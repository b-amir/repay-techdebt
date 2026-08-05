// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { validateFlow, FLOW_STATES } from "../../../src/dialogue/flow-machine.js";

test("validates valid flow transitions", () => {
  const flow = [
    FLOW_STATES.SETUP,
    FLOW_STATES.PURPOSE,
    FLOW_STATES.SHORTLIST,
    FLOW_STATES.GATHER,
    FLOW_STATES.DRAFT,
    FLOW_STATES.MECHANICAL_CHECK,
    FLOW_STATES.REVIEW,
    FLOW_STATES.SAVE,
    FLOW_STATES.WRAP,
  ];

  const result = validateFlow(flow);
  assert.equal(result.ok, true, result.errors.join(", "));
});

test("rejects invalid flow transitions", () => {
  const flow = [FLOW_STATES.SETUP, FLOW_STATES.SAVE];

  const result = validateFlow(flow);
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Invalid transition from setup to save/);
});

test("supports revise loop", () => {
  const flow = [
    FLOW_STATES.MECHANICAL_CHECK,
    FLOW_STATES.REVIEW,
    FLOW_STATES.REVISE,
    FLOW_STATES.MECHANICAL_CHECK,
    FLOW_STATES.REVIEW,
    FLOW_STATES.SAVE,
  ];

  const result = validateFlow(flow);
  assert.equal(result.ok, true, result.errors.join(", "));
});
