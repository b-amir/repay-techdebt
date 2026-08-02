import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { planCurriculum, renderCurriculumMarkdown } from "../src/curriculum/curriculum-planning.js";
import { buildProgramModel } from "../src/program/program-intelligence.js";

function help() {
  process.stdout.write(`Usage:
  node plan-curriculum.js <target-root> [--scope <relative-path>] [--format json|markdown] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>]

Build a ranked book-index proposal before writing lessons. It creates no target files. Output is a
dialogue proposal (role/nextAsks/signalClass); the agent must approve the shortlist before save.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  const options = { format: "json" };
  const allowed = new Set([
    "scope",
    "format",
    "max-files",
    "max-manifest-files",
    "max-relation-files",
    "max-relation-bytes",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) positional.push(argument);
    else {
      const name = argument.slice(2);
      if (!allowed.has(name)) throw new Error(`Unknown option: ${argument}`);
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      options[name] = value;
    }
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  if (!["json", "markdown"].includes(options.format))
    throw new Error("--format must be json or markdown");
  for (const name of [
    "max-files",
    "max-manifest-files",
    "max-relation-files",
    "max-relation-bytes",
  ])
    if (options[name] !== undefined) options[name] = Number(options[name]);
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
  const curriculum = planCurriculum(model);
  process.stdout.write(
    options.format === "markdown"
      ? renderCurriculumMarkdown(curriculum)
      : `${JSON.stringify(curriculum, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "curriculum-planning-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
