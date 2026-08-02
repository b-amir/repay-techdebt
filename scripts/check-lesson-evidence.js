import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyLessonCitations } from "../src/lessons/lesson-citation-check.js";
import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";

function help() {
  process.stdout.write(`Usage:
  node check-lesson-evidence.js <target-root> <lesson.md> [--format json|text]

Citation validity floor (B6): every path:line cite must resolve inside the target with a valid line.
Does not check claim faithfulness — that is the agent sense step in bottleneck-checkpoints.md.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  let format = "json";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) positional.push(argument);
    else if (argument === "--format") {
      format = argv[++index];
      if (!format || format.startsWith("--")) throw new Error("Missing value for --format");
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (positional.length !== 2) throw new Error("Expected <target-root> and <lesson.md>");
  if (!["json", "text"].includes(format)) throw new Error("--format must be json or text");
  return { targetInput: positional[0], lessonPath: positional[1], format };
}

try {
  const { targetInput, lessonPath, format } = parse(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);
  const markdown = await readFile(resolve(lessonPath), "utf8");
  const result = await verifyLessonCitations(target.targetRoot, markdown);
  const payload = {
    analyzer: "lesson-citation-check",
    role: "check",
    status: result.ok ? "succeeded" : "failed",
    targetRoot: target.targetRoot,
    lessonPath: resolve(lessonPath),
    citationCount: result.citations.length,
    citations: result.citations,
    problems: result.problems,
    nextAsks: result.ok
      ? [
          {
            who: "agent",
            do: "claim-decomposition-sense",
            why: "citation-validity-passed",
          },
        ]
      : [
          {
            who: "agent",
            do: "fix-citations-or-rewrite",
            why: "citation-validity-failed",
          },
        ],
  };
  if (format === "text") {
    process.stdout.write(
      `${result.ok ? "PASS" : "FAIL"}: ${result.citations.length} citations, ${result.problems.length} problems\n`,
    );
    for (const problem of result.problems) process.stdout.write(`- ${problem}\n`);
  } else process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  if (!result.ok) process.exitCode = 2;
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? `Lesson evidence check failed: ${error.message}`}\n`,
  );
  process.exitCode = 1;
}
