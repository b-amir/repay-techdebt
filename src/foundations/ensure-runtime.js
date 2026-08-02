// Bootstrap bundled skill dependencies inside <skill-root> only (never the target app).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runPackageInstall, RuntimeBootstrapError } from "./runtime-install.js";
import { auditSkillRuntime } from "./runtime-audit.js";

export { RuntimeBootstrapError } from "./runtime-install.js";

const CONSENT_DIR = ".repay-skill-runtime";
const CONSENT_FILE = "bundled-deps-consent.json";

export async function readRuntimeConsent(skillRoot) {
  try {
    const raw = await readFile(resolve(skillRoot, CONSENT_DIR, CONSENT_FILE), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function recordRuntimeConsent(skillRoot, details) {
  const dir = resolve(skillRoot, CONSENT_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(
    resolve(dir, CONSENT_FILE),
    `${JSON.stringify({ bundledDeps: true, ...details }, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Ensure bundled runtime packages exist under skillRoot. Installs on missing-deps unless
 * `install` is false. Records consent in <skill-root>/.repay-skill-runtime/.
 */
export async function ensureSkillRuntime({ skillRoot, install = true } = {}) {
  let report = await auditSkillRuntime(skillRoot);
  if (report.status === "ready") {
    return { report, installed: false, consent: await readRuntimeConsent(skillRoot) };
  }
  if (report.status === "unsupported-runtime") {
    throw new RuntimeBootstrapError(
      `Node ${report.node.current} is unsupported; require ${report.node.required}.`,
      report,
    );
  }
  if (!install) {
    return { report, installed: false, consent: await readRuntimeConsent(skillRoot) };
  }

  const installCommand = await runPackageInstall(skillRoot);
  await recordRuntimeConsent(skillRoot, {
    at: new Date().toISOString(),
    installCommand,
    node: report.node.current,
  });

  report = await auditSkillRuntime(skillRoot);
  if (report.status !== "ready") {
    throw new RuntimeBootstrapError(
      "Skill dependencies are still missing after install. Run `node scripts/ensure-runtime.js` manually.",
      report,
    );
  }
  return {
    report,
    installed: true,
    consent: await readRuntimeConsent(skillRoot),
  };
}

// Re-export bootstrap for scripts that must install before importing bundled deps.
export { bootstrapSkillRuntime } from "./runtime-install.js";
