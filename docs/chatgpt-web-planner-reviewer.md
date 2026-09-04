# ChatGPT Web planner/reviewer for Codex CLI

This integration lets a Codex CLI session use ChatGPT Web with the exact
`GPT-5.6 Sol Pro` selector option for planning and independent review while
Codex keeps all execution authority.

## Why it is a skill, not a daemon provider

DevSpace local providers run under `devspace-agentd`. That daemon can invoke
provider SDKs and local agent protocols, but it does not own the outer Codex
session's in-app browser. ChatGPT Web is therefore integrated at two explicit
boundaries:

```text
Windows Terminal / WSL / Git Bash
              |
              v
        outer Codex CLI
        |             |
        |             +-- in-app browser --> ChatGPT Web
        |                                  GPT-5.6 Sol Pro
        |
        +-- DevSpace chatgpt-web commands --> c2c bridge
                                               |
                                               v
                                      read-only workspace MCP
```

The design deliberately does not copy browser cookies, call private ChatGPT web
APIs, or disguise a normal Codex model as Sol Pro.

## Requirements

- Node.js supported by DevSpace.
- DevSpace built from this branch and installed or linked.
- Codex CLI with access to its in-app browser.
- A ChatGPT account whose web model selector exposes the exact label
  `GPT-5.6 Sol Pro`.
- `codex-with-chatgpt` installed globally as `c2c` or available as a source
  checkout.

The local doctor cannot prove which model is selected in a web page. The Codex
skill checks the visible selector as a separate fail-closed gate.

## Install from the feature branch

From WSL or Git Bash:

```bash
git clone --branch feat/chatgpt-web-planner-reviewer \
  https://github.com/RoshanDev/devspace.git
cd devspace
corepack pnpm install --frozen-lockfile
corepack pnpm build
npm install -g .
```

Install Codex with ChatGPT if it is not already available:

```bash
git clone https://github.com/XiaoDuoYa/codex-with-chatgpt.git \
  "$HOME/codex-with-chatgpt"
cd "$HOME/codex-with-chatgpt"
corepack pnpm install
corepack pnpm build
export DEVSPACE_C2C_CHECKOUT="$HOME/codex-with-chatgpt"
```

The DevSpace skill is stored at `skills/chatgpt-web/SKILL.md`. Copy it to the
Codex skill directory when working from a source checkout:

```bash
mkdir -p "$HOME/.codex/skills/devspace-chatgpt-web"
cp skills/chatgpt-web/SKILL.md \
  "$HOME/.codex/skills/devspace-chatgpt-web/SKILL.md"
```

## Commands

Run the commands from the project that ChatGPT Web should inspect.

### Diagnose without changing local state

```bash
devspace chatgpt-web doctor --json
```

The wrapper invokes:

```text
c2c doctor --workspace <current-git-root> --no-fix --json
```

Important wrapper fields:

- `ok`: C2C was found and returned parseable diagnostic JSON.
- `localReady`: all C2C checks are green and no connector or named-tunnel repair
  is pending.
- `requiredModelLabel`: always `GPT-5.6 Sol Pro` for this integration.
- `modelVerification.verified`: always `false` in the CLI result because only
  the in-app browser can verify the active web model.
- `c2c.attempts`: command discovery attempts and actionable failures.

### Repair or initialize

```bash
devspace chatgpt-web doctor --fix --json
devspace chatgpt-web setup --json
```

Inspect doctor output before using `--fix`; account login, CAPTCHA, 2FA,
Cloudflare authorization, connector changes, and model availability remain user
or browser interactions.

### Inspect and pair

```bash
devspace chatgpt-web status --json
devspace chatgpt-web pair --json
```

## C2C discovery

DevSpace uses the first working source in this order:

1. `DEVSPACE_C2C_COMMAND`.
2. `C2C_COMMAND`.
3. `DEVSPACE_C2C_CHECKOUT`.
4. `C2C_CHECKOUT`.
5. `c2c` on `PATH`.
6. `~/codex-with-chatgpt/bin/c2c.js`.
7. `~/.local/share/codex-with-chatgpt/bin/c2c.js`.

A command override is treated as one executable path. Put source checkout paths,
including paths containing spaces, in `DEVSPACE_C2C_CHECKOUT` instead of
embedding arguments in the command variable.

## Use from Codex

Start Codex in the target project and ask:

```text
Use the DevSpace ChatGPT Web skill. Verify the exact GPT-5.6 Sol Pro selector,
ask it to plan this task, execute the plan locally, then return the real diff to
the same ChatGPT conversation for independent review until DONE.
```

The skill enforces these boundaries:

- ChatGPT Web plans and reviews only.
- Codex edits, tests and operates Git.
- Code and diffs are read through the read-only C2C MCP bridge.
- Control messages stay small and structured.
- Failure to verify the exact visible Sol Pro label stops the workflow; there is
  no silent downgrade.

## Windows notes

DevSpace itself requires a Bash-compatible environment on Windows. WSL is the
recommended route for a repository already developed in WSL. Git Bash is also
supported for native Windows paths. The command resolver supports Windows
command shims and checkout paths containing spaces.

Pure PowerShell can launch WSL commands, but running the full DevSpace workflow
inside WSL avoids path-translation and shell incompatibilities.

## Security boundary

The integration never needs ChatGPT cookies or session storage. A model can
access only what the separately configured C2C bridge exposes. Keep C2C's
sensitive-file deny rules enabled, use one workspace boundary per connection,
and do not paste secrets into control messages.
