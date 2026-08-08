// @category C6
import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { collectRuntimeEvidence } from "../../../src/tools/runtime-evidence.js";

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

test("Runtime evidence withholds ambient variables unless their names are allowed", async () => {
  const name = "REPAY_RUNTIME_PRIVATE_VALUE";
  const previous = process.env[name];
  process.env[name] = "not-for-child-process";
  try {
    const hidden = await collectRuntimeEvidence(
      { command: "node", args: ["-e", `process.stdout.write(process.env.${name} || "hidden")`] },
      true,
    );
    assert.equal(hidden.evidence, "hidden");

    const allowed = await collectRuntimeEvidence(
      {
        command: "node",
        args: ["-e", `process.stdout.write(process.env.${name} || "hidden")`],
        envAllowlist: [name],
      },
      true,
    );
    assert.equal(allowed.evidence, "not-for-child-process");
    assert.deepEqual(allowed.provenance.environmentNames, [name]);
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
});

test("Runtime evidence redacts likely credentials from captured output", async () => {
  const result = await collectRuntimeEvidence(
    {
      command: "node",
      args: ["-e", 'process.stdout.write("token=definitely-sensitive-value")'],
    },
    true,
  );

  assert.equal(result.status, "successful");
  assert.equal(result.evidence, "[REDACTED]");
});

test("Runtime evidence rejects multiline command tokens", async () => {
  await assert.rejects(
    collectRuntimeEvidence({ command: "node\n--eval", args: [] }, true),
    /without control lines/u,
  );
});
