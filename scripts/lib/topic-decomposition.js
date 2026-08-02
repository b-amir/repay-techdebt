/**
 * Deduplicates and splits curriculum topics.
 * 
 * @param {Array<Object>} candidates List of generated topic candidates.
 * @returns {Array<Object>} Refined list of topics.
 */
export function deduplicateAndSplitTopics(candidates) {
  const finalTopics = [];
  const focusMap = new Map();

  for (const candidate of candidates) {
    // Basic deduplication: Merge if exact same focus and kind
    const key = `${candidate.kind}:${candidate.focus}`;
    if (focusMap.has(key)) {
      const existing = focusMap.get(key);
      existing.importanceReasons.push(`Merged with duplicate candidate`);
      existing.evidencePaths = [...new Set([...existing.evidencePaths, ...candidate.evidencePaths])];
      continue;
    }
    focusMap.set(key, candidate);

    // Topic splitting logic: if a component owns too many files, we could split it.
    // For now, if the focus contains a clear split signal (e.g. "auth, billing"), split it.
    if (candidate.focus.includes(",") && candidate.kind === "area") {
      const parts = candidate.focus.split(",").map(p => p.trim());
      for (const part of parts) {
        const splitCandidate = { ...candidate, id: `${candidate.id}-${part}`, focus: part };
        splitCandidate.importanceReasons.push(`Split from compound topic (${candidate.focus})`);
        finalTopics.push(splitCandidate);
      }
    } else {
      finalTopics.push(candidate);
    }
  }

  return finalTopics;
}
