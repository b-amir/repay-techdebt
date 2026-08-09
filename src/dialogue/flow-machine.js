export const FLOW_STATES = {
  SETUP: "setup",
  PURPOSE: "purpose",
  SHORTLIST: "shortlist",
  GATHER: "gather",
  DRAFT: "draft",
  MECHANICAL_CHECK: "mechanical-check",
  REVIEW: "review",
  REVISE: "revise",
  SAVE: "save",
  NEXT_LESSON: "next-lesson",
  WRAP: "wrap",
};

export const USER_STEPS = {
  [FLOW_STATES.SETUP]: "Reading your code",
  [FLOW_STATES.PURPOSE]: "Choosing lessons",
  [FLOW_STATES.SHORTLIST]: "Choosing lessons",
  [FLOW_STATES.GATHER]: "Writing lessons",
  [FLOW_STATES.DRAFT]: "Writing lessons",
  [FLOW_STATES.MECHANICAL_CHECK]: "Writing lessons",
  [FLOW_STATES.REVIEW]: "Writing lessons",
  [FLOW_STATES.REVISE]: "Writing lessons",
  [FLOW_STATES.SAVE]: "Writing lessons",
  [FLOW_STATES.NEXT_LESSON]: "Writing lessons",
  [FLOW_STATES.WRAP]: "You're set",
};

export const PROGRESS_SCENARIOS = Object.freeze({
  WORKBOOK: "workbook",
  SINGLE_CREATE: "single-create",
  SINGLE_RECREATE: "single-recreate",
  SINGLE_UPDATE: "single-update",
  SINGLE_DELETE: "single-delete",
  LESSON_BATCH: "lesson-batch",
  PR_LESSON: "pr-lesson",
  VIEW_ONLY: "view-only",
});

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function writingStep(count, currentLesson) {
  if (!count) return "Writing lessons";
  const current = Math.min(positiveInteger(currentLesson) ?? 1, count);
  return `Writing lesson ${current}/${count}`;
}

function batchActionStep(action, count, currentLesson) {
  const verb = {
    create: "Writing",
    recreate: "Recreating",
    update: "Updating",
    delete: "Removing",
  }[action];
  if (!verb) throw new Error(`Unknown lesson batch action: ${action}`);
  if (!count) return `${verb} lessons`;
  const current = Math.min(positiveInteger(currentLesson) ?? 1, count);
  return `${verb} lesson ${current}/${count}`;
}

/**
 * Build user-facing progress from the requested operation, never a default batch assumption.
 * @param {{scenario?: string, lessonCount?: number, currentLesson?: number, lessonAction?: "create"|"recreate"|"update"|"delete", includeOpenStep?: boolean, includeSetupStep?: boolean}} options
 */
export function buildProgressSteps({
  scenario = PROGRESS_SCENARIOS.WORKBOOK,
  lessonCount,
  currentLesson = 1,
  lessonAction = "create",
  includeOpenStep = false,
  includeSetupStep = false,
} = {}) {
  const count = positiveInteger(lessonCount);
  let steps;

  switch (scenario) {
    case PROGRESS_SCENARIOS.SINGLE_CREATE:
      steps = ["Reading your code", "Writing the lesson", "You're set"];
      break;
    case PROGRESS_SCENARIOS.SINGLE_RECREATE:
      steps = ["Reading the current lesson", "Recreating the lesson", "You're set"];
      break;
    case PROGRESS_SCENARIOS.SINGLE_UPDATE:
      steps = ["Reading the lesson", "Updating the lesson", "You're set"];
      break;
    case PROGRESS_SCENARIOS.SINGLE_DELETE:
      steps = ["Finding the lesson", "Removing the lesson", "You're set"];
      break;
    case PROGRESS_SCENARIOS.LESSON_BATCH:
      steps = [
        "Reading your code",
        count ? `Preparing ${count} lessons` : "Preparing the requested lessons",
        batchActionStep(lessonAction, count, currentLesson),
        "You're set",
      ];
      break;
    case PROGRESS_SCENARIOS.PR_LESSON:
      steps = ["Reading the change", "Writing the lesson", "You're set"];
      break;
    case PROGRESS_SCENARIOS.VIEW_ONLY:
      steps = ["Opening the workbook", "You're set"];
      break;
    case PROGRESS_SCENARIOS.WORKBOOK:
      steps = [
        "Reading your code",
        count === 1
          ? "Picking the most valuable lesson"
          : count
            ? `Picking the ${count} most valuable lessons`
            : "Choosing the most valuable lessons",
        writingStep(count, currentLesson),
        "You're set",
      ];
      break;
    default:
      throw new Error(`Unknown progress scenario: ${scenario}`);
  }

  if (includeOpenStep && scenario !== PROGRESS_SCENARIOS.VIEW_ONLY) {
    steps.splice(-1, 0, "Open workbook");
  }
  if (includeSetupStep) steps.unshift("Get ready");
  return steps;
}

export const FLOW_TRANSITIONS = {
  [FLOW_STATES.SETUP]: [FLOW_STATES.PURPOSE],
  [FLOW_STATES.PURPOSE]: [FLOW_STATES.SHORTLIST, FLOW_STATES.WRAP],
  [FLOW_STATES.SHORTLIST]: [FLOW_STATES.GATHER, FLOW_STATES.WRAP],
  [FLOW_STATES.GATHER]: [FLOW_STATES.DRAFT, FLOW_STATES.SHORTLIST, FLOW_STATES.WRAP],
  [FLOW_STATES.DRAFT]: [FLOW_STATES.MECHANICAL_CHECK, FLOW_STATES.WRAP],
  [FLOW_STATES.MECHANICAL_CHECK]: [FLOW_STATES.REVIEW, FLOW_STATES.DRAFT, FLOW_STATES.REVISE],
  [FLOW_STATES.REVIEW]: [FLOW_STATES.REVISE, FLOW_STATES.SAVE],
  [FLOW_STATES.REVISE]: [FLOW_STATES.MECHANICAL_CHECK],
  [FLOW_STATES.SAVE]: [FLOW_STATES.NEXT_LESSON, FLOW_STATES.WRAP],
  [FLOW_STATES.NEXT_LESSON]: [FLOW_STATES.SHORTLIST, FLOW_STATES.GATHER, FLOW_STATES.WRAP],
  [FLOW_STATES.WRAP]: [],
};

export function canTransition(fromState, toState) {
  if (!FLOW_TRANSITIONS[fromState]) return false;
  return FLOW_TRANSITIONS[fromState].includes(toState);
}

export function validateFlow(states) {
  const errors = [];
  if (!Array.isArray(states) || states.length === 0) {
    return { ok: false, errors: ["Empty flow states"] };
  }
  for (let i = 0; i < states.length - 1; i++) {
    const from = states[i];
    const to = states[i + 1];
    if (!canTransition(from, to)) {
      errors.push(`Invalid transition from ${from} to ${to}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
