/**
 * Curriculum design policy (B4a) — kept out of lesson faithfulness.
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
