// @category C5
import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { resolve, join } from "node:path";
import { rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execa } from "execa";

const SCRIPT_PATH = resolve(process.cwd(), "scripts", "run-conformance.js");

test("Minimal agent conformance passes on an empty project", async () => {
  const TEST_ROOT = await mkdtemp(join(tmpdir(), "conformance-test-"));
  try {
    const result = await execa("node", [SCRIPT_PATH, TEST_ROOT, "--agent", "minimal"], {
      cwd: process.cwd(),
    });
    assert.match(result.stdout, /Conformance run completed successfully/);
  } finally {
    await rm(TEST_ROOT, { recursive: true, force: true }).catch(() => {});
  }
});
