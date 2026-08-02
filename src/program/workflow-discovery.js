import { stableId } from "./identity.js";

/**
 * Discovers likely workflows by analyzing the program model for converging clues.
 *
 * @param {Object} model The normalized program model.
 * @returns {Array} List of workflow candidates with confidence and reasons.
 */
export function discoverWorkflows(model) {
  const candidates = [];
  const routeNodes = model.nodes.filter(
    (n) => n.kind === "route" || n.name.toLowerCase().includes("route"),
  );
  const commandNodes = model.nodes.filter(
    (n) =>
      n.kind === "command" ||
      n.name.toLowerCase().includes("cli") ||
      n.name.toLowerCase().includes("command"),
  );

  // Aggregate clues
  if (routeNodes.length > 0) {
    const isAuthoritative = routeNodes.length > 1; // Simplistic proxy for strong signal
    candidates.push({
      id: stableId("workflow", "api-routing"),
      name: "API Routing",
      confidence: isAuthoritative ? 0.8 : 0.3, // Weak if only one clue
      reasons: [
        isAuthoritative
          ? `Found ${routeNodes.length} route nodes suggesting a web service.`
          : `Found only one route-like node (${routeNodes[0].name}), weak signal.`,
      ],
      nodes: routeNodes.map((n) => n.id),
    });
  }

  if (commandNodes.length > 0) {
    const isAuthoritative = commandNodes.length > 1;
    candidates.push({
      id: stableId("workflow", "cli-execution"),
      name: "CLI Execution",
      confidence: isAuthoritative ? 0.85 : 0.4,
      reasons: [
        isAuthoritative
          ? `Found ${commandNodes.length} command nodes suggesting a CLI.`
          : `Found only one command-like node (${commandNodes[0].name}), weak signal.`,
      ],
      nodes: commandNodes.map((n) => n.id),
    });
  }

  // Filter weak signals or those lacking multiple clues/authoritative declaration
  // But for discovery, we return them with explicit reasons and low confidence.
  return candidates;
}
