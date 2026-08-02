/**
 * Evaluates a generated curriculum against expected topics.
 * 
 * @param {Object} curriculum The generated curriculum containing topics.
 * @param {Object} expectations The expected fixture definitions (EvaluationFixtureSchema).
 * @returns {Object} Report containing missing, extra, and matched topics.
 */
export function evaluateCurriculum(curriculum, expectations) {
  const generatedTopicIds = new Set(curriculum.topics.map(t => t.id || t.title || t.name || t.focus));
  
  const mustFind = expectations.topics.filter(t => t.intent === "must-find");
  const forbidden = expectations.topics.filter(t => t.intent === "forbidden");
  
  const missingMustFind = mustFind.filter(t => !generatedTopicIds.has(t.id));
  const presentForbidden = forbidden.filter(t => generatedTopicIds.has(t.id));
  
  const ok = missingMustFind.length === 0 && presentForbidden.length === 0;

  return {
    ok,
    missingMustFind,
    presentForbidden,
    totalExpected: mustFind.length,
    totalGenerated: generatedTopicIds.size
  };
}
