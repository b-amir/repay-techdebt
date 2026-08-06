import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateFlow, FLOW_STATES } from "../src/dialogue/flow-machine.js";
import {
  checkTrajectoryGate,
  buildTrajectoryGate,
  formatPathIncompleteReason,
} from "../src/dialogue/trajectory.js";

function help() {
  process.stdout.write(`Usage:
  node check-trajectory.js <trajectory.json> [--format json|text]
  node check-trajectory.js --stub-workbook [--format json]
  node check-trajectory.js --stub-gate [--format json]

Validate TrajectoryGate path completeness (purpose/verify/skips).
Legacy flow-state arrays still parse for transition checks but do NOT pass pathComplete.
`);
}

function stubWorkbookFlow() {
  return [
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
}

function stubCompleteGate() {
  return {
    gate: buildTrajectoryGate({
      mode: "fast",
      purposeDone: true,
      verifyDone: null,
      skipReasons: {},
    }),
    subject: "flow",
    mapAnswers: "capture validates; settle records status",
  };
}

try {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    help();
    process.exit(0);
  }
  let format = "json";
  let stubWorkbook = false;
  let stubGate = false;
  const positional = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === "--format") format = raw[++i];
    else if (raw[i] === "--mode")
      ++i; // backward compat with older tests
    else if (raw[i] === "--stub-workbook") stubWorkbook = true;
    else if (raw[i] === "--stub-gate") stubGate = true;
    else if (raw[i].startsWith("--")) throw new Error(`Unknown option: ${raw[i]}`);
    else positional.push(raw[i]);
  }
  if (!["json", "text"].includes(format)) throw new Error("--format must be json or text");

  if (stubGate) {
    process.stdout.write(`${JSON.stringify(stubCompleteGate(), null, 2)}\n`);
    process.exit(0);
  }
  if (stubWorkbook) {
    // Legacy flow list for transition demos — not a complete gate.
    process.stdout.write(`${JSON.stringify(stubWorkbookFlow(), null, 2)}\n`);
    process.exit(0);
  }
  if (positional.length !== 1) throw new Error("Expected <trajectory.json>");

  const trajectory = JSON.parse(await readFile(resolve(positional[0]), "utf8"));
  const gateCheck = checkTrajectoryGate(trajectory);

  // Optional legacy flow transition check when steps/array present.
  let flow = null;
  if (Array.isArray(trajectory)) {
    flow = validateFlow(trajectory);
  } else if (Array.isArray(trajectory?.flowStates)) {
    flow = validateFlow(trajectory.flowStates);
  } else if (
    Array.isArray(trajectory?.steps) &&
    trajectory.steps.every((s) => typeof s === "string")
  ) {
    flow = validateFlow(trajectory.steps);
  }

  const result = {
    ok: gateCheck.ok,
    pathComplete: gateCheck.pathComplete,
    missing: gateCheck.missing,
    errors: gateCheck.errors,
    gate: gateCheck.gate,
    legacyFlowOnly: gateCheck.legacyFlowOnly,
    reason: gateCheck.pathComplete ? null : formatPathIncompleteReason(gateCheck),
    flow,
  };

  if (format === "text") {
    process.stdout.write(`${result.ok ? "PASS" : "FAIL"}\n`);
    if (result.reason) process.stdout.write(`${result.reason}\n`);
    for (const error of result.errors) process.stdout.write(`- ${error}\n`);
  } else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Trajectory check failed: ${error.message}\n`);
  process.exitCode = 1;
}
