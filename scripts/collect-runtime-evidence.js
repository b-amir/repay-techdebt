#!/usr/bin/env node
import { parseArgs } from "node:util";
import { collectRuntimeEvidence } from "../src/tools/runtime-evidence.js";

const { values, positionals } = parseArgs({
  options: {
    consent: { type: "boolean" },
    command: { type: "string" },
    workload: { type: "string" },
    timeout: { type: "string" },
  },
  allowPositionals: true,
});

async function run() {
  if (!values.command) {
    console.error("Error: --command is required.");
    process.exitCode = 1;
    return;
  }

  const plan = {
    command: values.command,
    args: positionals,
    workload: values.workload || "unknown",
    durationMs: values.timeout ? parseInt(values.timeout, 10) : 30000,
  };

  const result = await collectRuntimeEvidence(plan, values.consent || false);

  if (result.status === "refused") {
    console.error(`[REFUSED] ${result.error}`);
    console.error("To authorize this execution, run again with --consent.");
    process.exitCode = 1;
    return;
  }

  if (result.status === "failed") {
    console.error(`[FAILED] ${result.error}`);
    if (result.stderr) console.error(result.stderr);
    process.exitCode = 2;
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
