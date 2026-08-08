const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

export function normalizeTitle(title) {
  return String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word))
    .join(" ");
}

function tokenSimilarity(left, right) {
  const a = new Set(normalizeTitle(left).split(" ").filter(Boolean));
  const b = new Set(normalizeTitle(right).split(" ").filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

/** Return comparison context only. Never propose, rank, rewrite, or select titles. */
export function inspectTitleSet(topics) {
  const entries = topics.map((topic) => ({
    id: topic.id,
    title: String(topic.title ?? "").trim(),
    normalized: normalizeTitle(topic.title),
  }));
  const exactDuplicates = [];
  const similarPairs = [];
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const a = entries[left];
      const b = entries[right];
      if (a.normalized && a.normalized === b.normalized) {
        exactDuplicates.push({ topicIds: [a.id, b.id], titles: [a.title, b.title] });
        continue;
      }
      const similarity = tokenSimilarity(a.title, b.title);
      if (similarity >= 0.72) {
        similarPairs.push({
          topicIds: [a.id, b.id],
          titles: [a.title, b.title],
          sharedTokenRatio: Number(similarity.toFixed(2)),
        });
      }
    }
  }
  return {
    existingTitles: entries.map(({ id, title }) => ({ id, title })),
    exactDuplicates,
    similarPairs,
  };
}
