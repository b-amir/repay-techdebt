/**
 * Shared analyzer result shape for enhanced-tool wrappers.
 * Prefer this plain factory over a base class — wrappers stay free to call CLIs directly
 * while still returning a uniform status vocabulary.
 */

export const ANALYZER_STATUSES = Object.freeze([
  "unavailable",
  "unconfigured",
  "refused",
  "failed",
  "partial",
  "stale",
  "successful",
]);

/**
 * @param {object} input
 * @param {string} input.analyzer
 * @param {string} [input.version]
 * @param {string} input.status
 * @param {string} input.targetRoot
 * @param {string[]} [input.scope]
 * @param {any} [input.evidence]
 * @param {string[]} [input.limitations]
 * @param {string|null} [input.artifactLocation]
 * @param {Error|string|null} [input.error]
 */
export function createAnalyzerResult({
  analyzer,
  version = "unknown",
  status,
  targetRoot,
  scope = [],
  evidence = null,
  limitations = [],
  artifactLocation = null,
  error = null,
}) {
  if (!ANALYZER_STATUSES.includes(status)) {
    throw new Error(`Invalid analyzer status: ${status}`);
  }
  return {
    analyzer,
    version,
    status,
    targetRoot,
    scope,
    evidence,
    limitations,
    artifactLocation,
    error: error ? String(error) : null,
    timestamp: new Date().toISOString(),
  };
}

/** Refuse writing analyzer caches inside the target repository. */
export function assertSafeAnalyzerOutputDirectory(analyzerName, targetRoot, outputDir) {
  if (!outputDir) return;
  if (String(outputDir).startsWith(String(targetRoot))) {
    throw new Error(
      `Security Violation: Analyzer ${analyzerName} attempted to write inside the target repository (${outputDir}). Adapters must use isolated private cache directories.`,
    );
  }
}
