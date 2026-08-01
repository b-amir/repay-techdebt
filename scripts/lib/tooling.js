import { accessSync, constants, existsSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { execa } from "execa";
import { z } from "zod";
import { skillRoot } from "./targeting.js";

export {
  formatTargetError,
  isSameOrInside,
  resolveTargetRoot,
  skillRoot,
  TargetRootError,
} from "./targeting.js";

export const capabilitySchema = z.object({
  id: z.string(),
  label: z.string(),
  phase: z.string(),
  kind: z.enum(["agent-mcp", "cli", "bundled"]),
  status: z.enum(["ready", "missing", "broken", "needs-setup", "agent-check-required"]),
  runtimeOutcome: z.enum(["not-attempted", "unavailable", "failed"]).default("not-attempted"),
  version: z.string().optional(),
  detail: z.string(),
  setup: z.array(z.string()),
  fallback: z.string(),
  installationScope: z
    .enum(["skill-local", "user-isolated", "agent-user-config", "none"])
    .default("none"),
  artifactScope: z.enum(["none", "stdout", "private-cache", "agent-user-config"]).default("none"),
  targetMutationRisk: z.enum(["none", "avoidable", "requires-explicit-opt-in"]).default("none"),
  operations: z.array(z.string()).default([]),
  fallbackChain: z
    .array(
      z.object({
        tool: z.string(),
        operation: z.string(),
        limitation: z.string(),
        requiresPermission: z.boolean(),
      }),
    )
    .default([]),
});

export const capabilityReportSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  projectRoot: z.string(),
  privateCacheRoot: z.string().optional(),
  capabilities: z.array(capabilitySchema),
});

const SECRET_PATTERNS = [
  /\b(?:sk|ghp|github_pat|glpat|xox[baprs]|AKIA)[-_A-Za-z0-9]{8,}\b/gi,
  /\b(?:token|password|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,
  /(?:Authorization:\s*(?:Bearer|Basic)\s+)\S+/gi,
];
const ANSI_ESCAPE = new RegExp(`${String.fromCodePoint(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

export function sanitizeDiagnostic(value, maxLength = 500) {
  let text = String(value ?? "")
    .replace(ANSI_ESCAPE, "")
    .trim();
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, "[REDACTED]");
  text = text.replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

export function bundledBinary(name) {
  const executable = process.platform === "win32" ? `${name}.cmd` : name;
  const candidate = resolve(skillRoot, "node_modules", ".bin", executable);
  try {
    accessSync(candidate, constants.X_OK);
    return candidate;
  } catch {
    return null;
  }
}

export function pathWithSkillBinaries(environment = process.env) {
  const binDirectory = resolve(skillRoot, "node_modules", ".bin");
  return { ...environment, PATH: `${binDirectory}${delimiter}${environment.PATH ?? ""}` };
}

export async function runCommand(command, args, options = {}) {
  try {
    const result = await execa(command, args, {
      cwd: options.cwd,
      env: options.includeSkillBinaries ? pathWithSkillBinaries(options.env) : options.env,
      reject: false,
      stdin: "ignore",
      timeout: options.timeout ?? 15_000,
      maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024,
    });
    const ok = !result.failed && result.exitCode === 0;
    return {
      ok,
      exitCode: result.exitCode ?? null,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      reason: ok
        ? undefined
        : result.code === "ENOENT"
          ? "command not found"
          : sanitizeDiagnostic(result.stderr || result.stdout || result.shortMessage),
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: null,
      stdout: "",
      stderr: "",
      reason:
        error.code === "ENOENT"
          ? "command not found"
          : sanitizeDiagnostic(error.shortMessage || error.message),
    };
  }
}

export async function probeCommand(definition, projectRoot) {
  const result = await runCommand(definition.command, definition.versionArgs ?? ["--version"], {
    cwd: projectRoot,
    timeout: 8_000,
  });
  if (!result.ok) {
    return capabilitySchema.parse({
      ...definition,
      kind: "cli",
      status: result.reason === "command not found" ? "missing" : "broken",
      runtimeOutcome: result.reason === "command not found" ? "unavailable" : "failed",
      detail: result.reason || `exited with status ${result.exitCode}`,
    });
  }

  const setupMissing =
    definition.projectMarker && !existsSync(resolve(projectRoot, definition.projectMarker));
  return capabilitySchema.parse({
    ...definition,
    kind: "cli",
    status: setupMissing ? "needs-setup" : "ready",
    runtimeOutcome: setupMissing ? "unavailable" : "not-attempted",
    version: sanitizeDiagnostic(result.stdout || result.stderr, 120),
    detail: setupMissing
      ? `installed, but ${definition.projectMarker} is absent`
      : "command probe succeeded",
  });
}

export function formatCapabilityTable(report) {
  const rows = [
    "| Capability | Phase | Install scope | Artifacts | Target writes | Preflight | Runtime outcome | Fallback |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const item of report.capabilities) {
    const cell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
    rows.push(
      `| ${cell(item.label)} | ${cell(item.phase)} | ${cell(item.installationScope)} | ${cell(item.artifactScope)} | ${cell(item.targetMutationRisk)} | ${cell(item.status)} | ${cell(item.runtimeOutcome)} | ${cell(item.fallbackChain.length > 0 ? item.fallbackChain.map((step) => step.tool).join(" → ") : item.fallback)} |`,
    );
  }
  return `${rows.join("\n")}\n`;
}
