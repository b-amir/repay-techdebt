import { readFileSync } from "node:fs";
import { inspectLesson, evaluateSpecification } from "./lib/lesson-quality.js";
import { buildLessonSpecification } from "./lib/lesson-specification.js";

function help() {
  process.stdout.write(`Usage:
  node review-lesson.js <lesson.md> <spec.json>

Reviews a lesson draft against quality standards and its specification.
`);
}

export async function execute(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    return 0;
  }

  const positional = argv.filter((arg) => !arg.startsWith("--"));
  if (positional.length !== 2) {
    process.stderr.write("Expected a lesson markdown file and a spec JSON file.\n");
    return 1;
  }

  const [lessonPath, specPath] = positional;

  let markdown;
  let spec;
  try {
    markdown = readFileSync(lessonPath, "utf8");
    spec = JSON.parse(readFileSync(specPath, "utf8"));
  } catch (error) {
    process.stderr.write(`Could not load files: ${error.message}\n`);
    return 1;
  }

  const qualityResult = inspectLesson(markdown);
  const specResult = evaluateSpecification(markdown, spec);

  const errors = [...qualityResult.errors, ...specResult.errors];

  if (errors.length > 0) {
    process.stdout.write("Lesson review failed:\n");
    for (const err of errors) {
      process.stdout.write(`- ${err}\n`);
    }
    return 1;
  }

  process.stdout.write("Lesson passes editorial review.\n");
  return 0;
}

if (process.argv[1].endsWith("review-lesson.js")) {
  execute(process.argv.slice(2)).then((code) => process.exit(code));
}
