// @category C6
// Tool CLI exit contracts: capability preflight emits JSON exit 0; Graphify
// extraction asks consent (exit 2, no network, no target write) before any binary spawn.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execa } from "execa";
import { test } from "vite-plus/test";

const root = resolve(import.meta.dirname, "..", "..");

async function runCli(scriptName, args) {
  const result = await execa(process.execPath, [resolve(root, "scripts", scriptName), ...args], {
    cwd: root,
    reject: false,
    timeout: 120_000,
  });
  return {
    code: result.exitCode,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

test("check-capabilities exits 0 and emits a machine-readable capability report", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-c6-caps-"));
  try {
    const result = await runCli("check-capabilities.js", [target, "--format", "json"]);
    assert.equal(result.code, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.ok(Array.isArray(report.capabilities) && report.capabilities.length > 0);
    assert.ok(report.capabilities.every((c) => typeof c.id === "string"));
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("run-graphify extract without --yes exits 2 consent-required with no network and no target writes", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-c6-graphify-"));
  try {
    const result = await runCli("run-graphify.js", ["extract", target]);
    assert.equal(result.code, 2, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.type, "consent-required");
    assert.equal(output.status, "not-extracted");
    assert.equal(output.network, false);
    assert.deepEqual(output.targetWrites, []);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
