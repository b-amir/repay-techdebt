import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runTeachFloors } from "../src/lessons/save-lesson.js";
import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { assertClosedNextAsks } from "../src/dialogue/dialogue-envelope.js";
import { evaluateLessonBehaviors } from "../src/evaluation/evaluation.js";

/**
 * Report-only pedagogy / quality bundle. Floor failures set exit 2; behavior reports never
 * invent an independent judge.
 */

function help() {
  process.stdout.write(`Usage:
  node evaluate-lesson.js <target-root> <lesson.md> [--depth concise|balanced|deep] [--format json|text]

Runs quality + citation validity + observable teaching behaviors + evidence-anchor coverage.
Exit 2 only when mechanical floors fail. Behavior scores are report-only.
`);
}

try {
  const raw = process.argv.slice(2);
  if (raw.includes("--help") || raw.includes("-h")) {
    help();
    process.exit(0);
  }
  const args = [];
  let format = "json";
  let depth = "balanced";
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === "--format") format = raw[++i];
    else if (raw[i] === "--depth") depth = raw[++i];
    else if (raw[i].startsWith("--")) throw new Error(`Unknown option: ${raw[i]}`);
    else args.push(raw[i]);
  }
  if (args.length !== 2) throw new Error("Expected <target-root> and <lesson.md>");
  const target = await resolveTargetRoot(args[0]);
  const markdown = await readFile(resolve(args[1]), "utf8");
  const floors = await runTeachFloors(target.targetRoot, markdown, { depth });
  const { floorOk, quality, citations, faithfulness } = floors;
  const rubric = evaluateLessonBehaviors(markdown, quality, { depth });
  const payload = {
    analyzer: "evaluate-lesson",
    role: "check",
    status: floorOk ? "succeeded" : "failed",
    floorOk,
    quality,
    citations,
    faithfulness: {
      mode: faithfulness.mode,
      ok: faithfulness.ok,
      problems: faithfulness.problems,
      assessmentCount: faithfulness.assessments.length,
    },
    rubric,
    nextAsks: assertClosedNextAsks(
      floorOk
        ? [
            {
              who: "agent",
              do: "review-behavior-report-then-save",
              why: "floors-passed",
            },
          ]
        : [{ who: "agent", do: "fix-floor-errors", why: "floors-failed" }],
    ),
  };
  if (format === "text") {
    process.stdout.write(
      `${floorOk ? "PASS" : "FAIL"} floors; faithfulness=${faithfulness.ok ? "ok" : "issues"}\n`,
    );
    for (const item of quality.errors) process.stdout.write(`- ${item}\n`);
    for (const item of quality.warnings) process.stdout.write(`- warning: ${item}\n`);
  } else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!floorOk) process.exitCode = 2;
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? `Lesson evaluation failed: ${error.message}`}\n`,
  );
  process.exitCode = 1;
}
