// Read-only bundled-runtime audit (same facts as scripts/check-runtime.js).
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function auditSkillRuntime(skillRoot) {
  const manifest = JSON.parse(await readFile(resolve(skillRoot, "package.json"), "utf8"));
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
