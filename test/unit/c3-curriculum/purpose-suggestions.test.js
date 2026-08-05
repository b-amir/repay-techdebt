import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  buildProfileFacts,
  validatePurposeAngles,
} from "../../../src/curriculum/purpose-suggestions.js";

test("buildProfileFacts handles empty or missing profile gracefully", () => {
  assert.equal(buildProfileFacts(null), "No project profile available.");
  assert.equal(buildProfileFacts({}), "No project profile available.");
  assert.equal(
    buildProfileFacts({ profile: {} }),
    "- Generic codebase (no specific workflows or boundaries detected).",
  );
});

test("buildProfileFacts extracts top workflows and boundaries", () => {
  const model = {
    profile: {
      criticalWorkflows: ["auth", "payment"],
      boundaryEvidence: [
        { path: "src/auth", confidence: 0.9 },
        { path: "src/db", confidence: 0.8 },
        { path: "src/utils", confidence: 0.5 },
      ],
    },
  };
  const facts = buildProfileFacts(model);
  assert.ok(facts.includes("- Top workflows: auth, payment"));
  assert.ok(facts.includes("- Key boundaries: src/auth, src/db"));
  assert.ok(!facts.includes("src/utils"));
});

test("validatePurposeAngles succeeds on valid schema", () => {
  const valid = {
    angles: [
      { sentence: "Angle 1", hint: "Hint 1" },
      { sentence: "Angle 2", hint: "Hint 2" },
      { sentence: "Angle 3", hint: "Hint 3" },
    ],
  };
  const parsed = validatePurposeAngles(valid);
  assert.deepEqual(parsed, valid);
});

test("validatePurposeAngles fails if missing required fields or wrong count", () => {
  assert.throws(() => {
    validatePurposeAngles({ angles: [] });
  }, /too_small/);

  assert.throws(() => {
    validatePurposeAngles({
      angles: [
        { sentence: "Angle 1" }, // missing hint
        { sentence: "Angle 2", hint: "Hint 2" },
        { sentence: "Angle 3", hint: "Hint 3" },
      ],
    });
  }, /invalid_type/);
});
