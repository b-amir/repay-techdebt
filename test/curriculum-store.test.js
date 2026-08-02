// @category C5
import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import {
  readCurriculum,
  writeCurriculum,
  CurriculumConflictError,
} from "../src/memory/curriculum-store.js";

test("curriculum-store handles revisions and locks correctly", async () => {
  const targetRoot = await mkdtemp(resolve(tmpdir(), "store-"));
  const filePath = join(targetRoot, "curriculum.json");

  try {
    // 1. Initial read should be null
    const { data: initialData, revision: initialRevision } = await readCurriculum(filePath);
    assert.equal(initialData, null);
    assert.equal(initialRevision, null);

    // 2. Initial write
    const curriculum = { topics: [{ id: "topic-1", title: "Test" }] };
    const rev1 = await writeCurriculum(filePath, curriculum, initialRevision);
    assert.ok(rev1, "Should return a revision hash");

    // 3. Read back
    const { data: data1, revision: readRev1 } = await readCurriculum(filePath);
    assert.equal(readRev1, rev1);
    assert.deepEqual(data1.topics, curriculum.topics);
    assert.ok(data1.history, "History array should be initialized");
    assert.ok(data1.learnerCompletion, "learnerCompletion should be initialized");

    // 4. Successful update with correct revision
    data1.topics.push({ id: "topic-2" });
    data1.history.push({ action: "added topic-2" });
    const rev2 = await writeCurriculum(filePath, data1, rev1);
    assert.notEqual(rev2, rev1);

    // 5. Conflict failure (simulating another process having written in the meantime)
    try {
      await writeCurriculum(filePath, data1, rev1); // using old rev1
      assert.fail("Should have thrown CurriculumConflictError");
    } catch (error) {
      assert.ok(error instanceof CurriculumConflictError);
      assert.match(error.message, /Expected revision/);
    }

    // 6. Test concurrent writes (lock contention)
    const concurrentWrites = Array.from({ length: 5 }).map((_, i) => {
      return (async () => {
        // We do not pass expectedRevision to force blind overwrite just to test the lock queuing
        // actually we can't blind overwrite concurrently without getting a corrupt file if rename wasn't atomic,
        // but lock prevents that entirely.
        const d = { topics: [], writer: i };
        await writeCurriculum(filePath, d);
      })();
    });

    await Promise.allSettled(concurrentWrites);
    const { data: finalData } = await readCurriculum(filePath);
    assert.ok(finalData.writer >= 0 && finalData.writer < 5);
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
});
