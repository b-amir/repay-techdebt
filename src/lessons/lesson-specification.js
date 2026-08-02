/**
 * Builds a lesson specification from a topic and its evidence packet.
 *
 * @param {Object} topic The topic to build a spec for.
 * @param {Object} packet The evidence packet.
 * @returns {Object} The lesson specification.
 */
export function buildLessonSpecification(topic, packet) {
  return {
    topicId: topic.id,
    outcome: topic.learnerOutcome,
    requiredClaims: [
      `Explains the purpose of ${topic.focus}`,
      ...packet.callers.map((c) => `Explains how it is called by ${c}`),
      ...packet.dependencies.map((d) => `Explains dependency on ${d}`),
    ],
    prohibitedClaims: [
      "Mentions internal details of un-imported components",
      "Invented or hallucinated API parameters not present in evidence",
    ],
    evidence: packet,
    challenge: `Create a transfer task evaluating knowledge of ${topic.focus}`,
  };
}
