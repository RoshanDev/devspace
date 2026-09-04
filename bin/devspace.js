#!/usr/bin/env node

if (process.argv[2] === "chatgpt-web") {
  process.argv.splice(2, 1);
  await import("../dist/chatgpt-web-cli.js");
} else {
  await import("../dist/cli.js");
}
