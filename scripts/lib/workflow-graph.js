import { stableId } from "./identity.js";

/**
 * Builds an entry-to-effect workflow graph for a given set of entry points.
 * 
 * @param {Object} model The program model.
 * @param {Array<string>} entryNodeIds The nodes acting as entry points for the workflow.
 * @returns {Object} Workflow graph containing nodes, edges, and status of completeness.
 */
export function buildWorkflowGraph(model, entryNodeIds) {
  const nodes = new Map();
  const edges = [];
  const unresolvedHops = [];
  const entryIds = new Set(entryNodeIds);

  const modelNodes = new Map(model.nodes.map(n => [n.id, n]));
  const adj = new Map();
  for (const edge of model.edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from).push(edge);
  }

  // BFS traversal to build the flow
  const visited = new Set();
  const queue = [...entryNodeIds];

  for (const startId of queue) {
    if (modelNodes.has(startId)) {
      nodes.set(startId, modelNodes.get(startId));
    }
  }

  while (queue.length > 0) {
    const currId = queue.shift();
    if (visited.has(currId)) continue;
    visited.add(currId);

    const outEdges = adj.get(currId) || [];
    
    // If a node is an entry/processing node but has no outgoing semantic edges, it's a potential dead end or unresolved hop
    const semanticOutEdges = outEdges.filter(e => e.kind !== "contains");
    if (semanticOutEdges.length === 0 && !modelNodes.get(currId)?.kind.includes("store")) {
      unresolvedHops.push({
        nodeId: currId,
        reason: "No outgoing edges detected statically, possible dynamic dispatch."
      });
    }

    for (const edge of semanticOutEdges) {
      edges.push({
        ...edge,
        inferred: edge.confidence < 0.7 // Example simplistic heuristic for inferred edges
      });
      
      if (!nodes.has(edge.to) && modelNodes.has(edge.to)) {
        nodes.set(edge.to, modelNodes.get(edge.to));
      }
      
      if (!visited.has(edge.to)) {
        queue.push(edge.to);
      }
    }
  }

  // The planner refuses to call an incomplete static path an end-to-end trace
  const isComplete = unresolvedHops.length === 0;

  return {
    isCompleteTrace: isComplete,
    nodes: Array.from(nodes.values()),
    edges,
    unresolvedHops
  };
}
