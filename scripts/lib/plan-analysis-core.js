import { buildDialogueEnvelope } from "./dialogue-envelope.js";
import { stableId } from "./identity.js";
import { analysisPlanSchema } from "./program-model-schema.js";

function focusTerms(focus) {
  const tokens = String(focus ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const positive = new Set();
  const negative = new Set();
  let negate = 0;
  for (const token of tokens) {
    if (new Set(["without", "avoid", "excluding", "except"]).has(token)) {
      negate = 4;
      continue;
    }
    if (token === "not" || token === "no") {
      negate = 2;
      continue;
    }
    if (token.length <= 2 || new Set(["the", "and", "with", "from", "into", "this"]).has(token))
      continue;
    if (token === "unsupported" || token === "unknown") positive.add(token);
    else if (negate > 0) negative.add(token);
    else positive.add(token);
    if (negate > 0) negate -= 1;
  }
  const synonyms = new Map([
    ["auth", ["authentication", "authorization", "identity", "security", "token"]],
    ["authentication", ["auth", "authorization", "identity", "security", "token"]],
    ["authorization", ["auth", "authentication", "permission", "security", "role"]],
    ["performance", ["latency", "throughput", "allocation", "blocking", "cost"]],
    ["failure", ["error", "retry", "rollback", "reliability", "timeout"]],
  ]);
  for (const token of Array.from(positive))
    for (const synonym of synonyms.get(token) ?? []) positive.add(synonym);
  return { positive, negative };
}

function relevance(text, terms) {
  const words = new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
  const positive = [...terms.positive].reduce(
    (score, token) => score + (words.has(token) ? 8 : 0),
    0,
  );
  const negative = [...terms.negative].reduce(
    (score, token) => score + (words.has(token) ? 8 : 0),
    0,
  );
  return positive - negative;
}

function toolChainFor(preferredTool, fallback, gate) {
  const lower = preferredTool.toLowerCase();
  const steps = [];
  const add = (tool, operation, sideEffects, confidence, limitations, stepGate = gate) =>
    steps.push({
      tool,
      operation,
      availability:
        "probe installation, configuration, target identity, and a functional operation",
      sideEffects,
      confidence,
      limitations,
      gate: stepGate === "permission-required" ? "ask-before-use" : stepGate,
    });
  if (lower.includes("graphify")) {
    add(
      "Graphify MCP or CLI",
      "query a target-scoped path or neighborhood",
      "reads-target",
      "high",
      ["Requires a current target index; extraction writes target artifacts."],
    );
    add(
      "language compiler or LSP",
      "resolve component-local symbols and references",
      "reads-target",
      "authoritative",
      ["Coverage is language- and build-configuration-specific."],
      "ask-on-failure",
    );
    add(
      "bundled AST relationship graph",
      "resolve conservative local dependencies",
      "reads-target",
      "medium",
      ["May miss reflection, dependency injection, generated code, events, and remote calls."],
      "ask-on-failure",
    );
  } else if (lower.includes("serena")) {
    add(
      "Serena MCP",
      "resolve definitions, references, and symbol context",
      "reads-target",
      "high",
      ["Requires the target project to be active and correctly excluded."],
    );
    add(
      "language compiler or LSP",
      "resolve exact symbols and references",
      "reads-target",
      "authoritative",
      ["May require build metadata or generated sources."],
      "ask-on-failure",
    );
    add(
      "bundled ts-morph or ast-grep adapter",
      "parse source structure",
      "reads-target",
      "medium",
      ["Only registered languages receive AST semantics."],
      "ask-on-failure",
    );
  } else if (lower.includes("semgrep")) {
    add("Semgrep MCP or CLI", "scan the scoped target and verify control flow", "network", "high", [
      "Rules can produce false positives; exploitability still requires manual verification.",
    ]);
    add(
      "bundled Secretlint",
      "detect credential exposure",
      "reads-target",
      "medium",
      ["Does not detect general vulnerabilities."],
      "ask-on-failure",
    );
  } else if (lower.includes("context7") || lower.includes("official documentation")) {
    add("Context7 MCP or CLI", "resolve version-matched documentation", "network", "high", [
      "Library identity and installed version must be established from the target.",
    ]);
    add(
      "official primary documentation",
      "look up authoritative version-specific behavior",
      "network",
      "authoritative",
      ["May not describe target-specific integration behavior."],
      "ask-on-failure",
    );
  } else if (
    lower.includes("dependency") ||
    lower.includes("lockfile") ||
    lower.includes("advisory")
  ) {
    add(
      "bundled manifest and lockfile adapters",
      "resolve declared and locked dependency versions plus observed usage",
      "reads-target",
      "high",
      ["Package/import aliases and runtime loading can hide usage."],
      "none",
    );
    add(
      "ecosystem advisory and registry APIs",
      "retrieve current advisories, licenses, releases, and maintenance metadata",
      "network",
      "authoritative",
      ["Current metadata still requires target-specific reachability and impact analysis."],
      "ask-before-use",
    );
    add(
      "targeted installed-package or version-tagged source",
      "inspect implementation details for a selected critical dependency",
      "reads-target",
      "high",
      ["Inspect only selected locked versions; do not merge vendor source into the app graph."],
      "ask-on-failure",
    );
  } else if (lower.includes("profiler") || lower.includes("trace")) {
    add(
      preferredTool,
      "collect a permission-scoped runtime observation",
      "executes-target",
      "authoritative",
      ["Runtime evidence represents the exercised scenario, not every production condition."],
      "permission-required",
    );
    add(
      "static relationship analysis",
      "bound the likely runtime path without execution",
      "reads-target",
      "medium",
      ["Cannot establish frequency, latency, data volume, or runtime dispatch."],
      "ask-on-failure",
    );
  } else {
    add(preferredTool, "collect the requested evidence", "reads-target", "high", [
      "Functional success must be verified; installation alone is insufficient.",
    ]);
  }
  add(
    fallback,
    "collect reduced-fidelity evidence",
    "reads-target",
    "low",
    ["This is the final named fallback; disclose the lost capability before use."],
    "ask-on-failure",
  );
  return [...new Map(steps.map((item) => [`${item.tool}:${item.operation}`, item])).values()];
}

export function planAnalysis(model, options = {}) {
  const mode = options.mode ?? "workbook";
  const focus = options.focus?.trim() || null;
  const depth = options.depth ?? "balanced";
  const terms = focusTerms(focus);
  const investigations = [];
  const push = (item) =>
    investigations.push({
      ...item,
      toolChain: item.toolChain ?? toolChainFor(item.preferredTool, item.fallback, item.gate),
      priority: Math.min(
        item.id === "purpose-and-constraints" ? 100 : 99,
        item.priority + relevance(`${item.question} ${item.why.join(" ")}`, terms),
      ),
    });
  const documentationEvidenceIds = model.nodes
    .filter((node) =>
      /(?:^|\/)(?:readme|architecture|overview|docs?)(?:\.|\/|$)/i.test(node.path ?? ""),
    )
    .flatMap((node) => node.evidenceIds)
    .slice(0, 12);
  const structuralEvidenceIds = model.nodes
    .filter((node) => ["entry-point", "test", "configuration", "deployment"].includes(node.kind))
    .flatMap((node) => node.evidenceIds)
    .slice(0, 20);
  const relationshipEdges = model.edges.filter((edge) => edge.kind !== "contains");
  push({
    id: "purpose-and-constraints",
    zoom: "system",
    priority: 100,
    question: `Confirm what this ${model.profile.primaryArchetype} exists to do, who depends on it, and which failures are unacceptable.`,
    why: ["Repository structure cannot establish product intent or business criticality."],
    evidenceNeeded: ["authoritative project docs", "user confirmation", "operational objectives"],
    preferredTool: "target source and project documentation",
    fallback: "ask focused purpose and criticality questions",
    gate: "none",
    evidenceIds: documentationEvidenceIds,
  });
  for (const [index, workflow] of model.profile.criticalWorkflows.entries())
    push({
      id: `configured-workflow-${stableId("workflow", workflow).split(":").at(-1)}`,
      zoom: "flow",
      priority: Math.max(82, 94 - index),
      question: `Trace the user-configured critical workflow: ${workflow}`,
      why: ["The project-memory wizard marked this workflow as operationally important."],
      evidenceNeeded: [
        "verified entry and outcome",
        "component crossings",
        "authoritative state changes",
        "failure, rollback, and recovery paths",
        "tests and runtime evidence",
      ],
      preferredTool: "Graphify path query plus Serena symbol references",
      fallback: "bundled AST relationship graph plus verified source traversal",
      gate: "ask-on-failure",
      evidenceIds: [],
    });
  push({
    id: "entry-to-effect",
    zoom: "flow",
    priority: 95,
    question:
      "Trace one critical input from an entry point through validation, domain decisions, state changes, side effects, and user-visible outcome.",
    why: ["End-to-end flow reveals ownership, trust boundaries, and coupled failure paths."],
    evidenceNeeded: ["entry point", "symbol references", "data sinks", "error and rollback paths"],
    preferredTool: "Graphify path query plus Serena symbol references",
    fallback: "bundled relation graph plus verified source traversal",
    gate: "ask-on-failure",
    evidenceIds: [
      ...structuralEvidenceIds,
      ...model.packs.flatMap((pack) => pack.evidenceIds),
    ].slice(0, 20),
  });
  if (model.dependencies.length > 0)
    push({
      id: "third-party-dependency-risk",
      zoom: "ecosystem",
      priority: 84,
      question:
        "Identify dependencies on critical paths, exact locked versions, source-usage concentration, update exposure, advisories, licenses, and maintenance risk.",
      why: [
        `${model.dependencies.filter((item) => item.direct).length} direct and ${model.dependencies.filter((item) => !item.direct).length} lockfile/transitive-only dependencies were modeled.`,
        "Third-party behavior can dominate security, compatibility, performance, and operability.",
      ],
      evidenceNeeded: [
        "manifest and lockfile declarations",
        "observed import/usage sites",
        "critical-flow reachability",
        "current authoritative advisory and release metadata",
      ],
      preferredTool: "dependency lockfile adapters plus ecosystem advisory APIs",
      fallback: "declared dependency and source-usage report with current risk left unresolved",
      gate: "ask-on-failure",
      evidenceIds: model.dependencies.flatMap((item) => item.evidenceIds).slice(0, 20),
    });
  const languagePacks = model.packs.filter((pack) => pack.kind === "language");
  if (languagePacks.length === 0) {
    push({
      id: "blocking-ecosystem-discovery",
      zoom: "ecosystem",
      priority: 99,
      question:
        "Identify the dominant language/runtime, version, compiler or language server, dependency manifest, official documentation, test runner, and semantic analysis path before teaching source mechanics.",
      why: [
        "No language pack matched the modeled source.",
        "Unsupported semantics must remain unresolved until ecosystem-aware evidence succeeds.",
      ],
      evidenceNeeded: [
        "language and runtime version",
        "compiler/LSP or ecosystem-aware parser",
        "dependency and build metadata",
        "version-matched official documentation",
      ],
      preferredTool: "target language compiler/LSP plus official documentation",
      fallback:
        "ask to set up ecosystem tooling or continue with structure-only teaching; there is no generic syntax fallback",
      gate: "ask-on-failure",
      evidenceIds: structuralEvidenceIds,
    });
  }
  const lensLimit = depth === "concise" ? 4 : depth === "deep" ? 12 : 8;
  const topLenses = model.profile.priorities.slice(0, lensLimit);
  for (const [index, priority] of topLenses.entries()) {
    push({
      id: `lens-${priority.lens}`,
      zoom: index < 3 ? "domain" : "module",
      priority: 90 - index * 4,
      question: `Apply the ${priority.lens} lens to the most critical workflow and locate the first verified constraint, failure mode, or trade-off.`,
      why: priority.reasons,
      evidenceNeeded: [
        "relevant control flow",
        "boundary behavior",
        "tests or runtime evidence",
        "project constraints",
      ],
      preferredTool:
        priority.lens === "security"
          ? "Semgrep plus manual control-flow verification"
          : priority.lens === "performance"
            ? "runtime profiler/trace plus static call path"
            : "Graphify and Serena evidence",
      fallback:
        priority.lens === "security"
          ? "Secretlint plus scoped manual verification (credential exposure only)"
          : "bundled relation graph and direct source verification",
      gate: "ask-on-failure",
      evidenceIds: priority.evidenceIds,
    });
  }
  const packInvestigations = model.packs
    .flatMap((pack) => pack.investigations.map((question) => ({ pack, question })))
    .filter(
      (candidate) => !focus || relevance(`${candidate.pack.id} ${candidate.question}`, terms) > 0,
    )
    .sort(
      (left, right) =>
        relevance(`${right.pack.id} ${right.question}`, terms) -
          relevance(`${left.pack.id} ${left.question}`, terms) ||
        right.pack.confidence - left.pack.confidence ||
        left.question.localeCompare(right.question),
    );
  const packLimit = depth === "concise" ? 8 : depth === "deep" ? 40 : 20;
  for (const [index, candidate] of packInvestigations.slice(0, packLimit).entries()) {
    push({
      id: `pack-${stableId(candidate.pack.id, candidate.question).split(":")[1]}`,
      zoom: index % 3 === 0 ? "symbol" : "function",
      priority: 70 - Math.floor(index / 3),
      question: `Investigate ${candidate.question} where ${candidate.pack.id} appears in a critical path.`,
      why: [`Selected by the detected ${candidate.pack.id} ${candidate.pack.kind} pack.`],
      evidenceNeeded: [
        "definition and consumers",
        "normal and failure branches",
        "tests",
        "version-specific official documentation when behavior is framework-defined",
      ],
      preferredTool: "Serena definition/reference lookup and Context7 documentation",
      fallback: new Set(["javascript-typescript", "python"]).has(candidate.pack.id)
        ? "bundled pattern scan plus direct source and official primary documentation"
        : "no bundled parser supports this ecosystem; set up a version-matched compiler/LSP/parser or keep exact semantics unresolved",
      gate: "ask-on-failure",
      evidenceIds: candidate.pack.evidenceIds,
    });
  }
  push({
    id: "consumer-map",
    zoom: "module",
    priority: 88,
    question:
      "For each selected module, identify every known caller, consumer, test, configuration owner, and downstream dependency before teaching or recommending a change.",
    why: ["A module has meaning through its relationships, not its filename alone."],
    evidenceNeeded: [
      "incoming and outgoing edges",
      "dynamic registrations",
      "tests",
      "configuration",
    ],
    preferredTool: "Graphify incoming/outgoing neighborhood plus Serena references",
    fallback:
      relationshipEdges.length > 0
        ? "bundled relation graph, search, and source verification"
        : "no bundled relationship graph is available for this ecosystem; set up a language-aware graph/LSP or skip consumer claims",
    gate: "ask-on-failure",
    evidenceIds: [],
  });
  push({
    id: "micro-semantics",
    zoom: "expression",
    priority: 75,
    question:
      "At each selected code example, explain the exact language semantics, runtime behavior, invariants, complexity, and framework lifecycle involved.",
    why: ["Local syntax is only useful when connected to project consequences."],
    evidenceNeeded: [
      "small verified snippet",
      "language/runtime version",
      "call context",
      "tests or executable behavior",
    ],
    preferredTool: "Serena symbol context plus version-matched Context7/official docs",
    fallback: languagePacks.some((pack) =>
      new Set(["javascript-typescript", "python"]).has(pack.id),
    )
      ? "bundled parser scan and authoritative primary documentation"
      : "no bundled parser supports this language; set up a version-matched compiler/LSP/parser or keep semantics unresolved",
    gate: "ask-on-failure",
    evidenceIds: [],
  });
  const deduplicated = [
    ...new Map(
      investigations
        .sort((left, right) => right.priority - left.priority)
        .map((item) => [item.id, item]),
    ).values(),
  ];
  const dialogue = buildDialogueEnvelope({
    role: "propose",
    coverage: model.coverage,
    unresolved: model.profile.uncertainties,
    mode,
    extraBlindSpots: [
      "dependency-injection-and-reflection",
      "event-and-runtime-dispatch",
      "generated-bindings",
    ],
    extraMustNotClaim: ["enhanced-tools-succeeded"],
    extraNextAsks: [
      {
        who: "tool",
        do: "graphify-or-serena-retrieve",
        why: "preferred-before-heuristic-fallback",
      },
    ],
  });
  return analysisPlanSchema.parse({
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    target: model.target,
    request: { mode, focus, depth },
    coverage: model.coverage,
    profileSummary: {
      primaryArchetype: model.profile.primaryArchetype,
      languages: model.profile.languages.map((item) => item.id),
      capabilities: model.profile.capabilities,
      highestPriorityLenses: model.profile.priorities.slice(0, 6).map((item) => item.lens),
    },
    investigations: deduplicated,
    stoppingRules: [
      "Stop a branch when evidence no longer changes the learner's mental model or safe next action.",
      "Do not promote an inferred relation to observed without source, tool, test, or runtime evidence.",
      "Stop and ask before a required enhanced tool is replaced by a fallback.",
      "Prefer depth on the highest-impact verified flow over shallow coverage quotas.",
      "Treat runtime, production, business, and user-impact claims as unresolved until evidence supports them.",
      "Follow nextAsks; treat this plan as a proposal, not verified code truth.",
    ],
    unresolved: model.profile.uncertainties,
    ...dialogue,
  });
}

export function summarizeModel(model) {
  const edgeCounts = Object.fromEntries(
    [...new Set(model.edges.map((edge) => edge.kind))]
      .sort()
      .map((kind) => [kind, model.edges.filter((edge) => edge.kind === kind).length]),
  );
  return {
    schemaVersion: model.schemaVersion,
    generatedAt: model.generatedAt,
    target: model.target,
    coverage: model.coverage,
    profile: model.profile,
    packs: model.packs,
    evidenceSummary: {
      total: model.evidence.length,
      byState: Object.fromEntries(
        [...new Set(model.evidence.map((item) => item.state))]
          .sort()
          .map((state) => [state, model.evidence.filter((item) => item.state === state).length]),
      ),
    },
    graphSummary: { nodes: model.nodes.length, edges: model.edges.length, edgesByKind: edgeCounts },
  };
}
