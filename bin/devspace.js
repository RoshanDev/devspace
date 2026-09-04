#!/usr/bin/env node

const command = process.argv[2];

if (command === "chatgpt-web") {
  process.argv.splice(2, 1);
  await import("../dist/chatgpt-web-cli.js");
} else {
  await import("../dist/cli.js");

  if (command === "help" || command === "--help" || command === "-h") {
    console.log([
      "",
      "ChatGPT Web planner/reviewer:",
      "  devspace chatgpt-web doctor [--fix] [--json] [-w <workspace>]",
      "  devspace chatgpt-web setup|status|pair [--json] [-w <workspace>]",
    ].join("\n"));
  }
}
