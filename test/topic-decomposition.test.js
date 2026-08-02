import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { deduplicateAndSplitTopics } from "../scripts/lib/topic-decomposition.js";

test("deduplicateAndSplitTopics merges exact duplicates", () => {
  const candidates = [
    { id: "1", kind: "workflow", focus: "auth", evidencePaths: ["a.js"], importanceReasons: [] },
    { id: "2", kind: "workflow", focus: "auth", evidencePaths: ["b.js"], importanceReasons: [] }
  ];
  
  const result = deduplicateAndSplitTopics(candidates);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].evidencePaths, ["a.js", "b.js"]);
  assert.ok(result[0].importanceReasons.some(r => r.includes("Merged with duplicate candidate")));
});

test("deduplicateAndSplitTopics splits compound topics", () => {
  const candidates = [
    { id: "1", kind: "area", focus: "auth, billing", evidencePaths: ["a.js"], importanceReasons: [] }
  ];
  
  const result = deduplicateAndSplitTopics(candidates);
  assert.equal(result.length, 2);
  assert.equal(result[0].focus, "auth");
  assert.equal(result[1].focus, "billing");
  assert.ok(result[0].importanceReasons.some(r => r.includes("Split from compound topic")));
});
