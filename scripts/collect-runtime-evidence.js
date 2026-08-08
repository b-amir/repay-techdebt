#!/usr/bin/env node
import { parseArgs } from "node:util";
import { collectRuntimeEvidence } from "../src/tools/runtime-evidence.js";

const { values, positionals } = parseArgs({
  options: {
    consent: { type: "boolean" },
    command: { type: "string" },
    workload: { type: "string" },
    timeout: { type: "string" },
    "allow-env": { type: "string", multiple: true },
  },
  allowPositionals: true,
});

async function run() {
  if (!values.command) {
    process.stderr.write("Error: --command is required.\n");
    process.exitCode = 1;
    return;
  }

  const plan = {
    command: values.command,
    args: positionals,
    workload: values.workload || "unknown",
    durationMs: values.timeout ? parseInt(values.timeout, 10) : 30000,
    envAllowlist: values["allow-env"] || [],
  };

  const result = await collectRuntimeEvidence(plan, values.consent || false);

  if (result.status === "refused") {
    process.stderr.write(`[REFUSED] ${result.error}\n`);
    process.stderr.write("To authorize this execution, run again with --consent.\n");
    process.exitCode = 1;
    return;
  }

  if (result.status === "failed") {
    process.stderr.write(`[FAILED] ${result.error}\n`);
    if (result.stderr) process.stderr.write(`${result.stderr}\n`);
    process.exitCode = 2;
    return;
  }

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

run().catch((err) => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exitCode = 1;
});
