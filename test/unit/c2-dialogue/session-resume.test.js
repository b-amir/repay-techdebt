// @category C2
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildTrajectoryGate, shouldReaskSessionSetup } from "../../../src/dialogue/trajectory.js";

test("session 2 does not re-ask purpose when gate has purposeDone", () => {
  const gate = {
    gate: buildTrajectoryGate({ mode: "fast", purposeDone: true, verifyDone: null }),
  };
  const decision = shouldReaskSessionSetup(gate, {
    hasStudyList: true,
    curriculumTopicCount: 3,
  });
  assert.equal(decision.reaskPurpose, false);
  assert.equal(decision.reaskStudyList, false);
  assert.match(decision.reason ?? "", /already on ledger|continue/i);
});

test("session without purpose still re-asks purpose", () => {
  const gate = {
    gate: buildTrajectoryGate({ mode: "control", purposeDone: false, verifyDone: false }),
  };
  const decision = shouldReaskSessionSetup(gate, { curriculumTopicCount: 0 });
  assert.equal(decision.reaskPurpose, true);
  assert.equal(decision.reaskStudyList, true);
});

test("purpose skipReason counts as settled", () => {
  const gate = {
    gate: buildTrajectoryGate({
      mode: "fast",
      purposeDone: false,
      verifyDone: null,
      skipReasons: { purpose: "User said onboarding path only" },
    }),
  };
  const decision = shouldReaskSessionSetup(gate, { hasStudyList: true });
  assert.equal(decision.reaskPurpose, false);
  assert.equal(decision.reaskStudyList, false);
});
