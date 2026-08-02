import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildEvidencePacket } from "../src/lessons/lesson-evidence.js";
import { resolveTargetRoot } from "../src/foundations/targeting.js";

function help() {
  process.stdout.write(`Usage:
  node build-lesson-evidence.js <target-project-directory> <topic-id>

Builds an evidence packet for the given topic in the target project.
`);
}

export async function execute(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    return 0;
  }

  const positional = argv.filter((arg) => !arg.startsWith("--"));
  if (positional.length !== 2) {
    process.stderr.write("Expected a target root and a topic ID.\n");
    return 1;
  }

  const [targetInput, topicId] = positional;
  const targetRoot = resolveTargetRoot(targetInput);

  // Read model and topics from project memory
  const memoryPath = resolve(targetRoot, ".repay", "memory.json");
  const curriculumPath = resolve(targetRoot, ".repay", "curriculum.json");

  let model;
  let curriculum;
  try {
    model = JSON.parse(readFileSync(memoryPath, "utf8"));
    curriculum = JSON.parse(readFileSync(curriculumPath, "utf8"));
  } catch (error) {
    process.stderr.write(`Could not load model or curriculum: ${error.message}\n`);
    return 1;
  }

  const topic = curriculum.topics.find((t) => t.id === topicId);
  if (!topic) {
    process.stderr.write(`Topic not found: ${topicId}\n`);
    return 1;
  }

  const packet = buildEvidencePacket(topic, model);
  process.stdout.write(JSON.stringify(packet, null, 2) + "\n");
  return 0;
}

if (process.argv[1].endsWith("build-lesson-evidence.js")) {
  execute(process.argv.slice(2)).then((code) => process.exit(code));
}
