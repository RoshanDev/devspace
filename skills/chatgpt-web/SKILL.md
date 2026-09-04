---
name: chatgpt-web
description: Use ChatGPT Web with the exact GPT-5.6 Sol Pro model as a planning and review layer for a Codex CLI coding session. Use when the user asks Codex in Windows Terminal, WSL, Git Bash, or another terminal to plan or review through ChatGPT Web while Codex keeps execution ownership.
---

# DevSpace ChatGPT Web planner/reviewer

Use ChatGPT Web as a separate planning and review brain. Codex remains the
executor: it edits files, runs commands and tests, handles Git, and repairs
failures. ChatGPT Web reads the workspace through the read-only Codex with
ChatGPT bridge.

## Architecture boundary

This integration is intentionally a Codex skill plus a local bridge adapter. It
is **not** a `devspace-agentd` provider. Do not run:

```bash
devspace agents run chatgpt-web ...
```

A background provider daemon does not own Codex's in-app browser and must not
obtain ChatGPT cookies or call private web endpoints. The outer Codex session
owns browser interaction; DevSpace discovers and validates the local `c2c`
bridge.

## Hard requirements

1. The ChatGPT Web model selector must display and select the exact visible
   label **`GPT-5.6 Sol Pro`**.
2. Confirm the exact label after selection. A request in the prompt is not
   proof that the correct model is active.
3. Never silently use Sol, Terra, Luna, Auto, or another fallback. If the exact
   label is unavailable, stop with a clear `MODEL_UNAVAILABLE` result.
4. Never pass `gpt-5.6-sol-pro` or a similar invented identifier to Codex, an
   API, or `devspace agents`. Sol Pro is verified only in ChatGPT Web.
5. Use only Codex's in-app browser for ChatGPT interaction. Do not automate a
   user's Chrome or Edge profile, read browser cookies, copy session tokens, or
   call undocumented ChatGPT web APIs.
6. Control messages contain task state only. ChatGPT reads files and diffs
   through MCP; do not paste repository bodies, diffs, logs, keys, or tokens
   into the chat.

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

`localReady: true` means the local bridge, workspace and connection checks are
green. `modelVerification.verified` deliberately remains `false`: the model
label can be verified only in the in-app browser.

If C2C is installed from source, prefer:

```bash
export DEVSPACE_C2C_CHECKOUT="$HOME/codex-with-chatgpt"
```

On Windows PowerShell, set the equivalent process or user environment variable.
Paths containing spaces are supported; do not embed command-line arguments in
`DEVSPACE_C2C_COMMAND`.

If the bridge has not been initialized:

```bash
devspace chatgpt-web setup --json
```

If repair is safe and no user login, CAPTCHA, 2FA, consent, or Cloudflare action
is pending:

```bash
devspace chatgpt-web doctor --fix --json
```

Other useful checks:

```bash
devspace chatgpt-web status --json
devspace chatgpt-web pair --json
```

When the separate `codex-with-chatgpt` skill exists, read it and follow its
current connector, pairing, tunnel, Project, conversation-reuse and recovery
rules. This skill adds the DevSpace command surface and the exact Sol Pro model
gate; it does not weaken C2C's security or session rules.

## In-app browser model gate

Before sending a task message:

1. Reuse one ChatGPT in-app-browser tab. Do not create parallel ChatGPT tabs for
   the same DevSpace agent turn.
2. Open or claim the saved C2C conversation or the workspace's ChatGPT Project.
3. Inspect the visible model selector.
4. Select **`GPT-5.6 Sol Pro`**.
5. Re-read the selector and confirm that its normalized visible text is exactly
   `GPT-5.6 Sol Pro`.
6. Record only the boolean verification and label in the local turn state. Do
   not record cookies, tokens or page storage.

If the selector is absent because the account, workspace or product surface
cannot choose models, do not infer the active model from previous chats. Stop
and report that exact-model verification was impossible.

## Planning workflow

After local readiness and the model gate succeed, send a compact control
message:

```text
[C2C]
STATE: INIT
TASK_ID: <stable task id>
ITERATION: 0
MODEL_REQUIRED: GPT-5.6 Sol Pro
MODEL_VERIFIED: true

GOAL:
<user's goal>

INSTRUCTION:
Inspect the connected workspace through MCP. Return a finite implementation
plan for Codex. Do not modify files and do not ask for pasted code.
```

Accept only a substantive `STATE: PLAN`, `STATE: BLOCKED`, or `STATE: ERROR`
reply for the same task ID. A plan should identify the relevant files or areas,
what should change, risks, tests, and success criteria without becoming a long
speculative epic.

Codex then executes the plan locally. ChatGPT Web does not execute shell
commands or edit files.

## Review workflow

After Codex finishes one implementation iteration and records the real test
result, send metadata only:

```text
[C2C]
STATE: EXECUTED
TASK_ID: <same task id>
ITERATION: <n>
MODEL_REQUIRED: GPT-5.6 Sol Pro
MODEL_VERIFIED: true

RESULT:
Execution finished.

CHANGED_FILES:
<count>

TESTS:
<concise result>

INSTRUCTION:
Independently inspect the current git diff and relevant files through MCP. Do
not trust this summary as evidence. Return PLAN for required fixes, DONE when
success criteria are met, or BLOCKED with a concrete reason.
```

When ChatGPT returns another `PLAN`, Codex applies the bounded fixes and sends a
new `EXECUTED` message. Continue in the same ChatGPT conversation until `DONE`
or a genuine blocker is reached. Do not restart the whole task merely because a
browser wait timed out; reclaim the same tab and inspect the current response.

## Session and failure rules

- Reuse the existing C2C workspace session and ChatGPT Project/conversation.
- Do not create a second connector for the same workspace.
- Run the non-mutating doctor first when recovering after a restart.
- Use `--fix` only after inspecting the JSON repair fields.
- User interaction is required for login, CAPTCHA, 2FA, explicit consent, and
  account-level model availability.
- If the public address changed, follow C2C's connector repair flow rather than
  pretending the old endpoint is healthy.
- If the exact model label disappears during a continued turn, stop before
  sending the next control message and report `MODEL_UNAVAILABLE`.
- Never describe a successful local doctor result as proof that Sol Pro was
  selected. Local bridge readiness and web-model verification are separate
  gates.

## Completion report

State separately:

- local bridge readiness;
- exact model label verification;
- planning result;
- files changed by Codex;
- tests actually run and their result;
- final independent review state.

Do not claim browser E2E verification unless the exact selector was inspected
in the current ChatGPT Web session.
