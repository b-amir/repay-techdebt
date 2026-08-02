// @category C5
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  emptyProgress,
  readProgress,
  setCompletion,
  normalizeLessonKey,
} from "../../../src/viewer/index.js";

test("normalizeLessonKey rejects path escape", () => {
  const root = resolve("/workbook");
  assert.throws(() => normalizeLessonKey("../outside.md", root), /escapes/);
});

test("setCompletion toggles progress.json atomically", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "repay-viewer-progress-"));
  const progressPath = resolve(root, "progress.json");
  const lessonPath = "lessons/2026-08-02-topic.md";
  const now = "2026-08-02T12:00:00.000Z";
  try {
    const first = await setCompletion(progressPath, lessonPath, root, {
      nowIso: now,
      topicId: "topic-123456789abc",
      completed: true,
    });
    assert.equal(first.completed, true);
    const stored = JSON.parse(await readFile(progressPath, "utf8"));
    assert.equal(stored.completed[lessonPath].topicId, "topic-123456789abc");

    const second = await setCompletion(progressPath, lessonPath, root, { nowIso: now });
    assert.equal(second.completed, false);
    assert.equal((await readProgress(progressPath)).completed[lessonPath], undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readProgress returns empty store when file is missing", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "repay-viewer-progress-miss-"));
  try {
    const progress = await readProgress(resolve(root, "progress.json"));
    assert.deepEqual(progress, emptyProgress());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
