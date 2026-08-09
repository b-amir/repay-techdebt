// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  buildProgressSteps,
  PROGRESS_SCENARIOS,
  validateFlow,
  FLOW_STATES,
} from "../../../src/dialogue/flow-machine.js";

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

test("single recreation progress contains only the requested operation", () => {
  const steps = buildProgressSteps({ scenario: PROGRESS_SCENARIOS.SINGLE_RECREATE });

  assert.deepEqual(steps, ["Reading the current lesson", "Recreating the lesson", "You're set"]);
  assert.doesNotMatch(steps.join(" "), /3|picking|writing lesson/i);
});

test("first run prepends setup without changing the requested scenario", () => {
  assert.deepEqual(
    buildProgressSteps({
      scenario: PROGRESS_SCENARIOS.SINGLE_RECREATE,
      includeSetupStep: true,
    }),
    ["Get ready", "Reading the current lesson", "Recreating the lesson", "You're set"],
  );
});

test("direct lesson and viewer scenarios expose only relevant steps", () => {
  /** @type {Array<{scenario: string, expected: string[]}>} */
  const scenarios = [
    {
      scenario: PROGRESS_SCENARIOS.SINGLE_CREATE,
      expected: ["Reading your code", "Writing the lesson", "You're set"],
    },
    {
      scenario: PROGRESS_SCENARIOS.SINGLE_UPDATE,
      expected: ["Reading the lesson", "Updating the lesson", "You're set"],
    },
    {
      scenario: PROGRESS_SCENARIOS.SINGLE_DELETE,
      expected: ["Finding the lesson", "Removing the lesson", "You're set"],
    },
    {
      scenario: PROGRESS_SCENARIOS.PR_LESSON,
      expected: ["Reading the change", "Writing the lesson", "You're set"],
    },
    {
      scenario: PROGRESS_SCENARIOS.VIEW_ONLY,
      expected: ["Opening the workbook", "You're set"],
    },
  ];

  for (const { scenario, expected } of scenarios) {
    assert.deepEqual(buildProgressSteps({ scenario }), expected);
  }
});

test("workbook progress uses the actual planned batch size", () => {
  assert.deepEqual(
    buildProgressSteps({
      scenario: PROGRESS_SCENARIOS.WORKBOOK,
      lessonCount: 3,
      currentLesson: 2,
    }),
    [
      "Reading your code",
      "Picking the 3 most valuable lessons",
      "Writing lesson 2/3",
      "You're set",
    ],
  );

  assert.deepEqual(buildProgressSteps({ scenario: PROGRESS_SCENARIOS.WORKBOOK }), [
    "Reading your code",
    "Choosing the most valuable lessons",
    "Writing lessons",
    "You're set",
  ]);
});

test("explicit lesson ranges keep their real count", () => {
  assert.deepEqual(
    buildProgressSteps({
      scenario: PROGRESS_SCENARIOS.LESSON_BATCH,
      lessonCount: 5,
      currentLesson: 4,
      lessonAction: "recreate",
      includeOpenStep: true,
    }),
    [
      "Reading your code",
      "Preparing 5 lessons",
      "Recreating lesson 4/5",
      "Open workbook",
      "You're set",
    ],
  );
  assert.throws(
    () =>
      buildProgressSteps({
        scenario: PROGRESS_SCENARIOS.LESSON_BATCH,
        lessonCount: 2,
        lessonAction: /** @type {any} */ ("rename"),
      }),
    /Unknown lesson batch action/,
  );
});
