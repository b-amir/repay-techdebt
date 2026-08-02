import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { validateFixture, validateRubric } from "../scripts/lib/evaluation-schema.js";

test("validates a correct fixture", () => {
  const validFixture = {
    version: 1,
    name: "Simple CLI Fixture",
    description: "A small CLI app to test basic semantic parsing.",
    topics: [
      { id: "core-command", intent: "must-find", description: "The main entry command" },
      { id: "unrelated-file", intent: "irrelevant", description: "A decoy file" },
    ],
    workflows: [
      { id: "run-cli", mustIncludeNodes: ["command:start"], mustIncludeEdges: [] }
    ],
    lessons: {
      "core-command": {
        correctness: 5,
        importance: 4,
        focus: 5,
        clarity: 4,
        pedagogy: 5,
        actionability: 4,
        notes: "Good lesson."
      }
    },
    allowedSideEffects: []
  };

  const result = validateFixture(validFixture);
  assert.equal(result.ok, true, "Expected fixture to be valid");
  assert.equal(result.data.version, 1);
  assert.equal(result.data.topics.length, 2);
});

test("rejects invalid fixture", () => {
  const invalidFixture = {
    version: 2, // Only version 1 is allowed
    name: 123, // Should be string
    // missing description
  };

  const result = validateFixture(invalidFixture);
  assert.equal(result.ok, false, "Expected fixture to be rejected");
  assert.ok(result.errors.length > 0);
});

test("validates a correct rubric", () => {
  const validRubric = {
    correctness: 5,
    importance: 3,
    focus: 4,
    clarity: 4,
    pedagogy: 5,
    actionability: 5
  };

  const result = validateRubric(validRubric);
  assert.equal(result.ok, true, "Expected rubric to be valid");
});

test("rejects rubric out of bounds", () => {
  const invalidRubric = {
    correctness: 6, // max is 5
    importance: 0, // min is 1
    focus: 4,
    clarity: 4,
    pedagogy: 5,
    actionability: 5
  };

  const result = validateRubric(invalidRubric);
  assert.equal(result.ok, false, "Expected rubric to be rejected");
});
