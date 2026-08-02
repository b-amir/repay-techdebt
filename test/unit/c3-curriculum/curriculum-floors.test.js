// @category C3
// Pure unit tests for curriculum design + persistence floors. No filesystem:
// validateCurriculum only string-compares resolve(target.root), so these are pure.
// Covers: omnibus true/false, topic floors,
// naming-heuristic gate, chapter diversity.
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { validateCurriculum } from "../../../src/curriculum/approve-curriculum.js";
import { isOmnibusTopic, findOmnibusTopics } from "../../../src/curriculum/curriculum-policy.js";

const TARGET_ROOT = "/tmp/repay-c3-target";

function topic(i, overrides = {}) {
  return {
    id: `topic-${i.toString(16).padStart(12, "0")}`,
    title: `Focused topic ${i}`,
    focus: `focus-${i}`,
    learnerOutcome: `Learner can reason about focus ${i}`,
    chapter: "billing",
    evidencePaths: [],
    signalClass: "graph-confirmed",
    ...overrides,
  };
}

function curriculum(topics, overrides = {}) {
  return {
    schemaVersion: 1,
    target: { root: TARGET_ROOT },
    coverage: { modeledFiles: 10 },
    scale: { availableCandidates: topics.length },
    agentApproval: { approvedAt: "2026-01-01T00:00:00Z", purposeStatus: "accepted" },
    topics,
    ...overrides,
  };
}

test("isOmnibusTopic flags whole-app subjects and leaves focused ones alone", () => {
  assert.equal(isOmnibusTopic({ title: "Understand the whole application" }), true);
  assert.equal(isOmnibusTopic({ title: "Complete overview of the system" }), true);
  assert.equal(isOmnibusTopic({ focus: "everything about the codebase" }), true);
  assert.equal(isOmnibusTopic({ title: "How capturePayment queues the settlement job" }), false);
});

test("findOmnibusTopics returns only the omnibus entries", () => {
  const topics = [
    { id: "t1", title: "billing capture flow" },
    { id: "t2", title: "full walkthrough of the app" },
    { id: "t3", title: "settle mechanism" },
  ];
  assert.deepEqual(
    findOmnibusTopics(topics).map((t) => t.id),
    ["t2"],
  );
  assert.deepEqual(findOmnibusTopics([]), []);
});

test("validateCurriculum accepts a minimal corroborated shortlist and mutates status", () => {
  const value = curriculum([topic(1), topic(2), topic(3)]);
  const result = validateCurriculum(value, TARGET_ROOT);
  assert.equal(result, value, "validateCurriculum returns the same (mutated) object");
  for (const t of result.topics) {
    assert.equal(t.status, "planned");
    assert.equal(t.lessonPath, null);
    assert.equal(t.writtenAt, undefined);
  }
});

test("validateCurriculum rejects non-v1 / wrong-target input", () => {
  assert.throws(
    () => validateCurriculum({ ...curriculum([topic(1)]), schemaVersion: 2 }, TARGET_ROOT),
    /schema-v1/,
  );
  assert.throws(
    () =>
      validateCurriculum(
        { ...curriculum([topic(1)]), target: { root: "/elsewhere" } },
        TARGET_ROOT,
      ),
    /target does not match/,
  );
});

test("validateCurriculum rejects malformed topic ids", () => {
  const value = curriculum([topic(1), topic(2, { id: "topic-xyz" })]);
  assert.throws(() => validateCurriculum(value, TARGET_ROOT), /topic IDs must be unique/);
});

test("validateCurriculum rejects duplicate topic ids", () => {
  const value = curriculum([topic(1), topic(2, { id: topic(1).id, focus: "focus-2" })]);
  assert.throws(() => validateCurriculum(value, TARGET_ROOT), /topic IDs must be unique/);
});

test("validateCurriculum rejects a repeated focus", () => {
  const value = curriculum([topic(1), topic(2, { focus: "focus-1" })]);
  assert.throws(() => validateCurriculum(value, TARGET_ROOT), /repeats the focus focus-1/);
});

test("validateCurriculum enforces the anti-compression topic floor", () => {
  // 3 topics but the planner claims 12 available candidates on a small repo → requires 12.
  const value = curriculum([topic(1), topic(2), topic(3)], {
    scale: { availableCandidates: 12 },
  });
  assert.throws(
    () => validateCurriculum(value, TARGET_ROOT),
    /require at least 12.*omnibus lessons/,
  );
});

test("validateCurriculum forbids omnibus topics at save time", () => {
  const value = curriculum([
    topic(1, { title: "Understand the whole application" }),
    topic(2),
    topic(3),
  ]);
  assert.throws(
    () => validateCurriculum(value, TARGET_ROOT),
    /Omnibus topics must be split or demoted/,
  );
});

test("naming-heuristic topics need corroboration before save", () => {
  const speculative = topic(1, { signalClass: "naming-heuristic" });
  const value = curriculum([speculative, topic(2), topic(3)]);
  assert.throws(
    () => validateCurriculum(value, TARGET_ROOT),
    /Naming-heuristic topics need corroboration/,
  );

  // Corroborated via approval list → passes
  const stamped = curriculum([speculative, topic(2), topic(3)], {
    agentApproval: {
      approvedAt: "2026-01-01T00:00:00Z",
      purposeStatus: "accepted",
      corroboratedTopicIds: [speculative.id],
    },
  });
  assert.ok(validateCurriculum(stamped, TARGET_ROOT));

  // Corroborated via topic flag → passes
  const flagged = curriculum([{ ...speculative, corroborated: true }, topic(2), topic(3)]);
  assert.ok(validateCurriculum(flagged, TARGET_ROOT));
});

test("validateCurriculum caps focused topics at 150", () => {
  const topics = Array.from({ length: 151 }, (_, i) => topic(i + 1));
  const value = curriculum(topics, { scale: { availableCandidates: 151 } });
  assert.throws(() => validateCurriculum(value, TARGET_ROOT), /cannot exceed 150 focused topics/);
});

test("large-repository curriculum must span at least five chapters", () => {
  const topics = Array.from({ length: 60 }, (_, i) =>
    topic(i + 1, { chapter: ["billing", "shipping", "auth", "infra"][i % 4] }),
  );
  const value = curriculum(topics, {
    coverage: { modeledFiles: 1_000 },
    scale: { availableCandidates: 60 },
  });
  assert.throws(
    () => validateCurriculum(value, TARGET_ROOT),
    /at least five distinct learning chapters/,
  );

  // Same scale, five chapters → passes
  const diverse = Array.from({ length: 60 }, (_, i) =>
    topic(i + 1, { chapter: ["billing", "shipping", "auth", "infra", "data"][i % 5] }),
  );
  assert.ok(
    validateCurriculum(
      curriculum(diverse, {
        coverage: { modeledFiles: 1_000 },
        scale: { availableCandidates: 60 },
      }),
      TARGET_ROOT,
    ),
  );
});
