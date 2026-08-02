/**
 * Evaluates the pedagogical quality of a lesson.
 *
 * @param {string} markdown The lesson content.
 * @returns {Object} Evaluation results containing errors and warnings.
 */
export function evaluatePedagogy(markdown) {
  const errors = [];
  const warnings = [];

  const lowerMd = markdown.toLowerCase();

  // 1. Motivation (why does this matter?)
  if (!/(?:why|because|motivation|important|reason|benefit)/i.test(lowerMd)) {
    warnings.push("Lesson lacks clear motivation. Add explanation of why this topic matters.");
  }

  // 2. Causal mental model (cause and effect)
  if (!/(?:leads to|causes|results in|triggers|so that|therefore)/i.test(lowerMd)) {
    errors.push("Missing causal mental model. Explain the cause-and-effect relationship.");
  }

  // 3. Misconception management
  if (
    !/(?:common mistake|pitfall|warning|note|misconception|careful|instead of|rather than)/i.test(
      lowerMd,
    )
  ) {
    warnings.push("Anticipate and address at least one common misconception or pitfall.");
  }

  // 4. Answerable transfer task / Challenge
  const hasChallenge = /challenge|task|exercise/i.test(lowerMd);
  if (!hasChallenge) {
    errors.push("Lesson must end with an actionable transfer task or challenge.");
  } else {
    // Check if challenge distinguishes between types (recall, trace, debug, modify, design)
    const hasChallengeType = /(?:recall|trace|debug|modify|design|build|fix|change)/i.test(lowerMd);
    if (!hasChallengeType) {
      warnings.push(
        "Challenge should explicitly be a tracing, debugging, modification, or design task.",
      );
    }

    // Check for private rubric or answer guidance
    if (!/(?:rubric|answer|solution|guidance|expected)/i.test(lowerMd)) {
      errors.push("Challenge must include a private rubric or answer guidance.");
    }
  }

  // 5. Cognitive load (proxy via excessive code blocks without explanation)
  const codeBlocks = (markdown.match(/```/g) || []).length / 2;
  const wordCount = markdown.split(/\s+/).length;
  if (codeBlocks > 5 && wordCount < 400) {
    errors.push("High cognitive load: Too much code relative to explanation.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
