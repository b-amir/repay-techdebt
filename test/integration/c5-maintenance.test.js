// @category C5
// Maintenance CLI: clear-output preview/consent, reset removes workbook artifacts.
import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execa } from "execa";
import { test } from "vite-plus/test";

const root = resolve(import.meta.dirname, "..", "..");
const script = resolve(root, "scripts", "project-memory.js");

async function run(args, env = {}) {
  const result = await execa(process.execPath, [script, ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    reject: false,
    timeout: 120_000,
  });
  return {
    code: result.exitCode,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

async function absent(path) {
  try {
    await access(path);
    return false;
  } catch {
    return true;
  }
}

test("clear-output dry-run then --yes removes initialized memory", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-maint-clear-"));
  try {
    const init = await run(["init", target, "--sharing", "local", "--depth", "concise", "--yes"]);
    assert.equal(init.code, 0, init.stderr);
    const memoryRoot = JSON.parse(init.stdout).memoryRoot;
    const preview = await run(["clear-output", target, "--dry-run"]);
    assert.equal(preview.code, 0, preview.stderr);
    assert.equal(JSON.parse(preview.stdout).type, "clear-output-preview");
    const consent = await run(["clear-output", target]);
    assert.equal(consent.code, 2);
    assert.equal(JSON.parse(consent.stdout).type, "consent-required");
    const cleared = await run(["clear-output", target, "--yes"]);
    assert.equal(cleared.code, 0, cleared.stderr);
    assert.equal(JSON.parse(cleared.stdout).type, "clear-output-completed");
    assert.equal(await absent(memoryRoot), true);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("reconfig updates lesson depth with consent", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-maint-reconfig-"));
  try {
    await run(["init", target, "--sharing", "local", "--depth", "balanced", "--yes"]);
    const preview = await run(["reconfig", target, "--depth", "concise"]);
    assert.equal(preview.code, 2);
    const payload = JSON.parse(preview.stdout);
    assert.equal(payload.type, "consent-required");
    assert.equal(payload.proposedConfig.defaults.lessonDepth, "concise");
    const applied = await run(["reconfig", target, "--depth", "concise", "--yes"]);
    assert.equal(applied.code, 0, applied.stderr);
    assert.equal(JSON.parse(applied.stdout).type, "reconfigured");
    const status = await run(["status", target, "--format", "json"]);
    assert.equal(JSON.parse(status.stdout).config.defaults.lessonDepth, "concise");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
