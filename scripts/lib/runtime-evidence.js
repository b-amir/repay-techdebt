import { execa } from "execa";

/**
 * Validates and executes a runtime evidence plan.
 * @param {Object} plan - The execution plan describing what will run
 * @param {boolean} hasConsent - Explicit user consent flag
 * @param {Object} options - execution options (cwd, timeout, etc.)
 */
export async function collectRuntimeEvidence(plan, hasConsent, options = {}) {
  if (!plan) throw new Error("A runtime plan is required.");
  if (!plan.command) throw new Error("A runtime plan must specify a command.");
  
  if (!hasConsent) {
    return {
      status: "refused",
      error: "Runtime execution was refused. Explicit consent is required.",
      evidence: null,
      provenance: {
        command: plan.command,
        workload: plan.workload || "unknown",
      }
    };
  }

  const startTime = Date.now();
  let result;
  
  try {
    const { stdout, stderr, exitCode } = await execa(plan.command, plan.args || [], {
      cwd: options.cwd || process.cwd(),
      timeout: plan.durationMs || 30000,
      reject: false,
    });

    const duration = Date.now() - startTime;

    if (exitCode !== 0) {
      result = {
        status: "failed",
        error: `Command failed with exit code ${exitCode}`,
        stdout,
        stderr,
      };
    } else {
      result = {
        status: "successful",
        evidence: stdout, // A real implementation would parse profiles/traces
        stderr: stderr || null,
      };
    }

    result.provenance = {
      command: plan.command,
      workload: plan.workload || "unknown",
      durationMs: duration,
      timestamp: new Date().toISOString()
    };

    return result;

  } catch (err) {
    const duration = Date.now() - startTime;
    return {
      status: "failed",
      error: err.message,
      evidence: null,
      provenance: {
        command: plan.command,
        workload: plan.workload || "unknown",
        durationMs: duration,
        timestamp: new Date().toISOString()
      }
    };
  }
}
