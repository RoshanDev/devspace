import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mcpConfig = JSON.parse(
  readFileSync(new URL("../.cursor/mcp.json", import.meta.url), "utf8"),
) as {
  mcpServers?: Record<string, { command?: string; args?: string[] }>;
};
const browser = mcpConfig.mcpServers?.["devspace-chatgpt-web-browser"];
assert.ok(browser, "Cursor project config exposes the ChatGPT Web browser controller");
assert.equal(browser.command, "npx");
assert.deepEqual(browser.args, ["-y", "@playwright/mcp@0.0.78"]);

const rule = readFileSync(
  new URL("../.cursor/rules/devspace-chatgpt-web.mdc", import.meta.url),
  "utf8",
);
assert.match(rule, /GPT-5\.6 Sol/);
assert.match(rule, /Mode\/capability: Pro/);
assert.match(rule, /devspace-chatgpt-web-browser/);
assert.match(rule, /CURSOR_BROWSER_UNAVAILABLE/);
assert.match(rule, /workspace_info/);
assert.match(rule, /STATE: INIT/);
assert.match(rule, /STATE: EXECUTED/);
assert.doesNotMatch(rule, /document\.cookie|backend-api|session storage extraction/i);

const command = readFileSync(
  new URL("../.cursor/commands/chatgpt-web.md", import.meta.url),
  "utf8",
);
assert.match(command, /devspace-chatgpt-web/);
assert.match(command, /independent review until DONE/i);

const cli = readFileSync(new URL("./chatgpt-web-cli.ts", import.meta.url), "utf8");
assert.match(cli, /cursorIdeOrCliWithProjectPlaywrightMcp: true/);
assert.match(cli, /devspaceCursorAcpSubagent: false/);

console.log("Cursor ChatGPT Web integration assets validated");
