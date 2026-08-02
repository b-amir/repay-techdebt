#!/usr/bin/env node
// Teach a single curriculum topic (--create activation). Resolves topic by id, prefix, title slug, or focus.
import { parseArgs } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveTargetRoot } from "../src/foundations/targeting.js";
import { runTopicWorkflow } from "../src/curriculum/topic-workflow.js";

const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parse(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      "topic-id": { type: "string" },
      next: { type: "boolean" },
      draft: { type: "string" },
      depth: { type: "string" },
      scope: { type: "string" },
      "max-files": { type: "string" },
      "max-manifest-files": { type: "string" },
      "max-relation-files": { type: "string" },
      "max-relation-bytes": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });

  if (values.help) {
    process.stdout.write(`Usage:
  node teach-topic.js <target-root> [<topic-id-or-slug>] [--topic-id <id>] [--next] [--draft <path>]

Activation flag --create maps to this script with a topic selector (id, title slug, or focus).

Examples:
  node teach-topic.js /path/to/app topic-abc123def456
  node teach-topic.js /path/to/app request-boundary --draft /tmp/lesson.md
`);
    process.exit(0);
  }

  if (positionals.length === 0) {
    throw new Error(
      "Usage: node teach-topic.js <target-root> [<topic-id-or-slug>] [--topic-id <id> | --next] [--draft <path>]",
    );
  }

  const topicSelector = values["topic-id"] ?? positionals[1];
  if (!topicSelector && !values.next) {
    throw new Error("Must specify a topic selector, --topic-id <id>, or --next.");
  }

  return {
    targetInput: positionals[0],
    options: { ...values, topicId: topicSelector },
  };
}

try {
  const { targetInput, options } = parse(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);

  const result = await runTopicWorkflow(target, {
    topicId: options.topicId,
    next: options.next,
    draftPath: options.draft,
    depth: options.depth,
    scope: options.scope,
    maxFiles: options["max-files"],
    maxManifestFiles: options["max-manifest-files"],
    maxRelationFiles: options["max-relation-files"],
    maxRelationBytes: options["max-relation-bytes"],
    skillRoot,
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  if (result.status === "paused") {
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(
    JSON.stringify({
      type: "target-error",
      code: error.code || "WORKFLOW_ERROR",
      reason: error.message,
    }) + "\n",
  );
  process.exit(1);
}
