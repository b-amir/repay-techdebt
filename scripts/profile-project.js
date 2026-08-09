import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { buildProgramModel, summarizeModel } from "../src/program/program-intelligence.js";

function help() {
  process.stdout.write(`Usage:
  node profile-project.js <target-root> [--scope <relative-path>] [--format json|markdown] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>]

Build a read-only, evidence-qualified project profile from an explicit target repository. The
summary reports language/stack packs, inferred program purpose, critical analysis lenses,
entry points, boundaries, graph coverage, and unresolved uncertainty. It never writes an index.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  const options = { format: "json" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) positional.push(argument);
    else {
      const key = argument.slice(2);
      if (
        !new Set([
          "scope",
          "format",
          "max-files",
          "max-manifest-files",
          "max-relation-files",
          "max-relation-bytes",
        ]).has(key)
      )
        throw new Error(`Unknown option: ${argument}`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      options[key] = value;
      index += 1;
    }
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  if (!new Set(["json", "markdown"]).has(options.format))
    throw new Error("--format must be json or markdown");
  for (const name of [
    "max-files",
    "max-manifest-files",
    "max-relation-files",
    "max-relation-bytes",
  ]) {
    if (options[name] === undefined) continue;
    const value = Number(options[name]);
    const maximum =
      name === "max-relation-bytes"
        ? 2_000_000_000
        : name === "max-manifest-files"
          ? 100_000
          : 1_000_000;
    if (!Number.isInteger(value) || value < 1 || value > maximum)
      throw new Error(`--${name} must be an integer from 1 to ${maximum}`);
    options[name] = value;
  }
  return { targetInput: positional[0], options };
}

function markdown(summary) {
  const lines = [
    "# Program Intelligence Profile",
    "",
    `Target: \`${summary.target.root}\``,
    `Scope: \`${summary.target.scope}\``,
    `Primary archetype: **${summary.profile.primaryArchetype}**`,
    `Coverage: **${summary.coverage.status}** - ${summary.coverage.modeledFiles}/${summary.coverage.discoveredFiles} files modeled; ${summary.coverage.relationFilesRead} files inspected for static relations${summary.coverage.truncated ? " (truncated)" : ""}.`,
    "",
    "## Detected stack",
    "",
    "| Signal | Evidence |",
    "| --- | --- |",
    `| Languages | ${summary.profile.languages.map((item) => `${item.id} (${item.files})`).join(", ") || "unresolved"} |`,
    `| Packs | ${summary.packs.map((item) => `${item.id} (${Math.round(item.confidence * 100)}%)`).join(", ") || "none matched"} |`,
    `| Capabilities | ${summary.profile.capabilities.join(", ") || "unresolved"} |`,
    `| Entry points | ${
      summary.profile.entryPoints
        .slice(0, 12)
        .map((item) => `\`${item}\``)
        .join(", ") || "unresolved"
    } |`,
    `| Components | ${summary.profile.components.map((item) => `${item.root}: ${item.primaryArchetype}`).join(", ") || "unresolved"} |`,
    "",
    "## Criticality priorities",
    "",
    "| Lens | Score | Why selected |",
    "| --- | ---: | --- |",
    ...summary.profile.priorities
      .slice(0, 12)
      .map((item) => `| ${item.lens} | ${item.score} | ${item.reasons.join("; ")} |`),
    "",
    "## Relationship graph",
    "",
    `Modeled ${summary.graphSummary.nodes} nodes and ${summary.graphSummary.edges} edges: ${
      Object.entries(summary.graphSummary.edgesByKind)
        .map(([kind, count]) => `${kind}=${count}`)
        .join(", ") || "none"
    }.`,
    "",
    "## Unresolved evidence",
    "",
    ...summary.profile.uncertainties.map((item) => `- ${item}`),
  ];
  return `${lines.join("\n")}\n`;
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
  const summary = summarizeModel(model);
  process.stdout.write(
    options.format === "json" ? `${JSON.stringify(summary, null, 2)}\n` : markdown(summary),
  );
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "profile-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
