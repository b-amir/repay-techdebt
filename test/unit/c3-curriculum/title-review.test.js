// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { inspectTitleSet, normalizeTitle } from "../../../src/curriculum/index.js";

test("title review exposes collisions without generating creative replacements", () => {
  const review = inspectTitleSet([
    { id: "one", title: "The Queue at the Trust Boundary" },
    { id: "two", title: "Queue at a Trust Boundary" },
    { id: "three", title: "Queue at the Trust Boundary Controls" },
  ]);

  assert.equal(normalizeTitle("The Queue at the Trust Boundary"), "queue at trust boundary");
  assert.equal(review.exactDuplicates.length, 1);
  assert.equal(review.similarPairs.length, 2);
  assert.deepEqual(Object.keys(review).sort(), [
    "exactDuplicates",
    "existingTitles",
    "similarPairs",
  ]);
  assert.equal(JSON.stringify(review).includes("suggest"), false);
  assert.equal(JSON.stringify(review).includes("replacement"), false);
});

test("different title forms remain available to the authoring agent", () => {
  const review = inspectTitleSet([
    { id: "one", title: "When Retries Become Duplicates" },
    { id: "two", title: "The Cache Has Two Owners" },
    { id: "three", title: "Permission Before Presentation" },
  ]);

  assert.deepEqual(review.exactDuplicates, []);
  assert.deepEqual(review.similarPairs, []);
});
