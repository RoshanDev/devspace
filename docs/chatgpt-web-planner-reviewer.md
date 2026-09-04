# ChatGPT Web planner/reviewer bridge

This feature prepares a read-only `codex-with-chatgpt` (C2C) bridge so ChatGPT
Web can inspect a local workspace for planning and independent review.

## Supported control planes

The C2C bridge is only the data plane. A visible browser controller is also
required to open ChatGPT, configure or repair the workspace connector, select
the web model and mode, send C2C messages, and read replies.

Two controller paths are supported in this branch:

```text
1. ChatGPT desktop app (Codex session)
        |-- in-app browser --> ChatGPT Web / GPT-5.6 Sol + Pro
        |
        `-- WSL shell ------> devspace chatgpt-web --> C2C bridge
                                                     |
                                                     `--> read-only workspace MCP

2. Native Cursor IDE or Cursor CLI
        |-- Playwright MCP --> visible persistent browser --> ChatGPT Web
        |
        `-- terminal -------> devspace chatgpt-web --> C2C bridge
                                                     |
                                                     `--> read-only workspace MCP
```

The Cursor controller is installed in this repository as:

```text
.cursor/mcp.json
.cursor/rules/devspace-chatgpt-web.mdc
.cursor/commands/chatgpt-web.md
```

The MCP config uses Microsoft's Playwright MCP server with a dedicated
persistent browser profile. Cursor must be reloaded after those files first
appear so the server and project rule are discovered.

Not supported by this branch:

- a standalone Codex CLI process with no browser MCP or desktop in-app browser;
- `devspace agents run cursor` inheriting the project Playwright MCP server;
- direct Grok-agent control of ChatGPT Web;
- a `devspace-agentd` provider named `chatgpt-web`.

The distinction between **native Cursor** and the **DevSpace Cursor ACP
subagent** matters. Native Cursor loads project `.cursor/mcp.json` and project
rules. DevSpace currently creates its Cursor ACP session with an explicit empty
`mcpServers` list, so that subagent path does not inherit the project browser
controller. This is a deliberate safety boundary until MCP injection is made
explicit and user-approved.

## Why this is not a background daemon provider

DevSpace local providers run under `devspace-agentd`. That daemon can invoke
provider SDKs and local agent protocols, but it does not own an interactive,
logged-in browser surface. Giving it ChatGPT cookies, scraping session tokens,
or calling private ChatGPT endpoints would cross the intended security
boundary.

Cursor support therefore uses a user-visible Playwright MCP browser controlled
by the native Cursor session. The browser keeps its own persistent profile; the
user completes login, CAPTCHA, 2FA, passkeys, and consent directly in that
window.

## What the DevSpace commands do

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
The desktop in-app browser or Cursor's Playwright MCP controller performs that
part.

`devspace init` is not required for these commands. The C2C bridge has its own
state and authorization. DevSpace server OAuth is unrelated.

Important fields:

- `localReady: true`: the local C2C bridge and MCP endpoint are healthy.
- `result.tokenCount: 0`: ChatGPT has not completed connector OAuth yet.
- `result.tokenCount > 0`: at least one connector has a C2C token; this is not
  model verification.
- `result.pairingActive: true`: a one-time pairing code is waiting or remains
  valid.
- `modelVerification.verified: false`: expected from the CLI because only a
  visible browser can verify the selected web model and mode.
- `requiredModelSelectorLabel`: the model-family control must show
  `GPT-5.6 Sol`.
- `requiredModeLabel`: the capability/reasoning control must show `Pro`.
- `effectiveModelLabel` or the legacy `requiredModelLabel`: the effective model
  is `GPT-5.6 Sol Pro`; the page may render this as two controls rather than one
  combined label.

The model gate accepts either two separately visible controls (`GPT-5.6 Sol` and
`Pro`) or one normalized combined summary label (`GPT-5.6 Sol Pro`). It does not
accept Sol with Medium, High, Extra High, or Auto as a substitute for Pro.

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

## ChatGPT desktop Codex setup

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

The desktop app's in-app browser performs ChatGPT login, connector creation or
repair, OAuth approval, pairing, and the model/mode check. User interaction may
still be required for login, CAPTCHA, 2FA, and consent.

## Native Cursor setup

The feature branch already contains the project MCP server, rule, and slash
command. Pull it and reload the Cursor window:

```bash
git pull --ff-only
```

After reload, Cursor should show the MCP server:

```text
devspace-chatgpt-web-browser
```

Approve and enable that server. It starts a visible Playwright browser and keeps
a project-specific persistent profile. The first use may install the browser
runtime and will require a one-time ChatGPT login in the opened window.

Invoke the workflow from Cursor Chat or Cursor CLI with:

```text
/chatgpt-web
```

or explicitly mention the project rule:

```text
Use the devspace-chatgpt-web rule. Repair the current C2C connector if needed,
ask GPT-5.6 Sol with Pro for a plan, execute it locally, and return the real diff
for independent review until DONE.
```

Cursor CLI supports the same project MCP configuration and rules as the IDE, so
this path is available there as well after the MCP server is enabled.

The Cursor rule deliberately forbids browser JavaScript evaluation, private
network inspection, cookie/storage extraction, and undocumented ChatGPT APIs.
It uses accessibility snapshots, normal clicks, typing, key presses, tabs, and
bounded waits.

## Repairing a reclaimed Quick Tunnel

A Cloudflare Quick Tunnel hostname can change when the bridge restarts. A doctor
result such as this means the old ChatGPT connector address is stale:

```json
{
  "localReady": false,
  "doctor": {
    "chatgptRepair": {
      "needed": true,
      "reason": "address_reclaimed"
    }
  }
}
```

The browser-owning controller must:

1. Run `devspace chatgpt-web doctor --fix --json` once.
2. Require a non-null current `mcpUrl` before editing the connector.
3. Delete only the connector named by `chatgptRepair.connectorName`.
4. Recreate exactly that connector with the current URL, never the old URL.
5. Generate a fresh pairing code immediately before OAuth when needed.
6. Complete OAuth and pairing in the browser.
7. Re-run status and require `tokenCount > 0`.
8. Call `workspace_info` and require the expected workspace identity.

Do not rerun setup or create a second connector when a bounded repair is enough.

## Planning and review workflow

Once bridge, connector, workspace, and model gates are green:

1. ChatGPT Web reads the connected workspace through C2C's read-only MCP tools
   and returns a bounded implementation plan.
2. The local controller's executor—Codex or Cursor—modifies files, runs tests,
   and records the real result.
3. ChatGPT Web independently reads the current diff and released test evidence.
4. The executor applies required fixes and repeats until ChatGPT returns `DONE`
   or a real blocker.

Control messages contain only task state and compact metadata. Files, diffs,
logs, credentials, and keys must not be pasted into the browser conversation.

## Cursor ACP subagent and Grok

Enabling `cursor` or `grok` in `devspace init` enables their native DevSpace
subagent adapters:

```bash
devspace agents targets --json
devspace agents run cursor "Implement the bounded task" --json
devspace agents run grok "Review the current change" --json
```

Those commands are separate model invocations. In this branch they do not
inherit the native Cursor Playwright MCP controller and are not a route to
ChatGPT Web or GPT-5.6 Sol Pro.

## Local Pi sandbox test behavior

The Pi sandbox integration depends on more than installed packages. On Linux and
WSL, the host kernel, user-namespace policy, AppArmor, nesting, and bubblewrap
must also permit a functional sandbox. A dependency check can therefore pass
while the first sandboxed command still fails.

Ordinary local `pnpm test` performs a functional smoke test. When the Pi sandbox
is not usable on that host, the optional integration test reports a skip instead
of failing the unrelated suite. The CI lane keeps it mandatory with:

```bash
DEVSPACE_REQUIRE_PI_SANDBOX=1 pnpm test
```

This does not make Pi fall back to unsandboxed execution. It changes only the
local test's environment policy; Pi's restricted runtime still fails closed if
a requested sandbox cannot be initialized.

## Windows and WSL notes

Keep the repository, DevSpace, C2C bridge, and provider CLIs in the same WSL
distribution. For Cursor Remote WSL, the project MCP server is launched in that
WSL environment. A visible Linux browser requires WSLg; if Cursor cannot display
it, run the Playwright MCP server on the Windows side over its HTTP transport
and point Cursor's MCP configuration at that local endpoint instead.

A Quick Tunnel is suitable for initial validation but its hostname may change
after restart. C2C's named-tunnel flow is preferable for a stable connector once
the end-to-end path has been validated.

## Security boundary

The controller never needs to expose ChatGPT cookies or session storage to the
model. A dedicated persistent browser profile is allowed to retain its own login
state, but the workflow must not read or serialize those credentials. ChatGPT
can read only what the separately configured C2C workspace exposes. Keep
sensitive-file deny rules enabled, use one connector per workspace, and never
paste secrets into C2C control messages.
