// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { applyLearnerProfile } from "../../../src/curriculum/learner-profile.js";

function topic(id, kind, learningStage, reasons = [], chapter = "Features") {
  return {
    id,
    kind,
    learningStage,
    importanceReasons: reasons,
    chapter,
  };
}

test("applyLearnerProfile handles empty profile", () => {
  const topics = [topic("t1", "area", "1. orientation")];
  const sorted = applyLearnerProfile(topics, {});
  assert.equal(sorted[0].id, "t1");
});

test("applyLearnerProfile handles familiarity 'new' (default)", () => {
  const topics = [topic("t1", "workflow", "3. applied"), topic("t2", "area", "1. orientation")];
  const sorted = applyLearnerProfile(topics, { familiarity: "new" });
  assert.equal(sorted[0].id, "t2", "1. orientation topic is pulled to the front for 'new'");
});

test("applyLearnerProfile handles familiarity 'dabbled'", () => {
  const topics = [
    topic("t1", "area", "1. orientation"),
    topic("t2", "workflow", "2. foundational"),
    topic("t3", "area", "1. orientation"),
  ];
  const sorted = applyLearnerProfile(topics, { familiarity: "dabbled" });
  assert.equal(sorted.length, 1);
  assert.equal(sorted[0].id, "t2", "1. orientation topics are removed for 'dabbled'");
});

test("applyLearnerProfile handles familiarity 'owner'", () => {
  const topics = [
    topic("t1", "area", "1. orientation"),
    topic("t2", "workflow", "2. foundational"),
    topic("t3", "entry", "2. foundational"),
    topic("t4", "boundary", "2. foundational"),
  ];
  const sorted = applyLearnerProfile(topics, { familiarity: "owner" });
  assert.equal(sorted.length, 1);
  assert.equal(
    sorted[0].id,
    "t4",
    "1. orientation, workflow, and entry topics are removed for 'owner'",
  );
});

test("applyLearnerProfile boosts security topics for security role", () => {
  const topics = [
    { id: "1", chapter: "Features", importanceReasons: [] },
    {
      id: "2",
      chapter: "Core",
      importanceReasons: ["(+) Involves security, auth, or trust boundaries."],
    },
  ];
  const result = applyLearnerProfile(topics, { role: "security review" });
  assert.equal(result[0].id, "2");
  assert.equal(result[1].id, "1");
});

test("applyLearnerProfile boosts operations topics for operations role", () => {
  const topics = [
    {
      id: "1",
      chapter: "User-facing features and interactions",
      importanceReasons: [],
    },
    { id: "2", chapter: "Reliability and operations", importanceReasons: [] },
  ];
  const result = applyLearnerProfile(topics, { role: "operations" });
  assert.equal(result[0].id, "2");
  assert.equal(result[1].id, "1");
});
