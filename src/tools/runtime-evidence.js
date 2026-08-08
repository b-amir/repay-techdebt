import { execa } from "execa";

const SAFE_ENV_NAMES = new Set([
  "CI",
  "COMSPEC",
  "HOME",
  "LANG",
  "LC_ALL",
  "LOGNAME",
  "PATH",
  "PATHEXT",
  "SHELL",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "TMPDIR",
  "USER",
  "WINDIR",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
]);

const SECRET_PATTERNS = [
  /\b(?:sk|ghp|github_pat|glpat|xox[baprs]|AKIA)[-_A-Za-z0-9]{8,}\b/giu,
  /\b(?:token|password|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/giu,
  /(?:Authorization:\s*(?:Bearer|Basic)\s+)\S+/giu,
];

function validatePlan(plan) {
  if (!Array.isArray(plan.args ?? [])) throw new Error("Runtime plan args must be an array.");
  for (const value of [plan.command, ...(plan.args ?? [])]) {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      value.includes("\u0000") ||
      value.includes("\r") ||
      value.includes("\n")
    ) {
      throw new Error("Runtime command and args must be non-empty strings without control lines.");
    }
  }
  for (const name of plan.envAllowlist ?? []) {
    if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
      throw new Error(`Invalid environment variable name: ${String(name)}`);
    }
  }
}

function runtimeEnvironment(envAllowlist = []) {
  const allowed = new Set([...SAFE_ENV_NAMES, ...envAllowlist]);
  return Object.fromEntries(
    [...allowed]
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  );
}

export function redactRuntimeOutput(value, maxLength = 64 * 1024) {
  let text = String(value ?? "");
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, "[REDACTED]");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n[TRUNCATED]` : text;
}

/**
 * Validates and executes a runtime evidence plan.
 * @param {Object} plan - The execution plan describing what will run
 * @param {boolean} hasConsent - Explicit user consent flag
 * @param {Object} options - execution options (cwd, timeout, etc.)
 */
export async function collectRuntimeEvidence(plan, hasConsent, options = {}) {
  if (!plan) throw new Error("A runtime plan is required.");
  if (!plan.command) throw new Error("A runtime plan must specify a command.");
  validatePlan(plan);

  if (!hasConsent) {
    return {
      status: "refused",
      error: "Runtime execution was refused. Explicit consent is required.",
      evidence: null,
      provenance: {
        command: plan.command,
        workload: plan.workload || "unknown",
        environmentNames: plan.envAllowlist ?? [],
      },
    };
  }

  const startTime = Date.now();
  let result;

  try {
    const { stdout, stderr, exitCode } = await execa(plan.command, plan.args || [], {
      cwd: options.cwd || process.cwd(),
      timeout: plan.durationMs || 30000,
      reject: false,
      shell: false,
      stdin: "ignore",
      env: runtimeEnvironment(plan.envAllowlist),
      extendEnv: false,
      maxBuffer: 1024 * 1024,
    });

    const duration = Date.now() - startTime;

    if (exitCode !== 0) {
      result = {
        status: "failed",
        error: `Command failed with exit code ${exitCode}`,
        stdout: redactRuntimeOutput(stdout),
        stderr: redactRuntimeOutput(stderr),
      };
    } else {
      result = {
        status: "successful",
        evidence: redactRuntimeOutput(stdout), // A real implementation would parse profiles/traces
        stderr: stderr ? redactRuntimeOutput(stderr) : null,
      };
    }

    /** @type {any} */ (result).provenance = {
      command: plan.command,
      workload: plan.workload || "unknown",
      environmentNames: plan.envAllowlist ?? [],
      durationMs: duration,
      timestamp: new Date().toISOString(),
    };

    return result;
  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      status: "failed",
      error: redactRuntimeOutput(err.message),
      evidence: null,
      provenance: {
        command: plan.command,
        workload: plan.workload || "unknown",
        environmentNames: plan.envAllowlist ?? [],
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
