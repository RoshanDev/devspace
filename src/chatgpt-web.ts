import { createRequire } from "node:module";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const CHATGPT_WEB_REQUIRED_MODEL_LABEL = "GPT-5.6 Sol Pro";

const require = createRequire(import.meta.url);
const crossSpawn = require("cross-spawn") as {
  sync: typeof import("node:child_process").spawnSync;
};
const PROBE_TIMEOUT_MS = 5_000;
const COMMAND_TIMEOUT_MS = 120_000;
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;

export type C2cCommandSource =
  | "command-override"
  | "checkout-override"
  | "path"
  | "default-checkout";

export interface C2cCommand {
  executable: string;
  prefixArgs: string[];
  source: C2cCommandSource;
  display: string;
}

export interface C2cAttempt {
  source: C2cCommandSource;
  display: string;
  ok: boolean;
  detail?: string;
}

export interface ProcessResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut: boolean;
}

export type CommandRunner = (
  executable: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    maxBufferBytes: number;
  },
) => ProcessResult;

export interface C2cOptions {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  nodePath?: string;
  fileExists?: (path: string) => boolean;
  runner?: CommandRunner;
}

export interface C2cResolution {
  command?: C2cCommand;
  attempts: C2cAttempt[];
}

export interface C2cRunResult {
  resolution: C2cResolution;
  process?: ProcessResult;
  parsed?: unknown;
}

export interface ChatGptWebDoctorReport {
  ok: boolean;
  localReady: boolean;
  workspaceRoot: string;
  requiredModelLabel: typeof CHATGPT_WEB_REQUIRED_MODEL_LABEL;
  modelVerification: {
    verified: false;
    mechanism: "codex-in-app-browser";
    downgradeAllowed: false;
    detail: string;
  };
  c2c: {
    available: boolean;
    source?: C2cCommandSource;
    command?: string;
    attempts: C2cAttempt[];
  };
  doctor?: unknown;
  process?: { status: number | null; stderr?: string };
  error?: string;
}

export function resolveC2cCommand(options: C2cOptions = {}): C2cResolution {
  const env = options.env ?? process.env;
  const home = options.homeDir ?? homedir();
  const node = options.nodePath ?? process.execPath;
  const exists = options.fileExists ?? existsSync;
  const runner = options.runner ?? runProcess;
  const attempts: C2cAttempt[] = [];

  const commandOverride = first(env.DEVSPACE_C2C_COMMAND, env.C2C_COMMAND);
  if (commandOverride) {
    return probe([command(expandHome(commandOverride, home), [], "command-override")]);
  }

  const checkoutOverride = first(env.DEVSPACE_C2C_CHECKOUT, env.C2C_CHECKOUT);
  if (checkoutOverride) {
    const candidate = checkoutCommand(
      expandHome(checkoutOverride, home),
      node,
      "checkout-override",
      exists,
    );
    if (!candidate) {
      const script = resolve(expandHome(checkoutOverride, home), "bin", "c2c.js");
      attempts.push({
        source: "checkout-override",
        display: displayCommand(node, [script]),
        ok: false,
        detail: `Missing ${script}.`,
      });
      return { attempts };
    }
    return probe([candidate]);
  }

  const candidates = [command("c2c", [], "path")];
  for (const checkout of [
    join(home, "codex-with-chatgpt"),
    join(home, ".local", "share", "codex-with-chatgpt"),
  ]) {
    const candidate = checkoutCommand(checkout, node, "default-checkout", exists);
    if (candidate) candidates.push(candidate);
  }
  return probe(candidates);

  function probe(candidatesToTry: C2cCommand[]): C2cResolution {
    for (const candidate of candidatesToTry) {
      const result = runner(
        candidate.executable,
        [...candidate.prefixArgs, "doctor", "--help"],
        {
          env: mergedEnv(env),
          timeoutMs: PROBE_TIMEOUT_MS,
          maxBufferBytes: 1024 * 1024,
        },
      );
      const ok = !result.error && result.status === 0;
      attempts.push({
        source: candidate.source,
        display: candidate.display,
        ok,
        ...(!ok
          ? {
              detail: truncate(
                result.error
                  ?? first(result.stderr, result.stdout)
                  ?? `Exited with status ${String(result.status)}.`,
                1_000,
              ),
            }
          : {}),
      });
      if (ok) return { command: candidate, attempts };
    }
    return { attempts };
  }
}

export function runC2cWorkspaceCommand(
  subcommand: "setup" | "status" | "pair",
  workspaceRoot: string,
  options: C2cOptions & { json?: boolean; timeoutMs?: number } = {},
): C2cRunResult {
  const resolution = resolveC2cCommand(options);
  if (!resolution.command) return { resolution };
  const root = canonical(workspaceRoot);
  const processResult = invoke(
    resolution.command,
    workspaceArgs(subcommand, root, { json: options.json }),
    root,
    options,
    options.timeoutMs,
  );
  return {
    resolution,
    process: processResult,
    ...(options.json ? { parsed: parseJsonOutput(processResult.stdout) } : {}),
  };
}

export function runChatGptWebDoctor(
  options: C2cOptions & {
    workspaceRoot: string;
    fix?: boolean;
    timeoutMs?: number;
  },
): ChatGptWebDoctorReport {
  const root = canonical(options.workspaceRoot);
  const resolution = resolveC2cCommand(options);
  const modelVerification = {
    verified: false as const,
    mechanism: "codex-in-app-browser" as const,
    downgradeAllowed: false as const,
    detail: `The outer Codex session must select and confirm the exact visible label ${JSON.stringify(CHATGPT_WEB_REQUIRED_MODEL_LABEL)}.`,
  };

  if (!resolution.command) {
    return {
      ok: false,
      localReady: false,
      workspaceRoot: root,
      requiredModelLabel: CHATGPT_WEB_REQUIRED_MODEL_LABEL,
      modelVerification,
      c2c: { available: false, attempts: resolution.attempts },
      error: "Codex with ChatGPT was not found. Install c2c or set DEVSPACE_C2C_COMMAND/DEVSPACE_C2C_CHECKOUT.",
    };
  }

  const processResult = invoke(
    resolution.command,
    workspaceArgs("doctor", root, { json: true, fix: options.fix }),
    root,
    options,
    options.timeoutMs,
  );
  const doctor = parseJsonOutput(processResult.stdout);
  const error = processResult.error
    ?? (doctor === undefined ? "c2c doctor did not return machine-readable JSON." : undefined);

  return {
    ok: error === undefined,
    localReady: doctor !== undefined && isC2cDoctorReady(doctor),
    workspaceRoot: root,
    requiredModelLabel: CHATGPT_WEB_REQUIRED_MODEL_LABEL,
    modelVerification,
    c2c: {
      available: true,
      source: resolution.command.source,
      command: resolution.command.display,
      attempts: resolution.attempts,
    },
    ...(doctor === undefined ? {} : { doctor }),
    process: {
      status: processResult.status,
      ...(processResult.stderr.trim()
        ? { stderr: truncate(processResult.stderr.trim(), 4_000) }
        : {}),
    },
    ...(error ? { error } : {}),
  };
}

export function workspaceArgs(
  subcommand: "doctor" | "setup" | "status" | "pair",
  workspaceRoot: string,
  options: { json?: boolean; fix?: boolean } = {},
): string[] {
  return [
    subcommand,
    "--workspace",
    workspaceRoot,
    ...(subcommand === "doctor" && !options.fix ? ["--no-fix"] : []),
    ...(options.json ? ["--json"] : []),
  ];
}

export function parseJsonOutput(output: string): unknown | undefined {
  const text = output
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "")
    .trim();
  if (!text) return undefined;

  for (const candidate of [
    text,
    ...text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).reverse(),
  ]) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try another candidate.
    }
  }
  return undefined;
}

export function isC2cDoctorReady(value: unknown): boolean {
  const root = record(value);
  const report = record(root?.report);
  if (!report || Object.keys(report).length === 0) return false;
  if (Object.values(report).some((check) => record(check)?.ok !== true)) return false;
  return record(root?.chatgptRepair)?.needed !== true
    && record(root?.namedRepair)?.needed !== true;
}

export function expandHome(value: string, home = homedir()): string {
  const trimmed = value.trim();
  if (trimmed === "~") return home;
  if (trimmed.startsWith("~/") || trimmed.startsWith("~\\")) {
    return resolve(home, trimmed.slice(2));
  }
  return trimmed;
}

function invoke(
  commandToRun: C2cCommand,
  args: string[],
  cwd: string,
  options: C2cOptions,
  timeoutMs = COMMAND_TIMEOUT_MS,
): ProcessResult {
  return (options.runner ?? runProcess)(
    commandToRun.executable,
    [...commandToRun.prefixArgs, ...args],
    {
      cwd,
      env: mergedEnv(options.env),
      timeoutMs,
      maxBufferBytes: MAX_BUFFER_BYTES,
    },
  );
}

function command(
  executable: string,
  prefixArgs: string[],
  source: C2cCommandSource,
): C2cCommand {
  const normalizedExecutable = pathLike(executable) ? canonical(executable) : executable;
  const normalizedArgs = prefixArgs.map((value) => pathLike(value) ? canonical(value) : value);
  return {
    executable: normalizedExecutable,
    prefixArgs: normalizedArgs,
    source,
    display: displayCommand(normalizedExecutable, normalizedArgs),
  };
}

function checkoutCommand(
  checkout: string,
  node: string,
  source: "checkout-override" | "default-checkout",
  exists: (path: string) => boolean,
): C2cCommand | undefined {
  const script = resolve(checkout, "bin", "c2c.js");
  return exists(script) ? command(node, [script], source) : undefined;
}

function runProcess(
  executable: string,
  args: readonly string[],
  options: {
    cwd?: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    maxBufferBytes: number;
  },
): ProcessResult {
  const result = crossSpawn.sync(executable, [...args], {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeoutMs,
    maxBuffer: options.maxBufferBytes,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const error = result.error instanceof Error ? result.error.message : undefined;
  const code = result.error && "code" in result.error
    ? String((result.error as NodeJS.ErrnoException).code ?? "")
    : "";
  return {
    status: result.status,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    ...(error ? { error } : {}),
    timedOut: code === "ETIMEDOUT",
  };
}

function mergedEnv(env: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  return env ? { ...process.env, ...env } : process.env;
}

function canonical(value: string): string {
  const absolute = resolve(value);
  try {
    return realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

function displayCommand(executable: string, args: string[]): string {
  return [executable, ...args].map((value) => (
    /[\s"']/u.test(value) ? JSON.stringify(value) : value
  )).join(" ");
}

function pathLike(value: string): boolean {
  return value.includes("/") || value.includes("\\");
}

function first(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find(Boolean);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}
