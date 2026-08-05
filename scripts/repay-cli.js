#!/usr/bin/env node
import { spawn } from "node:child_process";
import { cwd } from "node:process";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSkillRoot } from "../src/foundations/skill-locator.js";

const entryPath = fileURLToPath(import.meta.url);
const skillRoot = resolveSkillRoot(entryPath);
const skillName = "b-amir/repay-techdebt";

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`Command ${command} exited with code ${code}`));
    });
  });
}

function printHelp() {
  process.stdout.write(`Usage:
  repay view [<target-root>] [--open] [--port <n>] [--lesson <lessons/...>]
  repay init [skill args…]
  repay plan [skill args…]
  repay --help

Open the workbook viewer for a target repository. When <target-root> is omitted,
the current working directory is used.

Examples:
  repay view ../frontend --open
  repay view --open --lesson lessons/2026-08-01-auth.md
`);
}

async function viewCommand(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      open: { type: "boolean" },
      port: { type: "string" },
      lesson: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: false,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const targetRoot = resolve(positionals[0] ?? cwd());
  const script = resolve(skillRoot, "scripts", "view-lessons.js");
  const args = [script, targetRoot];
  if (typeof values.port === "string") args.push("--port", values.port);
  if (values.open) args.push("--open");
  if (typeof values.lesson === "string") args.push("--lesson", values.lesson);

  await run(process.execPath, args);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const command = argv[0];
  const rest = argv.slice(1);

  try {
    if (command === "view") {
      await viewCommand(rest);
    } else if (command === "init" || command === "repay") {
      await run("npx", ["skills", "invoke", skillName, ...rest]);
    } else if (command === "plan") {
      await run("npx", ["skills", "invoke", skillName, "--task", "plan", ...rest]);
    } else {
      process.stderr.write(`Unknown command: ${command}\n`);
      printHelp();
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

main();
