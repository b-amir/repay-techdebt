import { parseArgs } from "node:util";
import { resolveTargetRoot } from "./lib/targeting.js";
import { runTopicWorkflow } from "./lib/topic-workflow.js";

function parse(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      "topic-id": { type: "string" },
      next: { type: "boolean" },
      draft: { type: "string" }, // Path to drafted markdown
      depth: { type: "string" },
      scope: { type: "string" },
      "max-files": { type: "string" },
      "max-manifest-files": { type: "string" },
      "max-relation-files": { type: "string" },
      "max-relation-bytes": { type: "string" },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    throw new Error(
      "Usage: node teach-topic.js <target-root> [--topic-id <id> | --next] [--draft <path-to-markdown>]",
    );
  }

  if (!values["topic-id"] && !values.next) {
    throw new Error("Must specify --topic-id <id> or --next.");
  }

  return {
    targetInput: positionals[0],
    options: values,
  };
}

try {
  const { targetInput, options } = parse(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);
  
  const result = await runTopicWorkflow(target, {
    topicId: options["topic-id"],
    next: options.next,
    draftPath: options.draft,
    depth: options.depth,
    scope: options.scope,
    maxFiles: options["max-files"],
    maxManifestFiles: options["max-manifest-files"],
    maxRelationFiles: options["max-relation-files"],
    maxRelationBytes: options["max-relation-bytes"],
  });

  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  
  if (result.status === "paused") {
    process.exit(1); // Exits with error to enforce stop before continuing
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
