/**
 * AnalyzerAdapter Protocol
 *
 * This contract ensures all tooling integration behaves predictably, 
 * returns uniform results, and respects target repository boundaries.
 */

export class AnalyzerAdapter {
  constructor(options = {}) {
    this.name = options.name || "UnknownAnalyzer";
    this.version = options.version || "unknown";
  }

  /**
   * Defines the capabilities this analyzer supports.
   * @returns {Object} Capability manifest
   */
  getCapabilities() {
    return {
      name: this.name,
      version: this.version,
      operations: [],
    };
  }

  /**
   * Executes the analysis. Must be implemented by subclasses.
   * @param {string} targetRoot - Absolute path to the repository
   * @param {Object} options - Configuration and boundaries
   * @returns {Promise<AnalyzerResult>}
   */
  async analyze(targetRoot, options = {}) {
    throw new Error(`AnalyzerAdapter ${this.name} does not implement analyze()`);
  }

  /**
   * Formats a standard result object.
   */
  createResult({
    status, // "unavailable", "unconfigured", "refused", "failed", "partial", "stale", "successful"
    targetRoot,
    scope = [],
    evidence = null,
    limitations = [],
    artifactLocation = null,
    error = null,
  }) {
    const validStatuses = ["unavailable", "unconfigured", "refused", "failed", "partial", "stale", "successful"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid analyzer status: ${status}`);
    }

    return {
      analyzer: this.name,
      version: this.version,
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

  /**
   * Helper to ensure tools do not silently write into the target directory.
   * Any caching or side-effects should be directed to the provided safe temp dir.
   */
  assertSafeOutputDirectory(targetRoot, outputDir) {
    if (!outputDir) return;
    if (outputDir.startsWith(targetRoot)) {
      throw new Error(`Security Violation: Analyzer ${this.name} attempted to write inside the target repository (${outputDir}). Adapters must use isolated private cache directories.`);
    }
  }
}

/**
 * Standard Result Structure:
 * @typedef {Object} AnalyzerResult
 * @property {string} analyzer
 * @property {string} version
 * @property {string} status - unavailable, unconfigured, refused, failed, partial, stale, successful
 * @property {string} targetRoot
 * @property {string[]} scope - Files or directories analyzed
 * @property {any} evidence - Extracted data or structured results
 * @property {string[]} limitations - Known gaps (e.g. "Unsupported syntax ignored")
 * @property {string|null} artifactLocation - Absolute path to detailed logs/results if stored on disk
 * @property {string|null} error
 * @property {string} timestamp
 */
