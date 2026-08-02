import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { buildProgramModel } from "../src/program/program-intelligence.js";

function help() {
  process.stdout.write(`Usage:
  node render-system-atlas.js <target-root> [--focus <path-or-name>] [--scope <relative-path>] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>]

Render a Markdown system atlas on stdout from the normalized read-only model. The atlas is a
current analysis artifact, not project memory. Ask before saving it in the target repository.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  const options = { focus: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--focus") {
      options.focus = argv[index + 1];
      if (!options.focus || options.focus.startsWith("--"))
        throw new Error("Missing value for --focus");
      index += 1;
    } else if (argv[index] === "--scope") {
      options.scope = argv[index + 1];
      if (!options.scope || options.scope.startsWith("--"))
        throw new Error("Missing value for --scope");
      index += 1;
    } else if (
      new Set([
        "--max-files",
        "--max-manifest-files",
        "--max-relation-files",
        "--max-relation-bytes",
      ]).has(argv[index])
    ) {
      const name = argv[index].slice(2);
      const value = Number(argv[index + 1]);
      const maximum =
        name === "max-relation-bytes"
          ? 2_000_000_000
          : name === "max-manifest-files"
            ? 100_000
            : 1_000_000;
      if (!Number.isInteger(value) || value < 1 || value > maximum)
        throw new Error(`${argv[index]} must be an integer from 1 to ${maximum}`);
      options[name] = value;
      index += 1;
    } else if (argv[index].startsWith("--")) throw new Error(`Unknown option: ${argv[index]}`);
    else positional.push(argv[index]);
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  return { targetInput: positional[0], options };
}

function cell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("`", "\\`").replaceAll("\n", " ");
}

function relationHotspots(model, focus) {
  const counts = new Map();
  for (const edge of model.edges.filter((item) => item.kind === "imports"))
    counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
  const needle = focus?.toLowerCase();
  return model.nodes
    .filter(
      (node) =>
        node.path && (!needle || `${node.name} ${node.path}`.toLowerCase().includes(needle)),
    )
    .map((node) => ({ node, consumers: counts.get(node.id) ?? 0 }))
    .sort(
      (left, right) =>
        right.consumers - left.consumers || left.node.path.localeCompare(right.node.path),
    )
    .slice(0, 15);
}

function flowCandidates(model) {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const outgoing = new Map();
  for (const edge of model.edges.filter((item) => item.kind === "imports")) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push(edge.to);
  }
  return model.nodes
    .filter((node) => node.kind === "entry-point")
    .slice(0, 10)
    .map((entry) => {
      const paths = [entry.path];
      let current = entry.id;
      const visited = new Set([current]);
      for (let depth = 0; depth < 4; depth += 1) {
        const next = (outgoing.get(current) ?? []).find((id) => !visited.has(id));
        if (!next) break;
        visited.add(next);
        current = next;
        paths.push(nodeById.get(next)?.path ?? nodeById.get(next)?.name ?? next);
      }
      return paths;
    });
}

function render(model, focus) {
  const hotspots = relationHotspots(model, focus);
  const flows = flowCandidates(model);
  const lines = [
    "# System Atlas",
    "",
    `**Target:** \`${model.target.root}\`  `,
    `**Scope:** \`${model.target.scope}\`  `,
    `**Observed:** ${model.generatedAt}  `,
    `**Purpose hypothesis:** ${model.profile.primaryArchetype}${focus ? `  \n**Focus:** ${focus}` : ""}`,
    "",
    "> This atlas describes static evidence from the current target. Purpose, production behavior, runtime frequency, scale, and user impact remain unconfirmed unless separately evidenced.",
    "",
    "## Stack and executable shape",
    "",
    "| Dimension | Detected evidence |",
    "| --- | --- |",
    `| Languages | ${cell(model.profile.languages.map((item) => `${item.id} (${item.files})`).join(", ") || "unresolved")} |`,
    `| Capability packs | ${cell(model.profile.technologies.join(", ") || "none matched")} |`,
    `| Possible roles | ${cell(model.profile.capabilities.join(", ") || "unresolved")} |`,
    `| Components | ${cell(model.profile.components.map((item) => `${item.root}: ${item.primaryArchetype}`).join(", ") || "unresolved")} |`,
    `| Dependencies | ${cell(`${model.dependencies.filter((item) => item.direct).length} direct; ${model.dependencies.filter((item) => !item.direct).length} lockfile/transitive-only`)} |`,
    `| Entry points | ${cell(model.profile.entryPoints.slice(0, 20).join(", ") || "unresolved")} |`,
    `| Boundary paths | ${cell(model.profile.boundaries.slice(0, 20).join(", ") || "unresolved")} |`,
    `| Configuration | ${cell(
      model.nodes
        .filter((node) => node.kind === "configuration")
        .slice(0, 20)
        .map((node) => node.path)
        .join(", ") || "none detected",
    )} |`,
    `| Deployment | ${cell(
      model.nodes
        .filter((node) => node.kind === "deployment")
        .slice(0, 20)
        .map((node) => node.path)
        .join(", ") || "none detected",
    )} |`,
    "",
    "## Candidate flows",
    "",
    ...(flows.length > 0
      ? flows.map((path, index) => `${index + 1}. ${path.map((item) => `\`${item}\``).join(" → ")}`)
      : [
          "No conventional entry-point import flow was resolved. Use Graphify/Serena or inspect registration and invocation directly.",
        ]),
    "",
    "## Relationship hotspots",
    "",
    "| File | Known static consumers | Interpretation |",
    "| --- | ---: | --- |",
    ...(hotspots.length > 0
      ? hotspots.map(
          ({ node, consumers }) =>
            `| \`${cell(node.path)}\` | ${consumers} | ${consumers > 0 ? "Review blast radius and ownership" : "No modeled static consumer; dynamic use remains possible"} |`,
        )
      : ["| — | 0 | No focus match or modeled file |"]),
    "",
    "## Criticality lenses",
    "",
    "| Rank | Lens | Score | Evidence-based reason |",
    "| ---: | --- | ---: | --- |",
    ...model.profile.priorities
      .slice(0, 12)
      .map(
        (item, index) =>
          `| ${index + 1} | ${item.lens} | ${item.score} | ${cell(item.reasons.join("; "))} |`,
      ),
    "",
    "## Coverage and blind spots",
    "",
    `- Coverage status: **${model.coverage.status}**${model.coverage.reasonCodes.length > 0 ? ` — ${model.coverage.reasonCodes.join(", ")}` : ""}.`,
    `- Modeled ${model.coverage.modeledFiles} of ${model.coverage.discoveredFiles} discovered files.`,
    `- Read ${model.coverage.relationFilesRead} files (${model.coverage.relationBytesRead} bytes) for conservative static relations.`,
    `- Coverage truncated: **${model.coverage.truncated ? "yes" : "no"}**; skipped large files: ${model.coverage.skippedLargeFiles}; unreadable files: ${model.coverage.unreadableFiles}.`,
    `- Bundled local relation resolution supported: ${model.coverage.relationLanguagesSupported.join(", ") || "none"}.`,
    `- Bundled local relation resolution unsupported: ${model.coverage.relationLanguagesUnsupported.join(", ") || "none detected"}.`,
    ...model.profile.uncertainties.map((item) => `- ${item}`),
    "",
    "## Evidence state summary",
    "",
    "| State | Claims |",
    "| --- | ---: |",
    ...["observed", "derived", "inferred", "hypothesis", "contradicted", "stale"].map(
      (state) => `| ${state} | ${model.evidence.filter((item) => item.state === state).length} |`,
    ),
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
  process.stdout.write(render(model, options.focus));
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "atlas-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
