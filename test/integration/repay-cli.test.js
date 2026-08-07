import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { locateSkillRoot } from "../../src/foundations/skill-locator.js";
import { sanitizeArgs, sanitizeInvokeArgs } from "../../scripts/repay-cli.js";

const exec = promisify(execFile);
const CLI_PATH = join(process.cwd(), "scripts", "repay-cli.js");

test("skill locator finds repo skill root", () => {
  const root = locateSkillRoot(join(process.cwd(), "bin", "repay"));
  assert.ok(root);
  assert.match(root, /repay-techdebt$/);
});

test("CLI prints help for view --help", async () => {
  const { stdout } = await exec("node", [CLI_PATH, "view", "--help"]);
  assert.match(stdout, /repay view/);
  assert.match(stdout, /--open/);
  assert.match(stdout, /--lesson/);
  assert.match(stdout, /Local skill scripts only/);
});

test("bin/repay entry runs main (not silent no-op)", async () => {
  const binPath = join(process.cwd(), "bin", "repay");
  const { stdout } = await exec("node", [binPath, "view", "--help"]);
  assert.match(stdout, /repay view/);
  assert.match(stdout, /--open/);
});

test("CLI handles unknown commands", async () => {
  let threw = false;
  try {
    await exec("node", [CLI_PATH, "unknown-command-test"]);
  } catch (error) {
    threw = true;
    assert.equal(error.code, 1);
    assert.ok(error.stderr.includes("Unknown command: unknown-command-test"));
  }
  assert.ok(threw, "CLI should exit with code 1 on unknown commands");
});

test("sanitizeArgs allowlists flags and keeps positionals", () => {
  const allowed = new Set(["--yes", "--mode", "--focus", "--help", "-h"]);
  assert.deepEqual(sanitizeArgs(["--yes", "--mode", "workbook", "../app"], allowed), [
    "--yes",
    "--mode",
    "workbook",
    "../app",
  ]);
  assert.throws(() => sanitizeArgs(["--eval", "1"], allowed), /Rejected unknown flag/);
  assert.throws(() => sanitizeArgs(["--focus", "plan\n--evil"], allowed), /control characters/);
});

test("sanitizeInvokeArgs remains exported for compatibility", () => {
  assert.deepEqual(sanitizeInvokeArgs(["--yes", "--mode", "plan", "../app"]), [
    "--yes",
    "--mode",
    "plan",
    "../app",
  ]);
});

test("CLI rejects unknown flags on init without spawning scripts", async () => {
  let threw = false;
  try {
    await exec("node", [CLI_PATH, "init", "--eval", "process.exit(0)"]);
  } catch (error) {
    threw = true;
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Rejected unknown flag: --eval/);
  }
  assert.ok(threw);
});

test("CLI plan --help stays local (no npx skills invoke)", async () => {
  const { stdout, stderr } = await exec("node", [CLI_PATH, "plan", "--help"]);
  assert.match(stdout, /repay plan/);
  assert.doesNotMatch(stdout + stderr, /Unknown command: invoke/);
  assert.doesNotMatch(stdout + stderr, /npx skills/);
});
