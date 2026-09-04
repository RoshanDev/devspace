---
name: chatgpt-web
description: Prepare and use a C2C read-only workspace bridge from a ChatGPT desktop-app Codex session whose in-app browser can operate ChatGPT Web. Use for GPT-5.6 Sol Pro planning and independent review while local Codex remains the executor. Do not claim standalone Codex CLI, Cursor, or Grok can own the browser control plane.
---

# DevSpace ChatGPT Web planner/reviewer

Use ChatGPT Web as a separate planning and review brain. Local Codex remains the
executor: it edits files, runs commands and tests, handles Git, and repairs
failures. ChatGPT Web reads the workspace through the read-only Codex with
ChatGPT bridge.

## Supported controller

This workflow requires a **ChatGPT desktop-app Codex session** with access to the
app's in-app browser. The WSL shell may run `devspace` and `c2c`, but a standalone
`codex` process in Windows Terminal does not provide this skill with the browser
runtime used below.

This integration is not a `devspace-agentd` provider. Never run:

```bash
devspace agents run chatgpt-web ...
```

Do not claim direct support from Cursor or Grok. Their DevSpace adapters invoke
their own ACP runtimes; they do not control ChatGPT Web and do not select
GPT-5.6 Sol Pro.

## Security boundary

The browser-owning desktop session may operate the official ChatGPT webpage. A
background daemon must not obtain ChatGPT cookies, copy session tokens, attach
to an arbitrary external browser profile, or call undocumented ChatGPT web
endpoints.

Control messages contain task state only. ChatGPT reads files and diffs through
MCP; never paste repository bodies, diffs, logs, keys, cookies, pairing codes, or
long-lived tokens into the conversation.

## Hard requirements

1. The visible model-family control must show **`GPT-5.6 Sol`**.
2. The visible capability/reasoning control must show **`Pro`**.
3. Treat those two controls together as the effective model
   **`GPT-5.6 Sol Pro`**. Some UI versions may instead show one combined summary
   label; a normalized combined label of `GPT-5.6 Sol Pro` is equivalent.
4. Re-read the controls after selection. A prompt asking for Sol Pro is not
   proof that the correct model and mode are active.
5. Never silently use Medium, High, Extra High, Auto, Terra, Luna, or another
   fallback. `GPT-5.6 Sol` with `High` or `Extra High` is not Sol Pro. If either
   required control cannot be verified, stop with `MODEL_UNAVAILABLE`.
6. Never pass `gpt-5.6-sol-pro` or a similar invented identifier to Codex, an API,
   or `devspace agents`. Sol Pro is a ChatGPT Web model-plus-mode selection.
7. Do not describe a successful local doctor result as browser or model
   verification. The bridge gate and web-model gate are separate.

## Local readiness

Run from the target workspace:

```bash
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

Interpret the result precisely:

- `localReady: true`: local bridge and MCP checks are healthy.
- `modelVerification.verified: false`: expected before browser inspection.
- `requiredModelSelectorLabel`: must be `GPT-5.6 Sol`.
- `requiredModeLabel`: must be `Pro`.
- `effectiveModelLabel` or legacy `requiredModelLabel`: describes the combined
  effective model `GPT-5.6 Sol Pro`; it is not necessarily one DOM label.
- C2C status `tokenCount: 0`: ChatGPT has not completed connector OAuth.
- C2C status `pairingActive: true`: a pairing code is waiting or still valid.

If C2C is installed from source, prefer:

```bash
export DEVSPACE_C2C_CHECKOUT="$HOME/codex-with-chatgpt"
```

If the bridge has not been initialized:

```bash
devspace chatgpt-web setup --json
```

For a safe local repair:

```bash
devspace chatgpt-web doctor --fix --json
```

Inspect repair fields before changing a connector. Login, CAPTCHA, 2FA,
Cloudflare authorization, explicit consent, and model availability require the
user or browser-owning desktop session.

Other checks:

```bash
devspace chatgpt-web status --json
devspace chatgpt-web pair --json
```

When the separate `codex-with-chatgpt` skill is installed, read it and follow
its current connector, pairing, tunnel, Project, conversation-reuse, and recovery
rules. This skill adds the DevSpace command surface and Sol-plus-Pro gate; it
does not replace the C2C protocol.

## Complete first-time connector setup

A local `setup` result with an MCP URL and pairing code means only that the C2C
bridge is ready. Complete the remaining work in the ChatGPT desktop app:

1. Open Codex mode for the target local/WSL workspace.
2. Use one in-app-browser tab for ChatGPT configuration and the C2C conversation.
3. Enable the required ChatGPT connector/developer setting when C2C instructs it.
4. Add exactly one connector for this workspace using the current C2C MCP URL.
5. Complete OAuth and enter a fresh one-time pairing code.
6. Verify `workspace_info` names the expected workspace.
7. Confirm `devspace chatgpt-web status --json` reports a nonzero `tokenCount`.
8. Select model `GPT-5.6 Sol`, select mode `Pro`, and re-check both controls.

If the pairing code expired, generate a new one immediately before the OAuth
flow:

```bash
devspace chatgpt-web pair --json
```

Do not reuse a code copied into logs or a public conversation.

## In-app browser model gate

Before sending a task message:

1. Reuse one ChatGPT in-app-browser tab for this workspace and task.
2. Open or claim the saved C2C conversation or workspace ChatGPT Project.
3. Inspect the visible model-family control and select **`GPT-5.6 Sol`**.
4. Inspect the visible capability/reasoning control and select **`Pro`**.
5. Re-read both controls and require normalized visible text to equal
   `GPT-5.6 Sol` and `Pro` respectively.
6. If the current UI renders only one combined summary, accept it only when its
   normalized visible text is exactly `GPT-5.6 Sol Pro`.
7. Record only the boolean verification plus the model and mode labels in turn
   state. Never persist cookies, tokens, or page storage.

If either control is absent because the account or product surface cannot choose
it, do not infer the active mode from the account plan or an older conversation.
Stop with `MODEL_UNAVAILABLE`.

## Planning workflow

After local readiness, connector authorization, workspace validation, and the
model gate all succeed, send:

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
<user's goal>

INSTRUCTION:
Inspect the connected workspace through MCP. Return a finite implementation
plan for Codex. Do not modify files and do not ask for pasted code.
```

Accept only a substantive `STATE: PLAN`, `STATE: BLOCKED`, or `STATE: ERROR`
for the same task ID. The plan should identify relevant files or areas, bounded
changes, risks, tests, and success criteria.

Codex then executes locally. ChatGPT Web does not edit files or execute shell
commands.

## Review workflow

After Codex completes an iteration and records actual test results, send compact
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
<concise real result>

INSTRUCTION:
Independently inspect the current git diff and relevant files through MCP. Do
not trust this summary as evidence. Return PLAN for required fixes, DONE when
success criteria are met, or BLOCKED with a concrete reason.
```

When ChatGPT returns another `PLAN`, Codex applies the bounded fixes and sends a
new `EXECUTED` message. Reuse the same ChatGPT conversation until `DONE` or a
real blocker. A browser timeout is not permission to open duplicate tabs or
restart the task; reclaim the same tab and inspect the current response.

## Cursor and Grok coexistence

Cursor and Grok can be used as separate DevSpace subagents after their provider
targets are enabled and available:

```bash
devspace agents targets --json
devspace agents run cursor "<bounded task>" --json
devspace agents run grok "<bounded task>" --json
```

A desktop-app Codex session may coordinate those subagents after receiving a
Sol Pro plan, but the subagents do not inherit the ChatGPT Web conversation or
its model. State that distinction whenever reporting which model performed
which work.

## Session and failure rules

- Reuse the existing C2C workspace session and ChatGPT Project/conversation.
- Do not create a second connector for the same workspace.
- Run non-mutating doctor first after restart.
- Use `--fix` only after inspecting the JSON repair fields.
- If a temporary public address changed, follow C2C's connector repair flow.
- If model `GPT-5.6 Sol` or mode `Pro` disappears, stop before the next control
  message.
- Never claim terminal-only, Cursor-direct, or Grok-direct ChatGPT Web control.

## Completion report

Report separately:

- local bridge readiness;
- connector authorization (`tokenCount` evidence);
- model-family verification (`GPT-5.6 Sol`);
- mode verification (`Pro`);
- effective model (`GPT-5.6 Sol Pro`);
- planning result;
- executor/provider used for file changes;
- tests actually run and results;
- final independent review state.

Do not claim browser E2E verification unless both controls, or an equivalent
combined label, were inspected in the current ChatGPT desktop-app browser
session.
