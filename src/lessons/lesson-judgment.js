import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";

export function getDigest(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

const RUBRIC_DIMENSION = z.number().min(1).max(5);

export const JUDGMENT_PAYLOAD_SCHEMA = z.object({
  insight: RUBRIC_DIMENSION,
  accuracy: RUBRIC_DIMENSION,
  evidenceFit: RUBRIC_DIMENSION,
  pacing: RUBRIC_DIMENSION,
  singleSubject: RUBRIC_DIMENSION,
  elementsPresent: RUBRIC_DIMENSION,
  score: z.number().min(0).max(100),
  mustFix: z.array(z.string()).default([]),
  reasoning: z.string().min(1),
  reviewerRole: z.string().optional(),
});

/**
 * Validate an agent judgment payload (from lesson-reviewer.md).
 * @param {unknown} payload
 */
export function validateJudgmentPayload(payload) {
  return JUDGMENT_PAYLOAD_SCHEMA.parse(payload);
}

/**
 * @param {unknown} payload
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function tryValidateJudgmentPayload(payload) {
  const parsed = JUDGMENT_PAYLOAD_SCHEMA.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: true, value: parsed.data };
}

export async function recordJudgment(draftPath, payload) {
  const content = await readFile(draftPath, "utf8");
  const digest = getDigest(content);
  const validated = validateJudgmentPayload(payload);

  const record = {
    lessonDigest: digest,
    rubric: {
      insight: validated.insight,
      accuracy: validated.accuracy,
      evidenceFit: validated.evidenceFit,
      pacing: validated.pacing,
      singleSubject: validated.singleSubject,
      elementsPresent: validated.elementsPresent,
    },
    score: validated.score,
    mustFix: validated.mustFix,
    reasoning: validated.reasoning,
    reviewerRole: validated.reviewerRole || "peer",
    at: new Date().toISOString(),
  };

  await writeFile(`${draftPath}.judgment.json`, JSON.stringify(record, null, 2), "utf8");
  return record;
}

export async function hasPassingJudgment(draftPath, threshold = 80) {
  try {
    const content = await readFile(draftPath, "utf8");
    const digest = getDigest(content);

    if (!existsSync(`${draftPath}.judgment.json`)) {
      return {
        ok: false,
        reason: "No AI judgment recorded. Run review-lesson.js first.",
      };
    }

    const raw = JSON.parse(await readFile(`${draftPath}.judgment.json`, "utf8"));
    const validation = tryValidateJudgmentPayload({
      insight: raw.rubric?.insight ?? raw.insight,
      accuracy: raw.rubric?.accuracy ?? raw.accuracy,
      evidenceFit: raw.rubric?.evidenceFit ?? raw.evidenceFit,
      pacing: raw.rubric?.pacing ?? raw.pacing,
      singleSubject: raw.rubric?.singleSubject ?? raw.singleSubject,
      elementsPresent: raw.rubric?.elementsPresent ?? raw.elementsPresent,
      score: raw.score,
      mustFix: raw.mustFix ?? [],
      reasoning: raw.reasoning,
      reviewerRole: raw.reviewerRole,
    });
    if (validation.ok === false) {
      return { ok: false, reason: `Invalid judgment record: ${validation.error}` };
    }

    if (raw.lessonDigest !== digest) {
      return {
        ok: false,
        reason: "Draft was modified after the AI judgment was recorded.",
      };
    }

    if (validation.value.score < threshold) {
      return {
        ok: false,
        reason: `Judgment score ${validation.value.score} is below threshold ${threshold}.`,
      };
    }

    return { ok: true, record: raw };
  } catch (error) {
    return { ok: false, reason: `Failed to read judgment: ${error.message}` };
  }
}
