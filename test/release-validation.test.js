// @category C7
import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { rm, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execa } from "execa";

const SCRIPT_PATH = resolve(process.cwd(), "scripts", "validate-release.js");

test("Validation fails when package.json is missing or malformed", async () => {
  const TEST_ROOT = await mkdtemp(join(tmpdir(), "release-test-"));
  try {
    const result = await execa("node", [SCRIPT_PATH], { cwd: TEST_ROOT, reject: false });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Failed to read package.json/);
  } finally {
    await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});
  }
});

test("Validation fails when SKILL.md is invalid", async () => {
  const TEST_ROOT = await mkdtemp(join(tmpdir(), "release-test-"));
  try {
    await writeFile(
      join(TEST_ROOT, "package.json"),
      JSON.stringify({ name: "test", version: "1.0" }),
      "utf8",
    );
    await writeFile(join(TEST_ROOT, "SKILL.md"), "No frontmatter here!", "utf8");

    const result = await execa("node", [SCRIPT_PATH], { cwd: TEST_ROOT, reject: false });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /SKILL.md must begin with YAML frontmatter/);
  } finally {
    await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});
  }
});
