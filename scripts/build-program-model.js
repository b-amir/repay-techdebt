import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { buildProgramModel } from "../src/program/program-intelligence.js";

function help() {
  process.stdout.write(`Usage:
  node build-program-model.js <target-root> [--scope <relative-path>] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>]

Emit the complete normalized program graph as JSON on stdout. Nodes, edges, and claims carry
evidence IDs, confidence, coverage, and target provenance. No file is created in the target.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) positional.push(argument);
    else {
      const name = argument.slice(2);
      if (
        !new Set([
          "scope",
          "max-files",
          "max-manifest-files",
          "max-relation-files",
          "max-relation-bytes",
        ]).has(name)
      )
        throw new Error(`Unknown option: ${argument}`);
      if (name === "scope") {
        const value = argv[index + 1];
        if (!value || value.startsWith("--")) throw new Error("Missing value for --scope");
        options[name] = value;
        index += 1;
        continue;
      }
      const value = Number(argv[index + 1]);
      const maximum =
        name === "max-relation-bytes"
          ? 2_000_000_000
          : name === "max-manifest-files"
            ? 100_000
            : 1_000_000;
      if (!Number.isInteger(value) || value < 1 || value > maximum)
        throw new Error(`${argument} must be an integer from 1 to ${maximum}`);
      options[name] = value;
      index += 1;
    }
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  return { targetInput: positional[0], options };
}

try {
  const { targetInput, options } = parse(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);
  const model = await buildProgramModel(target, {
    scope: options.scope,
    maxFiles: options["max-files"],
    maxManifestFiles: options["max-manifest-files"],
    maxRelationFiles: options["max-relation-files"],
    maxRelationBytes: options["max-relation-bytes"],
  });
  process.stdout.write(`${JSON.stringify(model, null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "model-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
