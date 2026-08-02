// Zero-dependency skill runtime install (spawn only). Used before node_modules exists.
import { spawn } from "node:child_process";
import { auditSkillRuntime } from "./runtime-audit.js";

export class RuntimeBootstrapError extends Error {
  constructor(message, report) {
    super(message);
    this.name = "RuntimeBootstrapError";
    this.report = report;
  }
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", (error) => {
      if (error.code === "ENOENT") reject(Object.assign(error, { errno: "ENOENT" }));
      else reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

export async function runPackageInstall(skillRoot) {
  const attempts = [
    { command: "corepack", args: ["pnpm", "install"] },
    { command: "pnpm", args: ["install"] },
    { command: "npm", args: ["install", "--no-audit", "--no-fund"] },
  ];
  for (const { command, args } of attempts) {
    try {
      await runCommand(command, args, skillRoot);
      return `${command} ${args.join(" ")}`.trim();
    } catch (error) {
      if (error.errno === "ENOENT") continue;
      throw new RuntimeBootstrapError(
        `Skill dependency install failed (${command}): ${error.message}`,
        null,
      );
    }
  }
  throw new RuntimeBootstrapError(
    "No package manager available to install skill dependencies (tried corepack pnpm, pnpm, npm).",
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
