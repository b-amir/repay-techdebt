import { formatTargetError, resolveTargetRoot } from "./lib/targeting.js";
import { buildProgramModel, planAnalysis } from "./lib/program-intelligence.js";

function help() {
  process.stdout.write(`Usage:
  node plan-analysis.js <target-root> [--mode pr|workbook|focused] [--focus <question-or-area>] [--scope <relative-path>] [--depth concise|balanced|deep] [--format json|summary-json|markdown] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>]

Profile the explicit target and emit an evidence-ranked, multi-zoom investigation plan. Tool
fallbacks remain permission-gated; emitting a plan does not claim any enhanced tool succeeded.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  const options = { mode: "workbook", format: "json", focus: null, depth: "balanced" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) positional.push(argument);
    else {
      const name = argument.slice(2);
      if (
        !new Set([
          "mode",
          "focus",
          "scope",
          "depth",
          "format",
          "max-files",
          "max-manifest-files",
          "max-relation-files",
          "max-relation-bytes",
        ]).has(name)
      )
        throw new Error(`Unknown option: ${argument}`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      options[name] = value;
      index += 1;
    }
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  if (!new Set(["pr", "workbook", "focused"]).has(options.mode))
    throw new Error("--mode must be pr, workbook, or focused");
  if (!new Set(["json", "summary-json", "markdown"]).has(options.format))
    throw new Error("--format must be json, summary-json, or markdown");
  if (!new Set(["concise", "balanced", "deep"]).has(options.depth))
    throw new Error("--depth must be concise, balanced, or deep");
  if (options.mode === "focused" && !options.focus)
    throw new Error("--focus is required when --mode focused");
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

function markdown(plan) {
  const lines = [
    "# Adaptive Analysis Plan",
    "",
    `Target: \`${plan.target.root}\``,
    `Scope: \`${plan.target.scope}\``,
    `Mode: **${plan.request.mode}**; depth: **${plan.request.depth}**${plan.request.focus ? `; focus: **${plan.request.focus}**` : ""}`,
    `Profile: ${plan.profileSummary.primaryArchetype}; ${plan.profileSummary.languages.join(", ") || "language unresolved"}.`,
    `Coverage: **${plan.coverage.status}**${plan.coverage.reasonCodes.length > 0 ? ` — ${plan.coverage.reasonCodes.join(", ")}` : ""}.`,
    "",
    "| Priority | Zoom | Investigation | Preferred evidence tool | Failure gate |",
    "| ---: | --- | --- | --- | --- |",
    ...plan.investigations.map(
      (item) =>
        `| ${item.priority} | ${item.zoom} | ${item.question.replaceAll("|", "\\|")} | ${item.preferredTool.replaceAll("|", "\\|")} | ${item.gate} |`,
    ),
    "",
    "## Stopping rules",
    "",
    ...plan.stoppingRules.map((item) => `- ${item}`),
    "",
    "## Unresolved",
    "",
    ...plan.unresolved.map((item) => `- ${item}`),
  ];
  return `${lines.join("\n")}\n`;
}

function summaryJson(plan) {
  return {
    schemaVersion: plan.schemaVersion,
    generatedAt: plan.generatedAt,
    target: plan.target,
    request: plan.request,
    coverage: plan.coverage,
    role: plan.role,
    coverageStatus: plan.coverageStatus,
    blindSpots: plan.blindSpots,
    mustNotClaim: plan.mustNotClaim,
    nextAsks: plan.nextAsks,
    profileSummary: plan.profileSummary,
    investigations: plan.investigations.map((item) => ({
      id: item.id,
      zoom: item.zoom,
      priority: item.priority,
      question: item.question,
      preferredTool: item.preferredTool,
      fallback: item.fallback,
      gate: item.gate,
      toolChain: item.toolChain.map(({ tool, operation, availability, sideEffects, gate }) => ({
        tool,
        operation,
        availability,
        sideEffects,
        gate,
      })),
      evidenceCount: item.evidenceIds.length,
    })),
    stoppingRules: plan.stoppingRules,
    unresolved: plan.unresolved,
  };
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
  const plan = planAnalysis(model, {
    mode: options.mode,
    focus: options.focus,
    depth: options.depth,
  });
  process.stdout.write(
    options.format === "markdown"
      ? markdown(plan)
      : `${JSON.stringify(options.format === "summary-json" ? summaryJson(plan) : plan, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "planning-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
