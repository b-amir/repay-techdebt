// Zero-dependency skill runtime install (spawn only). Used before node_modules exists.
import { spawn } from "node:child_process";
import { auditSkillRuntime } from "./runtime-audit.js";
import { getCacheDir } from "./user-dirs.js";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";

export class RuntimeBootstrapError extends Error {
  constructor(message, report) {
    super(message);
    this.name = "RuntimeBootstrapError";
    this.report = report;
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

  const args = [
    "install",
    `--config.store-dir=${pnpmStore}`,
    "--prefer-offline",
    "--ignore-scripts",
  ];

  // Strip parent Node debug flags (NODE_OPTIONS) that break spawned pnpm.
  const env = /** @type {Record<string, string | undefined>} */ ({
    ...process.env,
    NPM_CONFIG_USERCONFIG: npmrcPath,
    CI: "true",
  });
  delete env.NODE_OPTIONS;

  const attempts = [
    { command: "pnpm", args },
    { command: "corepack", args: ["pnpm@" + version, ...args] },
  ];
  for (const { command, args } of attempts) {
    try {
      await runCommand(command, args, skillRoot, env);
      return {
        command: `${command} ${args.join(" ")}`.trim(),
        installSource: warmStore ? "warm-store" : "network",
      };
    } catch (error) {
      if (error.errno === "ENOENT") continue;
      throw new RuntimeBootstrapError(
        `Skill dependency install failed (${command}): ${error.message}`,
        null,
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
