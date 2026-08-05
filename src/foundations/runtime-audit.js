import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import crypto from "node:crypto";

const manifestCache = new Map();

export async function getSkillHashes(skillRoot) {
  const pkgPath = resolve(skillRoot, "package.json");
  const lockPath = resolve(skillRoot, "pnpm-lock.yaml");
  const packageJsonHash = crypto
    .createHash("sha256")
    .update(await readFile(pkgPath, "utf8"))
    .digest("hex");
  let lockHash = null;
  try {
    lockHash = crypto
      .createHash("sha256")
      .update(await readFile(lockPath, "utf8"))
      .digest("hex");
  } catch {}
  return { packageJsonHash, lockHash };
}

export async function auditSkillRuntime(skillRoot) {
  let manifest = manifestCache.get(skillRoot);
  if (!manifest) {
    manifest = JSON.parse(await readFile(resolve(skillRoot, "package.json"), "utf8"));
    manifestCache.set(skillRoot, manifest);
  }
  const packages = Object.keys(manifest.dependencies ?? {});
  const currentNodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  const nodeSupported = currentNodeMajor >= 22;
  const results = packages.map((name) => {
    const installed = existsSync(resolve(skillRoot, "node_modules", ...name.split("/")));
    return {
      package: name,
      status: installed ? "ready" : "missing",
      expectedVersion: manifest.dependencies[name],
    };
  });
  return {
    node: {
      current: process.versions.node,
      required: manifest.engines?.node ?? "unspecified",
      status: nodeSupported ? "ready" : "unsupported",
    },
    status: !nodeSupported
      ? "unsupported-runtime"
      : results.every((item) => item.status === "ready")
        ? "ready"
        : "missing-dependencies",
    packages: results,
  };
}
