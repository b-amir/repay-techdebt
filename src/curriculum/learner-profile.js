/**
 * Applies a learner profile to modify topic ranking and order without invalidating the source of truth.
 *
 * @param {Array<Object>} topics The topologically sorted list of topics.
 * @param {Object} profile The learner's profile (role, goal, experience).
 * @returns {Array<Object>} Topics re-ordered to fit the learner's profile.
 */
export function applyLearnerProfile(topics, profile = {}) {
  const { role, goal, familiarity } = profile;

  // If no specific profile is given, return as-is
  if (!role && !goal && !familiarity) {
    return topics;
  }

  let filtered = [...topics];
  if (familiarity === "dabbled") {
    filtered = filtered.filter((t) => t.learningStage !== "1. orientation");
  } else if (familiarity === "owner") {
    filtered = filtered.filter(
      (t) => t.learningStage !== "1. orientation" && t.kind !== "workflow" && t.kind !== "entry",
    );
  }

  // Define multipliers or weight bonuses based on role/goal
  const sorted = [...filtered].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    // Security Review Role
    if (role === "security review" || goal === "security") {
      if (a.importanceReasons.some((r) => r.includes("trust boundar") || r.includes("security")))
        scoreA += 100;
      if (b.importanceReasons.some((r) => r.includes("trust boundar") || r.includes("security")))
        scoreB += 100;
    }

    // Operations / Debugging Role
    if (role === "operations" || goal === "debugging") {
      if (a.chapter.includes("operations") || a.chapter.includes("workflows")) scoreA += 100;
      if (b.chapter.includes("operations") || b.chapter.includes("workflows")) scoreB += 100;
    }

    // Feature Work
    if (role === "feature work" || goal === "feature") {
      if (a.chapter.includes("features")) scoreA += 100;
      if (b.chapter.includes("features")) scoreB += 100;
    }

    // If scores are equal, maintain the original topological index by returning 0
    // Stable sort is needed, but just falling back to original index is fine.
    // Assuming topics came in topologically sorted.
    const indexA = topics.indexOf(a);
    const indexB = topics.indexOf(b);

    // Sort descending by score, fallback to original order
    return scoreB - scoreA || indexA - indexB;
  });

  // For "new" or unspecified familiarity, ensure the very first topic is an orientation stage (if available)
  if (!familiarity || familiarity === "new") {
    const orientIndex = sorted.findIndex((t) => t.learningStage === "1. orientation");
    if (orientIndex > 0) {
      const orientTopic = sorted.splice(orientIndex, 1)[0];
      sorted.unshift(orientTopic);
    }
  }

  return sorted;
}
