import { resolveMemoryPaths } from "../foundations/memory-paths.js";
import { buildProgramModel } from "../program/program-intelligence.js";
import { planLesson } from "../lessons/lesson-composition.js";
import { inspectLesson } from "../lessons/lesson-quality.js";
import { isWeakCurriculumTitle } from "./title-quality.js";
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

  // 3. Existing lesson: recreate continues; plain create stops.
  if (topic.lessonPath && !options.recreate) {
    return { status: "complete", reason: "Topic already has a saved lesson." };
  }

  // 4. Draft provided?
  if (options.draftPath) {
    const draftMarkdown = await readFile(options.draftPath, "utf8");
    const evaluation = inspectLesson(draftMarkdown, {
      depth: options.depth || "balanced",
      expectedEvidencePaths: topic.evidencePaths || [],
      requireLearningMomentDecisions: true,
    });

    if (!evaluation.ok) {
      return {
        status: "paused",
        requiredAction: "fix-lesson-quality",
        errors: evaluation.errors,
        warnings: evaluation.warnings,
      };
    }

    const saveTitle = options.title?.trim() || topic.title;
    if (isWeakCurriculumTitle(saveTitle, topic.focus, topic.kind)) {
      return {
        status: "paused",
        requiredAction: "rewrite-topic-title",
        topicId: topic.id,
        focus: topic.focus,
        currentTitle: topic.title,
        reason:
          "Curriculum/lesson title is still a path basename or planner placeholder. Invent a mechanism title, put it in the draft H1, and pass it as --title on save.",
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
      saveTitle,
      "--input",
      options.draftPath,
      "--yes",
    ];

    try {
      const saved = await exec(process.execPath, args);
      const payload = JSON.parse(saved.stdout);
      return {
        status: "complete",
        topicId: topic.id,
        reason: options.recreate ? "Lesson recreated successfully." : "Lesson saved successfully.",
        warnings: payload.warnings ?? evaluation.warnings ?? [],
        viewer: payload.viewer ?? null,
      };
    } catch (e) {
      return {
        status: "paused",
        requiredAction: "retry-save",
        reason: (e.stderr ? e.stderr.toString() : "") || e.message || "Save failed.",
      };
    }
  }

  // 5. Build model and plan against the focus path, never the title string.
  const model = await buildProgramModel(target, {
    scope: options.scope,
    maxFiles: options.maxFiles,
    maxManifestFiles: options.maxManifestFiles,
    maxRelationFiles: options.maxRelationFiles,
    maxRelationBytes: options.maxRelationBytes,
  });

  const plan = planLesson(model, {
    focus: topic.focus,
    depth: options.depth || "balanced",
  });

  const weakTitle = isWeakCurriculumTitle(topic.title, topic.focus, topic.kind);
  return {
    status: "paused",
    requiredAction: "draft-lesson",
    topicId: topic.id,
    focus: topic.focus,
    title: topic.title,
    recreate: Boolean(options.recreate && topic.lessonPath),
    previousLessonPath: options.recreate ? topic.lessonPath : null,
    mustRewriteTitle: weakTitle,
    titleGuidance: weakTitle
      ? "Do not keep this Title-Cased path as the lesson title. Invent a mechanism/decision/consequence title before drafting."
      : null,
    plan,
    nextAsks: [
      {
        who: "agent",
        do: weakTitle
          ? "rewrite-title-then-draft-via-teach-handshake"
          : "draft-via-teach-handshake",
        why: options.recreate
          ? "Recreate must run check-lesson-quality + review-lesson + save-lesson. Never write topic-*.md into memory by hand."
          : "Draft must use repay lesson shape and save-lesson only.",
      },
    ],
  };
}
