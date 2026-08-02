import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { collectRuntimeEvidence } from "../scripts/lib/runtime-evidence.js";

test("Refuses to run without explicit consent", async () => {
  const plan = { command: "echo", args: ["hello"] };
  const result = await collectRuntimeEvidence(plan, false);
  
  assert.equal(result.status, "refused");
  assert.match(result.error, /explicit consent is required/i);
  assert.equal(result.evidence, null);
  assert.equal(result.provenance.command, "echo");
});

test("Executes command when consent is granted", async () => {
  const plan = { command: "echo", args: ["hello"] };
  const result = await collectRuntimeEvidence(plan, true);
  
  assert.equal(result.status, "successful");
  assert.match(result.evidence, /hello/);
  assert.ok(result.provenance.durationMs >= 0);
  assert.ok(result.provenance.timestamp);
});

test("Handles command failure gracefully", async () => {
  const plan = { command: "node", args: ["-e", "process.exit(1)"] };
  const result = await collectRuntimeEvidence(plan, true);
  
  assert.equal(result.status, "failed");
  assert.match(result.error, /exit code 1/);
});
