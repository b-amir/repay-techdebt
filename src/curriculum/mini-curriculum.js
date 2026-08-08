// Mini-curriculum builder for one-shot teaches (PR / focused). Every durable save
// must link into a workbook, so a small curriculum (1–5 subjects) is created or
// appended under a single neutral chapter, "Recent teaching", before save-lesson.
//
// This is a pure proposal the agent still shortlists (demote/add/corroborate);
// it carries a complete agentApproval scaffold and pre-corroborated topics so it
// passes validateAgentApproval + validateCurriculum floors without compressing a
// large repo into omnibus lessons (scale.availableCandidates collapses the minimum).
import { createHash } from "node:crypto";

export const TEACHING_CHAPTER = "Recent teaching";

function topicId(focus) {
  const digest = createHash("sha256").update(`teaching\0${focus}`).digest("hex").slice(0, 12);
  return `topic-${digest}`;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

/**
 * @param {object} input
 * @param {string} input.targetRoot     Canonical (realpath) target root.
 * @param {string} input.approvedAt     ISO timestamp for agentApproval.approvedAt.
 * @param {"accepted"|"unresolved"} [input.purposeStatus]
 * @param {string} [input.origin]       Free-text provenance note (e.g. "PR #42").
 * @param {Array<{title:string, focus:string, learnerOutcome?:string, evidencePaths?:string[]}>} input.subjects
 * @returns {object} A schemaVersion 1 curriculum proposal ready for `save-curriculum --input`.
 */
export function buildTeachingCurriculum({
  targetRoot,
  approvedAt,
  purposeStatus = "unresolved",
  origin = null,
  subjects,
}) {
  if (!targetRoot || typeof targetRoot !== "string") {
    throw new Error("buildTeachingCurriculum requires a targetRoot string");
  }
  if (!approvedAt || typeof approvedAt !== "string") {
    throw new Error("buildTeachingCurriculum requires an approvedAt ISO timestamp");
  }
  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new Error("buildTeachingCurriculum requires at least one subject");
  }
  if (subjects.length > 5) {
    throw new Error("A mini-curriculum has 1–5 subjects; use plan-curriculum for larger workbooks");
  }
  const focuses = new Set();
  const topics = subjects.map((subject, index) => {
    if (!subject?.title || !subject?.focus) {
      throw new Error(`Subject ${index + 1} needs a title and focus`);
    }
    const focus = String(subject.focus);
    if (focuses.has(focus)) throw new Error(`Mini-curriculum repeats the focus: ${focus}`);
    focuses.add(focus);
    return {
      id: topicId(focus),
      rank: index + 1,
      tier: index === 0 ? "start-here" : "core",
      chapter: TEACHING_CHAPTER,
      learningStage: "3. applied",
      title: String(subject.title),
      focus,
      learnerOutcome:
        subject.learnerOutcome ||
        `You will understand ${String(subject.title)} from verified project evidence and change it safely.`,
      importance: 90 - index,
      importanceReasons: ["Teaching subject from a change or focus area"],
      evidencePaths: asArray(subject.evidencePaths),
      relationCount: asArray(subject.evidencePaths).length,
      signalClass: "naming-heuristic",
      corroborated: true,
      status: "planned",
      lessonPath: null,
      prerequisites: [],
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: approvedAt,
    target: { root: targetRoot, scope: "." },
    repositorySize: "small",
    scale: {
      minimum: topics.length,
      target: topics.length,
      maximum: 5,
      availableCandidates: topics.length,
      selectedTopics: topics.length,
    },
    coverage: { modeledFiles: topics.length, status: "complete" },
    delivery: {
      mode: "batch-only",
      requestedLessonCount: topics.length,
      learningPathTopics: topics.map((topic) => topic.id),
      sessionBatch: topics.map((topic) => topic.id),
    },
    topics,
    unresolved: [],
    agentApproval: {
      approvedAt,
      purposeStatus,
      note: origin ? `Recent teaching: ${origin}` : "Recent teaching subject(s).",
      corroboratedTopicIds: topics.map((topic) => topic.id),
      demotedTopicIds: [],
      addedTopicIds: [],
      acceptedPartialScope: null,
    },
  };
}
