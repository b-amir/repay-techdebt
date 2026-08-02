// @category C5
// Persistence CLI consent + quality exit matrix. Table-driven exit-code contracts:
// consent = 2, quality-fail = 2, success = 0.
// project-memory.test.js covers happy paths; this locks the no-consent and quality-fail edges.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
  return { code: result.exitCode, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

async function initLocal(target) {
  // --sharing local keeps all state inside the temp target; no write to the user Library.
  const init = await run(["init", target, "--sharing", "local", "--yes"]);
  assert.equal(init.code, 0, init.stderr);
}

test("save-curriculum without --yes exits 2 consent-required and writes nothing", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-c5-curr-consent-"));
  try {
    await initLocal(target);
    // --input is not read until after consent, so a placeholder path is enough to prove the gate.
    const result = await run([
      "save-curriculum",
      target,
      "--input",
      resolve(target, "absent-curriculum.json"),
    ]);
    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).type, "consent-required");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("save-lesson without --yes exits 2 consent-required and writes nothing", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-c5-lesson-consent-"));
  const draft = resolve(target, "draft.md");
  try {
    await initLocal(target);
    await writeFile(draft, "# Placeholder lesson\n\nBody.\n");
    const result = await run(["save-lesson", target, "--title", "Placeholder", "--input", draft]);
    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).type, "consent-required");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("save-lesson with --yes but a low-quality lesson exits 2 lesson-quality-failed", async () => {
  const target = await mkdtemp(resolve(tmpdir(), "repay-c5-lesson-quality-"));
  const draft = resolve(target, "bad.md");
  try {
    await initLocal(target);
    // No sections, no citations, far too short → inspectLesson fails the floor.
    await writeFile(draft, "thin content with no structure or evidence\n");
    const result = await run([
      "save-lesson",
      target,
      "--title",
      "Bad lesson",
      "--input",
      draft,
      "--yes",
    ]);
    assert.equal(result.code, 2);
    const output = JSON.parse(result.stdout);
    assert.equal(output.type, "lesson-quality-failed");
    assert.ok(output.quality && output.quality.ok === false);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
