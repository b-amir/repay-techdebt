#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cwd, stderr, stdout } from "node:process";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDirectCliInvocation } from "../src/foundations/cli-entry.js";
import { resolveSkillRoot } from "../src/foundations/skill-locator.js";
import { bold, cyan, dim, green, paint, red } from "../src/foundations/term.js";

const entryPath = fileURLToPath(import.meta.url);
const skillRoot = resolveSkillRoot(entryPath);

/**
 * Human TTY → pretty table. Piped / non-TTY (agents, CI) → machine JSON.
 * Explicit --format always wins.
 * @param {{ isTTY?: boolean } | null | undefined} [stream]
 * @param {"table" | "summary-json" | "json"} [ttyFormat]
 * @param {"table" | "summary-json" | "json"} [pipeFormat]
 */
export function defaultCliFormat(
  stream = stdout,
  ttyFormat = "table",
  pipeFormat = "summary-json",
) {
  return stream?.isTTY ? ttyFormat : pipeFormat;
}

/** Flags humans may pass through to local scripts. Unknown flags rejected. */
const ALLOWED_INIT_FLAGS = new Set([
  "--yes",
  "--interactive",
  "--storage",
  "--sharing",
  "--output-location",
  "--output-root",
  "--mode",
  "--depth",
  "--save-policy",
  "--boundary-hints",
  "--critical-workflows",
  "--max-files",
  "--max-manifest-files",
  "--max-relation-files",
  "--max-relation-bytes",
  "--allow-non-git",
  "--format",
  "--help",
  "-h",
]);

const ALLOWED_PLAN_FLAGS = new Set([
  "--mode",
  "--depth",
  "--scope",
  "--focus",
  "--format",
  "--max-files",
  "--max-manifest-files",
  "--max-relation-files",
  "--max-relation-bytes",
  "--help",
  "-h",
]);

const BOOLEAN_FLAGS = new Set(["--yes", "--interactive", "--allow-non-git", "--help", "-h"]);

/**
 * Spawn local script with inherit stdio. Optional label → dim lead-in + ✓/✗ trailer.
 * Exit 2 (consent / already-exists) → yellow soft trailer; other non-zero → red.
 * (Spinner lives in child long work via createSpinner - inherit owns the TTY mid-run.)
 * @param {string} command
 * @param {string[]} args
 * @param {{ label?: string }} [options]
 */
function run(command, args, options = {}) {
  const label = options.label;
  if (label) stderr.write(`${dim("→", stderr)} ${dim(label, stderr)}\n`);

  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.on("error", (/** @type {Error} */ error) => {
      if (label) stderr.write(`${red("✗", stderr)} ${label}\n`);
      reject(error);
    });
    child.on("close", (/** @type {number | null} */ code) => {
      if (code === 0) {
        if (label) stderr.write(`${green("✓", stderr)} ${label}\n`);
        resolvePromise();
        return;
      }
      // Consent / already-exists are expected soft stops - not hard failure chrome.
      if (label) {
        if (code === 2) {
          stderr.write(
            `${paint("yellow", "!", stderr)} ${dim(label, stderr)} ${dim("(exit 2)", stderr)}\n`,
          );
        } else {
          stderr.write(`${red("✗", stderr)} ${label} (exit ${code ?? 1})\n`);
        }
      }
      // Child already wrote diagnostics on stdio; preserve its exit code only.
      /** @type {Error & { exitCode?: number, silent?: boolean }} */
      const err = new Error(`exit ${code ?? 1}`);
      err.exitCode = code ?? 1;
      err.silent = true;
      reject(err);
    });
  });
}

/** @param {string} value */
function hasControlChars(value) {
  return value.includes("\n") || value.includes("\r") || value.includes("\0");
}

/**
 * Allow only known flags + non-flag positionals. Reject control chars.
 * @param {string[]} rest
 * @param {Set<string>} allowedFlags
 */
export function sanitizeArgs(rest, allowedFlags) {
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (typeof token !== "string" || token.length === 0) {
      throw new Error(`Invalid argument at position ${i}`);
    }
    if (hasControlChars(token)) {
      throw new Error(`Rejected control characters in argument: ${token.slice(0, 40)}`);
    }
    if (token.startsWith("-")) {
      const flag = token.includes("=") ? token.slice(0, token.indexOf("=")) : token;
      if (!allowedFlags.has(flag)) {
        throw new Error(`Rejected unknown flag: ${flag}. Allowed: ${[...allowedFlags].join(" ")}`);
      }
      out.push(token);
      if (
        !token.includes("=") &&
        !BOOLEAN_FLAGS.has(flag) &&
        i + 1 < rest.length &&
        !String(rest[i + 1]).startsWith("-")
      ) {
        const value = rest[++i];
        if (hasControlChars(value)) {
          throw new Error(`Rejected control characters in value for ${flag}`);
        }
        out.push(value);
      }
      continue;
    }
    out.push(token);
  }
  return out;
}

/** @deprecated use sanitizeArgs - kept for older tests */
export function sanitizeInvokeArgs(rest) {
  return sanitizeArgs(
    rest,
    new Set([
      ...ALLOWED_INIT_FLAGS,
      ...ALLOWED_PLAN_FLAGS,
      "--task",
      "--view",
      "--create",
      "--recreate",
      "--clear-output",
      "--clear-cache",
      "--reset",
      "--reconfig",
      "--keep-lessons",
      "--keep-config",
      "--revert-target-markers",
      "--dry-run",
      "--workbook",
    ]),
  );
}

function printHelp() {
  const pipe = dim("│");
  const head = `${paint(["bold", "cyan"], "repay")} ${dim("· Local skill scripts only")}`;
  stdout.write(`${head}\n`);
  stdout.write(`${pipe}\n`);
  stdout.write(`${pipe} ${bold("Usage")}\n`);
  stdout.write(`${pipe}   repay view   [<target-root>] [--open] [--port <n>] [--lesson …]\n`);
  stdout.write(`${pipe}   repay init   [<target-root>] [init flags…]\n`);
  stdout.write(`${pipe}   repay plan   [<target-root>] [<focus…>] [--mode …] [--depth …]\n`);
  stdout.write(`${pipe}   repay status [<target-root>]\n`);
  stdout.write(`${pipe}   repay --help\n`);
  stdout.write(`${pipe}\n`);
  stdout.write(`${pipe} ${bold("Commands")}\n`);
  stdout.write(`${pipe}   ${cyan("view")}    Workbook browser UI\n`);
  stdout.write(`${pipe}   ${cyan("init")}    Project memory setup\n`);
  stdout.write(`${pipe}   ${cyan("plan")}    Evidence-ranked investigation plan\n`);
  stdout.write(`${pipe}   ${cyan("status")}  Read-only memory health\n`);
  stdout.write(`${pipe}\n`);
  stdout.write(`${pipe} ${dim("init needs --yes (or --interactive). plan is read-only.")}\n`);
  stdout.write(
    `${pipe} ${dim("TTY → pretty table; piped → JSON. Agents: plan-analysis.js --format summary-json.")}\n`,
  );
  stdout.write(`${pipe}\n`);
  stdout.write(`${pipe} ${bold("Examples")}\n`);
  stdout.write(`${pipe}   ${dim("repay init --yes")}\n`);
  stdout.write(`${pipe}   ${dim('repay plan "auth from request boundary to data access"')}\n`);
  stdout.write(`${pipe}   ${dim("repay plan ./apps/web --mode focused --depth balanced")}\n`);
  stdout.write(`${pipe}   ${dim("repay view --open")}\n`);
  stdout.write(`${pipe}   ${dim("repay status")}\n`);
  stdout.write(`${dim("╰")}\n`);
}

/**
 * First positional that looks like a path → target; remaining non-flags → free text.
 * @param {string[]} tokens
 */
function splitTargetAndText(tokens) {
  if (tokens.length === 0) {
    return { targetRoot: resolve(cwd()), textParts: [] };
  }
  const first = tokens[0];
  const asPath = resolve(cwd(), first);
  const looksLikePath =
    first === "." ||
    first === ".." ||
    first.startsWith("./") ||
    first.startsWith("../") ||
    first.startsWith("/") ||
    existsSync(asPath);

  if (looksLikePath) {
    return { targetRoot: asPath, textParts: tokens.slice(1) };
  }
  return { targetRoot: resolve(cwd()), textParts: tokens };
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

  await run(process.execPath, args, { label: "open workbook viewer" });
}

async function initCommand(argv) {
  const safe = sanitizeArgs(argv, ALLOWED_INIT_FLAGS);
  if (safe.includes("--help") || safe.includes("-h")) {
    printHelp();
    return;
  }
  /** @type {string[]} */
  const positionals = [];
  /** @type {string[]} */
  const flagArgs = [];
  for (let i = 0; i < safe.length; i++) {
    const token = safe[i];
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }
    flagArgs.push(token);
    const flag = token.includes("=") ? token.slice(0, token.indexOf("=")) : token;
    if (
      !BOOLEAN_FLAGS.has(flag) &&
      !token.includes("=") &&
      i + 1 < safe.length &&
      !safe[i + 1].startsWith("-")
    ) {
      flagArgs.push(safe[++i]);
    }
  }
  const targetRoot = resolve(positionals[0] ?? cwd());
  const script = resolve(skillRoot, "scripts", "project-memory.js");
  const args = [script, "init", targetRoot, ...flagArgs];
  if (!flagArgs.some((t) => t === "--format" || t.startsWith("--format="))) {
    // TTY humans get panel; agents/CI (no TTY) get JSON machine envelope.
    args.push("--format", defaultCliFormat(stdout, "table", "json"));
  }
  await run(process.execPath, args, {
    label: `init ${targetRoot}`,
  });
}

async function planCommand(argv) {
  const safe = sanitizeArgs(argv, ALLOWED_PLAN_FLAGS);
  if (safe.includes("--help") || safe.includes("-h")) {
    printHelp();
    return;
  }

  /** @type {string[]} */
  const flagArgs = [];
  /** @type {string[]} */
  const positionals = [];
  for (let i = 0; i < safe.length; i++) {
    const token = safe[i];
    if (token.startsWith("-")) {
      flagArgs.push(token);
      const flag = token.includes("=") ? token.slice(0, token.indexOf("=")) : token;
      if (
        !BOOLEAN_FLAGS.has(flag) &&
        !token.includes("=") &&
        i + 1 < safe.length &&
        !safe[i + 1].startsWith("-")
      ) {
        flagArgs.push(safe[++i]);
      }
      continue;
    }
    positionals.push(token);
  }

  const { targetRoot, textParts } = splitTargetAndText(positionals);
  const focusFromFlags = (() => {
    const idx = flagArgs.findIndex((t) => t === "--focus" || t.startsWith("--focus="));
    if (idx < 0) return null;
    if (flagArgs[idx].startsWith("--focus=")) return flagArgs[idx].slice("--focus=".length);
    return flagArgs[idx + 1] ?? null;
  })();
  const focus = focusFromFlags || (textParts.length ? textParts.join(" ") : null);

  const script = resolve(skillRoot, "scripts", "plan-analysis.js");
  const args = [script, targetRoot, ...flagArgs];
  // Avoid duplicate --focus if already present
  if (focus && !focusFromFlags) args.push("--focus", focus);
  if (!flagArgs.some((t) => t === "--format" || t.startsWith("--format="))) {
    // TTY humans → table; piped/agent/CI → summary-json (full machine fields).
    args.push("--format", defaultCliFormat(stdout, "table", "summary-json"));
  }
  await run(process.execPath, args, { label: `plan ${targetRoot}` });
}

async function statusCommand(argv) {
  const targetRoot = resolve(argv.find((t) => !t.startsWith("-")) ?? cwd());
  const script = resolve(skillRoot, "scripts", "project-memory.js");
  // TTY humans → table; piped/agent/CI → json machine envelope.
  const format = defaultCliFormat(stdout, "table", "json");
  await run(process.execPath, [script, "status", targetRoot, "--format", format], {
    label: `status ${targetRoot}`,
  });
}

export async function main() {
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
    } else if (command === "init") {
      await initCommand(rest);
    } else if (command === "plan") {
      await planCommand(rest);
    } else if (command === "status") {
      await statusCommand(rest);
    } else {
      stderr.write(`${red("✗", stderr)} Unknown command: ${command}\n`);
      printHelp();
      process.exitCode = 1;
    }
  } catch (error) {
    const err = /** @type {Error & { exitCode?: number, silent?: boolean }} */ (error);
    if (!err.silent) stderr.write(`${red("✗", stderr)} ${err.message}\n`);
    process.exitCode = err.exitCode ?? 1;
  }
}

// Direct `node scripts/repay-cli.js …` only. `bin/repay` imports and calls main().
if (isDirectCliInvocation(import.meta.url)) {
  main();
}
