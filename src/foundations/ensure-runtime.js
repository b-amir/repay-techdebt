import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { runPackageInstall, RuntimeBootstrapError } from "./runtime-install.js";
import { auditSkillRuntime, getSkillHashes } from "./runtime-audit.js";
import { getStateDir } from "./user-dirs.js";
import { ensureLinkedRuntime, pruneLinkedRuntimes } from "./runtime-link.js";
import { ensureRepayPathShim } from "./repay-shim.js";

export { RuntimeBootstrapError } from "./runtime-install.js";

const CONSENT_DIR = ".repay-skill-runtime";
const CONSENT_FILE = "bundled-deps-consent.json";

async function readManifest() {
  try {
    const stateDir = getStateDir();
    return JSON.parse(await readFile(resolve(stateDir, "installed-manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function readRuntimeConsent(skillRoot) {
  try {
    const stateDir = getStateDir();
    const manifestPath = resolve(stateDir, "installed-manifest.json");

    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      const hashes = await getSkillHashes(skillRoot);
      if (manifest.packageJsonHash !== hashes.packageJsonHash) {
        return null;
      }
    }

    return JSON.parse(await readFile(resolve(stateDir, "runtime-consent.json"), "utf8"));
  } catch {
    try {
      return JSON.parse(await readFile(resolve(skillRoot, CONSENT_DIR, CONSENT_FILE), "utf8"));
    } catch {
      return null;
    }
  }
}

async function recordRuntimeConsent(skillRoot, details) {
  try {
    const stateDir = getStateDir();
    await mkdir(stateDir, { recursive: true });
    await writeFile(
      resolve(stateDir, "runtime-consent.json"),
      `${JSON.stringify({ bundledDeps: true, ...details }, null, 2)}\n`,
      "utf8",
    );
    const hashes = await getSkillHashes(skillRoot);
    await writeFile(
      resolve(stateDir, "installed-manifest.json"),
      `${JSON.stringify({ ...hashes, ...details }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    const dir = resolve(skillRoot, CONSENT_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(
      resolve(dir, CONSENT_FILE),
      `${JSON.stringify({ bundledDeps: true, ...details }, null, 2)}\n`,
      "utf8",
    );
  }
}

/**
 * Ensure bundled runtime packages exist under skillRoot. Installs on missing-deps unless
 * `install` is false. Records consent in user state or fallback dir.
 *
 * @param {object} options
 * @param {string} options.skillRoot
 * @param {boolean} [options.install]
 * @param {boolean} [options.prune]
 */
export async function ensureSkillRuntime({ skillRoot, install = true, prune = false }) {
  const hashes = await getSkillHashes(skillRoot);
  const manifest = await readManifest();
  const hashMatches = manifest && manifest.packageJsonHash === hashes.packageJsonHash;

  let report = await auditSkillRuntime(skillRoot);

  if (report.status === "ready") {
    const shim = await ensureRepayPathShim(skillRoot);
    if (prune) {
      await pruneLinkedRuntimes(hashes.packageJsonHash);
    }
    return {
      report,
      installed: false,
      installSource: hashMatches ? "skipped-manifest-match" : "already-installed",
      consent: await readRuntimeConsent(skillRoot),
      repayShim: shim,
    };
  }

  if (report.status === "unsupported-runtime") {
    throw new RuntimeBootstrapError(
      `Unsupported Node.js version. Required: ${report.node.required}, Current: ${report.node.current}`,
      report,
    );
  }

  if (!install) {
    throw new RuntimeBootstrapError("Skill dependencies are missing and install=false.", report);
  }

  const installResult = await ensureLinkedRuntime(
    skillRoot,
    hashes.packageJsonHash,
    runPackageInstall,
  );

  if (installResult) {
    const pkg = JSON.parse(
      await readFile(resolve(skillRoot, "package.json"), "utf8").catch(() => "{}"),
    );
    await recordRuntimeConsent(skillRoot, {
      bundledDeps: Object.keys(pkg.dependencies || {}),
      installCommand: installResult.command,
      at: new Date().toISOString(),
    });
  }

  if (prune) {
    await pruneLinkedRuntimes(hashes.packageJsonHash);
  }

  report = await auditSkillRuntime(skillRoot);
  if (report.status !== "ready") {
    throw new RuntimeBootstrapError("Installation completed but runtime audit still fails", report);
  }

  const shim = await ensureRepayPathShim(skillRoot);

  return {
    report,
    installed: !!installResult,
    installSource: installResult?.installSource || "skipped-manifest-match",
    consent: await readRuntimeConsent(skillRoot),
    repayShim: shim,
  };
}

// Re-export bootstrap for scripts that must install before importing bundled deps.
export { bootstrapSkillRuntime } from "./runtime-install.js";
