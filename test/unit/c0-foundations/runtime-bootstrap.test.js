// @category C0
import assert from "node:assert/strict";
import { symlink, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import { isDirectCliInvocation } from "../../../src/foundations/cli-entry.js";
import { auditSkillRuntime, getSkillHashes } from "../../../src/foundations/runtime-audit.js";
import { skillRoot } from "../../../src/foundations/targeting.js";

test("isDirectCliInvocation matches realpath when argv is a symlink", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-cli-entry-"));
  try {
    const scriptsDir = resolve(base, "scripts");
    const linkDir = resolve(base, "link");
    await mkdir(scriptsDir, { recursive: true });
    const realScript = resolve(scriptsDir, "probe.js");
    await writeFile(realScript, "export {}\n", "utf8");
    await symlink(scriptsDir, linkDir);
    const linkScript = resolve(linkDir, "probe.js");
    const metaUrl = new URL(`file://${realScript}`).href;
    const originalArgv = process.argv[1];
    process.argv[1] = linkScript;
    assert.equal(isDirectCliInvocation(metaUrl), true);
    process.argv[1] = originalArgv;
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("auditSkillRuntime reports ready when node_modules exists", async () => {
  const report = await auditSkillRuntime(skillRoot);
  assert.equal(report.status, "ready");
  assert.ok(report.packages.length > 0);
});

test("runtime identity changes when workspace install settings change", async () => {
  const base = await mkdtemp(resolve(tmpdir(), "repay-runtime-hash-"));
  try {
    await writeFile(resolve(base, "package.json"), '{"dependencies":{"zod":"4.4.3"}}\n');
    await writeFile(resolve(base, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    await writeFile(resolve(base, "pnpm-workspace.yaml"), "packages:\n  - .\n");
    const before = await getSkillHashes(base);
    await writeFile(
      resolve(base, "pnpm-workspace.yaml"),
      "packages:\n  - .\noverrides:\n  zod: 4.4.3\n",
    );
    const after = await getSkillHashes(base);
    assert.notEqual(before.workspaceHash, after.workspaceHash);
    assert.notEqual(before.runtimeHash, after.runtimeHash);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("bootstrapSkillRuntime is ready when node_modules exists", async () => {
  const { bootstrapSkillRuntime } = await import("../../../src/foundations/runtime-install.js");
  const result = await bootstrapSkillRuntime(skillRoot);
  assert.equal(result.report.status, "ready");
  assert.equal(result.installed, false);
});

test("ensureSkillRuntime skips PATH shim by default", async () => {
  const previous = process.env.REPAY_LINK_CLI;
  const previousStateHome = process.env.XDG_STATE_HOME;
  const stateHome = await mkdtemp(resolve(tmpdir(), "repay-runtime-state-"));
  delete process.env.REPAY_LINK_CLI;
  process.env.XDG_STATE_HOME = stateHome;
  try {
    const { ensureSkillRuntime } = await import("../../../src/foundations/ensure-runtime.js");
    const result = await ensureSkillRuntime({ skillRoot, install: false });
    assert.equal(result.report.status, "ready");
    assert.equal(result.repayShim.linked, false);
    assert.match(result.repayShim.hint ?? "", /REPAY_LINK_CLI/);
  } finally {
    if (previous === undefined) delete process.env.REPAY_LINK_CLI;
    else process.env.REPAY_LINK_CLI = previous;
    if (previousStateHome === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = previousStateHome;
    await rm(stateHome, { recursive: true, force: true });
  }
});

test("ensureSkillRuntime seals consent when runtime already ready", async () => {
  const previous = process.env.REPAY_LINK_CLI;
  const previousStateHome = process.env.XDG_STATE_HOME;
  const stateHome = await mkdtemp(resolve(tmpdir(), "repay-runtime-state-"));
  delete process.env.REPAY_LINK_CLI;
  process.env.XDG_STATE_HOME = stateHome;
  try {
    const { ensureSkillRuntime } = await import("../../../src/foundations/ensure-runtime.js");
    const result = await ensureSkillRuntime({ skillRoot, install: false });
    assert.equal(result.report.status, "ready");
    assert.ok(result.consent && typeof result.consent === "object");
    assert.ok(
      result.consent.bundledDeps === true || Array.isArray(result.consent.bundledDeps),
      "bundledDeps recorded in consent audit trail",
    );
  } finally {
    if (previous === undefined) delete process.env.REPAY_LINK_CLI;
    else process.env.REPAY_LINK_CLI = previous;
    if (previousStateHome === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = previousStateHome;
    await rm(stateHome, { recursive: true, force: true });
  }
});
