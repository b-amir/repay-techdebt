#!/usr/bin/env node
import { parseArgs } from "node:util";
import { execa } from "execa";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { stubWorkbookTrajectory, validateTrajectory } from "../src/dialogue/trajectory.js";

const { values, positionals } = parseArgs({
  options: {
    agent: { type: "string", default: "minimal" },
  },
  allowPositionals: true,
});

async function run() {
  const target = positionals[0] || process.cwd();
  const skillRoot = resolve(import.meta.dirname, "..");
  console.log(`Running conformance suite for agent profile: ${values.agent}`);
  console.log(`Target: ${target}`);

  console.log("\n[Step 1] Checking status...");
  await execa("node", ["scripts/project-memory.js", "status", target, "--format", "json"], {
    cwd: skillRoot,
  });

  console.log("\n[Step 2] Initializing memory...");
  try {
    await execa("node", ["scripts/project-memory.js", "init", target, "--yes"], {
      cwd: skillRoot,
    });
  } catch (err) {
    if (!String(err.stderr ?? err.message).includes("already-exists")) throw err;
  }

  console.log("\n[Step 3] Verifying status after init...");
  await execa("node", ["scripts/project-memory.js", "status", target, "--format", "json"], {
    cwd: skillRoot,
  });

  console.log("\n[Step 4] Trajectory ask-fidelity (workbook stub)...");
  const trajectory = stubWorkbookTrajectory();
  const check = validateTrajectory(trajectory, { mode: "workbook" });
  if (!check.ok) {
    throw new Error(`Trajectory stub failed: ${check.errors.join("; ")}`);
  }
  const trajDir = await mkdtemp(join(tmpdir(), "repay-traj-"));
  try {
    const trajPath = join(trajDir, "trajectory.json");
    await writeFile(trajPath, JSON.stringify(trajectory));
    await execa(
      "node",
      ["scripts/check-trajectory.js", trajPath, "--mode", "workbook", "--format", "json"],
      { cwd: skillRoot },
    );
  } finally {
    await rm(trajDir, { recursive: true, force: true });
  }

  console.log("\n✅ Conformance run completed successfully. Core mechanics are intact.");
}

run().catch((err) => {
  console.error("❌ Conformance run failed:", err.message);
  process.exitCode = 1;
});
