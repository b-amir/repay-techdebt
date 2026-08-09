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
  setLastRead,
  normalizeLessonKey,
} from "../../../src/viewer/index.js";
import { writeFile } from "node:fs/promises";

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

    const second = await setCompletion(progressPath, lessonPath, root, {
      nowIso: now,
    });
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

test("readProgress migrates v1 to v2", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "repay-viewer-progress-mig-"));
  const progressPath = resolve(root, "progress.json");
  try {
    const v1 = {
      schemaVersion: 1,
      updatedAt: "2026-08-01T12:00:00.000Z",
      completed: { "lessons/foo.md": { completedAt: "2026-08-01T12:00:00.000Z" } },
    };
    await writeFile(progressPath, JSON.stringify(v1));
    const p = await readProgress(progressPath);
    assert.equal(p.schemaVersion, 2);
    assert.equal(p.lastRead, null);
    assert.equal(p.completed["lessons/foo.md"].completedAt, "2026-08-01T12:00:00.000Z");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("setLastRead sets lastRead and lastScroll", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "repay-viewer-progress-last-"));
  const progressPath = resolve(root, "progress.json");
  const lessonPath = "lessons/2026-08-02-topic.md";
  const now = "2026-08-02T12:00:00.000Z";
  try {
    const p = await setLastRead(progressPath, lessonPath, root, {
      nowIso: now,
      lastScroll: "heading-1",
    });
    assert.equal(p.lastRead, lessonPath);
    assert.equal(p.lastScroll, "heading-1");
    const stored = JSON.parse(await readFile(progressPath, "utf8"));
    assert.equal(stored.lastRead, lessonPath);
    assert.equal(stored.lastScroll, "heading-1");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("setLastRead clears another lesson's scroll position", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "repay-viewer-progress-switch-"));
  const progressPath = resolve(root, "progress.json");
  try {
    await setLastRead(progressPath, "lessons/first.md", root, {
      nowIso: "2026-08-02T12:00:00.000Z",
      lastScroll: "first-section",
    });
    const switched = await setLastRead(progressPath, "lessons/second.md", root, {
      nowIso: "2026-08-02T12:01:00.000Z",
    });
    assert.equal(switched.lastRead, "lessons/second.md");
    assert.equal(switched.lastScroll, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
