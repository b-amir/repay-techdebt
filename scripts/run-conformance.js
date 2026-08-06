#!/usr/bin/env node
import { parseArgs } from "node:util";
import { execa } from "execa";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { FLOW_STATES, validateFlow } from "../src/dialogue/flow-machine.js";
import { buildTrajectoryGate } from "../src/dialogue/trajectory.js";

const { values, positionals } = parseArgs({
  options: {
    agent: { type: "string", default: "minimal" },
  },
  allowPositionals: true,
});

async function run() {
  const target = positionals[0] || process.cwd();
  const skillRoot = resolve(import.meta.dirname, "..");
  process.stdout.write(`Running conformance suite for agent profile: ${values.agent}\n`);
  process.stdout.write(`Target: ${target}\n`);

  process.stdout.write("\n[Step 1] Checking status...\n");
  await execa("node", ["scripts/project-memory.js", "status", target, "--format", "json"], {
    cwd: skillRoot,
  });

  process.stdout.write("\n[Step 2] Initializing memory...\n");
  try {
    await execa("node", ["scripts/project-memory.js", "init", target, "--yes"], {
      cwd: skillRoot,
    });
  } catch (err) {
    if (!String(err.stderr ?? err.message).includes("already-exists")) throw err;
  }

  process.stdout.write("\n[Step 3] Verifying status after init...\n");
  await execa("node", ["scripts/project-memory.js", "status", target, "--format", "json"], {
    cwd: skillRoot,
  });

  process.stdout.write("\n[Step 4] Trajectory ask-fidelity (gate + legacy demotion)...\n");
  const trajectory = [
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
  const check = validateFlow(trajectory);
  if (!check.ok) {
    throw new Error(`Trajectory stub failed: ${check.errors.join("; ")}`);
  }
  const trajDir = await mkdtemp(join(tmpdir(), "repay-traj-"));
  try {
    const gatePath = join(trajDir, "gate.json");
    const gate = buildTrajectoryGate({
      mode: "fast",
      purposeDone: true,
      verifyDone: null,
      skipReasons: {},
    });
    await writeFile(gatePath, JSON.stringify({ gate }));
    await execa(
      "node",
      ["scripts/check-trajectory.js", gatePath, "--format", "json"],
      { cwd: skillRoot },
    );

    // Legacy step-list alone must fail closed (exit 2).
    const legacyPath = join(trajDir, "legacy.json");
    await writeFile(legacyPath, JSON.stringify(trajectory));
    let legacyFailed = false;
    try {
      await execa(
        "node",
        ["scripts/check-trajectory.js", legacyPath, "--format", "json"],
        { cwd: skillRoot },
      );
    } catch (err) {
      legacyFailed = (err.exitCode ?? err.code) === 2;
    }
    if (!legacyFailed) {
      throw new Error("Legacy step-list trajectory must fail closed (pathComplete false)");
    }
  } finally {
    await rm(trajDir, { recursive: true, force: true });
  }

  process.stdout.write("\n✅ Conformance run completed successfully. Core mechanics are intact.\n");
}

run().catch((err) => {
  process.stderr.write(`❌ Conformance run failed: ${err.message}\n`);
  process.exitCode = 1;
});
