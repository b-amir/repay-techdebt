// @category C4
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  recordJudgment,
  hasPassingJudgment,
  validateJudgmentPayload,
  tryValidateJudgmentPayload,
} from "../../../src/lessons/lesson-judgment.js";

const VALID_JUDGMENT = {
  insight: 2,
  accuracy: 5,
  evidenceFit: 3,
  pacing: 3,
  singleSubject: 5,
  elementsPresent: 2,
  score: 60,
  mustFix: ["Explain exactly what happens if the route omits the guard."],
  reasoning: "Heading present but no causal explanation.",
  reviewerRole: "skeptical-editor",
  reviewerProvenance: "independent-agent",
};

const PASSING_JUDGMENT = {
  insight: 5,
  accuracy: 5,
  evidenceFit: 5,
  pacing: 4,
  singleSubject: 5,
  elementsPresent: 5,
  score: 95,
  mustFix: [],
  reasoning: "Genuine architectural insight with evidence fit.",
  reviewerRole: "skeptical-editor",
  reviewerProvenance: "independent-agent",
};

test("validateJudgmentPayload requires rubric dimensions", () => {
  const invalid = tryValidateJudgmentPayload({ score: 90, reasoning: "ok" });
  assert.equal(invalid.ok, false);
  assert.equal(validateJudgmentPayload(PASSING_JUDGMENT).score, 95);
  for (const reviewerProvenance of ["self", "independent-agent", "human"]) {
    assert.equal(
      validateJudgmentPayload({ ...PASSING_JUDGMENT, reviewerProvenance }).reviewerProvenance,
      reviewerProvenance,
    );
  }
  const missingProvenance = { ...PASSING_JUDGMENT };
  delete missingProvenance.reviewerProvenance;
  assert.equal(tryValidateJudgmentPayload(missingProvenance).ok, false);
});

test("hollow lesson judgment fails threshold even with headings present", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "judgment-hollow-"));
  const draftPath = resolve(dir, "draft.md");
  await writeFile(draftPath, "## The tricky part\n\nThis file exists.");

  await recordJudgment(draftPath, VALID_JUDGMENT);
  const result = await hasPassingJudgment(draftPath, 80);
  assert.equal(result.ok, false);
  assert.match(result.reason, /below threshold/);

  await rm(dir, { recursive: true, force: true });
});

test("recordJudgment and hasPassingJudgment", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "judgment-test-"));
  const draftPath = resolve(dir, "draft.md");
  await writeFile(draftPath, "My great lesson");

  const invalid = tryValidateJudgmentPayload({ reasoning: "good", score: 90 });
  assert.equal(invalid.ok, false);

  await recordJudgment(draftPath, PASSING_JUDGMENT);

  let result = await hasPassingJudgment(draftPath, 80);
  assert.equal(result.ok, true);
  assert.equal(result.record.score, 95);

  result = await hasPassingJudgment(draftPath, 96);
  assert.equal(result.ok, false);
  assert.match(result.reason, /below threshold/);

  await writeFile(draftPath, "My great lesson modified");
  result = await hasPassingJudgment(draftPath, 80);
  assert.equal(result.ok, false);
  assert.match(result.reason, /modified/);

  await rm(dir, { recursive: true, force: true });
});

test("self-review score is advisory while unresolved fixes still block", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "judgment-self-"));
  const draftPath = resolve(dir, "draft.md");
  await writeFile(draftPath, "A lesson reviewed by its author");

  await recordJudgment(draftPath, {
    ...PASSING_JUDGMENT,
    score: 40,
    reviewerProvenance: "self",
  });
  const advisory = await hasPassingJudgment(draftPath, 80);
  assert.equal(advisory.ok, true);
  assert.equal(advisory.advisory, true);

  await recordJudgment(draftPath, {
    ...PASSING_JUDGMENT,
    accuracy: 2,
    reviewerProvenance: "self",
  });
  const weakSelfReview = await hasPassingJudgment(draftPath, 80);
  assert.equal(weakSelfReview.ok, false);
  assert.match(weakSelfReview.reason, /accuracy/);

  await recordJudgment(draftPath, {
    ...PASSING_JUDGMENT,
    reviewerProvenance: "self",
    mustFix: ["Clarify the failure path."],
  });
  const blocked = await hasPassingJudgment(draftPath, 80);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /required fixes/i);

  await rm(dir, { recursive: true, force: true });
});
