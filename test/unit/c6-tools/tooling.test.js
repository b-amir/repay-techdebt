// @category C6
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import {
  bundledBinary,
  capabilityReportSchema,
  formatCapabilityTable,
  isSameOrInside,
  pathWithSkillBinaries,
  probeCommand,
  resolveTargetRoot,
  runCommand,
  sanitizeDiagnostic,
  skillRoot,
} from "../../../src/tools/tooling.js";

// Minimal capability definition accepted by capabilitySchema (probeCommand fills the rest).
function def(overrides = {}) {
  return {
    id: "node",
    label: "Node",
    phase: "runtime",
    detail: "node runtime",
    setup: [],
    fallback: "none",
    command: "node",
    versionArgs: ["--version"],
    ...overrides,
  };
}

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

test("runCommand reports a successful command with exit code 0", async () => {
  const result = await runCommand("node", ["--version"]);
  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /\d/);
  assert.equal(result.reason, undefined);
});

test("runCommand reports a non-zero exit as failed (not 'command not found')", async () => {
  const result = await runCommand("node", ["-e", "process.exit(2)"]);
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 2);
  assert.notEqual(result.reason, "command not found");
  assert.ok(result.reason.length > 0);
});

test("probeCommand marks an installed command ready and captures its version", async () => {
  const cap = await probeCommand(def(), skillRoot);
  assert.equal(cap.status, "ready");
  assert.equal(cap.runtimeOutcome, "not-attempted");
  assert.match(cap.version, /\d/);
  assert.match(cap.detail, /succeeded/);
});

test("probeCommand marks a missing command as missing/unavailable", async () => {
  const cap = await probeCommand(
    def({ id: "missing", label: "Missing", command: "no-such-cmd-xyz" }),
    skillRoot,
  );
  assert.equal(cap.status, "missing");
  assert.equal(cap.runtimeOutcome, "unavailable");
  assert.equal(cap.detail, "command not found");
});

test("probeCommand marks a command that exits non-zero as broken/failed", async () => {
  const cap = await probeCommand(
    def({
      id: "broken",
      label: "Broken",
      versionArgs: ["-e", "process.exit(7)"],
    }),
    skillRoot,
  );
  assert.equal(cap.status, "broken");
  assert.equal(cap.runtimeOutcome, "failed");
});

test("probeCommand flags needs-setup when the project marker is absent", async () => {
  const dir = await mkdtemp(resolve(tmpdir(), "tooling-marker-"));
  try {
    const cap = await probeCommand(def({ projectMarker: "package.json" }), dir);
    assert.equal(cap.status, "needs-setup");
    assert.equal(cap.runtimeOutcome, "unavailable");
    assert.match(cap.detail, /package\.json is absent/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bundledBinary resolves an installed .bin entry and null for a missing one", () => {
  assert.equal(typeof bundledBinary("vp"), "string");
  assert.equal(bundledBinary("no-such-binary-xyz"), null);
});

test("pathWithSkillBinaries prepends the skill .bin dir to PATH", () => {
  const env = pathWithSkillBinaries({ PATH: "/usr/bin" });
  assert.ok(env.PATH.includes(resolve(skillRoot, "node_modules", ".bin")));
  assert.ok(env.PATH.endsWith(":/usr/bin").toString() || env.PATH.includes("/usr/bin"));
});
