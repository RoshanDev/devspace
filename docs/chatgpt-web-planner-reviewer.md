# ChatGPT Web planner/reviewer bridge

This feature prepares a read-only `codex-with-chatgpt` (C2C) bridge so ChatGPT
Web can inspect a local workspace for planning and independent review.

## Current support boundary

The current implementation is **not a terminal-only ChatGPT Web client**.

The browser control required to open ChatGPT, configure the connector, select a
web model, send C2C messages, and read replies is available in the ChatGPT
desktop app's Codex/Work experience. A standalone `codex` process in Windows
Terminal, WSL, or an IDE terminal does not expose that in-app-browser runtime to
this integration.

Supported today:

```text
ChatGPT desktop app (Codex session)
        |-- in-app browser --> ChatGPT Web / GPT-5.6 Sol Pro
        |
        `-- WSL shell ------> devspace chatgpt-web --> C2C bridge
                                                     |
                                                     `--> read-only workspace MCP
```

Not supported today:

- standalone Codex CLI as the browser/control-plane owner;
- direct Cursor-agent control of ChatGPT Web;
- direct Grok-agent control of ChatGPT Web;
- a `devspace-agentd` provider named `chatgpt-web`.

Cursor and Grok remain valid DevSpace local subagent providers, but invoking
those providers uses their own ACP runtimes. It does not consume ChatGPT Web
quota or select GPT-5.6 Sol Pro.

## Why this is not a daemon provider

DevSpace local providers run under `devspace-agentd`. That daemon can invoke
provider SDKs and local agent protocols, but it does not own a logged-in browser
surface. Giving it ChatGPT cookies, scraping session tokens, or calling private
ChatGPT endpoints would cross the intended security boundary.

A future terminal-native implementation needs a separate, user-visible browser
controller with an explicit local IPC contract. Until that exists, do not claim
that `devspace chatgpt-web` alone can conduct a complete Web conversation.

## What the current commands do

Run them from the project ChatGPT should inspect:

```bash
devspace chatgpt-web doctor --json
devspace chatgpt-web doctor --fix --json
devspace chatgpt-web setup --json
devspace chatgpt-web status --json
devspace chatgpt-web pair --json
```

They discover C2C, validate or start its local bridge, establish a tunnel, and
produce connector/pairing information. They do **not** operate the ChatGPT page.

`devspace init` is not required for these commands. The C2C bridge has its own
state and authorization. DevSpace server OAuth is unrelated.

Important fields:

- `localReady: true`: the local C2C bridge and MCP endpoint are healthy.
- `result.tokenCount: 0`: ChatGPT has not completed connector OAuth yet.
- `result.pairingActive: true`: a one-time pairing code is waiting or remains
  valid.
- `modelVerification.verified: false`: no browser has verified the selected web
  model.
- `requiredModelLabel`: the visible selector must be exactly
  `GPT-5.6 Sol Pro`; no automatic downgrade is permitted.

## C2C discovery

DevSpace uses the first working source in this order:

1. `DEVSPACE_C2C_COMMAND`.
2. `C2C_COMMAND`.
3. `DEVSPACE_C2C_CHECKOUT`.
4. `C2C_CHECKOUT`.
5. `c2c` on `PATH`.
6. `~/codex-with-chatgpt/bin/c2c.js`.
7. `~/.local/share/codex-with-chatgpt/bin/c2c.js`.

A command override is one executable path. For a source checkout, especially a
path containing spaces, use `DEVSPACE_C2C_CHECKOUT`.

## Complete the one-time ChatGPT connection

Install both skills into the Codex environment used by the ChatGPT desktop app:

```bash
mkdir -p "$HOME/.codex/skills/codex-with-chatgpt"
cp "$HOME/codex-with-chatgpt/skill/SKILL.md" \
  "$HOME/.codex/skills/codex-with-chatgpt/SKILL.md"

mkdir -p "$HOME/.codex/skills/devspace-chatgpt-web"
cp "skills/chatgpt-web/SKILL.md" \
  "$HOME/.codex/skills/devspace-chatgpt-web/SKILL.md"
```

Update the installed C2C skill's checkout placeholder to the actual checkout
path, then restart the Codex desktop session so skills are rediscovered.

In the ChatGPT desktop app, open the target WSL project in Codex mode and ask it
to complete the C2C connector setup. The app's in-app browser performs the
ChatGPT login, connector creation, OAuth approval, pairing, and exact model-label
check. User interaction may still be required for login, CAPTCHA, 2FA, and
consent.

Generate a fresh pairing code immediately before authorization if the previous
one expired:

```bash
devspace chatgpt-web pair --json
```

After authorization:

```bash
devspace chatgpt-web status --json
```

A nonzero `tokenCount` proves that a connector obtained a C2C token. It does not
by itself prove that GPT-5.6 Sol Pro is selected; verify the exact visible model
label in the current browser conversation.

## Planning and review workflow

Once both gates are green:

1. ChatGPT Web reads the connected workspace through C2C's read-only MCP tools
   and returns a bounded implementation plan.
2. Codex executes locally, runs tests, and records the real result.
3. ChatGPT Web independently reads the current diff and test evidence.
4. Codex applies required fixes and repeats until ChatGPT returns `DONE` or a
   real blocker.

Control messages contain only task state and compact metadata. Files, diffs,
logs, credentials, and keys must not be pasted into the conversation.

## Cursor and Grok

Enabling `cursor` or `grok` in `devspace init` enables their native DevSpace
subagent adapters. Example:

```bash
devspace agents targets --json
devspace agents run cursor "Implement the bounded task" --json
devspace agents run grok "Review the current change" --json
```

Those commands are useful alongside the desktop-controlled ChatGPT Web planning
loop, but they are separate model invocations. They are not a route to ChatGPT
Web or GPT-5.6 Sol Pro.

## Windows notes

Keep the repository, DevSpace, C2C bridge, and provider CLIs in the same WSL
distribution. The ChatGPT desktop app can select that WSL distribution for local
Codex work. The built-in browser itself runs in the Windows desktop app and uses
its own browser state.

A Cloudflare Quick Tunnel is suitable for initial validation but its hostname
may change after restart. C2C's named-tunnel flow is preferable for a stable
connector once the end-to-end path has been validated.

## Security boundary

The bridge never needs ChatGPT cookies or session storage. A model can read only
what the separately configured C2C workspace exposes. Keep sensitive-file deny
rules enabled, use one connector per workspace, and never paste secrets into C2C
control messages.
