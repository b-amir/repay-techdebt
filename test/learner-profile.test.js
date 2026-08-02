// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { applyLearnerProfile } from "../src/curriculum/learner-profile.js";

test("applyLearnerProfile leaves order unchanged if no profile given", () => {
  const topics = [
    { id: "1", chapter: "A", importanceReasons: [] },
    { id: "2", chapter: "B", importanceReasons: [] },
  ];
  const result = applyLearnerProfile(topics, {});
  assert.equal(result[0].id, "1");
  assert.equal(result[1].id, "2");
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
    { id: "1", chapter: "User-facing features and interactions", importanceReasons: [] },
    { id: "2", chapter: "Reliability and operations", importanceReasons: [] },
  ];
  const result = applyLearnerProfile(topics, { role: "operations" });
  assert.equal(result[0].id, "2");
  assert.equal(result[1].id, "1");
});
