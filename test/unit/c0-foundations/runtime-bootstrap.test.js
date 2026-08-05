// @category C0
import assert from "node:assert/strict";
import { symlink, mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "vite-plus/test";
import { isDirectCliInvocation } from "../../../src/foundations/cli-entry.js";
import { auditSkillRuntime } from "../../../src/foundations/runtime-audit.js";
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

test("bootstrapSkillRuntime is ready when node_modules exists", async () => {
  const { bootstrapSkillRuntime } = await import("../../../src/foundations/runtime-install.js");
  const result = await bootstrapSkillRuntime(skillRoot);
  assert.equal(result.report.status, "ready");
  assert.equal(result.installed, false);
});
