import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { locateSkillRoot } from "../../src/foundations/skill-locator.js";

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
