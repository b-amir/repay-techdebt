import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateTrajectory, stubWorkbookTrajectory } from "../src/dialogue/trajectory.js";

function help() {
  process.stdout.write(`Usage:
  node check-trajectory.js <trajectory.json> [--mode workbook|focused|pr] [--format json|text]
  node check-trajectory.js --stub-workbook [--format json]

Validate checkpoint ask fidelity (B0–B6 order). Use --stub-workbook to print a valid example.
`);
}

try {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    help();
    process.exit(0);
  }
  let format = "json";
  let mode = null;
  let stub = false;
  const positional = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === "--format") format = raw[++i];
    else if (raw[i] === "--mode") mode = raw[++i];
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
  const result = validateTrajectory(trajectory, { mode: mode ?? undefined });
  if (format === "text") {
    process.stdout.write(
      `${result.ok ? "PASS" : "FAIL"} mode=${result.mode} observed=${result.observed.join(",")}\n`,
    );
    for (const error of result.errors) process.stdout.write(`- ${error}\n`);
  } else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Trajectory check failed: ${error.message}\n`);
  process.exitCode = 1;
}
