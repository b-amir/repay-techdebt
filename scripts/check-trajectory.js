import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateFlow, FLOW_STATES } from "../src/dialogue/flow-machine.js";

function help() {
  process.stdout.write(`Usage:
  node check-trajectory.js <trajectory.json> [--format json|text]
  node check-trajectory.js --stub-workbook [--format json]

Validate checkpoint ask fidelity using flow states. Use --stub-workbook to print a valid example.
`);
}

function stubWorkbookTrajectory() {
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

try {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    help();
    process.exit(0);
  }
  let format = "json";
  let stub = false;
  const positional = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === "--format") format = raw[++i];
    else if (raw[i] === "--mode")
      ++i; // ignore mode for backward compat in test
    else if (raw[i] === "--stub-workbook") stub = true;
    else if (raw[i].startsWith("--")) throw new Error(`Unknown option: ${raw[i]}`);
    else positional.push(raw[i]);
  }
  if (stub) {
    const trajectory = stubWorkbookTrajectory();
    process.stdout.write(`${JSON.stringify(trajectory, null, 2)}\n`);
    process.exit(0);
  }
  if (positional.length !== 1) throw new Error("Expected <trajectory.json>");
  if (!["json", "text"].includes(format)) throw new Error("--format must be json or text");

  const trajectory = JSON.parse(await readFile(resolve(positional[0]), "utf8"));
  const states = Array.isArray(trajectory)
    ? trajectory
    : trajectory.steps
      ? trajectory.steps.map((s) => s.id)
      : [];

  const result = validateFlow(states);
  if (format === "text") {
    process.stdout.write(`${result.ok ? "PASS" : "FAIL"}\n`);
    if (result.errors) {
      for (const error of result.errors) process.stdout.write(`- ${error}\n`);
    }
  } else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.ok) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Trajectory check failed: ${error.message}\n`);
  process.exitCode = 1;
}
