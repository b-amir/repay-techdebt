import { createHash } from "node:crypto";

/**
 * Creates an SHA-256 digest for an excerpt.
 */
function hashExcerpt(text) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Builds a bounded evidence packet for a specific topic.
 *
 * @param {Object} topic The curriculum topic.
 * @param {Object} model The program model.
 * @param {Object} options Options like tokenBudget.
 * @returns {Object} The evidence packet.
 */
export function buildEvidencePacket(topic, model, options = {}) {
  const tokenBudget = options.tokenBudget || 4000;
  
  // Basic packet structure
  const packet = {
    topicId: topic.id,
    topicTitle: topic.title,
    purpose: topic.learnerOutcome,
    workflowPosition: topic.chapter,
    excerpts: [],
    callers: [],
    dependencies: [],
    stateEffects: [],
    tests: [],
    vocabulary: [],
    gaps: []
  };

  // Extract nodes based on evidence paths
  const evidenceNodes = model.nodes.filter(n => topic.evidencePaths.includes(n.path));
  
  let currentTokens = 0;
  const charsPerToken = 4; // rough heuristic

  for (const path of topic.evidencePaths) {
    const node = evidenceNodes.find(n => n.path === path);
    // In a real system we'd read the file content, for now we mock the excerpt logic
    // or rely on the model containing excerpts or file paths to read.
    const mockContent = node ? `// Content of ${node.name}` : `// Content of ${path}`;
    
    // Simulate token budget constraint
    const tokenCost = mockContent.length / charsPerToken;
    if (currentTokens + tokenCost > tokenBudget) {
      packet.gaps.push(`Excerpt for ${path} truncated due to token budget.`);
      continue;
    }

    currentTokens += tokenCost;

    packet.excerpts.push({
      path,
      lines: "1-10", // Placeholder for actual lines
      digest: hashExcerpt(mockContent),
      content: mockContent, // Sensitive values should be stripped here (e.g. regex for secrets)
      collectionTime: new Date().toISOString(),
      evidenceState: "verified"
    });
  }

  // Find relations
  for (const node of evidenceNodes) {
    const nodeEdges = model.edges.filter(e => e.to === node.id || e.from === node.id);
    for (const edge of nodeEdges) {
      if (edge.kind === "calls" && edge.to === node.id) {
        packet.callers.push(edge.from);
      }
      if (edge.kind === "imports" && edge.from === node.id) {
        packet.dependencies.push(edge.to);
      }
      if (edge.kind === "writes") {
        packet.stateEffects.push(edge.to);
      }
      if (edge.kind === "tests" && edge.to === node.id) {
        packet.tests.push(edge.from);
      }
    }
  }

  // Deduplicate
  packet.callers = [...new Set(packet.callers)];
  packet.dependencies = [...new Set(packet.dependencies)];
  packet.stateEffects = [...new Set(packet.stateEffects)];
  packet.tests = [...new Set(packet.tests)];

  return packet;
}
