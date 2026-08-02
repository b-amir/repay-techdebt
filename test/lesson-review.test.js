// @category C4
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildLessonSpecification } from "../src/lessons/lesson-specification.js";
import { evaluateSpecification } from "../src/lessons/lesson-quality.js";

test("buildLessonSpecification produces a structured spec", () => {
  const topic = {
    id: "1",
    learnerOutcome: "Learn about DB auth",
    focus: "db.js",
  };
  const packet = {
    callers: ["auth.js"],
    dependencies: ["mysql2"],
  };

  const spec = buildLessonSpecification(topic, packet);
  assert.equal(spec.outcome, "Learn about DB auth");
  assert.ok(spec.requiredClaims.some((c) => c.includes("auth.js")));
  assert.ok(spec.requiredClaims.some((c) => c.includes("mysql2")));
  assert.ok(spec.prohibitedClaims.length > 0);
  assert.ok(spec.challenge);
});

test("evaluateSpecification detects missing required claims", () => {
  const spec = {
    requiredClaims: ["Explains dependency on mysql2"],
  };
  const markdown = "This lesson covers the auth module but forgets the DB.";
  const result = evaluateSpecification(markdown, spec);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("Missing required claim")));
});

test("evaluateSpecification passes when claims and challenge are present", () => {
  const spec = {
    requiredClaims: ["Explains dependency on mysql2"],
  };
  const markdown = "This lesson explains dependency on mysql2. Now for the challenge: build it.";
  const result = evaluateSpecification(markdown, spec);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});
