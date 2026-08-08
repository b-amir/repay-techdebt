// Zero-dependency skill runtime install (spawn only). Used before node_modules exists.
// Install is skill-root only, --ignore-scripts, and --frozen-lockfile when lockfile present.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { auditSkillRuntime } from "./runtime-audit.js";
import { getCacheDir } from "./user-dirs.js";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

export class RuntimeBootstrapError extends Error {
  constructor(message, report, details = null) {
    super(message);
    this.name = "RuntimeBootstrapError";
    this.report = report;
    this.details = details;
  }
}

function runCommand(command, args, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.on("error", (/** @type {NodeJS.ErrnoException} */ error) => {
      if (error.code === "ENOENT") reject(Object.assign(error, { errno: "ENOENT" }));
      else reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function getPinnedPnpmVersion(skillRoot) {
  try {
    const manifest = JSON.parse(await readFile(resolve(skillRoot, "package.json"), "utf8"));
    return manifest.devEngines?.packageManager?.version || "11.18.0";
  } catch {
    return "11.18.0";
  }
}

async function storeLooksWarm(storeDir) {
  try {
    const entries = await readdir(storeDir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export async function runPackageInstall(skillRoot) {
  const cacheDir = getCacheDir();
  await mkdir(cacheDir, { recursive: true });

  const npmrcPath = join(cacheDir, ".npmrc");
  const pnpmStore = join(cacheDir, "pnpm-store");
  const warmStore = await storeLooksWarm(pnpmStore);

  const npmrcContent = `store-dir=${pnpmStore}
prefer-offline=true
fetch-retries=2
fetch-timeout=60000
confirmModulesPurge=false
`;
  await writeFile(npmrcPath, npmrcContent, "utf8");

  const version = await getPinnedPnpmVersion(skillRoot);
  const hasLockfile = existsSync(resolve(skillRoot, "pnpm-lock.yaml"));

  const args = [
    "install",
    `--config.store-dir=${pnpmStore}`,
    "--prefer-offline",
    "--ignore-scripts",
  ];
  // Pin deps to committed lockfile when present (supply-chain hygiene).
  if (hasLockfile) args.push("--frozen-lockfile");

  // Strip parent Node debug flags (NODE_OPTIONS) that break spawned pnpm.
  const env = /** @type {Record<string, string | undefined>} */ ({
    ...process.env,
    NPM_CONFIG_USERCONFIG: npmrcPath,
    CI: "true",
  });
  delete env.NODE_OPTIONS;

  // Prefer the manifest-pinned package manager. An arbitrary system pnpm can
  // interpret a synced lockfile with different settings and report false drift.
  const attempts = [
    { command: "corepack", args: ["pnpm@" + version, ...args], pinned: true },
    { command: "pnpm", args, pinned: false },
  ];
  for (const { command, args, pinned } of attempts) {
    try {
      await runCommand(command, args, skillRoot, env);
      return {
        command: `${command} ${args.join(" ")}`.trim(),
        installSource: warmStore ? "warm-store" : "network",
        packageManagerVersion: pinned ? version : "system-fallback",
      };
    } catch (error) {
      if (error.errno === "ENOENT") continue;
      const managerLabel = pinned ? `pinned pnpm ${version}` : "system pnpm fallback";
      throw new RuntimeBootstrapError(
        `Skill dependency install failed with ${managerLabel} (${command}): ${error.message}. ` +
          "The lockfile was not bypassed; repair package.json and pnpm-lock.yaml together, then rerun node scripts/ensure-runtime.js.",
        null,
        {
          code: "pinned-install-failed",
          packageManager: command,
          packageManagerVersion: pinned ? version : "system-fallback",
          frozenLockfile: hasLockfile,
          lifecycleScripts: "ignored",
          repairCommand: "node scripts/ensure-runtime.js --format json",
        },
      );
    }
  }
  throw new RuntimeBootstrapError(
    "No package manager available to install skill dependencies. pnpm is required; install via `npm i -g pnpm` or `corepack enable`.",
    null,
  );
}

/**
 * Install bundled deps when missing. Safe to call before any npm package import.
 */
export async function bootstrapSkillRuntime(skillRoot, { install = true } = {}) {
  let report = await auditSkillRuntime(skillRoot);
  if (report.status === "ready") return { report, installed: false };
  if (report.status === "unsupported-runtime") {
    throw new RuntimeBootstrapError(
      `Node ${report.node.current} is unsupported; require ${report.node.required}.`,
      report,
    );
  }
  if (!install) return { report, installed: false };

  // Skill-root only; no package lifecycle scripts.
  process.stderr.write(
    "repay-techdebt: installing skill-root dependencies (pnpm --ignore-scripts; frozen lockfile when present). Never touches the target app.\n",
  );
  await runPackageInstall(skillRoot);
  report = await auditSkillRuntime(skillRoot);
  if (report.status !== "ready") {
    throw new RuntimeBootstrapError(
      "Skill dependencies are still missing after install. Run `node scripts/ensure-runtime.js` manually.",
      report,
    );
  }
  return { report, installed: true };
}
