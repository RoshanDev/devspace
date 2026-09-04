Use the project rule `devspace-chatgpt-web` for this task.

Use the configured `devspace-chatgpt-web-browser` Playwright MCP server to control
a visible ChatGPT browser. Do not use a personal Chrome profile, cookies, storage,
private network APIs, or an undocumented ChatGPT endpoint.

First inspect `devspace chatgpt-web status --json` and
`devspace chatgpt-web doctor --json`. Reuse a healthy bridge, connector, Project,
and conversation. Repair an expired Quick Tunnel only through the bounded C2C
repair flow in the rule.

Verify all gates before planning:

1. `workspace_info` matches the current Git workspace.
2. The visible model-family control is `GPT-5.6 Sol`.
3. The visible mode/capability control is `Pro`.

Treat those controls together as `GPT-5.6 Sol Pro`; never silently downgrade.
Ask ChatGPT Web for a structured PLAN, execute it locally in Cursor, then return
the real state through an EXECUTED message for independent review until DONE or
a genuine blocker.
