#!/usr/bin/env node
/**
 * Maintainer: mechanical golden-run simulation (no live agent, no MCP required).
 * Exit 0 when golden A+B pass evaluateLessonForSave floors; non-zero on failure.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDirectCliInvocation } from "../src/foundations/cli-entry.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (isDirectCliInvocation(import.meta.url)) {
  const vp = resolve(root, "node_modules/.bin/vp");
  const child = spawn(vp, ["test", "test/unit/c4-lessons/golden-run-sim.test.js"], {
    cwd: root,
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code ?? 1));
}
