/**
 * Checkpoint trajectory validation (ask fidelity).
 * Agents (or stubs) record replies; conformance checks the required order.
 *
 * TrajectoryGate: shared contract for check + save path completeness.
 * Field names are internal - never paste into user chat.
 */

export const WORKBOOK_TRAJECTORY = ["B0", "B1", "B2", "B5", "B3", "B4a", "B4b", "B6"];
export const FOCUSED_TRAJECTORY = ["B0", "B1", "B2", "B5", "B4b", "B6"];
export const PR_TRAJECTORY = ["B0", "B1", "B2", "B5", "B4b", "B6"];

/** @typedef {"fast" | "control"} TrajectoryGateMode */

/**
 * Shared gate shape for check-trajectory + fail-closed save.
 * `pathComplete` is derived - do not trust agent-supplied hope alone.
 *
 * @typedef {object} TrajectoryGate
 * @property {TrajectoryGateMode} mode
 * @property {boolean} purposeDone
 * @property {boolean | null} verifyDone  null = N/A when path skips verify
 * @property {{ purpose?: string, verify?: string, map?: string }} skipReasons
 * @property {boolean} pathComplete
 */

const CHECKPOINT_IDS = new Set(["B0", "B1", "B2", "B3", "B4a", "B4b", "B5", "B6"]);
const GATE_MODES = new Set(["fast", "control"]);

/**
 * Derive whether the durable learning path is complete.
 * Incomplete purpose → false. Valid skip reasons count as done for that slot.
 * verifyDone null = N/A (does not block). verifyDone false needs skipReasons.verify.
 *
 * @param {Pick<TrajectoryGate, "mode" | "purposeDone" | "verifyDone" | "skipReasons">} gate
 * @returns {boolean}
 */
export function derivePathComplete(gate) {
  if (!gate || typeof gate !== "object") return false;
  if (gate.mode !== "fast" && gate.mode !== "control") return false;

  const skips =
    gate.skipReasons && typeof gate.skipReasons === "object" && !Array.isArray(gate.skipReasons)
      ? gate.skipReasons
      : {};

  const purposeOk =
    gate.purposeDone === true ||
    (typeof skips.purpose === "string" && skips.purpose.trim().length > 0);
  if (!purposeOk) return false;

  // null = N/A (mode/path skips verify). true = done. false needs a verify skip reason.
  if (gate.verifyDone === null) return true;
  if (gate.verifyDone === true) return true;
  if (gate.verifyDone === false) {
    return typeof skips.verify === "string" && skips.verify.trim().length > 0;
  }
  return false;
}

/**
 * Normalize raw ledger/flow fields into a TrajectoryGate (pathComplete always re-derived).
 *
 * @param {object} [raw]
 * @returns {TrajectoryGate}
 */
export function buildTrajectoryGate(raw = {}) {
  const mode = raw.mode === "control" ? "control" : raw.mode === "fast" ? "fast" : null;
  const skipReasons = {};
  const src = raw.skipReasons && typeof raw.skipReasons === "object" ? raw.skipReasons : {};
  for (const key of ["purpose", "verify", "map"]) {
    if (typeof src[key] === "string" && src[key].trim()) skipReasons[key] = src[key].trim();
  }

  let verifyDone = raw.verifyDone;
  if (verifyDone !== true && verifyDone !== false && verifyDone !== null) {
    // Missing verifyDone: fast path may omit mechanical verify; control expects a boolean.
    verifyDone = mode === "fast" ? null : false;
  }

  /** @type {Omit<TrajectoryGate, "pathComplete">} */
  const partial = {
    mode: mode ?? "fast",
    purposeDone: raw.purposeDone === true,
    verifyDone,
    skipReasons,
  };
  // Invalid/unknown mode still yields a gate object with pathComplete false.
  if (!mode) {
    return { ...partial, mode: "fast", pathComplete: false };
  }
  return { ...partial, pathComplete: derivePathComplete(partial) };
}

/**
 * Soft shape check for gate payloads (no user-facing strings).
 * @param {unknown} value
 * @returns {{ ok: boolean, errors: string[], gate: TrajectoryGate | null }}
 */
export function validateTrajectoryGateShape(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["gate must be an object"], gate: null };
  }
  const v = /** @type {Record<string, unknown>} */ (value);
  if (!GATE_MODES.has(/** @type {string} */ (v.mode))) {
    errors.push("mode must be fast|control");
  }
  if (typeof v.purposeDone !== "boolean") errors.push("purposeDone must be boolean");
  if (v.verifyDone !== true && v.verifyDone !== false && v.verifyDone !== null) {
    errors.push("verifyDone must be boolean or null");
  }
  if (v.skipReasons != null) {
    if (typeof v.skipReasons !== "object" || Array.isArray(v.skipReasons)) {
      errors.push("skipReasons must be an object");
    }
  }
  if (errors.length > 0) return { ok: false, errors, gate: null };
  const gate = buildTrajectoryGate(v);
  // Re-derive; ignore any agent-supplied pathComplete hope.
  return { ok: true, errors: [], gate };
}

/** Subjects that need a structure map or an explicit map skip reason. */
const MAP_REQUIRED_SUBJECTS = new Set(["architecture", "flow", "structure", "dependency"]);

/**
 * Machine-readable missing pieces for refuse / status (codes only - phrase in formatPathIncompleteReason).
 * @param {TrajectoryGate | null | undefined} gate
 * @param {{ subject?: string, hasMapAnswers?: boolean }} [opts]
 * @returns {string[]}
 */
export function listPathMissing(gate, opts = {}) {
  if (!gate || typeof gate !== "object") return ["gate"];
  const missing = [];
  const skips = gate.skipReasons && typeof gate.skipReasons === "object" ? gate.skipReasons : {};
  const purposeOk =
    gate.purposeDone === true ||
    (typeof skips.purpose === "string" && skips.purpose.trim().length > 0);
  if (!purposeOk) missing.push("purpose");

  if (gate.verifyDone === false) {
    const verifySkip = typeof skips.verify === "string" && skips.verify.trim().length > 0;
    if (!verifySkip) missing.push("verify");
  } else if (gate.verifyDone !== true && gate.verifyDone !== null) {
    missing.push("verify");
  }

  const subject = typeof opts.subject === "string" ? opts.subject.toLowerCase() : "";
  if (MAP_REQUIRED_SUBJECTS.has(subject)) {
    const mapSkip = typeof skips.map === "string" && skips.map.trim().length > 0;
    if (!opts.hasMapAnswers && !mapSkip) missing.push("map");
  }

  if (gate.mode !== "fast" && gate.mode !== "control") missing.push("mode");
  return missing;
}

/**
 * Full gate check for check-trajectory + save (fail closed).
 * Accepts: gate object, { gate }, { trajectoryGate }, or legacy step-list only (→ incomplete).
 *
 * @param {unknown} input
 * @param {{ subject?: string, hasMapAnswers?: boolean }} [opts]
 * @returns {{
 *   ok: boolean,
 *   pathComplete: boolean,
 *   gate: TrajectoryGate | null,
 *   missing: string[],
 *   errors: string[],
 *   legacyFlowOnly: boolean
 * }}
 */
export function checkTrajectoryGate(input, opts = {}) {
  // Legacy: bare flow-state array / steps-only - not a gate.
  if (Array.isArray(input)) {
    return {
      ok: false,
      pathComplete: false,
      gate: null,
      missing: ["gate"],
      errors: ["trajectory gate missing; step list alone is not pathComplete"],
      legacyFlowOnly: true,
    };
  }
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      pathComplete: false,
      gate: null,
      missing: ["gate"],
      errors: ["trajectory must be an object with a gate"],
      legacyFlowOnly: false,
    };
  }
  const obj = /** @type {Record<string, unknown>} */ (input);
  /** @type {unknown} */
  let rawGate = obj.gate ?? obj.trajectoryGate ?? null;
  if (!rawGate && ("purposeDone" in obj || "pathComplete" in obj || "verifyDone" in obj)) {
    rawGate = obj;
  }
  // Steps-only object (old checkpoint trajectory) without gate fields.
  if (!rawGate && Array.isArray(obj.steps) && !("purposeDone" in obj) && !("verifyDone" in obj)) {
    return {
      ok: false,
      pathComplete: false,
      gate: null,
      missing: ["gate"],
      errors: ["trajectory gate missing; checkpoint steps alone are not pathComplete"],
      legacyFlowOnly: true,
    };
  }
  if (!rawGate) {
    return {
      ok: false,
      pathComplete: false,
      gate: null,
      missing: ["gate"],
      errors: ["trajectory gate missing"],
      legacyFlowOnly: false,
    };
  }

  const shape = validateTrajectoryGateShape(rawGate);
  if (!shape.ok || !shape.gate) {
    return {
      ok: false,
      pathComplete: false,
      gate: null,
      missing: ["gate"],
      errors: shape.errors,
      legacyFlowOnly: false,
    };
  }

  const gate = shape.gate;
  const subject =
    opts.subject ??
    (typeof obj.subject === "string" ? obj.subject : undefined) ??
    (typeof rawGate === "object" &&
    rawGate &&
    typeof (/** @type {any} */ (rawGate).subject) === "string"
      ? /** @type {any} */ (rawGate).subject
      : undefined);
  const hasMapAnswers =
    opts.hasMapAnswers === true ||
    (typeof obj.mapAnswers === "string" && obj.mapAnswers.trim().length > 0) ||
    (typeof rawGate === "object" &&
      rawGate &&
      typeof (/** @type {any} */ (rawGate).mapAnswers) === "string" &&
      /** @type {any} */ (rawGate).mapAnswers.trim().length > 0);

  const missing = listPathMissing(gate, { subject, hasMapAnswers });
  // pathComplete from derive; map gap can still fail check for architecture subjects.
  const pathComplete = gate.pathComplete && !missing.includes("map");
  const errors = [];
  if (!pathComplete) {
    errors.push("path incomplete");
    for (const m of missing) errors.push(`missing:${m}`);
  }
  return {
    ok: pathComplete,
    pathComplete,
    gate: { ...gate, pathComplete },
    missing,
    errors,
    legacyFlowOnly: false,
  };
}

/**
 * Plain-language reason for refused save / status / doctor.
 * Never dumps internal field names (purposeDone, pathComplete, …).
 *
 * @param {{ missing?: string[], pathComplete?: boolean } | null | undefined} check
 * @returns {string}
 */
export function formatPathIncompleteReason(check) {
  const missing = Array.isArray(check?.missing) ? check.missing : ["gate"];
  if (check?.pathComplete === true && missing.length === 0) {
    return "Learning path looks complete.";
  }
  const phrases = [];
  if (missing.includes("gate")) {
    phrases.push("the learning path was not recorded yet");
  }
  if (missing.includes("purpose")) {
    phrases.push("why you are studying this code is not settled");
  }
  if (missing.includes("verify")) {
    phrases.push("the check step is still open (finish it or record why it was skipped)");
  }
  if (missing.includes("map")) {
    phrases.push(
      "this structure/flow topic still needs a small map or a short reason the map was skipped",
    );
  }
  if (missing.includes("mode")) {
    phrases.push("session mode is not set");
  }
  if (phrases.length === 0) {
    phrases.push("the learning path is incomplete");
  }
  return `Cannot save a durable lesson yet: ${phrases.join("; ")}. Finish those steps, then save again.`;
}

/**
 * Fail-closed gate for durable save. Returns structured refuse (no write side effects).
 * @param {unknown} gateInput
 * @param {{ subject?: string, hasMapAnswers?: boolean }} [opts]
 */
export function refuseSaveIfPathIncomplete(gateInput, opts = {}) {
  const check = checkTrajectoryGate(gateInput ?? {}, opts);
  if (check.pathComplete) {
    return { refuse: false, check, reason: null, code: null };
  }
  return {
    refuse: true,
    check,
    reason: formatPathIncompleteReason(check),
    code: "path-incomplete",
  };
}

/**
 * Session 2+: do not re-ask purpose/study-list when already settled on the gate/ledger.
 * @param {unknown} gateInput
 * @param {{ hasStudyList?: boolean, curriculumTopicCount?: number }} [opts]
 * @returns {{ reaskPurpose: boolean, reaskStudyList: boolean, reason: string | null }}
 */
export function shouldReaskSessionSetup(gateInput, opts = {}) {
  const check = checkTrajectoryGate(gateInput ?? {});
  const gate = check.gate ?? buildTrajectoryGate(gateInput ?? {});
  const purposeSettled =
    gate.purposeDone === true ||
    (typeof gate.skipReasons?.purpose === "string" && gate.skipReasons.purpose.trim().length > 0);
  const studyListSettled =
    opts.hasStudyList === true ||
    (typeof opts.curriculumTopicCount === "number" && opts.curriculumTopicCount > 0);

  return {
    reaskPurpose: !purposeSettled,
    reaskStudyList: !studyListSettled,
    reason: purposeSettled
      ? studyListSettled
        ? "Purpose and study list already on the ledger. Continue without setup."
        : null
      : "Purpose not settled yet.",
  };
}

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
    return {
      ok: false,
      errors: ["trajectory must be an object"],
      required,
      observed: [],
    };

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
      {
        id: "B0",
        status: "done",
        reply: "UNRESOLVED purpose: who are the users?",
      },
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
        reply: 'CLAIMS: 1. "settle is called from capture" - capture.js:4 - support: yes',
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
