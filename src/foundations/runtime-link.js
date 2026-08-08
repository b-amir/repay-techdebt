import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, rm, symlink, copyFile, readdir, lstat, readlink } from "node:fs/promises";
import { getDataDir } from "./user-dirs.js";
import { auditSkillRuntime } from "./runtime-audit.js";
import { materializeRuntimeLock } from "./runtime-lock.js";
import { materializeRuntimeManifest } from "./runtime-manifest.js";

export async function ensureLinkedRuntime(skillRoot, hash, runInstallFn) {
  const dataDir = getDataDir();
  const targetDir = resolve(dataDir, hash);
  const targetNodeModules = resolve(targetDir, "node_modules");

  await mkdir(targetDir, { recursive: true });

  let valid = false;
  if (existsSync(targetNodeModules)) {
    await materializeRuntimeManifest(
      resolve(skillRoot, "package.json"),
      resolve(targetDir, "package.json"),
    );
    const report = await auditSkillRuntime(targetDir);
    valid = report.status === "ready";
  }

  let installResult = null;
  if (!valid) {
    // Copy manifest files to target directory
    await materializeRuntimeManifest(
      resolve(skillRoot, "package.json"),
      resolve(targetDir, "package.json"),
    );
    if (existsSync(resolve(skillRoot, "pnpm-lock.yaml"))) {
      await materializeRuntimeLock(
        resolve(skillRoot, "pnpm-lock.yaml"),
        resolve(targetDir, "pnpm-lock.yaml"),
      );
    }
    if (existsSync(resolve(skillRoot, "pnpm-workspace.yaml"))) {
      await copyFile(
        resolve(skillRoot, "pnpm-workspace.yaml"),
        resolve(targetDir, "pnpm-workspace.yaml"),
      );
    }

    // Run installation in the target directory
    installResult = await runInstallFn(targetDir);
  }

  // Create or update symlink at <skillRoot>/node_modules
  const linkPath = resolve(skillRoot, "node_modules");
  let needsLink = true;
  if (existsSync(linkPath) || existsSync(linkPath) === false) {
    // check if it exists as symlink or dir
    try {
      const stat = await lstat(linkPath);
      if (stat.isSymbolicLink()) {
        const currentTarget = await readlink(linkPath);
        if (
          currentTarget === targetNodeModules ||
          resolve(skillRoot, currentTarget) === targetNodeModules
        ) {
          needsLink = false;
        } else {
          await rm(linkPath, { force: true });
        }
      } else {
        await rm(linkPath, { recursive: true, force: true });
      }
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  if (needsLink) {
    await symlink(targetNodeModules, linkPath, "junction");
  }

  return installResult;
}

export async function pruneLinkedRuntimes(activeHash) {
  const dataDir = getDataDir();
  if (!existsSync(dataDir)) return;

  const entries = await readdir(dataDir, { withFileTypes: true });
  const runtimes = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = resolve(dataDir, entry.name);
      try {
        const stat = await lstat(fullPath);
        runtimes.push({ path: fullPath, hash: entry.name, mtime: stat.mtimeMs });
      } catch {
        // ignore
      }
    }
  }

  // Sort by modification time, newest first
  runtimes.sort((a, b) => b.mtime - a.mtime);

  // Keep activeHash + 2 most recent (up to 3 total)
  let kept = 0;
  for (const runtime of runtimes) {
    if (runtime.hash === activeHash) {
      // Always keep active
      continue;
    }

    if (kept < 2) {
      kept++;
      continue;
    }

    // Prune the rest
    try {
      await rm(runtime.path, { recursive: true, force: true });
    } catch {
      // ignore deletion errors (e.g. windows locking)
    }
  }
}
