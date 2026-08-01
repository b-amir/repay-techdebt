import { formatTargetError, resolveTargetRoot } from "./lib/targeting.js";
import { buildProgramModel } from "./lib/program-intelligence.js";

function help() {
  process.stdout.write(`Usage:
  node query-program-model.js <target-root> <path-or-name-query> [--scope <relative-path>] [--depth 1|2|3] [--limit 1..500] [--format json|table]

Build the read-only bundled graph and return matching files with incoming consumers, outgoing
dependencies, tests, and containment neighbors. Use only after the user accepts this fallback when
Graphify or Serena was required and failed.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  let depth = 1;
  let limit = 100;
  let format = "json";
  let scope;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--depth") {
      depth = Number(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--limit") {
      limit = Number(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--format") {
      format = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--scope") {
      scope = argv[index + 1];
      if (!scope || scope.startsWith("--")) throw new Error("Missing value for --scope");
      index += 1;
    } else if (argv[index].startsWith("--")) throw new Error(`Unknown option: ${argv[index]}`);
    else positional.push(argv[index]);
  }
  if (positional.length > 2) throw new Error("Expected a target root and one query");
  if (!Number.isInteger(depth) || depth < 1 || depth > 3)
    throw new Error("--depth must be 1, 2, or 3");
  if (!Number.isInteger(limit) || limit < 1 || limit > 500)
    throw new Error("--limit must be an integer from 1 to 500");
  if (!new Set(["json", "table"]).has(format)) throw new Error("--format must be json or table");
  return { targetInput: positional[0], query: positional[1], depth, limit, format, scope };
}

function renderTable(result) {
  const nodeById = new Map(result.neighborhood.map((node) => [node.id, node]));
  const lines = [
    `Query: ${result.query}`,
    `Status: ${result.status}; depth: ${result.depth}; nodes: ${result.neighborhood.length}; relations: ${result.relations.length}; truncated: ${result.truncated}`,
    "",
    "| Relation | From | To | Confidence |",
    "| --- | --- | --- | ---: |",
    ...result.relations.map((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      const label = (node) =>
        String(node?.path ?? node?.name ?? node?.id ?? "unknown")
          .replaceAll("|", "\\|")
          .replaceAll("`", "\\`")
          .replaceAll("\n", " ");
      return `| ${edge.kind} | \`${label(from)}\` | \`${label(to)}\` | ${edge.confidence} |`;
    }),
    "",
    ...result.limitations.map((item) => `- ${item}`),
  ];
  return `${lines.join("\n")}\n`;
}

try {
  const { targetInput, query, depth, limit, format, scope } = parse(process.argv.slice(2));
  if (!query?.trim()) throw new Error("A non-empty path-or-name query is required");
  const target = await resolveTargetRoot(targetInput);
  const model = await buildProgramModel(target, { scope });
  const needle = query.toLowerCase();
  const seedNodes = model.nodes
    .filter((node) => `${node.name} ${node.path ?? ""}`.toLowerCase().includes(needle))
    .slice(0, Math.min(20, limit));
  const selectedIds = new Set(seedNodes.map((node) => node.id));
  let frontier = new Set(selectedIds);
  for (let level = 0; level < depth; level += 1) {
    const next = new Set();
    for (const edge of model.edges)
      if (frontier.has(edge.from) || frontier.has(edge.to)) {
        if (!selectedIds.has(edge.from)) next.add(edge.from);
        if (!selectedIds.has(edge.to)) next.add(edge.to);
      }
    for (const id of next) {
      if (selectedIds.size >= limit) break;
      selectedIds.add(id);
    }
    frontier = new Set([...next].filter((id) => selectedIds.has(id)));
  }
  const allRelations = model.edges.filter(
    (edge) => selectedIds.has(edge.from) && selectedIds.has(edge.to),
  );
  const relations = allRelations.slice(0, Math.max(limit * 3, 100));
  const evidenceIds = new Set(relations.flatMap((edge) => edge.evidenceIds));
  for (const node of seedNodes) for (const id of node.evidenceIds) evidenceIds.add(id);
  const semanticRelations = relations.filter((edge) => edge.kind !== "contains");
  const status =
    seedNodes.length === 0
      ? "no-match"
      : semanticRelations.length === 0
        ? "partial-no-semantic-relations"
        : "succeeded";
  const result = {
    schemaVersion: 1,
    target: model.target,
    query,
    depth,
    status,
    coverage: model.coverage,
    truncated: selectedIds.size >= limit || allRelations.length > relations.length,
    matches: seedNodes,
    neighborhood: model.nodes.filter((node) => selectedIds.has(node.id)),
    relations,
    evidence: model.evidence.filter((item) => evidenceIds.has(item.id)),
    limitations: [
      "This bundled graph uses static, conservative relation extraction.",
      "Supported language resolvers model local module imports, not complete function-call graphs.",
      `No bundled local relation resolver is available for: ${model.coverage.relationLanguagesUnsupported.join(", ") || "none of the detected languages"}.`,
      "Dynamic registration, reflection, generated code, runtime dispatch, configuration wiring, and remote calls may be absent.",
    ],
  };
  process.stdout.write(
    format === "json" ? `${JSON.stringify(result, null, 2)}\n` : renderTable(result),
  );
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "query-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
