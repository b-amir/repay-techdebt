import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessClaimFaithfulness } from "./lib/claim-faithfulness.js";
import { verifyLessonCitations } from "./lib/lesson-citation-check.js";
import { inspectLesson } from "./lib/lesson-quality.js";
import { evaluatePedagogy } from "./lib/pedagogy.js";
import { formatTargetError, resolveTargetRoot } from "./lib/targeting.js";

/**
 * Report-only pedagogy / quality bundle. Floor failures set exit 2; rubric proxies never
 * invent an LLM judge — they score deterministic proxies for the LessonRubric dimensions.
 */

function help() {
  process.stdout.write(`Usage:
  node evaluate-lesson.js <target-root> <lesson.md> [--depth concise|balanced|deep] [--format json|text]

Runs quality + citation validity + pedagogy proxies + optional claim faithfulness.
Exit 2 only when mechanical floors fail (quality/citations). Rubric proxies are report-only.
`);
}

function rubricProxies(markdown, quality, pedagogy) {
  const lower = markdown.toLowerCase();
  const hasCite = (quality.citations?.length ?? 0) >= 2;
  const hasYou = /\b(?:you|your)\b/i.test(markdown);
  const hasCausal = /\b(?:because|therefore|so that|which means|as a result)\b/i.test(markdown);
  const hasChallenge = /challenge|try it|exercise|modify/i.test(lower);
  const hasPredict = /predict|before you run|what happens if|expect/i.test(lower);
  const score = (ok, mid) => (ok ? 5 : mid ? 3 : 1);
  return {
    judge: "deterministic-proxy",
    note: "Not an LLM judge. Use for CI reporting only; calibrate before treating as truth.",
    dimensions: {
      correctness: score(hasCite && quality.ok, hasCite),
      importance: score(/because|matters|critical|protect/i.test(lower), /why/i.test(lower)),
      focus: score(quality.sectionCount >= 3 && quality.sectionCount <= 8, quality.sectionCount > 0),
      clarity: score(hasYou && (quality.warnings?.length ?? 0) === 0, hasYou),
      pedagogy: score(
        pedagogy.ok && hasPredict && hasChallenge,
        hasChallenge || pedagogy.warnings.length < 3,
      ),
      actionability: score(hasChallenge && hasCausal, hasChallenge || hasCausal),
    },
  };
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
  const quality = inspectLesson(markdown, { depth });
  const citations = await verifyLessonCitations(target.targetRoot, quality.citations);
  if (citations.problems.length > 0) {
    quality.ok = false;
    quality.errors.push(...citations.problems);
  }
  const pedagogy = evaluatePedagogy(markdown);
  const faithfulness = await assessClaimFaithfulness(target.targetRoot, markdown);
  const rubric = rubricProxies(markdown, quality, pedagogy);
  const floorOk = quality.ok;
  const payload = {
    analyzer: "evaluate-lesson",
    role: "check",
    status: floorOk ? "succeeded" : "failed",
    floorOk,
    quality,
    citations,
    pedagogy,
    faithfulness: {
      mode: faithfulness.mode,
      ok: faithfulness.ok,
      problems: faithfulness.problems,
      assessmentCount: faithfulness.assessments.length,
    },
    rubric,
    nextAsks: floorOk
      ? [{ who: "agent", do: "review-rubric-proxies-then-save", why: "floors-passed" }]
      : [{ who: "agent", do: "fix-floor-errors", why: "floors-failed" }],
  };
  if (format === "text") {
    process.stdout.write(
      `${floorOk ? "PASS" : "FAIL"} floors; pedagogy=${pedagogy.ok ? "ok" : "issues"}; faithfulness=${faithfulness.ok ? "ok" : "issues"}\n`,
    );
    for (const item of [...quality.errors, ...pedagogy.errors]) process.stdout.write(`- ${item}\n`);
  } else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!floorOk) process.exitCode = 2;
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? `Lesson evaluation failed: ${error.message}`}\n`,
  );
  process.exitCode = 1;
}
