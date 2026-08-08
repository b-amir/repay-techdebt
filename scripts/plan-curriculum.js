import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  formatTargetError,
  isSameOrInside,
  resolveTargetRoot,
} from "../src/foundations/targeting.js";
import {
  curriculumDecisionSummary,
  planCurriculum,
  renderCurriculumMarkdown,
} from "../src/curriculum/curriculum-planning.js";
import { buildProgramModel } from "../src/program/program-intelligence.js";

function help() {
  process.stdout.write(`Usage:
  node plan-curriculum.js <target-root> [--scope <relative-path>] [--focus <path-or-topic>] [--format summary-json|json|markdown] [--candidate-limit <count>] [--batch-size <count>] [--batch-only] [--include-catalog --output <path>] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>]

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
  const options = { format: "summary-json" };
  const allowed = new Set([
    "scope",
    "focus",
    "format",
    "max-files",
    "max-manifest-files",
    "max-relation-files",
    "max-relation-bytes",
    "candidate-limit",
    "batch-size",
    "output",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) positional.push(argument);
    else if (argument === "--batch-only" || argument === "--include-catalog") {
      options[argument.slice(2)] = true;
    } else {
      const name = argument.slice(2);
      if (!allowed.has(name)) throw new Error(`Unknown option: ${argument}`);
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      options[name] = value;
    }
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  if (!["summary-json", "json", "markdown"].includes(options.format))
    throw new Error("--format must be summary-json, json, or markdown");
  for (const name of [
    "max-files",
    "max-manifest-files",
    "max-relation-files",
    "max-relation-bytes",
    "candidate-limit",
    "batch-size",
  ]) {
    if (options[name] === undefined) continue;
    options[name] = Number(options[name]);
    if (!Number.isInteger(options[name]) || options[name] < 1)
      throw new Error(`--${name} must be a positive integer`);
  }
  if (options["batch-size"] > 5) throw new Error("--batch-size must be between 1 and 5");
  if (options["candidate-limit"] > 150)
    throw new Error("--candidate-limit must be between 1 and 150");
  if (options["include-catalog"] && !options.output)
    throw new Error("--include-catalog requires --output so full diagnostics never flood stdout");
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
  const curriculum = planCurriculum(model, {
    limit: options["candidate-limit"],
    batchSize: options["batch-size"],
    batchOnly: options["batch-only"] === true,
    includeCatalog: options["include-catalog"] === true,
    focus: options.focus,
  });
  /** @type {any} */
  let outputCurriculum = curriculum;
  if (options.output) {
    const outputPath = resolve(options.output);
    if (isSameOrInside(outputPath, target.targetRoot))
      throw new Error("Curriculum diagnostic output must stay outside the target repository");
    await writeFile(outputPath, `${JSON.stringify(curriculum, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    outputCurriculum = {
      ...curriculum,
      candidateCatalog: undefined,
      diagnosticsArtifact: outputPath,
    };
  }
  const rendered =
    options.format === "markdown"
      ? renderCurriculumMarkdown(outputCurriculum)
      : JSON.stringify(
          options.format === "summary-json"
            ? curriculumDecisionSummary(outputCurriculum)
            : outputCurriculum,
          null,
          2,
        );
  process.stdout.write(options.format === "markdown" ? rendered : `${rendered}\n`);
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "curriculum-planning-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
