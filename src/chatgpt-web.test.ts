import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import {
  CHATGPT_WEB_REQUIRED_MODEL_LABEL,
  expandHome,
  workspaceArgs,
  isC2cDoctorReady,
  parseJsonOutput,
  resolveC2cCommand,
  runChatGptWebDoctor,
  type CommandRunner,
} from "./chatgpt-web.js";

const okResult = {
  status: 0,
  stdout: "",
  stderr: "",
  timedOut: false,
};

assert.equal(CHATGPT_WEB_REQUIRED_MODEL_LABEL, "GPT-5.6 Sol Pro");
assert.deepEqual(
  workspaceArgs("doctor", "/workspace", { json: true }),
  ["doctor", "--workspace", "/workspace", "--no-fix", "--json"],
);
assert.deepEqual(
  workspaceArgs("doctor", "/workspace", { json: true, fix: true }),
  ["doctor", "--workspace", "/workspace", "--json"],
);
assert.deepEqual(
  workspaceArgs("setup", "/workspace", { json: true }),
  ["setup", "--workspace", "/workspace", "--json"],
);
const testHome = resolve("test-home");
assert.equal(expandHome("~/code", testHome), resolve(testHome, "code"));

assert.deepEqual(parseJsonOutput('{"ok":true}'), { ok: true });
assert.deepEqual(
  parseJsonOutput('log line\n\u001b[32m{"ok":true,"value":2}\u001b[0m\n'),
  { ok: true, value: 2 },
);
assert.equal(parseJsonOutput("not json"), undefined);

const healthyDoctor = {
  report: {
    node: { ok: true },
    workspace: { ok: true },
    bridge: { ok: true },
    mcp: { ok: true },
  },
  chatgptRepair: { needed: false },
  namedRepair: { needed: false },
};
assert.equal(isC2cDoctorReady(healthyDoctor), true);
assert.equal(
  isC2cDoctorReady({
    ...healthyDoctor,
    report: { ...healthyDoctor.report, bridge: { ok: false } },
  }),
  false,
);
assert.equal(
  isC2cDoctorReady({
    ...healthyDoctor,
    chatgptRepair: { needed: true },
  }),
  false,
);
assert.equal(isC2cDoctorReady({ report: {} }), false);

{
  const calls: Array<{ executable: string; args: readonly string[] }> = [];
  const runner: CommandRunner = (executable, args) => {
    calls.push({ executable, args });
    return okResult;
  };
  const resolution = resolveC2cCommand({
    env: { DEVSPACE_C2C_COMMAND: "/custom tools/c2c" },
    runner,
  });
  assert.equal(resolution.command?.source, "command-override");
  assert.match(resolution.command?.display ?? "", /custom tools/);
  assert.deepEqual(calls[0]?.args, ["doctor", "--help"]);
  assert.equal(resolution.attempts.length, 1);
}

{
  const calls: Array<{ executable: string; args: readonly string[] }> = [];
  const runner: CommandRunner = (executable, args) => {
    calls.push({ executable, args });
    return okResult;
  };
  const homeDir = resolve("test-home");
  const checkoutScript = join(homeDir, "codex-with-chatgpt", "bin", "c2c.js");
  const nodePath = resolve("fake-node");
  const resolution = resolveC2cCommand({
    env: { DEVSPACE_C2C_CHECKOUT: "~/codex-with-chatgpt" },
    homeDir,
    nodePath,
    fileExists: (path) => path === checkoutScript,
    runner,
  });
  assert.equal(resolution.command?.source, "checkout-override");
  assert.equal(resolution.command?.executable, nodePath);
  assert.deepEqual(calls[0]?.args, [
    checkoutScript,
    "doctor",
    "--help",
  ]);
}

{
  const resolution = resolveC2cCommand({
    env: { DEVSPACE_C2C_CHECKOUT: "/missing/c2c" },
    nodePath: "/usr/bin/node",
    fileExists: () => false,
    runner: () => {
      throw new Error("runner must not be called for a missing explicit checkout");
    },
  });
  assert.equal(resolution.command, undefined);
  assert.equal(resolution.attempts.length, 1);
  assert.match(resolution.attempts[0]?.detail ?? "", /Missing/);
}

{
  const calls: Array<readonly string[]> = [];
  const runner: CommandRunner = (_executable, args) => {
    calls.push(args);
    if (args.at(-1) === "--help") return okResult;
    return {
      ...okResult,
      stdout: JSON.stringify(healthyDoctor),
    };
  };
  const workspaceRoot = resolve("workspace");
  const report = runChatGptWebDoctor({
    workspaceRoot,
    env: { DEVSPACE_C2C_COMMAND: "c2c" },
    runner,
  });
  assert.equal(report.ok, true);
  assert.equal(report.localReady, true);
  assert.equal(report.requiredModelLabel, "GPT-5.6 Sol Pro");
  assert.equal(report.modelVerification.verified, false);
  assert.equal(report.modelVerification.downgradeAllowed, false);
  assert.deepEqual(calls[1], [
    "doctor",
    "--workspace",
    workspaceRoot,
    "--no-fix",
    "--json",
  ]);
}

{
  const calls: Array<readonly string[]> = [];
  const runner: CommandRunner = (_executable, args) => {
    calls.push(args);
    if (args.at(-1) === "--help") return okResult;
    return { ...okResult, stdout: JSON.stringify(healthyDoctor) };
  };
  const workspaceRoot = resolve("workspace");
  const report = runChatGptWebDoctor({
    workspaceRoot,
    fix: true,
    env: { DEVSPACE_C2C_COMMAND: "c2c" },
    runner,
  });
  assert.equal(report.localReady, true);
  assert.deepEqual(calls[1], [
    "doctor",
    "--workspace",
    workspaceRoot,
    "--json",
  ]);
}

console.log("chatgpt web integration tests passed");
