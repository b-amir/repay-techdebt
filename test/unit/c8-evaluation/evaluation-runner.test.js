// @category C8
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { evaluateCurriculum, evaluateLessonBehaviors } from "../../../src/evaluation/evaluation.js";

test("evaluateCurriculum detects missing must-find topics", () => {
  const expectations = {
    topics: [
      { id: "core-feature", intent: "must-find", description: "Important" },
      { id: "helper", intent: "useful", description: "Nice to have" },
    ],
  };

  const curriculum = {
    topics: [{ id: "helper" }],
  };

  const result = evaluateCurriculum(curriculum, expectations);
  assert.equal(result.ok, false);
  assert.equal(result.missingMustFind.length, 1);
  assert.equal(result.missingMustFind[0].id, "core-feature");
});

test("evaluateCurriculum detects present forbidden topics", () => {
  const expectations = {
    topics: [
      { id: "core-feature", intent: "must-find", description: "Important" },
      { id: "secret-key", intent: "forbidden", description: "Do not expose" },
    ],
  };

  const curriculum = {
    topics: [{ id: "core-feature" }, { id: "secret-key" }],
  };

  const result = evaluateCurriculum(curriculum, expectations);
  assert.equal(result.ok, false);
  assert.equal(result.missingMustFind.length, 0);
  assert.equal(result.presentForbidden.length, 1);
  assert.equal(result.presentForbidden[0].id, "secret-key");
});

test("evaluateCurriculum passes when conditions are met", () => {
  const expectations = {
    topics: [
      { id: "core-feature", intent: "must-find", description: "Important" },
      { id: "secret-key", intent: "forbidden", description: "Do not expose" },
    ],
  };

  const curriculum = {
    topics: [{ id: "core-feature" }, { id: "extra-topic" }],
  };

  const result = evaluateCurriculum(curriculum, expectations);
  assert.equal(result.ok, true);
  assert.equal(result.missingMustFind.length, 0);
  assert.equal(result.presentForbidden.length, 0);
});

test("lesson behavior evaluation rewards a trace, contrast, decision rule, and learner job", () => {
  const markdown = `## Predict\n\nBefore you continue, predict what happens if the request fails.\n\n## Trace\n\nStart at src/chat/send.ts:10. Then follow the request to src/chat/api.ts:20.\n\n## Contrast\n\nThe common assumption is streaming bytes, but this state begins after the response.\n\n## Rule\n\nIf the request is cancelled, then preserve the local draft.\n\n## Try it\n\nModify the cancellation branch and run the focused test to verify the draft remains.`;
  const result = evaluateLessonBehaviors(markdown, { ok: true, warnings: [] });
  assert.equal(result.calibration.pedagogyFloorMet, true);
  assert.equal(result.calibration.actionabilityFloorMet, true);
  assert.ok(result.dimensions.pedagogy >= 4);
  assert.ok(result.dimensions.actionability >= 4);
});

test("lesson behavior evaluation does not reward headings alone", () => {
  const result = evaluateLessonBehaviors(
    "## Predict\n\nOverview.\n\n## Trace\n\nOverview.\n\n## Try it\n\nOverview.",
    { ok: true, warnings: [] },
  );
  assert.equal(result.calibration.pedagogyFloorMet, false);
  assert.equal(result.calibration.actionabilityFloorMet, false);
});
