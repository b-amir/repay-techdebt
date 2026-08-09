#!/usr/bin/env node
// Install bundled skill dependencies when check-runtime reports missing packages.
// Scoped to <skill-root> only - never touches the target application repo.
//
//   node scripts/ensure-runtime.js [--dry-run] [--format json]
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSkillRuntime, RuntimeBootstrapError } from "../src/foundations/ensure-runtime.js";
import { isDirectCliInvocation } from "../src/foundations/cli-entry.js";

const skillRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean" },
      "prune-runtime": { type: "boolean" },
      "link-cli": { type: "boolean" },
      format: { type: "string", default: "json" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    process.stdout.write(
      "Usage: node scripts/ensure-runtime.js [--dry-run] [--prune-runtime] [--link-cli] [--format json]\n\nInstalls skill-root node_modules when missing with manifest-pinned pnpm via Corepack (ignore-scripts, frozen-lockfile).\n--link-cli or REPAY_LINK_CLI=1 also symlinks repay onto ~/.local/bin.\n",
    );
    process.exit(0);
  }
  const result = await ensureSkillRuntime({
    skillRoot,
    install: !values["dry-run"],
    prune: values["prune-runtime"] || false,
    linkCli: values["link-cli"] || false,
  });
  if (values.format === "json") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`Runtime: ${result.report.status}\n`);
    if (result.installed) process.stdout.write("Installed bundled dependencies.\n");
  }
  if (result.report.status !== "ready") process.exitCode = 2;
}

if (isDirectCliInvocation(import.meta.url)) {
  main().catch((error) => {
    if (error instanceof RuntimeBootstrapError) {
      process.stderr.write(`${error.message}\n`);
      if (error.report) process.stderr.write(`${JSON.stringify(error.report, null, 2)}\n`);
      if (error.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    } else {
      process.stderr.write(`ensure-runtime failed: ${error.message}\n`);
    }
    process.exit(1);
  });
}
