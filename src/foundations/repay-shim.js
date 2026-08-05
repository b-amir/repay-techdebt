import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { mkdir, readlink, rm, symlink, writeFile } from "node:fs/promises";

function localBinDir() {
  return resolve(homedir(), ".local", "bin");
}

function pathOnPath(binDir) {
  const pathEnv = process.env.PATH ?? "";
  const sep = process.platform === "win32" ? ";" : ":";
  return pathEnv.split(sep).some((entry) => resolve(entry) === resolve(binDir));
}

/**
 * Idempotently link `repay` onto the user PATH (Unix) or write a cmd shim (Windows).
 *
 * @param {string} skillRoot
 * @returns {Promise<{ linked: boolean, path: string, hint: string|null }>}
 */
export async function ensureRepayPathShim(skillRoot) {
  const repayBin = resolve(skillRoot, "bin", "repay");
  if (!existsSync(repayBin)) {
    return { linked: false, path: repayBin, hint: null };
  }

  if (process.platform === "win32") {
    const binDir = localBinDir();
    await mkdir(binDir, { recursive: true });
    const cmdPath = resolve(binDir, "repay.cmd");
    const content = `@echo off\r\nnode "${repayBin.replaceAll("/", "\\")}" %*\r\n`;
    await writeFile(cmdPath, content, "utf8");
    const hint = pathOnPath(binDir) ? null : `Add ${binDir} to your PATH, then run repay view.`;
    return { linked: true, path: cmdPath, hint };
  }

  const binDir = localBinDir();
  await mkdir(binDir, { recursive: true });
  const linkPath = resolve(binDir, "repay");

  try {
    if (existsSync(linkPath)) {
      const current = await readlink(linkPath).catch(() => null);
      if (current && resolve(dirname(linkPath), current) === resolve(repayBin)) {
        const hint = pathOnPath(binDir) ? null : `export PATH="${binDir}:$PATH"`;
        return { linked: true, path: linkPath, hint };
      }
      await rm(linkPath, { force: true });
    }
    await symlink(repayBin, linkPath);
    const hint = pathOnPath(binDir) ? null : `export PATH="${binDir}:$PATH"`;
    return { linked: true, path: linkPath, hint };
  } catch (error) {
    return {
      linked: false,
      path: linkPath,
      hint: `Could not link repay onto PATH (${error.code ?? error.message}). Run: node ${repayBin}`,
    };
  }
}
