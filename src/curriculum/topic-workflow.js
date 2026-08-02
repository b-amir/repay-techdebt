import { resolveMemoryPaths } from "../foundations/memory-paths.js";
import { buildProgramModel } from "../program/program-intelligence.js";
import { planLesson } from "../lessons/lesson-composition.js";
import { inspectLesson } from "../lessons/lesson-quality.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const exec = promisify(execFile);

import { resolveTopicSelector } from "./topic-resolve.js";

export async function runTopicWorkflow(target, options) {
  const paths = await resolveMemoryPaths(target.targetRoot);

  // 1. Read curriculum
  let curriculum;
  try {
    const data = await readFile(paths.curriculumData, "utf8");
    curriculum = JSON.parse(data);
  } catch {
    return {
      status: "paused",
      requiredAction: "plan-curriculum",
      reason: "Curriculum not found. Please plan the curriculum first.",
    };
  }

  // 2. Select topic
  let topic;
  if (options.topicId) {
    topic = resolveTopicSelector(curriculum, options.topicId);
    if (!topic) {
      throw new Error(`Topic not found: ${options.topicId}`);
    }
  } else if (options.next) {
    topic = curriculum.topics?.find((t) => !t.lessonPath);
    if (!topic) {
      return { status: "complete", reason: "All topics completed." };
    }
  }

  // 3. Check if completed
  if (topic.lessonPath) {
    return { status: "complete", reason: "Topic already has a saved lesson." };
  }

  // 4. Draft provided?
  if (options.draftPath) {
    const draftMarkdown = await readFile(options.draftPath, "utf8");
    const evaluation = inspectLesson(draftMarkdown, {
      depth: options.depth || "balanced",
      expectedEvidencePaths: [],
    }); // TODO: compute expected paths if necessary

    if (!evaluation.ok) {
      return {
        status: "paused",
        requiredAction: "fix-lesson-quality",
        errors: evaluation.errors,
        warnings: evaluation.warnings,
      };
    }

    // Attempt to save
    // We use the project-memory.js save-lesson CLI to preserve atomic writes and locks
    const args = [
      resolve(options.skillRoot ?? process.cwd(), "scripts/project-memory.js"),
      "save-lesson",
      target.targetRoot,
      "--topic-id",
      topic.id,
      "--title",
      topic.title,
      "--input",
      options.draftPath,
      "--yes",
    ];

    try {
      await exec(process.execPath, args);
      return {
        status: "complete",
        topicId: topic.id,
        reason: "Lesson saved successfully.",
      };
    } catch (e) {
      return {
        status: "paused",
        requiredAction: "retry-save",
        reason: (e.stderr ? e.stderr.toString() : "") || e.message || "Save failed.",
      };
    }
  }

  // 5. Build model and plan
  const model = await buildProgramModel(target, {
    scope: options.scope,
    maxFiles: options.maxFiles,
    maxManifestFiles: options.maxManifestFiles,
    maxRelationFiles: options.maxRelationFiles,
    maxRelationBytes: options.maxRelationBytes,
  });

  const plan = planLesson(model, { focus: topic.title, depth: options.depth || "balanced" });

  return {
    status: "paused",
    requiredAction: "draft-lesson",
    topicId: topic.id,
    plan,
  };
}
