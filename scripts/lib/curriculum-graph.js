/**
 * Infers a prerequisite graph for topics and returns them in topological order.
 *
 * @param {Array<Object>} topics The list of refined topics.
 * @returns {Array<Object>} Topics in a logical study order (DAG).
 */
export function buildStudyOrder(topics) {
  // Simple heuristic-based ordering if exact dependencies are not mapped
  // 1. purpose (workflows) 
  // 2. architecture (components/boundaries)
  // 3. state ownership (data)
  // 4. implementation (files/areas)
  
  const kindWeights = {
    workflow: 10,
    entry: 20,
    dependency: 30,
    boundary: 40,
    component: 50,
    area: 60,
    file: 70,
    test: 80
  };

  // Add prerequisites based on heuristics
  for (const topic of topics) {
    if (!topic.prerequisites) topic.prerequisites = [];
    
    // E.g., area topics depend on components they might belong to
    if (topic.kind === "area") {
      const parentComponent = topics.find(t => t.kind === "component" && topic.focus.startsWith(t.focus));
      if (parentComponent && parentComponent.id !== topic.id) {
        topic.prerequisites.push(parentComponent.id);
      }
    }
  }

  // Topological sort
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();

  function visit(topic) {
    if (visited.has(topic.id)) return;
    if (visiting.has(topic.id)) {
      // Cycle detected, break it by returning
      return; 
    }
    visiting.add(topic.id);
    
    for (const reqId of topic.prerequisites || []) {
      const req = topics.find(t => t.id === reqId);
      if (req) visit(req);
    }
    
    visiting.delete(topic.id);
    visited.add(topic.id);
    sorted.push(topic);
  }

  // Sort by basic weight first so standalone topics are ordered nicely
  const preSorted = [...topics].sort((a, b) => {
    const weightA = kindWeights[a.kind] || 100;
    const weightB = kindWeights[b.kind] || 100;
    return weightA - weightB || b.importance - a.importance;
  });

  for (const topic of preSorted) {
    visit(topic);
  }

  return sorted;
}
