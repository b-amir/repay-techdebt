// @category C3
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  buildTeachingCurriculum,
  TEACHING_CHAPTER,
  validateCurriculum,
} from "../../../src/curriculum/index.js";

test("buildTeachingCurriculum produces a valid mini workbook under Recent teaching", () => {
  const approvedAt = "2026-08-02T12:00:00.000Z";
  const targetRoot = resolve("/tmp/repay-mini-curriculum-target");
  const proposal = buildTeachingCurriculum({
    targetRoot,
    approvedAt,
    origin: "PR #42",
    subjects: [
      {
        title: "Capture handoff",
        focus: "capture to settle handoff",
        evidencePaths: ["billing/capture.js"],
      },
    ],
  });
  assert.equal(proposal.topics.length, 1);
  assert.equal(proposal.topics[0].chapter, TEACHING_CHAPTER);
  assert.equal(proposal.agentApproval.corroboratedTopicIds.length, 1);
  const validated = validateCurriculum(proposal, targetRoot);
  assert.equal(validated.topics.length, 1);
  assert.equal(validated.topics[0].status, "planned");
});

test("buildTeachingCurriculum rejects more than five subjects", () => {
  const subjects = Array.from({ length: 6 }, (_, index) => ({
    title: `Topic ${index}`,
    focus: `focus-${index}`,
  }));
  assert.throws(
    () =>
      buildTeachingCurriculum({
        targetRoot: resolve("/tmp/x"),
        approvedAt: "2026-08-02T12:00:00.000Z",
        subjects,
      }),
    /1–5 subjects/,
  );
});

test("mini curriculum persists through validateCurriculum on a real target root", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-mini-curr-"));
  try {
    const targetRoot = resolve(base, "app");
    const proposal = buildTeachingCurriculum({
      targetRoot,
      approvedAt: "2026-08-02T12:00:00.000Z",
      subjects: [
        { title: "Area A", focus: "area-a-boundary", evidencePaths: [] },
        { title: "Area B", focus: "area-b-boundary", evidencePaths: [] },
      ],
    });
    const validated = validateCurriculum(proposal, targetRoot);
    assert.equal(validated.topics.length, 2);
    assert.deepEqual(new Set(validated.topics.map((t) => t.chapter)), new Set([TEACHING_CHAPTER]));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
