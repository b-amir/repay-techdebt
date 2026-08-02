import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

export class AnalysisCache {
  constructor(cacheRoot) {
    this.cacheRoot = cacheRoot;
  }

  /**
   * Generates a deterministic cache key.
   */
  async generateKey(analyzerVersion, config, targetIdentity, filePaths) {
    const hash = createHash("sha256");
    hash.update(analyzerVersion);
    hash.update(JSON.stringify(config));
    hash.update(targetIdentity);

    // In a real implementation, we would stat/hash the actual file contents.
    // For performance/demonstration, we hash the sorted paths.
    const sortedPaths = [...filePaths].sort();
    for (const p of sortedPaths) {
      hash.update(p);
      try {
         const s = await stat(p);
         hash.update(s.mtimeMs.toString());
      } catch (err) {
         // ignore missing
      }
    }

    return hash.digest("hex");
  }

  async get(key) {
    try {
      const data = await readFile(join(this.cacheRoot, `${key}.json`), "utf8");
      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }

  async set(key, value) {
    await mkdir(this.cacheRoot, { recursive: true });
    await writeFile(join(this.cacheRoot, `${key}.json`), JSON.stringify(value), "utf8");
  }
}

/**
 * Checks if a specific analysis operation exceeded its budget.
 * @param {number} durationMs 
 * @param {number} budgetMs 
 * @returns {Object} 
 */
export function checkBudget(durationMs, budgetMs) {
  if (durationMs > budgetMs) {
    return {
      exceeded: true,
      lostCoverage: true,
      message: `Analysis budget exceeded: took ${durationMs}ms (limit: ${budgetMs}ms). Coverage lost.`
    };
  }
  return {
    exceeded: false,
    lostCoverage: false,
    message: `Analysis completed within budget (${durationMs}ms / ${budgetMs}ms).`
  };
}
