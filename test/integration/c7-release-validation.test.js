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
    const result = await execa("node", [SCRIPT_PATH], {
      cwd: TEST_ROOT,
      reject: false,
    });
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

    const result = await execa("node", [SCRIPT_PATH], {
      cwd: TEST_ROOT,
      reject: false,
    });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /SKILL.md must begin with YAML frontmatter/);
  } finally {
    await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});
  }
});

test("Validation can require independent forward-test review provenance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "release-review-"));
  try {
    const selfReview = join(directory, "self.json");
    const independentReview = join(directory, "independent.json");
    await writeFile(
      selfReview,
      JSON.stringify({ reviewerProvenance: "self", mustFix: [] }),
      "utf8",
    );
    await writeFile(
      independentReview,
      JSON.stringify({ reviewerProvenance: "independent-agent", mustFix: [] }),
      "utf8",
    );

    const rejected = await execa(
      "node",
      [SCRIPT_PATH, "--require-independent-review", selfReview],
      { cwd: process.cwd(), reject: false },
    );
    assert.equal(rejected.exitCode, 1);
    assert.match(rejected.stderr, /not independent/);

    const accepted = await execa(
      "node",
      [SCRIPT_PATH, "--require-independent-review", independentReview],
      { cwd: process.cwd(), reject: false },
    );
    assert.equal(accepted.exitCode, 0);
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
});
