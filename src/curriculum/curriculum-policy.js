/**
 * Curriculum design policy (B4a) - kept out of lesson faithfulness.
 */

const OMNIBUS =
  /\b(?:whole\s+(?:app|application|codebase|system|project)|entire\s+(?:app|application|codebase|system)|everything\s+about|complete\s+overview|full\s+walkthrough\s+of\s+the\s+(?:app|system)|understand\s+the\s+(?:whole|entire)\b)/i;

/** Titles/outcomes that try to teach the entire application in one subject. */
export function isOmnibusTopic(topic) {
  const blob = `${topic.title ?? ""} ${topic.focus ?? ""} ${topic.learnerOutcome ?? ""}`;
  return OMNIBUS.test(blob);
}

export function findOmnibusTopics(topics) {
  return (topics ?? []).filter(isOmnibusTopic);
}

/**
 * Topics that need explicit corroboration before curriculum save.
 * @param {{ signalClass?: string, relationCount?: number }} topic
 */
export function requiresCorroboration(topic) {
  const signal = topic.signalClass ?? "naming-heuristic";
  if (signal === "naming-heuristic") return true;
  if ((topic.relationCount ?? 0) < 2) return true;
  return false;
}

/**
 * @param {{ id: string, corroborated?: boolean, signalClass?: string, relationCount?: number }} topic
 * @param {{ corroboratedTopicIds?: string[], corroboration?: Record<string, { corroborated?: boolean }> }} [approval]
 */
export function isTopicCorroborated(topic, approval = {}) {
  if (!requiresCorroboration(topic)) return true;
  if (topic.corroborated === true) return true;
  if ((approval.corroboratedTopicIds ?? []).includes(topic.id)) return true;
  const record = approval.corroboration?.[topic.id];
  return record?.corroborated === true;
}

/**
 * @param {{ id: string, signalClass?: string, relationCount?: number, evidencePaths?: string[] }} topic
 * @param {object} [evidence]
 * @returns {{ corroborated: boolean, reason: string, evidence: string[] }}
 */
export function corroborateTopic(topic, evidence = {}) {
  const paths = topic.evidencePaths ?? [];
  const signals = evidence.convergingSignals ?? paths;
  const corroborated = signals.length >= 2 || (paths.length >= 2 && topic.relationCount >= 2);
  return {
    corroborated,
    reason: corroborated
      ? "At least two converging evidence signals support this topic."
      : "Naming-heuristic or low-relation topics need ≥2 converging signals before save.",
    evidence: signals.slice(0, 8),
  };
}

export function enforceCorroboration(topics, model, userCorroboratedIds = new Set()) {
  const errors = [];
  const entryPaths = new Set(model?.profile?.entryPoints || []);
  const workflows = new Set(model?.profile?.criticalWorkflows || []);

  for (const topic of topics) {
    if (
      topic.signalClass === "naming-heuristic" &&
      topic.evidencePaths &&
      topic.evidencePaths.length === 1 &&
      !userCorroboratedIds.has(topic.id) &&
      topic.corroborated !== true
    ) {
      // Check if it's related to a workflow or entry point
      let related = false;
      if (model) {
        const node = model.nodes.find((n) => n.path === topic.evidencePaths[0]);
        if (node) {
          const edges = model.edges.filter((e) => e.from === node.id || e.to === node.id);
          related = edges.some((e) => {
            const other = model.nodes.find((n) => n.id === (e.from === node.id ? e.to : e.from));
            return other && (entryPaths.has(other.path) || workflows.has(other.name));
          });
        }
      }

      if (!related) {
        errors.push(
          `Topic ${topic.id} is a single-file naming-heuristic module and must be corroborated by a related workflow, entry point, or explicit user acceptance.`,
        );
      }
    }
  }

  return errors;
}
