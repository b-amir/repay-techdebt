import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { recordJudgment, validateJudgmentPayload } from "../src/lessons/lesson-judgment.js";

function help() {
  process.stdout.write(`Usage:
  node review-lesson.js <lesson.md> <judgment.json>

Records a reviewer-supplied judgment; it does not invoke a reviewer.
The JSON must identify reviewerProvenance as self, independent-agent, or human.
`);
}

export async function execute(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    return 0;
  }

  const positional = argv.filter((arg) => !arg.startsWith("--"));
  if (positional.length !== 2) {
    process.stderr.write("Expected a lesson markdown file and a judgment JSON file.\n");
    return 1;
  }

  const [lessonPath, jsonPath] = positional;

  let payload;
  try {
    payload = JSON.parse(readFileSync(resolve(jsonPath), "utf8"));
    validateJudgmentPayload(payload);
  } catch (error) {
    process.stderr.write(`Could not load judgment JSON: ${error.message}\n`);
    return 1;
  }

  try {
    await recordJudgment(resolve(lessonPath), payload);
    process.stdout.write(
      `Judgment recorded (${payload.reviewerProvenance}). ${payload.reviewerProvenance === "self" ? "The score is advisory, not independent certification." : "Independent review provenance recorded."}\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`Failed to record judgment: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1].endsWith("review-lesson.js")) {
  execute(process.argv.slice(2)).then((code) => process.exit(code));
}
