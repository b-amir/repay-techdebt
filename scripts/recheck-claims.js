import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { pathExists } from "../src/foundations/private-storage.js";
import { resolveWorkbook } from "../src/viewer/resolve-workbook.js";
import {
  reverifyLessonClaims,
  reverifyWorkbookClaims,
  displayLessonPath,
} from "../src/lessons/claim-reverify.js";

/**
 * Re-verify saved lesson claims against live target sources.
 * Exit 2 when any claim/citation is stale or unfaithful.
 */

function help() {
  process.stdout.write(`Usage:
  node recheck-claims.js <target-root> [<lesson.md>] [--format json|text] [--storage private|project-local|team]

Re-check explicit CLAIMS / path:line citations against current source files.
With no lesson path, scans the workbook lessons directory from project memory.
Exit 2 when any claim fails or citations are missing/stale.
`);
}

function parseArgs(argv) {
  const args = [];
  let format = "json";
  let storage;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--help" || argv[i] === "-h") {
      help();
      process.exit(0);
    }
    if (argv[i] === "--format") {
      format = argv[++i];
      continue;
    }
    if (argv[i] === "--storage") {
      storage = argv[++i];
      continue;
    }
    if (argv[i]?.startsWith("--")) throw new Error(`Unknown option: ${argv[i]}`);
    args.push(argv[i]);
  }
  if (!["json", "text"].includes(format)) throw new Error("--format must be json or text");
  if (args.length < 1 || args.length > 2) {
    throw new Error("Expected <target-root> and optional <lesson.md>");
  }
  return { targetInput: args[0], lessonPath: args[1] ? resolve(args[1]) : null, format, storage };
}

function printText(payload, targetRoot) {
  if (payload.scope === "lesson") {
    process.stdout.write(
      `${payload.ok ? "PASS" : "FAIL"} recheck-claims (${payload.mode}): ${payload.claimCount} claims, ${payload.problems.length} problems\n`,
    );
    for (const p of payload.problems) process.stdout.write(`- ${p}\n`);
    return;
  }
  process.stdout.write(
    `${payload.ok ? "PASS" : payload.empty ? "EMPTY" : "FAIL"} recheck-claims: ${payload.lessonCount} lessons, ${payload.failedCount} failed\n`,
  );
  for (const lesson of payload.lessons ?? []) {
    if (lesson.ok) continue;
    const rel = displayLessonPath(targetRoot, lesson.lessonPath);
    process.stdout.write(`- ${rel}\n`);
    for (const p of lesson.problems) process.stdout.write(`  - ${p}\n`);
  }
  if (payload.empty) {
    process.stdout.write("No saved lessons found under workbook lessons directory.\n");
  }
}

try {
  const { targetInput, lessonPath, format, storage } = parseArgs(process.argv.slice(2));
  const { targetRoot } = await resolveTargetRoot(targetInput);

  if (lessonPath) {
    if (!(await pathExists(lessonPath))) throw new Error(`Lesson not found: ${lessonPath}`);
    const markdown = await readFile(lessonPath, "utf8");
    const result = await reverifyLessonClaims(targetRoot, markdown, { lessonPath });
    const payload = {
      analyzer: "recheck-claims",
      role: "check",
      scope: "lesson",
      status: result.ok ? "succeeded" : "failed",
      targetRoot,
      ...result,
    };
    if (format === "text") printText(payload, targetRoot);
    else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    if (!result.ok) process.exitCode = 2;
  } else {
    const workbook = await resolveWorkbook(targetRoot, storage ? { storage } : {});
    if (!workbook.ready) {
      const payload = {
        analyzer: "recheck-claims",
        role: "check",
        scope: "workbook",
        status: "not-initialized",
        ok: false,
        empty: true,
        lessonCount: 0,
        failedCount: 0,
        lessons: [],
        problems: ["Project memory not initialized; cannot locate saved lessons."],
        targetRoot,
        lessonsDir: workbook.lessonsDir,
      };
      if (format === "text") {
        process.stdout.write("FAIL recheck-claims: project memory not initialized\n");
      } else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      process.exitCode = 2;
    } else {
      const lessonsDir = /** @type {string} */ (workbook.lessonsDir);
      const batch = await reverifyWorkbookClaims(targetRoot, lessonsDir);
      const payload = {
        analyzer: "recheck-claims",
        role: "check",
        scope: "workbook",
        status: batch.empty ? "empty" : batch.ok ? "succeeded" : "failed",
        targetRoot,
        lessonsDir: workbook.lessonsDir,
        ...batch,
      };
      if (format === "text") printText(payload, targetRoot);
      else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      if (!batch.ok) process.exitCode = 2;
    }
  }
} catch (error) {
  process.stderr.write(`${formatTargetError(error) ?? `Claim recheck failed: ${error.message}`}\n`);
  process.exitCode = 1;
}
