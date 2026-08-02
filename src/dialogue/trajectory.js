/**
 * Checkpoint trajectory validation (ask fidelity).
 * Agents (or stubs) record replies; conformance checks the required order.
 */

export const WORKBOOK_TRAJECTORY = ["B0", "B1", "B2", "B5", "B3", "B4a", "B4b", "B6"];
export const FOCUSED_TRAJECTORY = ["B0", "B1", "B2", "B5", "B4b", "B6"];
export const PR_TRAJECTORY = ["B0", "B1", "B2", "B5", "B4b", "B6"];

const CHECKPOINT_IDS = new Set(["B0", "B1", "B2", "B3", "B4a", "B4b", "B5", "B6"]);

/**
 * @param {object} trajectory
 * @param {{ mode?: "workbook"|"focused"|"pr" }} [options]
 */
export function validateTrajectory(trajectory, options = {}) {
  const mode = options.mode ?? trajectory?.mode ?? "workbook";
  const required =
    mode === "pr" ? PR_TRAJECTORY : mode === "focused" ? FOCUSED_TRAJECTORY : WORKBOOK_TRAJECTORY;
  const errors = [];
  if (!trajectory || typeof trajectory !== "object")
    return { ok: false, errors: ["trajectory must be an object"], required, observed: [] };

  const steps = Array.isArray(trajectory.steps) ? trajectory.steps : [];
  const observed = [];
  for (const [index, step] of steps.entries()) {
    if (!step || typeof step !== "object") {
      errors.push(`steps[${index}] must be an object`);
      continue;
    }
    if (!CHECKPOINT_IDS.has(step.id)) {
      errors.push(`steps[${index}].id must be a checkpoint id (B0–B6)`);
      continue;
    }
    if (!step.status || !["done", "skipped"].includes(step.status)) {
      errors.push(`steps[${index}].status must be done|skipped`);
      continue;
    }
    if (step.status === "skipped" && !step.reason)
      errors.push(`steps[${index}] skipped without reason`);
    if (step.status === "done" && !step.reply) errors.push(`steps[${index}] done without reply`);
    observed.push(step.id);
  }

  let cursor = 0;
  for (const id of required) {
    const at = observed.indexOf(id, cursor);
    if (at < 0) {
      const step = steps.find((item) => item.id === id);
      if (step?.status === "skipped" && step.reason) continue;
      errors.push(`Missing required checkpoint ${id} for mode=${mode}`);
    } else cursor = at + 1;
  }

  // Mode-specific skips: workbook must not skip B3/B4a without reason already checked;
  // focused/pr should not require them.
  if (mode === "workbook") {
    for (const id of ["B3", "B4a"]) {
      const step = steps.find((item) => item.id === id);
      if (!step) errors.push(`Workbook trajectory requires ${id}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    required,
    observed,
    mode,
  };
}

export function stubWorkbookTrajectory(overrides = {}) {
  const base = {
    mode: "workbook",
    steps: [
      { id: "B0", status: "done", reply: "UNRESOLVED purpose: who are the users?" },
      { id: "B1", status: "done", reply: "Confirm languages: javascript" },
      {
        id: "B2",
        status: "done",
        reply: "RETRIEVEQs: paths into capturePayment; callers of settle",
      },
      {
        id: "B5",
        status: "done",
        reply: "Verified capture→settle at bounded-contexts/billing-core/capture.js",
      },
      {
        id: "B3",
        status: "done",
        reply: "SHORTLIST: billing-core; DEMOTED: none",
      },
      {
        id: "B4a",
        status: "done",
        reply: "Order: purpose → capture flow → settle mechanism",
      },
      {
        id: "B4b",
        status: "done",
        reply: "Drafted capture lesson with predict + modify challenge",
      },
      {
        id: "B6",
        status: "done",
        reply: 'CLAIMS: 1. "settle is called from capture" — capture.js:4 — support: yes',
      },
    ],
  };
  return {
    ...base,
    ...overrides,
    mode: overrides.mode ?? "workbook",
    steps: overrides.steps ?? base.steps,
  };
}
