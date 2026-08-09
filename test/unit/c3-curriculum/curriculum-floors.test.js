// @category C3
// Pure unit tests for curriculum design + persistence floors. No filesystem:
// validateCurriculum only string-compares resolve(target.root), so these are pure.
// Covers: omnibus true/false, topic floors,
// naming-heuristic gate, chapter diversity.
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { validateCurriculum } from "../../../src/curriculum/approve-curriculum.js";
import { isOmnibusTopic, findOmnibusTopics } from "../../../src/curriculum/curriculum-policy.js";
import { titleFor, outcomeFor } from "../../../src/curriculum/curriculum-planning.js";

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
    relationCount: 2,
    ...overrides,
  };
}

function curriculum(topics, overrides = {}) {
  return {
    schemaVersion: 1,
    target: { root: TARGET_ROOT },
    coverage: { modeledFiles: 10 },
    scale: { availableCandidates: topics.length },
    agentApproval: {
      approvedAt: "2026-01-01T00:00:00Z",
      purposeStatus: "accepted",
      titleReview: {
        reviewedAt: "2026-01-01T00:00:00Z",
        scope: "complete-curriculum",
      },
    },
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

test("similar title diagnostics require an agent rewrite or retention reason", () => {
  const topics = [
    topic(1, { title: "The Queue at the Trust Boundary" }),
    topic(2, { title: "Queue at the Trust Boundary Controls" }),
    topic(3, { title: "Retries Become Duplicates" }),
  ];
  const unresolved = curriculum(structuredClone(topics));
  assert.throws(() => validateCurriculum(unresolved, TARGET_ROOT), /rewrite or explain/i);

  const retained = curriculum(structuredClone(topics));
  retained.agentApproval.titleReview.retainedSimilarities = [
    {
      topicIds: [topics[0].id, topics[1].id],
      reason: "Both lessons teach distinct controls at the same named trust boundary.",
    },
  ];
  assert.ok(validateCurriculum(retained, TARGET_ROOT));
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

test("validateCurriculum accepts a deliberate shortlist instead of enforcing raw candidate count", () => {
  const value = curriculum([topic(1), topic(2), topic(3)], {
    coverage: { modeledFiles: 1_200 },
    scale: { availableCandidates: 100 },
  });
  const result = validateCurriculum(value, TARGET_ROOT);
  assert.equal(result.topics.length, 3);
  assert.ok(result.approvalWarnings.some((warning) => /collapsed more than 80%/i.test(warning)));
  assert.ok(result.approvalWarnings.some((warning) => /fewer than five chapters/i.test(warning)));
});

test("batch-only curriculum suppresses learning-path breadth warnings", () => {
  const topics = [topic(1), topic(2), topic(3)];
  const value = curriculum(topics, {
    coverage: { modeledFiles: 1_200 },
    scale: { availableCandidates: 100 },
    delivery: {
      mode: "batch-only",
      requestedLessonCount: 3,
      learningPathTopics: topics.map((item) => item.id),
      sessionBatch: topics.map((item) => item.id),
    },
  });
  const result = validateCurriculum(value, TARGET_ROOT);
  assert.equal(result.topics.length, 3);
  assert.ok(!result.approvalWarnings.some((warning) => /80%|five chapters/i.test(warning)));
});

test("validateCurriculum keeps a small structural minimum for whole-app saves", () => {
  const value = curriculum([topic(1), topic(2)], {
    scale: { availableCandidates: 20 },
  });
  assert.throws(() => validateCurriculum(value, TARGET_ROOT), /at least 3 kept topics/);
});

test("topic decisions require reasons and fold evidence into the kept topic", () => {
  const source = topic(1, { evidencePaths: ["src/wrapper.js"] });
  const target = topic(2, { evidencePaths: ["src/flow.js"] });
  const third = topic(3);
  const fourth = topic(4);
  const value = curriculum([source, target, third, fourth], {
    agentApproval: {
      approvedAt: "2026-01-01T00:00:00Z",
      purposeStatus: "accepted",
      titleReview: {
        reviewedAt: "2026-01-01T00:00:00Z",
        scope: "complete-curriculum",
      },
      topicDecisions: {
        [source.id]: {
          action: "fold",
          intoTopicId: target.id,
          reason: "Same learner outcome and failure mode",
        },
      },
    },
  });

  const result = validateCurriculum(value, TARGET_ROOT);
  assert.deepEqual(
    result.topics.map((item) => item.id),
    [target.id, third.id, fourth.id],
  );
  assert.deepEqual(result.topics[0].evidencePaths, ["src/flow.js", "src/wrapper.js"]);
  assert.equal(result.scale.selectedTopics, 3);

  const reasonless = curriculum([topic(1), topic(2), topic(3)], {
    agentApproval: {
      approvedAt: "2026-01-01T00:00:00Z",
      purposeStatus: "accepted",
      titleReview: {
        reviewedAt: "2026-01-01T00:00:00Z",
        scope: "complete-curriculum",
      },
      topicDecisions: { [topic(1).id]: { action: "demote", reason: "" } },
    },
  });
  assert.throws(() => validateCurriculum(reasonless, TARGET_ROOT), /decision reason/i);
});

test("topic decisions keep their source when a stale fold target disappeared", () => {
  const source = topic(1);
  const value = curriculum([source, topic(2), topic(3)], {
    agentApproval: {
      approvedAt: "2026-01-01T00:00:00Z",
      purposeStatus: "accepted",
      titleReview: {
        reviewedAt: "2026-01-01T00:00:00Z",
        scope: "complete-curriculum",
      },
      topicDecisions: {
        [source.id]: {
          action: "fold",
          intoTopicId: "topic-ffffffffffff",
          reason: "Same flow",
        },
      },
    },
  });
  const result = validateCurriculum(value, TARGET_ROOT);
  assert.deepEqual(
    result.topics.map((item) => item.id),
    [source.id, topic(2).id, topic(3).id],
  );
  assert.deepEqual(result.agentApproval.topicDecisions, {});
  assert.ok(
    !result.approvalWarnings.some((warning) => /fold target is no longer present/i.test(warning)),
  );
});

test("stale topic decisions are stripped without blocking the current curriculum", () => {
  const value = curriculum([topic(1), topic(2), topic(3)], {
    agentApproval: {
      approvedAt: "2026-01-01T00:00:00Z",
      purposeStatus: "accepted",
      titleReview: {
        reviewedAt: "2026-01-01T00:00:00Z",
        scope: "complete-curriculum",
      },
      topicDecisions: Object.fromEntries(
        Array.from({ length: 130 }, (_, index) => [
          `topic-${(index + 100).toString(16).padStart(12, "0")}`,
          { action: "demote", reason: "Superseded planner candidate" },
        ]),
      ),
      demotedTopicIds: ["topic-ffffffffffff"],
    },
  });

  const result = validateCurriculum(value, TARGET_ROOT);
  assert.equal(result.topics.length, 3);
  assert.deepEqual(result.agentApproval.topicDecisions, {});
  assert.deepEqual(result.agentApproval.demotedTopicIds, []);
  assert.ok(
    !result.approvalWarnings.some((warning) =>
      /stale topic decision|stale legacy demotion/i.test(warning),
    ),
  );
});

test("unchanged planner title is blocked until the agent authors it or records a reason", () => {
  const focus = "app/domains/chat/store/types.ts";
  const planned = topic(1, {
    kind: "module",
    focus,
    title: titleFor("module", focus),
    learnerOutcome: outcomeFor("module", focus),
  });
  const value = curriculum([planned, topic(2), topic(3)]);
  assert.throws(() => validateCurriculum(value, TARGET_ROOT), /planner title placeholder/i);

  const booleanBypass = curriculum(
    [
      topic(1, {
        kind: "module",
        focus,
        title: titleFor("module", focus),
        learnerOutcome: outcomeFor("module", focus),
      }),
      topic(2),
      topic(3),
    ],
    {
      agentApproval: {
        approvedAt: "2026-01-01T00:00:00Z",
        purposeStatus: "accepted",
        titleReview: {
          reviewedAt: "2026-01-01T00:00:00Z",
          scope: "complete-curriculum",
        },
        placeholderReasons: { [planned.id]: { title: true, learnerOutcome: true } },
      },
    },
  );
  assert.throws(() => validateCurriculum(booleanBypass, TARGET_ROOT), /planner title placeholder/i);

  booleanBypass.agentApproval.placeholderReasons[planned.id] = {
    title: "The project uses this exact product term, so changing it would reduce clarity.",
    learnerOutcome: "The source-defined outcome is already precise.",
  };
  assert.ok(validateCurriculum(booleanBypass, TARGET_ROOT));
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
    /Topics need structured corroboration/,
  );

  // Corroborated via approval list → passes
  const stamped = curriculum([speculative, topic(2), topic(3)], {
    agentApproval: {
      approvedAt: "2026-01-01T00:00:00Z",
      purposeStatus: "accepted",
      titleReview: {
        reviewedAt: "2026-01-01T00:00:00Z",
        scope: "complete-curriculum",
      },
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

test("large-repository chapter concentration is a warning, not a save failure", () => {
  const topics = Array.from({ length: 60 }, (_, i) =>
    topic(i + 1, { chapter: ["billing", "shipping", "auth", "infra"][i % 4] }),
  );
  const value = curriculum(topics, {
    coverage: { modeledFiles: 1_000 },
    scale: { availableCandidates: 60 },
  });
  const result = validateCurriculum(value, TARGET_ROOT);
  assert.ok(result.approvalWarnings.some((warning) => /fewer than five chapters/i.test(warning)));

  // Same scale, five chapters → passes
  const diverse = Array.from({ length: 60 }, (_, i) =>
    topic(i + 1, {
      chapter: ["billing", "shipping", "auth", "infra", "data"][i % 5],
    }),
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
