import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  capabilityReportSchema,
  formatCapabilityTable,
  isSameOrInside,
  resolveTargetRoot,
  runCommand,
  sanitizeDiagnostic,
  skillRoot,
} from "../scripts/lib/tooling.js";

test("distinguishes nested skill paths from sibling repositories", () => {
  assert.equal(
    isSameOrInside("/workspace/app/.agents/skills/repay-techdebt", "/workspace/app"),
    true,
  );
  assert.equal(isSameOrInside("/workspace/app", "/workspace/app"), true);
  assert.equal(isSameOrInside("/workspace/application", "/workspace/app"), false);
});

test("reports the exact skill path when the installation is nested in a target", async () => {
  const result = await resolveTargetRoot(resolve(skillRoot, ".."));
  assert.equal(result.relativeSkillRoot, skillRoot.split(/[\\/]/).pop());
});

test("sanitizes common credential-shaped diagnostics", () => {
  const diagnostic = sanitizeDiagnostic(
    ["Authorization: Bearer", "sk-testvalue123456789", "password=hunter2"].join(" "),
  );
  assert.equal(diagnostic.includes("hunter2"), false);
  assert.equal(diagnostic.includes("sk-testvalue"), false);
  assert.match(diagnostic, /\[REDACTED\]/);
});

test("reports a missing command without throwing", async () => {
  const result = await runCommand("repay-techdebt-command-that-does-not-exist", ["--version"]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "command not found");
});

test("formats a validated capability report", () => {
  const report = capabilityReportSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date(0).toISOString(),
    projectRoot: "/tmp/project",
    capabilities: [
      {
        id: "example",
        label: "Example",
        phase: "test",
        kind: "cli",
        status: "missing",
        detail: "command not found",
        setup: ["install example"],
        fallback: "manual inspection",
      },
    ],
  });
  const table = formatCapabilityTable(report);
  assert.match(table, /Example/);
  assert.match(table, /manual inspection/);
});
