/**
 * Thin tool handlers for optional MCP / host integration.
 * Prefer these when an MCP host is present; scripts remain the source of truth.
 * Never inflate claim confidence because a tool ran. Never silent durable write.
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { pathExists } from "../foundations/private-storage.js";
import { resolveMemoryPaths } from "../foundations/memory-paths.js";
import { resolveWorkbook } from "../viewer/resolve-workbook.js";
import { listLessonMarkdown } from "../viewer/search-lessons.js";
import { readProgress } from "../viewer/progress-store.js";
import { checkTrajectoryGate, formatPathIncompleteReason } from "../dialogue/trajectory.js";
import { reverifyLessonClaims, reverifyWorkbookClaims } from "../lessons/claim-reverify.js";
import { searchWorkbookClaims } from "../lessons/claim-search.js";
import { evaluateLessonForSave } from "../lessons/save-lesson.js";
import { inspectLesson } from "../lessons/lesson-quality.js";
import { assessClaimFaithfulness } from "../lessons/claim-faithfulness.js";
import { verifyLessonCitations } from "../lessons/lesson-citation-check.js";

const execute = promisify(execFile);
const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const REPAY_TOOL_NAMES = [
  "repay_doctor",
  "repay_trajectory_check",
  "repay_recheck_claims",
  "repay_search_claims",
  "repay_pr_changes",
  "repay_save_evaluate",
  "repay_open_workbook",
  "repay_capabilities",
  "repay_status",
  "repay_list_lessons",
  "repay_check_faithfulness",
  "repay_check_quality",
  "repay_check_evidence",
  "repay_get_lesson",
  "repay_progress",
];

const storageProp = {
  type: "string",
  enum: ["private", "project-local", "team"],
  description: "Optional memory storage mode",
};

const targetRootProp = {
  type: "string",
  description: "Absolute path to the application repo",
};

/**
 * @returns {{ name: string, description: string, inputSchema: object }[]}
 */
export function listRepayTools() {
  return [
    {
      name: "repay_doctor",
      description:
        "Plain-language learning-path health for a target repo (blocks durable save when incomplete).",
      inputSchema: {
        type: "object",
        properties: { targetRoot: targetRootProp, storage: storageProp },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_trajectory_check",
      description:
        "Fail-closed TrajectoryGate check (pathComplete / missing / reason). No soft escape.",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          storage: storageProp,
          gatePath: {
            type: "string",
            description: "Optional path to trajectory JSON; default memory trajectory-gate.json",
          },
        },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_recheck_claims",
      description:
        "Re-verify saved lesson CLAIMS/citations against live sources. Fail-closed on stale/missing.",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          lessonPath: {
            type: "string",
            description: "Optional single lesson.md; omit to scan workbook lessons",
          },
          storage: storageProp,
        },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_search_claims",
      description: "Search saved lessons by claim text, citation path, or primaryPaths substring.",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          query: { type: "string" },
          limit: { type: "number" },
          storage: storageProp,
        },
        required: ["targetRoot", "query"],
      },
    },
    {
      name: "repay_pr_changes",
      description:
        "Local Git changed files for PR teaching (same excludes as get-pr-changes.js). No GitHub MCP required.",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          ref: {
            type: "string",
            description: "Optional git ref or range (same as get-pr-changes second arg)",
          },
        },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_save_evaluate",
      description:
        "Run evaluateLessonForSave floors only — no durable write. Host/agent still owns craft + save.",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          lessonPath: { type: "string", description: "Path to lesson markdown to evaluate" },
          markdown: { type: "string", description: "Inline markdown if lessonPath omitted" },
          depth: { type: "string", enum: ["concise", "balanced", "deep"] },
          storage: storageProp,
        },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_open_workbook",
      description:
        "Resolve workbook paths + suggested view-lessons command. Does not start the server.",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          lesson: { type: "string", description: "Optional relative lesson path for deep link" },
          port: { type: "number" },
          storage: storageProp,
        },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_capabilities",
      description:
        "Probe optional CLIs/MCP availability (check-capabilities). Maintainer/host use.",
      inputSchema: {
        type: "object",
        properties: { targetRoot: targetRootProp },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_status",
      description: "Memory root, workbook ready, lesson counts, progress summary.",
      inputSchema: {
        type: "object",
        properties: { targetRoot: targetRootProp, storage: storageProp },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_list_lessons",
      description: "List saved lesson markdown keys/paths under the workbook.",
      inputSchema: {
        type: "object",
        properties: { targetRoot: targetRootProp, storage: storageProp },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_check_faithfulness",
      description: "Claim↔snippet faithfulness for one lesson (assessClaimFaithfulness).",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          lessonPath: { type: "string" },
          markdown: { type: "string" },
        },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_check_quality",
      description: "Lesson quality floors (inspectLesson) for one draft/lesson. No write.",
      inputSchema: {
        type: "object",
        properties: {
          lessonPath: { type: "string" },
          markdown: { type: "string" },
          depth: { type: "string", enum: ["concise", "balanced", "deep"] },
        },
        required: [],
      },
    },
    {
      name: "repay_check_evidence",
      description: "Citation validity (path:line resolves) for one lesson.",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          lessonPath: { type: "string" },
          markdown: { type: "string" },
        },
        required: ["targetRoot"],
      },
    },
    {
      name: "repay_get_lesson",
      description: "Read one lesson.md by absolute path or workbook-relative key.",
      inputSchema: {
        type: "object",
        properties: {
          targetRoot: targetRootProp,
          lessonPath: { type: "string", description: "Absolute path or lessons/foo.md key" },
          storage: storageProp,
        },
        required: ["targetRoot", "lessonPath"],
      },
    },
    {
      name: "repay_progress",
      description: "Read progress.json (lastRead, completed map). Read-only.",
      inputSchema: {
        type: "object",
        properties: { targetRoot: targetRootProp, storage: storageProp },
        required: ["targetRoot"],
      },
    },
  ];
}

/**
 * @param {string} script
 * @param {string[]} args
 */
async function runSkillScript(script, args) {
  try {
    const result = await execute(
      process.execPath,
      [resolve(skillRoot, "scripts", script), ...args],
      {
        cwd: skillRoot,
        maxBuffer: 30 * 1024 * 1024,
        timeout: 120_000,
      },
    );
    return { code: 0, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } catch (error) {
    return {
      code: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? String(error?.message ?? error),
    };
  }
}

/**
 * @param {Record<string, unknown>} args
 */
async function loadMarkdown(args) {
  if (args.markdown != null && String(args.markdown).length > 0) {
    return {
      markdown: String(args.markdown),
      lessonPath: args.lessonPath ? String(args.lessonPath) : null,
    };
  }
  if (args.lessonPath) {
    const lessonPath = String(args.lessonPath);
    if (!(await pathExists(lessonPath))) {
      return { error: `Lesson not found: ${lessonPath}` };
    }
    return { markdown: await readFile(lessonPath, "utf8"), lessonPath };
  }
  return { error: "lessonPath or markdown is required" };
}

/**
 * @param {string} name
 * @param {Record<string, unknown>} args
 */
export async function callRepayTool(name, args = {}) {
  // Quality check can run without target when markdown/lessonPath provided
  if (name === "repay_check_quality") {
    const loaded = await loadMarkdown(args);
    if (loaded.error) return { ok: false, tool: name, error: loaded.error };
    const result = inspectLesson(loaded.markdown, {
      depth: args.depth ? String(args.depth) : "balanced",
    });
    return { ok: result.ok, tool: name, ...result };
  }

  const targetRoot = String(args.targetRoot ?? "");
  if (!targetRoot) {
    return { ok: false, error: "targetRoot is required" };
  }
  const storageOpts = args.storage ? { storage: String(args.storage) } : {};

  if (name === "repay_doctor") {
    const paths = await resolveMemoryPaths(targetRoot, storageOpts);
    const gateFile = resolve(paths.root, "trajectory-gate.json");
    let pathComplete = false;
    let reason =
      "Learning path not recorded yet. Cannot save a durable lesson until the path is complete.";
    let missing = ["purpose", "mode"];
    if (await pathExists(gateFile)) {
      try {
        const raw = JSON.parse(await readFile(gateFile, "utf8"));
        const check = checkTrajectoryGate(raw.gate ?? raw);
        pathComplete = check.pathComplete === true;
        missing = check.missing ?? [];
        reason = pathComplete
          ? "Learning path complete — durable save allowed if lesson craft passes."
          : formatPathIncompleteReason(check);
      } catch {
        reason = "Trajectory gate file is unreadable or invalid.";
      }
    }
    const workbook = await resolveWorkbook(targetRoot, storageOpts);
    return {
      ok: true,
      tool: name,
      pathComplete,
      saveBlocked: !pathComplete,
      reason,
      missing,
      memoryRoot: paths.root,
      lessonsDir: workbook.lessonsDir,
      ready: workbook.ready,
    };
  }

  if (name === "repay_trajectory_check") {
    const paths = await resolveMemoryPaths(targetRoot, storageOpts);
    const gateFile = args.gatePath
      ? String(args.gatePath)
      : resolve(paths.root, "trajectory-gate.json");
    if (!(await pathExists(gateFile))) {
      return {
        ok: false,
        tool: name,
        pathComplete: false,
        saveBlocked: true,
        missing: ["purpose", "mode"],
        reason:
          "Learning path not recorded yet. Cannot save a durable lesson until the path is complete.",
        gatePath: gateFile,
      };
    }
    try {
      const raw = JSON.parse(await readFile(gateFile, "utf8"));
      const check = checkTrajectoryGate(raw.gate ?? raw);
      const pathComplete = check.pathComplete === true;
      return {
        ok: pathComplete,
        tool: name,
        pathComplete,
        saveBlocked: !pathComplete,
        missing: check.missing ?? [],
        reason: pathComplete ? "Learning path complete." : formatPathIncompleteReason(check),
        gatePath: gateFile,
      };
    } catch {
      return {
        ok: false,
        tool: name,
        pathComplete: false,
        saveBlocked: true,
        reason: "Trajectory gate file is unreadable or invalid.",
        gatePath: gateFile,
      };
    }
  }

  if (name === "repay_recheck_claims") {
    const lessonPath = args.lessonPath ? String(args.lessonPath) : null;
    if (lessonPath) {
      if (!(await pathExists(lessonPath))) {
        return { ok: false, tool: name, error: `Lesson not found: ${lessonPath}` };
      }
      const markdown = await readFile(lessonPath, "utf8");
      const result = await reverifyLessonClaims(targetRoot, markdown, { lessonPath });
      return { ok: result.ok, tool: name, scope: "lesson", ...result };
    }
    const workbook = await resolveWorkbook(targetRoot, storageOpts);
    if (!workbook.ready) {
      return {
        ok: false,
        tool: name,
        scope: "workbook",
        empty: true,
        problems: ["Project memory not initialized; cannot locate saved lessons."],
      };
    }
    const batch = await reverifyWorkbookClaims(
      targetRoot,
      /** @type {string} */ (workbook.lessonsDir),
    );
    return { ok: batch.ok, tool: name, scope: "workbook", ...batch };
  }

  if (name === "repay_search_claims") {
    const query = String(args.query ?? "");
    const limit = args.limit != null ? Number(args.limit) : 20;
    const workbook = await resolveWorkbook(targetRoot, storageOpts);
    const result = await searchWorkbookClaims(workbook, query, { limit });
    return { ok: result.ok, tool: name, ...result };
  }

  if (name === "repay_pr_changes") {
    const scriptArgs = [targetRoot];
    if (args.ref) scriptArgs.push(String(args.ref));
    const run = await runSkillScript("get-pr-changes.js", scriptArgs);
    if (run.code !== 0) {
      return {
        ok: false,
        tool: name,
        error: (run.stderr || run.stdout || "get-pr-changes failed").trim(),
        exitCode: run.code,
      };
    }
    try {
      const entries = JSON.parse(run.stdout);
      return {
        ok: true,
        tool: name,
        fileCount: Array.isArray(entries) ? entries.length : 0,
        entries,
      };
    } catch {
      return { ok: false, tool: name, error: "get-pr-changes returned non-JSON output" };
    }
  }

  if (name === "repay_save_evaluate") {
    const loaded = await loadMarkdown(args);
    if (loaded.error) return { ok: false, tool: name, error: loaded.error, wrote: false };
    const paths = await resolveMemoryPaths(targetRoot, storageOpts);
    const gateFile = resolve(paths.root, "trajectory-gate.json");
    /** @type {object | null} */
    let trajectoryGate = null;
    if (await pathExists(gateFile)) {
      try {
        const raw = JSON.parse(await readFile(gateFile, "utf8"));
        trajectoryGate = { gate: raw.gate ?? raw };
      } catch {
        trajectoryGate = null;
      }
    }
    const result = await evaluateLessonForSave(targetRoot, loaded.markdown, {
      depth: args.depth ? String(args.depth) : "balanced",
      draftPath: loaded.lessonPath ?? undefined,
      trajectoryGate,
    });
    return {
      ok: result.ok,
      tool: name,
      wrote: false,
      note: "Evaluate only — host must call save path separately after craft passes.",
      trajectory: result.trajectory,
      quality: {
        ok: result.quality?.ok,
        errors: result.quality?.errors ?? [],
        warnings: result.quality?.warnings ?? [],
      },
      craft: result.craft
        ? Object.fromEntries(
            Object.entries(result.craft).map(([k, v]) => [
              k,
              v && typeof v === "object" ? { ok: v.ok, errors: v.errors ?? [] } : v,
            ]),
          )
        : null,
    };
  }

  if (name === "repay_open_workbook") {
    const workbook = await resolveWorkbook(targetRoot, storageOpts);
    const port = args.port != null ? Number(args.port) : 8765;
    const lesson = args.lesson ? String(args.lesson) : null;
    const cmdParts = ["node", "scripts/view-lessons.js", targetRoot, "--port", String(port)];
    if (lesson) cmdParts.push("--lesson", lesson);
    return {
      ok: true,
      tool: name,
      started: false,
      ready: workbook.ready,
      workbookRoot: workbook.workbookRoot,
      lessonsDir: workbook.lessonsDir,
      indexPath: workbook.indexPath,
      progressPath: workbook.progressPath,
      memoryRoot: workbook.memoryRoot,
      suggestedUrl: lesson
        ? `http://127.0.0.1:${port}/lesson/${encodeURI(lesson)}`
        : `http://127.0.0.1:${port}/`,
      command: cmdParts.join(" "),
      note: "Does not start the server. Run command (or repay CLI) to serve.",
    };
  }

  if (name === "repay_capabilities") {
    const run = await runSkillScript("check-capabilities.js", [targetRoot, "--format", "json"]);
    if (run.code !== 0) {
      return {
        ok: false,
        tool: name,
        error: (run.stderr || run.stdout || "check-capabilities failed").trim(),
        exitCode: run.code,
      };
    }
    try {
      const report = JSON.parse(run.stdout);
      return { ok: true, tool: name, ...report };
    } catch {
      return { ok: false, tool: name, error: "check-capabilities returned non-JSON output" };
    }
  }

  if (name === "repay_status") {
    const workbook = await resolveWorkbook(targetRoot, storageOpts);
    const files = workbook.lessonsDir
      ? await listLessonMarkdown(/** @type {string} */ (workbook.lessonsDir))
      : [];
    let progress = null;
    try {
      progress = await readProgress(/** @type {string} */ (workbook.progressPath));
    } catch {
      progress = null;
    }
    const completedCount = progress?.completed
      ? Object.keys(progress.completed).filter((k) => progress.completed[k]).length
      : 0;
    return {
      ok: true,
      tool: name,
      ready: workbook.ready,
      targetRoot,
      memoryRoot: workbook.memoryRoot,
      workbookRoot: workbook.workbookRoot,
      lessonsDir: workbook.lessonsDir,
      lessonCount: files.length,
      completedCount,
      lastRead: progress?.lastRead ?? null,
      storageMode: workbook.storageMode ?? workbook.location ?? null,
    };
  }

  if (name === "repay_list_lessons") {
    const workbook = await resolveWorkbook(targetRoot, storageOpts);
    if (!workbook.lessonsDir) {
      return { ok: false, tool: name, lessons: [], empty: true };
    }
    const files = await listLessonMarkdown(/** @type {string} */ (workbook.lessonsDir));
    const lessons = [];
    for (const file of files) {
      let title = file.name.replace(/\.md$/i, "");
      try {
        const md = await readFile(file.path, "utf8");
        const m = md.match(/^#\s+(.+)$/m);
        if (m) title = m[1].trim();
      } catch {
        // keep basename title
      }
      lessons.push({ key: file.key, path: file.path, name: file.name, title });
    }
    return {
      ok: true,
      tool: name,
      ready: workbook.ready,
      count: lessons.length,
      lessons,
    };
  }

  if (name === "repay_check_faithfulness") {
    const loaded = await loadMarkdown(args);
    if (loaded.error) return { ok: false, tool: name, error: loaded.error };
    const result = await assessClaimFaithfulness(targetRoot, loaded.markdown);
    const blocking = result.mode === "explicit-claims" ? result.problems : result.problems;
    return {
      ok: blocking.length === 0,
      tool: name,
      mode: result.mode,
      assessmentCount: result.assessments.length,
      assessments: result.assessments,
      problems: result.problems,
    };
  }

  if (name === "repay_check_evidence") {
    const loaded = await loadMarkdown(args);
    if (loaded.error) return { ok: false, tool: name, error: loaded.error };
    const result = await verifyLessonCitations(targetRoot, loaded.markdown);
    return {
      ok: result.ok,
      tool: name,
      citationCount: result.citations.length,
      citations: result.citations,
      problems: result.problems,
    };
  }

  if (name === "repay_get_lesson") {
    const raw = String(args.lessonPath ?? "");
    const workbook = await resolveWorkbook(targetRoot, storageOpts);
    let absolute = raw;
    if (!(await pathExists(absolute))) {
      const rel = raw.replace(/^\//, "");
      const fromLessons = resolve(
        /** @type {string} */ (workbook.lessonsDir),
        rel.replace(/^lessons\//, ""),
      );
      const fromWorkbook = resolve(
        /** @type {string} */ (workbook.workbookRoot ?? workbook.lessonsDir),
        rel,
      );
      if (await pathExists(fromLessons)) absolute = fromLessons;
      else if (await pathExists(fromWorkbook)) absolute = fromWorkbook;
      else {
        return { ok: false, tool: name, error: `Lesson not found: ${raw}` };
      }
    }
    const markdown = await readFile(absolute, "utf8");
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    return {
      ok: true,
      tool: name,
      path: absolute,
      title: titleMatch?.[1]?.trim() ?? null,
      markdown,
    };
  }

  if (name === "repay_progress") {
    const workbook = await resolveWorkbook(targetRoot, storageOpts);
    try {
      const progress = await readProgress(/** @type {string} */ (workbook.progressPath));
      return {
        ok: true,
        tool: name,
        progressPath: workbook.progressPath,
        ...progress,
      };
    } catch (error) {
      return {
        ok: false,
        tool: name,
        error: String(error?.message ?? error),
        progressPath: workbook.progressPath,
      };
    }
  }

  return { ok: false, error: `Unknown tool: ${name}` };
}
