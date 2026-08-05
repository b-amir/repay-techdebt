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
  [FLOW_STATES.PURPOSE]: "Picking the 3 most valuable lessons",
  [FLOW_STATES.SHORTLIST]: "Picking the 3 most valuable lessons",
  [FLOW_STATES.GATHER]: "Writing lessons",
  [FLOW_STATES.DRAFT]: "Writing lessons",
  [FLOW_STATES.MECHANICAL_CHECK]: "Writing lessons",
  [FLOW_STATES.REVIEW]: "Writing lessons",
  [FLOW_STATES.REVISE]: "Writing lessons",
  [FLOW_STATES.SAVE]: "Writing lessons",
  [FLOW_STATES.NEXT_LESSON]: "Writing lessons",
  [FLOW_STATES.WRAP]: "You're set",
};

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
