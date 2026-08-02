/**
 * Determines whether a topic should include a diagram, and if so, what type.
 * 
 * @param {Object} topic The lesson topic.
 * @param {Object} packet The evidence packet.
 * @returns {Object} Diagram intent (type, reason, teachingQuestion).
 */
export function selectDiagramType(topic, packet) {
  // Budget heuristic (max nodes/edges)
  const nodeCount = packet.callers.length + packet.dependencies.length + 1; // +1 for the focus node itself
  const edgeCount = packet.callers.length + packet.dependencies.length;

  if (nodeCount > 10 || edgeCount > 14) {
    return {
      type: "none",
      reason: "Diagram would be too dense to remain readable. Use prose instead."
    };
  }

  // Type selection logic based on the chapter or evidence
  if (topic.chapter.includes("workflows") || packet.callers.length > 2) {
    return {
      type: "sequence",
      teachingQuestion: "Who talks to whom, and in what order?",
      reason: "Clarifies complex asynchronous work or order of operations."
    };
  }

  if (topic.chapter.includes("boundaries") || topic.chapter.includes("trust")) {
    return {
      type: "flowchart",
      teachingQuestion: "Who owns which responsibility or trust zone?",
      reason: "Visualizes ownership boundaries and cross-boundary dependencies."
    };
  }

  if (packet.stateEffects.length > 0) {
    return {
      type: "state",
      teachingQuestion: "Which transitions are legal?",
      reason: "Clarifies state mutations and their lifecycle."
    };
  }

  if (nodeCount > 1 && nodeCount <= 10) {
    return {
      type: "flowchart",
      teachingQuestion: "What breaks when this node changes?",
      reason: "A focused dependency flow clarifies the blast radius."
    };
  }

  return {
    type: "none",
    reason: "A simple linear fact or single local function does not need a visual."
  };
}
