// Bootstrap bundled skill dependencies inside <skill-root> only (never the target app).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execa } from "execa";
import { auditSkillRuntime } from "./runtime-audit.js";

export class RuntimeBootstrapError extends Error {
  constructor(message, report) {
    super(message);
    this.name = "RuntimeBootstrapError";
    this.report = report;
  }
}

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

async function runPackageInstall(skillRoot) {
  const attempts = [
    { command: "corepack", args: ["pnpm", "install"] },
    { command: "pnpm", args: ["install"] },
    { command: "npm", args: ["install", "--no-audit", "--no-fund"] },
  ];
  for (const { command, args } of attempts) {
    try {
      await execa(command, args, { cwd: skillRoot, stdio: "inherit" });
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
