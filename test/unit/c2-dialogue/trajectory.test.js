// @category C2
// Pure unit tests for checkpoint trajectory validation. No FS, no agent stubs.
// Covers workbook/focused/pr shapes and
// skipped-with-reason.
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  validateTrajectory,
  stubWorkbookTrajectory,
  WORKBOOK_TRAJECTORY,
  FOCUSED_TRAJECTORY,
  PR_TRAJECTORY,
} from "../../../src/dialogue/trajectory.js";

const done = (id, reply = "reply") => ({ id, status: "done", reply });

test("WORKBOOK/FOCUSED/PR trajectories are distinct required sets", () => {
  assert.notDeepEqual(WORKBOOK_TRAJECTORY, FOCUSED_TRAJECTORY);
  assert.deepEqual(FOCUSED_TRAJECTORY, PR_TRAJECTORY);
  assert.ok(WORKBOOK_TRAJECTORY.includes("B3") && WORKBOOK_TRAJECTORY.includes("B4a"));
  assert.ok(!FOCUSED_TRAJECTORY.includes("B3"));
});

test("stubWorkbookTrajectory validates clean as a workbook", () => {
  const result = validateTrajectory(stubWorkbookTrajectory());
  assert.equal(result.ok, true);
  assert.equal(result.mode, "workbook");
});

test("focused mode accepts B3/B4a omitted", () => {
  const trajectory = {
    mode: "focused",
    steps: [done("B0"), done("B1"), done("B2"), done("B5"), done("B4b"), done("B6")],
  };
  const result = validateTrajectory(trajectory);
  assert.equal(result.ok, true);
  assert.equal(result.mode, "focused");
});

test("pr mode mirrors focused requirements", () => {
  const trajectory = {
    mode: "pr",
    steps: [done("B0"), done("B1"), done("B2"), done("B5"), done("B4b"), done("B6")],
  };
  const result = validateTrajectory(trajectory, { mode: "pr" });
  assert.equal(result.ok, true);
});

test("options.mode overrides trajectory.mode", () => {
  // trajectory says workbook (needs B3/B4a) but caller asks for focused
  const trajectory = {
    mode: "workbook",
    steps: [done("B0"), done("B1"), done("B2"), done("B5"), done("B4b"), done("B6")],
  };
  const result = validateTrajectory(trajectory, { mode: "focused" });
  assert.equal(result.ok, true);
  assert.equal(result.mode, "focused");
});

test("workbook without B3 fails", () => {
  const steps = [
    done("B0"),
    done("B1"),
    done("B2"),
    done("B5"),
    done("B4a"),
    done("B4b"),
    done("B6"),
  ];
  const result = validateTrajectory({ mode: "workbook", steps });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /B3/.test(e)));
});

test("required checkpoint skipped with a reason is accepted", () => {
  const trajectory = {
    mode: "focused",
    steps: [
      done("B0"),
      done("B1"),
      done("B2"),
      { id: "B5", status: "skipped", reason: "no runtime available in CI" },
      done("B4b"),
      done("B6"),
    ],
  };
  const result = validateTrajectory(trajectory);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("skipped without a reason fails", () => {
  const trajectory = {
    mode: "focused",
    steps: [
      done("B0"),
      done("B1"),
      done("B2"),
      { id: "B5", status: "skipped" },
      done("B4b"),
      done("B6"),
    ],
  };
  const result = validateTrajectory(trajectory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /skipped without reason/.test(e)));
});

test("done without a reply fails", () => {
  const trajectory = {
    mode: "focused",
    steps: [{ id: "B0", status: "done" }, done("B1")],
  };
  const result = validateTrajectory(trajectory);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /done without reply/.test(e)));
});

test("out-of-order required checkpoints fail", () => {
  const trajectory = {
    mode: "focused",
    steps: [done("B5"), done("B0"), done("B1"), done("B2"), done("B4b"), done("B6")],
  };
  const result = validateTrajectory(trajectory);
  assert.equal(result.ok, false);
});
