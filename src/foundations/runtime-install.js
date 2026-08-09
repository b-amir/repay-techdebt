// Zero-dependency skill runtime install (spawn only). Used before node_modules exists.
// Install is skill-root only, --ignore-scripts, and --frozen-lockfile when lockfile present.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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

function runCommand(command, args, cwd, env = process.env, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let timeoutId;
    const child = spawn(command, args, { cwd, env, stdio: ["inherit", "pipe", "pipe"] });

    let output = "";
    if (child.stdout) {
      child.stdout.on("data", (data) => {
        process.stdout.write(data);
        output += data.toString();
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (data) => {
        process.stderr.write(data);
        output += data.toString();
      });
    }

    let isDone = false;
    const finish = (error, code) => {
      if (isDone) return;
      isDone = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (error) {
        if (error.code === "ENOENT") reject(Object.assign(error, { errno: "ENOENT" }));
        else reject(Object.assign(error, { output }));
      } else if (code === 0) {
        resolve();
      } else {
        const cmdErr = new Error(`${command} exited with code ${code}`);
        reject(Object.assign(cmdErr, { output }));
      }
    };

    if (timeoutMs) {
      timeoutId = setTimeout(() => {
        child.kill();
        finish(new Error(`Command ${command} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    child.on("error", (error) => finish(error));
    child.on("close", (code) => finish(null, code));
  });
}

async function getPinnedPnpmVersion(skillRoot) {
  try {
    const manifest = JSON.parse(await readFile(resolve(skillRoot, "package.json"), "utf8"));
    return (
      manifest.devEngines?.packageManager?.version ||
      String(manifest.packageManager ?? "").match(/^pnpm@(.+)$/u)?.[1] ||
      "11.18.0"
    );
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

  let enoentCount = 0;
  let lastError;
  let lastOutput = "";

  for (const { command, args, pinned } of attempts) {
    try {
      await runCommand(command, args, skillRoot, env);
      return {
        command: `${command} ${args.join(" ")}`.trim(),
        installSource: warmStore ? "warm-store" : "network",
        packageManagerVersion: pinned ? version : "system-fallback",
      };
    } catch (error) {
      if (error.errno === "ENOENT") {
        enoentCount++;
      } else {
        lastError = error;
        lastOutput = error.output || "";
      }
      continue;
    }
  }

  if (enoentCount === attempts.length) {
    throw new RuntimeBootstrapError(
      "No package manager available to install skill dependencies. pnpm is required; install via `npm i -g pnpm` or `corepack enable`.",
      null,
    );
  }

  const outputSnippet = lastOutput ? `\nOutput snippet:\n${lastOutput.slice(-1000)}` : "";
  throw new RuntimeBootstrapError(
    `Skill dependency install failed. (Original error: ${lastError?.message})${outputSnippet}\n\n` +
      `Check the output above to determine if this is a network issue, a package.json syntax error, or lockfile drift. ` +
      `If in a sandboxed environment without network, ensure dependencies are cached or pre-installed.`,
    null,
    {
      code: "install-failed",
      frozenLockfile: hasLockfile,
      lifecycleScripts: "ignored",
      repairCommand: `cd ${skillRoot} && pnpm install --ignore-scripts`,
    },
  );
}

/**
 * Compatibility entrypoint for bootstrap-first CLIs. Delegate to the linked
 * runtime path so Vite+'s multi-document source lock is materialized before
 * pnpm consumes it.
 */
export async function bootstrapSkillRuntime(skillRoot, { install = true } = {}) {
  const { ensureSkillRuntime } = await import("./ensure-runtime.js");
  return ensureSkillRuntime({ skillRoot, install });
}
