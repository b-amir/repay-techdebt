/**
 * Builds a lesson specification from a topic and its evidence packet.
 *
 * @param {Object} topic The topic to build a spec for.
 * @param {Object} packet The evidence packet.
 * @returns {Object} The lesson specification.
 */
export function buildLessonSpecification(topic, packet) {
  const claims = [];

  if (packet.callers && packet.callers.length > 0) {
    packet.callers.slice(0, 2).forEach((caller) => {
      claims.push({
        claim: `Why does **${caller}** call ${topic.focus} here, and what would break if the call were removed?`,
        expectedAnchor: caller,
      });
    });
  }

  if (packet.dependencies && packet.dependencies.length > 0) {
    packet.dependencies.slice(0, 1).forEach((dependency) => {
      claims.push({
        claim: `What contract does ${topic.focus} rely on from ${dependency}, and what happens if ${dependency} changes it?`,
        expectedAnchor: dependency,
      });
    });
  }

  if (packet.state || (packet.effects && packet.effects.length > 0)) {
    claims.push({
      claim: `Trace one input through ${topic.focus} to its observable effect.`,
      expectedAnchor: topic.focus,
    });
  }

  if (packet.failurePath) {
    claims.push({
      claim: `What is the failure path when ${packet.failurePath}, and why is it safe?`,
      expectedAnchor: packet.failurePath,
    });
  }

  claims.push({
    claim: `Name one non-obvious consequence of ${topic.focus} a reader would not guess from the file name alone.`,
    expectedAnchor: topic.focus,
  });

  return {
    topicId: topic.id,
    outcome: topic.learnerOutcome,
    requiredClaims: claims,
    prohibitedClaims: [
      "Mentions internal details of un-imported components",
      "Invented or hallucinated API parameters not present in evidence",
    ],
    evidence: packet,
    challenge: `Create a transfer task evaluating knowledge of ${topic.focus}`,
  };
}
