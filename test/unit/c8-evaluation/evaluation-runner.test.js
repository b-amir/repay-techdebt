// @category C8
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { evaluateCurriculum } from "../../../src/evaluation/evaluation.js";

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
