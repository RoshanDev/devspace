---
name: chatgpt-web
description: Prepare and use a C2C read-only workspace bridge with a visible browser controller. ChatGPT desktop Codex uses its in-app browser; native Cursor IDE/CLI uses the project Playwright MCP rule. Use GPT-5.6 Sol with Pro for planning and independent review while the local coding agent remains the executor.
---

# DevSpace ChatGPT Web planner/reviewer

Use ChatGPT Web as a separate planning and review brain. The local coding agent
remains the executor: it edits files, runs commands and tests, handles Git, and
repairs failures. ChatGPT Web reads the workspace through the read-only Codex
with ChatGPT bridge.

## Supported controllers

Two visible browser controllers are supported by this branch:

1. A ChatGPT desktop-app Codex session using the app's in-app browser.
2. A native Cursor IDE or Cursor CLI session using the project MCP server
   `devspace-chatgpt-web-browser` and the project rule
   `.cursor/rules/devspace-chatgpt-web.mdc`.

The WSL shell may run `devspace` and `c2c`. Browser interaction must remain in a
visible controller owned by the active desktop/IDE session.

This integration is not a `devspace-agentd` provider. Never run:

```bash
devspace agents run chatgpt-web ...
```

`devspace agents run cursor` is also a different path: the DevSpace Cursor ACP
session currently receives an explicit empty `mcpServers` list and does not
inherit the native Cursor project browser MCP. Do not claim that ACP subagent
path can control ChatGPT Web in this version.

Grok likewise remains a separate provider and cannot directly control the
ChatGPT browser in this branch.

## Browser security boundary

For ChatGPT desktop Codex, use only the app's in-app browser. For native Cursor,
use only the Microsoft Playwright MCP tools exposed by
`devspace-chatgpt-web-browser`.

- Use one visible browser profile and one ChatGPT tab for a workspace task.
- Let the user complete login, CAPTCHA, 2FA, passkeys, and consent in the browser.
- Do not obtain ChatGPT cookies, copy session tokens, attach to an arbitrary
  personal browser profile, or call undocumented ChatGPT endpoints.
- In Cursor, do not use browser JavaScript evaluation, unsafe code execution, or
  network inspection to obtain authentication or model state. Use accessibility
  snapshots, normal clicks, typing, tabs, key presses, and bounded waits.
- Control messages contain task state only. Never paste repository bodies,
  diffs, logs, keys, passwords, cookies, pairing codes, or long-lived tokens into
  the coding-agent conversation.
- A pairing code may be typed only into the official C2C authorization page.

## Hard model requirements

1. The visible model-family control must show **`GPT-5.6 Sol`**.
2. The visible capability/reasoning control must show **`Pro`**.
3. Treat those two controls together as the effective model
   **`GPT-5.6 Sol Pro`**. A UI that shows one normalized combined label
   `GPT-5.6 Sol Pro` is equivalent.
4. Re-read the controls after selection. A prompt requesting Sol Pro is not
   proof that the correct model and mode are active.
5. Never silently use Medium, High, Extra High, Auto, Terra, Luna, or another
   fallback. `GPT-5.6 Sol` with `High` or `Extra High` is not Sol Pro.
6. If either required control cannot be verified, stop with
   `MODEL_UNAVAILABLE`.
7. Never pass `gpt-5.6-sol-pro` or a similar invented identifier to Codex, an
   API, Cursor's model selector, or `devspace agents`. Sol Pro here is a
   ChatGPT Web model-plus-mode selection.
8. A successful local doctor result is not browser or model verification. The
   bridge gate and web-model gate are separate.

## Local readiness

Run from the target workspace:

```bash
devspace chatgpt-web status --json
devspace chatgpt-web doctor --json
```

The command discovers Codex with ChatGPT in this order:

1. `DEVSPACE_C2C_COMMAND`, then `C2C_COMMAND`.
2. `DEVSPACE_C2C_CHECKOUT`, then `C2C_CHECKOUT`.
3. `c2c` on `PATH`.
4. `~/codex-with-chatgpt/bin/c2c.js`.
5. `~/.local/share/codex-with-chatgpt/bin/c2c.js`.

`devspace init` is not required for `chatgpt-web` commands. DevSpace server OAuth
is unrelated to the C2C bridge.

Interpret results precisely:

- `localReady: true`: local bridge, MCP, OAuth, and tunnel checks are healthy.
- `modelVerification.verified: false`: expected before visible browser
  inspection.
- `requiredModelSelectorLabel`: must be `GPT-5.6 Sol`.
- `requiredModeLabel`: must be `Pro`.
- `effectiveModelLabel` or legacy `requiredModelLabel`: describes the combined
  effective model `GPT-5.6 Sol Pro`; it is not necessarily one DOM label.
- C2C status `tokenCount: 0`: ChatGPT has not completed connector OAuth.
- C2C status `tokenCount > 0`: at least one connector has a C2C token; this does
  not prove the model selection.
- C2C status `pairingActive: true`: a pairing code is waiting or still valid.

If C2C is installed from source, prefer:

```bash
export DEVSPACE_C2C_CHECKOUT="$HOME/codex-with-chatgpt"
```

Run setup only when the bridge has never been initialized:

```bash
devspace chatgpt-web setup --json
```

For a bounded local repair:

```bash
devspace chatgpt-web doctor --fix --json
```

Inspect repair fields before changing a connector. Login, CAPTCHA, 2FA,
Cloudflare authorization, explicit consent, and model availability require the
user or visible browser controller.

## Reclaimed Quick Tunnel repair

Do not rerun setup or create a second connector merely because a temporary
Cloudflare address expired.

When `chatgptRepair.needed` is true with `reason: address_reclaimed`:

1. Run non-mutating doctor first.
2. Run `devspace chatgpt-web doctor --fix --json` once.
3. Require a non-null current `mcpUrl` before editing ChatGPT connectors.
4. Delete only the connector named by `chatgptRepair.connectorName`.
5. Recreate exactly one connector with the current `mcpUrl`; never reuse the old
   address and never modify another workspace's connector.
6. Generate a fresh code immediately before authorization when needed:

```bash
devspace chatgpt-web pair --json
```

7. Complete OAuth and one-time pairing in the visible browser.
8. Run status again and require `tokenCount > 0`.
9. Call `workspace_info` through the connector and require the expected
   workspace identity.

Use direct ChatGPT settings URLs returned by C2C rather than hunting through
menus.

## Controller-specific startup

### ChatGPT desktop Codex

Install the C2C and DevSpace skills under `~/.codex/skills`, correct the C2C
checkout path, then start a fresh desktop Codex session so skills are
rediscovered. Reuse one in-app-browser tab.

### Native Cursor IDE or CLI

The repository supplies:

```text
.cursor/mcp.json
.cursor/rules/devspace-chatgpt-web.mdc
.cursor/commands/chatgpt-web.md
```

After pulling those files, reload Cursor and enable the project MCP server
`devspace-chatgpt-web-browser`. Cursor may require approval before launching the
server. Its headed Playwright browser uses a project-specific persistent profile,
so the first use may require a one-time ChatGPT login.

Start the workflow with:

```text
/chatgpt-web
```

or explicitly request the `devspace-chatgpt-web` project rule.

If the Playwright browser tools are unavailable, stop with
`CURSOR_BROWSER_UNAVAILABLE`; do not fall back to a personal Chrome profile or
pretend the browser step completed.

## Workspace identity gate

Before planning, make ChatGPT call `workspace_info` through the current C2C
connector. Require the workspace name/root to match the current Git workspace.
If it does not match, stop with `WORKSPACE_MISMATCH` and do not use that chat's
memory.

Use one connector per workspace. Reuse the existing ChatGPT Project or saved
conversation when C2C state identifies one. Do not create a duplicate connector
or reuse another workspace's conversation just because it is open.

## Visible model gate

Before each new or reclaimed ChatGPT conversation:

1. Reuse the current workspace browser tab.
2. Open or claim the saved C2C conversation or workspace ChatGPT Project.
3. Inspect the model-family control and select **`GPT-5.6 Sol`**.
4. Inspect the mode/capability control and select **`Pro`**.
5. Re-read both controls and require those exact normalized visible values.
6. If the UI renders one combined summary, accept it only when its normalized
   text is exactly `GPT-5.6 Sol Pro`.
7. Record only the verification boolean plus the visible model and mode labels.
   Never persist cookies, tokens, or browser storage.

If either control is absent, do not infer the mode from the account plan or an
older conversation. Stop with `MODEL_UNAVAILABLE`.

## New conversation bootstrap

On a new ChatGPT conversation, send this once after connector, workspace, and
model gates pass. Substitute the active executor name (`Codex` or `Cursor`):

```text
You are the planning and review layer of a local coding session.

The local coding agent owns execution: editing, terminal commands, tests, Git,
and recovery. You own high-level reasoning, planning, and independent review.

Use only the C2C connector for this workspace. Read files, Git status, diffs,
and released test evidence through its tools. Never ask for pasted code, diffs,
logs, credentials, or tokens.

Return compact structured C2C control messages. After EXECUTED, independently
inspect the real workspace and current diff. Reply PLAN for required fixes,
DONE when success criteria are met, or BLOCKED with a concrete reason.
```

## Planning workflow

Send state, not repository content:

```text
[C2C]
STATE: INIT
TASK_ID: <stable task id>
ITERATION: 0
MODEL_SELECTOR_REQUIRED: GPT-5.6 Sol
MODE_REQUIRED: Pro
EFFECTIVE_MODEL: GPT-5.6 Sol Pro
MODEL_VERIFIED: true

GOAL:
<user goal>

INSTRUCTION:
Inspect the connected workspace through C2C. Return a finite implementation
plan for the local coding agent. Do not modify files and do not ask for pasted
code.
```

Accept only a substantive `STATE: PLAN`, `STATE: BLOCKED`, or `STATE: ERROR`
for the same task ID. A PLAN should identify relevant files or areas, bounded
changes, risks, tests, and success criteria.

The local coding agent then executes. ChatGPT Web must not edit files or run
local commands through C2C.

## Independent review workflow

After one implementation iteration and the actual test run, send compact
metadata only:

```text
[C2C]
STATE: EXECUTED
TASK_ID: <same task id>
ITERATION: <n>
MODEL_SELECTOR_REQUIRED: GPT-5.6 Sol
MODE_REQUIRED: Pro
EFFECTIVE_MODEL: GPT-5.6 Sol Pro
MODEL_VERIFIED: true

RESULT:
Execution finished.

CHANGED_FILES:
<count>

TESTS:
<concise actual result>

INSTRUCTION:
Independently inspect the current git diff, relevant files, and released test
evidence through C2C. Do not trust this summary as proof. Return PLAN for
required fixes, DONE when success criteria are met, or BLOCKED with a concrete
reason.
```

When ChatGPT returns PLAN, apply only the bounded required fixes, rerun relevant
tests, and send another EXECUTED message in the same browser conversation.
Continue until DONE or a genuine blocker.

Use one cheap snapshot or bounded wait every 20–30 seconds while ChatGPT is
still generating. A timeout is not permission to resend, create another tab, or
start another conversation.

## Separate Cursor ACP and Grok providers

These remain valid independent DevSpace subagents:

```bash
devspace agents targets --json
devspace agents run cursor "<bounded task>" --json
devspace agents run grok "<bounded task>" --json
```

They use their own model/provider sessions. In this branch they do not inherit
the native Cursor browser MCP and do not consume ChatGPT Web Sol Pro quota.
State which model performed planning/review and which executor changed files.

## Completion report

Report separately:

- local bridge and tunnel readiness;
- connector authorization (`tokenCount` evidence);
- `workspace_info` identity;
- model-family verification (`GPT-5.6 Sol`);
- mode verification (`Pro`);
- effective model (`GPT-5.6 Sol Pro`);
- planning result;
- executor used for file changes;
- tests actually run and results;
- final independent review state.

Do not claim browser E2E verification unless both visible controls, or an
exactly equivalent combined label, were inspected in the current visible
browser session.
