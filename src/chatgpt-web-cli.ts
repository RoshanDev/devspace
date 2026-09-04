#!/usr/bin/env node
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { resolveCliWorkspaceContext } from "./cli-workspace.js";
import {
  CHATGPT_WEB_REQUIRED_MODEL_LABEL,
  expandHome,
  runC2cWorkspaceCommand,
  runChatGptWebDoctor,
  type C2cResolution,
  type C2cRunResult,
  type ChatGptWebDoctorReport,
} from "./chatgpt-web.js";

type ChatGptWebCommand = "doctor" | "setup" | "status" | "pair" | "help";

interface ParsedOptions {
  json: boolean;
  fix: boolean;
  workspace?: string;
}

function main(argv: string[]): void {
  const [rawCommand, ...rest] = argv;
  const command = normalizeCommand(rawCommand);
  if (command === "help") {
    printHelp();
    return;
  }

  const options = parseOptions(rest, command);
  const config = loadConfig();
  const workspaceRoot = options.workspace
    ? resolve(expandHome(options.workspace))
    : resolveCliWorkspaceContext(config.allowedRoots).workspaceRoot;

  if (command === "doctor") {
    const report = runChatGptWebDoctor({
      workspaceRoot,
      fix: options.fix,
    });
    presentDoctor(report, options.json);
    if (!report.ok || !report.localReady) process.exitCode = 1;
    return;
  }

  const result = runC2cWorkspaceCommand(command, workspaceRoot, {
    json: options.json,
    timeoutMs: command === "setup" ? 180_000 : 120_000,
  });
  presentWorkspaceCommand(command, workspaceRoot, result, options.json);
}

function normalizeCommand(value: string | undefined): ChatGptWebCommand {
  if (!value || value === "help" || value === "--help" || value === "-h") return "help";
  if (value === "doctor" || value === "setup" || value === "status" || value === "pair") {
    return value;
  }
  throw new Error(`Unknown chatgpt-web command: ${value}`);
}

function parseOptions(args: string[], command: ChatGptWebCommand): ParsedOptions {
  const parsed: ParsedOptions = {
    json: false,
    fix: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") {
      parsed.json = true;
      continue;
    }
    if (argument === "--fix") {
      if (command !== "doctor") throw new Error("--fix is supported only by chatgpt-web doctor.");
      parsed.fix = true;
      continue;
    }
    if (argument === "--no-fix") {
      if (command !== "doctor") throw new Error("--no-fix is supported only by chatgpt-web doctor.");
      parsed.fix = false;
      continue;
    }
    if (argument === "-w" || argument === "--workspace") {
      const workspace = args[index + 1]?.trim();
      if (!workspace) throw new Error(`Missing value for ${argument}.`);
      parsed.workspace = workspace;
      index += 1;
      continue;
    }
    if (argument?.startsWith("--workspace=")) {
      const workspace = argument.slice("--workspace=".length).trim();
      if (!workspace) throw new Error("Missing value for --workspace.");
      parsed.workspace = workspace;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  return parsed;
}

function presentDoctor(report: ChatGptWebDoctorReport, json: boolean): void {
  if (json) {
    printJson(report);
    return;
  }

  console.log("DevSpace ChatGPT Web planner/reviewer");
  console.log("");
  console.log(`${report.c2c.available ? "✓" : "✗"} Codex with ChatGPT: ${
    report.c2c.command ?? "not found"
  }`);
  console.log(`${report.localReady ? "✓" : "✗"} Local planner/reviewer bridge: ${
    report.localReady ? "ready" : "not ready"
  }`);
  console.log(`· Required ChatGPT Web model: ${report.requiredModelLabel}`);
  console.log("· Model verification: exact visible label must be confirmed in the Codex in-app browser");
  console.log("· Automatic downgrade: disabled");

  if (report.error) {
    console.log("");
    console.error(report.error);
  }
  if (report.doctor !== undefined) {
    console.log("");
    console.log(JSON.stringify(report.doctor, null, 2));
  }
}

function presentWorkspaceCommand(
  command: "setup" | "status" | "pair",
  workspaceRoot: string,
  result: C2cRunResult,
  json: boolean,
): void {
  const invocation = result.process;
  const ok = Boolean(invocation && !invocation.error && invocation.status === 0);

  if (json) {
    printJson({
      ok,
      command,
      workspaceRoot,
      requiredModelLabel: CHATGPT_WEB_REQUIRED_MODEL_LABEL,
      modelVerification: {
        verified: false,
        mechanism: "codex-in-app-browser",
        downgradeAllowed: false,
      },
      c2c: resolutionOutput(result.resolution),
      ...(result.parsed === undefined ? {} : { result: result.parsed }),
      ...(invocation
        ? {
            process: {
              status: invocation.status,
              ...(invocation.error ? { error: invocation.error } : {}),
              ...(invocation.stderr.trim() ? { stderr: invocation.stderr.trim() } : {}),
              ...(result.parsed === undefined && invocation.stdout.trim()
                ? { stdout: invocation.stdout.trim() }
                : {}),
            },
          }
        : {}),
    });
  } else if (!result.resolution.command) {
    console.error(
      "Codex with ChatGPT was not found. Install c2c, set DEVSPACE_C2C_COMMAND, or set DEVSPACE_C2C_CHECKOUT.",
    );
  } else if (invocation) {
    if (invocation.stdout) process.stdout.write(invocation.stdout);
    if (invocation.stderr) process.stderr.write(invocation.stderr);
    if (!invocation.stdout.trim() && result.parsed !== undefined) {
      console.log(JSON.stringify(result.parsed, null, 2));
    }
  }

  if (!ok) process.exitCode = 1;
}

function resolutionOutput(resolution: C2cResolution): Record<string, unknown> {
  return {
    available: Boolean(resolution.command),
    ...(resolution.command
      ? {
          source: resolution.command.source,
          command: resolution.command.display,
        }
      : {}),
    attempts: resolution.attempts,
  };
}

function printHelp(): void {
  console.log([
    "DevSpace ChatGPT Web planner/reviewer",
    "",
    "Use ChatGPT Web from an outer Codex CLI session for planning and review.",
    `The required model label is exactly: ${CHATGPT_WEB_REQUIRED_MODEL_LABEL}`,
    "",
    "Usage:",
    "  devspace chatgpt-web doctor [--fix] [--json] [-w <workspace>]",
    "  devspace chatgpt-web setup [--json] [-w <workspace>]",
    "  devspace chatgpt-web status [--json] [-w <workspace>]",
    "  devspace chatgpt-web pair [--json] [-w <workspace>]",
    "",
    "Discovery:",
    "  DEVSPACE_C2C_COMMAND (or C2C_COMMAND) points to a c2c executable.",
    "  DEVSPACE_C2C_CHECKOUT (or C2C_CHECKOUT) points to a codex-with-chatgpt checkout.",
    "  Otherwise DevSpace tries c2c on PATH and ~/codex-with-chatgpt.",
    "",
    "This command prepares the local bridge. The outer Codex session must use its",
    "in-app browser to select and confirm the exact ChatGPT Web model label.",
    "It never treats a Codex/API model identifier as proof of Sol Pro and never downgrades.",
  ].join("\n"));
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value));
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
