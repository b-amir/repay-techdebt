const TEMPORAL_EDGES = new Set(["calls", "handles", "routes-to", "emits", "transforms"]);
const STATE_EDGES = new Set(["reads", "writes", "transitions-to"]);

function reducedGraph(packet, maximumNodes = 8, maximumEdges = 10) {
  const byId = new Map((packet.nodes ?? []).map((node) => [node.id, node]));
  const focusIds = new Set(packet.focusNodeIds ?? []);
  const edges = [...(packet.edges ?? [])]
    .filter((edge) => byId.has(edge.from) && byId.has(edge.to) && edge.from !== edge.to)
    .sort((left, right) => {
      const leftFocus = focusIds.has(left.from) || focusIds.has(left.to) ? 1 : 0;
      const rightFocus = focusIds.has(right.from) || focusIds.has(right.to) ? 1 : 0;
      return rightFocus - leftFocus || String(left.kind).localeCompare(String(right.kind));
    });
  const keptEdges = [];
  const keptIds = new Set(focusIds);
  for (const edge of edges) {
    const nextIds = new Set([...keptIds, edge.from, edge.to]);
    if (nextIds.size > maximumNodes) continue;
    keptIds.add(edge.from);
    keptIds.add(edge.to);
    keptEdges.push({
      from: edge.from,
      to: edge.to,
      label: edge.kind,
      evidenceIds: [...(edge.evidenceIds ?? [])],
    });
    if (keptEdges.length >= maximumEdges) break;
  }
  return {
    nodes: [...keptIds]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((node) => ({ id: node.id, label: node.path ?? node.name ?? node.id })),
    edges: keptEdges,
  };
}

/** Select a useful evidence-backed visual, or explicitly explain why prose is better. */
export function selectDiagramType(topic, packet) {
  const graph = reducedGraph(packet);
  const kinds = new Set(graph.edges.map((edge) => edge.label));
  const chapter = String(topic.chapter ?? "").toLowerCase();
  const temporalCount = graph.edges.filter((edge) => TEMPORAL_EDGES.has(edge.label)).length;
  const stateCount = graph.edges.filter((edge) => STATE_EDGES.has(edge.label)).length;

  if (graph.edges.length === 0) {
    const legacyCount = (packet.callers?.length ?? 0) + (packet.dependencies?.length ?? 0);
    if (legacyCount > 0) {
      const type =
        chapter.includes("workflow") || (packet.callers?.length ?? 0) > 2
          ? "sequence"
          : chapter.includes("boundar") || chapter.includes("trust")
            ? "flowchart"
            : (packet.stateEffects?.length ?? 0) > 0
              ? "state"
              : "flowchart";
      return {
        type,
        orientation: type === "flowchart" ? "portrait" : "intrinsic",
        decision: "recommended",
        teachingQuestion:
          type === "sequence"
            ? "Who talks to whom, and in what order?"
            : type === "state"
              ? "Which transitions are legal?"
              : "Which responsibility crosses this boundary?",
        reason:
          "Relationship evidence suggests a visual, but concrete graph edges still need source verification.",
        nodes: [],
        edges: [],
        evidenceIds: [],
      };
    }
    return {
      type: "none",
      orientation: "intrinsic",
      decision: "omit",
      reason: "No verified relationship or transition would make a diagram more useful than prose.",
      nodes: [],
      edges: [],
      evidenceIds: [],
    };
  }

  let type = "flowchart";
  let teachingQuestion = "Which responsibility crosses this boundary?";
  if (stateCount >= 2 && /state|lifecycle/.test(chapter)) {
    type = "state";
    teachingQuestion = "Which transitions and state effects are possible?";
  } else if (temporalCount >= 2 && /flow|workflow|request|debug/.test(chapter)) {
    type = "sequence";
    teachingQuestion = "Who talks to whom, and in what order?";
  } else if (
    !/boundar|security|architecture|ownership|impact/.test(chapter) &&
    temporalCount >= 3
  ) {
    type = "sequence";
    teachingQuestion = "Who talks to whom, and in what order?";
  }

  const decision =
    graph.edges.length >= 2 &&
    /flow|workflow|request|state|lifecycle|boundar|security|architecture|ownership/.test(chapter)
      ? "required"
      : "recommended";
  return {
    type,
    orientation: type === "flowchart" ? "portrait" : "intrinsic",
    decision,
    teachingQuestion,
    reason:
      graph.edges.length < (packet.edges?.length ?? 0)
        ? "A reduced evidence-backed subgraph explains the lesson without reproducing the full dependency graph."
        : "The verified relationships are easier to understand as one visual path than as equivalent prose.",
    nodes: graph.nodes,
    edges: graph.edges,
    evidenceIds: [...new Set(graph.edges.flatMap((edge) => edge.evidenceIds ?? []))],
    observedEdgeKinds: [...kinds],
  };
}
