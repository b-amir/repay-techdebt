// @category C4
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vite-plus/test";
import { cleanupDraftInput, shouldCleanupDraftInput } from "../../../src/lessons/draft-cleanup.js";

test("shouldCleanupDraftInput accepts .draft- files", () => {
  const decision = shouldCleanupDraftInput("/tmp/.draft-lesson.md", "/final/lesson.md");
  assert.equal(decision.cleanup, true);
  assert.equal(decision.reason, "draft-prefix");
});

test("shouldCleanupDraftInput accepts temp-dir drafts", () => {
  const draft = join(tmpdir(), "repay-draft-abc.md");
  const decision = shouldCleanupDraftInput(draft, "/final/lesson.md");
  assert.equal(decision.cleanup, true);
  assert.equal(decision.reason, "temp-dir");
});

test("shouldCleanupDraftInput skips when cleanup disabled", () => {
  const decision = shouldCleanupDraftInput("/tmp/.draft-lesson.md", "/final/lesson.md", {
    cleanupInput: false,
  });
  assert.equal(decision.cleanup, false);
  assert.equal(decision.reason, "cleanup-disabled");
});

test("shouldCleanupDraftInput skips same path as output", () => {
  const path = "/tmp/lesson.md";
  const decision = shouldCleanupDraftInput(path, path);
  assert.equal(decision.cleanup, false);
  assert.equal(decision.reason, "same-as-output");
});

test("cleanupDraftInput removes eligible draft files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "repay-draft-cleanup-"));
  const draftPath = join(dir, ".draft-lesson.md");
  await writeFile(draftPath, "draft");
  const result = await cleanupDraftInput(draftPath, join(dir, "final.md"));
  assert.equal(result.cleaned, true);
  await rm(dir, { recursive: true, force: true });
});

test("cleanupDraftInput keeps normal lesson files outside eligible paths", async () => {
  const dir = join(process.cwd(), "test", "tmp-draft-cleanup-fixture");
  await mkdir(dir, { recursive: true });
  const normalPath = join(dir, "lesson.md");
  await writeFile(normalPath, "lesson");
  const result = await cleanupDraftInput(normalPath, join(dir, "final.md"));
  assert.equal(result.cleaned, false);
  await rm(dir, { recursive: true, force: true });
});
