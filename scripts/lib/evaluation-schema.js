import { z } from "zod";

export const TopicExpectationSchema = z.object({
  id: z.string().describe("Stable identifier for the expected topic"),
  intent: z.enum(["must-find", "useful", "irrelevant", "forbidden"]).describe("How this topic should be ranked or penalized"),
  description: z.string().optional().describe("Why this topic has this expectation"),
});

export const WorkflowExpectationSchema = z.object({
  id: z.string(),
  mustIncludeNodes: z.array(z.string()).default([]),
  mustIncludeEdges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    })
  ).default([]),
});

export const LessonRubricSchema = z.object({
  correctness: z.number().min(1).max(5),
  importance: z.number().min(1).max(5),
  focus: z.number().min(1).max(5),
  clarity: z.number().min(1).max(5),
  pedagogy: z.number().min(1).max(5),
  actionability: z.number().min(1).max(5),
  notes: z.string().optional(),
});

export const EvaluationFixtureSchema = z.object({
  version: z.number().int().min(1).max(1),
  name: z.string(),
  description: z.string(),
  topics: z.array(TopicExpectationSchema).default([]),
  workflows: z.array(WorkflowExpectationSchema).default([]),
  lessons: z.record(LessonRubricSchema).default({}),
  allowedSideEffects: z.array(z.string()).default([]),
});

export function validateFixture(data) {
  const result = EvaluationFixtureSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, errors: result.error.issues };
  }
  return { ok: true, data: result.data };
}

export function validateRubric(data) {
  const result = LessonRubricSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, errors: result.error.issues };
  }
  return { ok: true, data: result.data };
}
