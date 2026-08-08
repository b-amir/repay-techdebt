import { z } from "zod";
import { selectDiagramType } from "./diagram-selection.js";

const LESSON_PLAN_VERSION = 1;

const shapeIds = [
  "architecture-orientation",
  "end-to-end-flow",
  "code-mechanics",
  "change-impact",
  "debugging-failure",
  "security-boundary",
  "performance-scale",
  "data-state",
  "dependency-ecosystem",
  "operations-deployment",
  "testing-verification",
  "ui-interaction",
];

const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  purpose: z.string(),
  evidencePaths: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  strength: z.enum(["required", "strong", "authoritative"]),
  caution: z.string().nullable(),
});

const signalSchema = z.object({
  id: z.string(),
  score: z.number().min(0).max(100),
  strength: z.enum(["strong", "moderate", "weak", "absent"]),
  independentSources: z.number().int().nonnegative(),
  focusRelated: z.boolean(),
  authoritative: z.boolean(),
  evidencePaths: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  reasons: z.array(z.string()),
  limitations: z.array(z.string()),
});

export const lessonPlanSchema = z.object({
  schemaVersion: z.literal(LESSON_PLAN_VERSION),
  generatedAt: z.string(),
  target: z.object({
    root: z.string(),
    scope: z.string(),
  }),
  request: z.object({
    focus: z.string().nullable(),
    kind: z.enum(["auto", ...shapeIds]),
    depth: z.enum(["concise", "balanced", "deep"]),
  }),
  lessonShape: z.object({
    id: z.enum(shapeIds),
    label: z.string(),
    reason: z.string(),
  }),
  titleHint: z.string(),
  simplePlan: z.array(sectionSchema).min(3).max(10),
  activatedOptionalSections: z.array(sectionSchema),
  omittedOptionalSections: z.array(
    z.object({
      id: z.string(),
      reasonCode: z.enum([
        "weak-signal",
        "not-focus-related",
        "lower-priority",
        "covered-by-shape",
        "requires-runtime-evidence",
        "requires-user-confirmation",
      ]),
    }),
  ),
  signals: z.array(signalSchema),
  focusAnchors: z.array(
    z.object({
      nodeId: z.string(),
      kind: z.string(),
      path: z.string().nullable(),
      name: z.string(),
    }),
  ),
  evidenceGaps: z.array(z.string()),
  compositionRules: z.array(z.string()),
  diagramIntent: z
    .object({
      type: z.enum(["none", "flowchart", "sequence", "state", "er", "class"]),
      decision: z.enum(["required", "recommended", "omit"]),
      teachingQuestion: z.string().optional(),
      reason: z.string().optional(),
      nodes: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
      edges: z
        .array(
          z.object({
            from: z.string(),
            to: z.string(),
            label: z.string(),
            evidenceIds: z.array(z.string()).optional(),
          }),
        )
        .optional(),
      evidenceIds: z.array(z.string()).optional(),
      observedEdgeKinds: z.array(z.string()).optional(),
    })
    .optional(),
});

const SHAPES = {
  "architecture-orientation": {
    label: "Architecture orientation",
    required: ["why", "map", "responsibilities", "relationships", "change-safely"],
  },
  "end-to-end-flow": {
    label: "End-to-end flow",
    required: ["why", "entry-to-effect", "mechanism", "failure-path", "change-safely"],
  },
  "code-mechanics": {
    label: "Code mechanics",
    required: ["why", "verified-snippet", "mechanism", "project-consequence", "try-it"],
  },
  "change-impact": {
    label: "Change impact",
    required: ["intent", "before-after", "blast-radius", "risk", "verification"],
  },
  "debugging-failure": {
    label: "Debugging and failure",
    required: ["symptom", "execution-path", "failure-path", "diagnostic-evidence", "recovery"],
  },
  "security-boundary": {
    label: "Security boundary",
    required: [
      "asset-and-actor",
      "trust-boundary",
      "control-flow",
      "failure-and-abuse",
      "verification",
    ],
  },
  "performance-scale": {
    label: "Performance and scale",
    required: ["workload", "hot-path", "cost-model", "measurement", "safe-optimization"],
  },
  "data-state": {
    label: "Data and state",
    required: ["ownership", "state-lifecycle", "invariants", "failure-path", "verification"],
  },
  "dependency-ecosystem": {
    label: "Dependency and ecosystem",
    required: [
      "dependency-role",
      "usage-path",
      "version-contract",
      "failure-impact",
      "change-safely",
    ],
  },
  "operations-deployment": {
    label: "Operations and deployment",
    required: [
      "runtime-shape",
      "configuration",
      "startup-to-service",
      "failure-recovery",
      "verification",
    ],
  },
  "testing-verification": {
    label: "Testing and verification",
    required: ["behavior-contract", "test-map", "test-mechanics", "coverage-gaps", "next-test"],
  },
  "ui-interaction": {
    label: "UI and interaction",
    required: ["user-goal", "interaction-flow", "state-ownership", "edge-states", "verification"],
  },
};

const SHAPE_COVERED_SIGNALS = {
  "architecture-orientation": new Set(["architecture", "relationships"]),
  "end-to-end-flow": new Set(["relationships"]),
  "code-mechanics": new Set(["language"]),
  "change-impact": new Set(["relationships"]),
  "debugging-failure": new Set(["reliability"]),
  "security-boundary": new Set(["security"]),
  "performance-scale": new Set(["performance"]),
  "data-state": new Set(["data"]),
  "dependency-ecosystem": new Set(["dependencies"]),
  "operations-deployment": new Set(["operations"]),
  "testing-verification": new Set(["testing"]),
  "ui-interaction": new Set(["ui"]),
};

const SECTIONS = {
  why: ["Why this matters", "Connect the subject to the program and its users."],
  map: ["The map", "Show the smallest useful system or component map."],
  responsibilities: ["Who owns what", "Explain responsibilities and boundaries."],
  relationships: ["How the parts connect", "Trace consumers, dependencies, and effects."],
  "change-safely": ["How to change it safely", "Name the edit surface and verification path."],
  "entry-to-effect": ["From entry to effect", "Trace inputs through the selected outcome."],
  mechanism: ["How it works", "Explain the exact mechanism at the useful zoom level."],
  "failure-path": ["When it fails", "Trace represented failure and recovery behavior."],
  "verified-snippet": ["The important code", "Use the smallest verified, redacted snippet."],
  "project-consequence": [
    "What this changes here",
    "Relate language mechanics to project behavior.",
  ],
  "try-it": ["Try this", "Offer one concrete prediction or modification challenge."],
  intent: [
    "What changed and why",
    "Frame the requested change without treating the diff as current truth.",
  ],
  "before-after": [
    "Before and after",
    "Explain the behavioral delta with verified source context.",
  ],
  "blast-radius": [
    "What else is affected",
    "Trace consumers, contracts, state, and deployment impact.",
  ],
  risk: ["Main risks", "Prioritize evidenced correctness and compatibility risks."],
  verification: ["How to prove it", "Give the shortest credible verification strategy."],
  symptom: ["The symptom", "State the observable failure without premature diagnosis."],
  "execution-path": ["Trace the execution", "Walk from trigger to observed symptom."],
  "diagnostic-evidence": [
    "Evidence that separates causes",
    "Identify decisive logs, state, or experiments.",
  ],
  recovery: ["Recover and prevent", "Separate immediate recovery from durable prevention."],
  "asset-and-actor": [
    "What needs protection",
    "Identify assets, actors, and authority assumptions.",
  ],
  "trust-boundary": ["Where trust changes", "Trace validation and authorization boundaries."],
  "control-flow": ["How the control works", "Explain verified controls and their ordering."],
  "failure-and-abuse": [
    "Failure and abuse cases",
    "Use bounded scenarios without asserting exploitability.",
  ],
  workload: ["What grows", "Define the workload dimension before discussing speed."],
  "hot-path": [
    "Where work is paid",
    "Trace the candidate hot path without claiming production heat.",
  ],
  "cost-model": ["The cost model", "Explain algorithmic, I/O, allocation, or fan-out costs."],
  measurement: ["What to measure", "Name the runtime evidence needed to establish impact."],
  "safe-optimization": ["Optimize safely", "Preserve semantics and specify a regression check."],
  ownership: ["Who owns the truth", "Identify authoritative and derived state."],
  "state-lifecycle": ["State lifecycle", "Trace creation, mutation, persistence, and disposal."],
  invariants: ["What must stay true", "Explain verified constraints and transaction boundaries."],
  "dependency-role": ["Why this dependency exists", "Connect declaration to observed usage."],
  "usage-path": ["Where it is used", "Trace dependency usage through application code."],
  "version-contract": [
    "Version and contract",
    "Explain resolved versions and compatibility evidence.",
  ],
  "failure-impact": [
    "If it changes or fails",
    "Identify affected paths without inventing runtime frequency.",
  ],
  "runtime-shape": ["How it runs", "Describe processes, services, jobs, or client runtime."],
  configuration: ["Configuration that matters", "Connect configuration sources to behavior."],
  "startup-to-service": [
    "From startup to service",
    "Trace boot, registration, readiness, and work.",
  ],
  "failure-recovery": [
    "Failure and recovery",
    "Explain health, retry, rollback, and operator paths.",
  ],
  "behavior-contract": ["Behavior under test", "State the externally meaningful contract."],
  "test-map": ["Where it is tested", "Connect tests to the code and boundaries they exercise."],
  "test-mechanics": [
    "How the test proves it",
    "Explain setup, action, observation, and assertions.",
  ],
  "coverage-gaps": ["What is not proved", "Name gaps without converting absence into a defect."],
  "next-test": ["The next useful test", "Propose one high-value behavior check."],
  "user-goal": ["The user goal", "Frame the interaction around a concrete outcome."],
  "interaction-flow": [
    "The interaction flow",
    "Trace input, feedback, success, and failure states.",
  ],
  "state-ownership": [
    "Where state lives",
    "Explain backend, URL, shared, and transient ownership.",
  ],
  "edge-states": [
    "States people encounter",
    "Cover evidenced loading, empty, error, disabled, and forbidden states.",
  ],
};

const OPTIONAL_SECTIONS = {
  "consumer-impact": {
    title: "Who depends on this",
    purpose: "Expose verified incoming consumers and blast radius.",
    signal: "relationships",
    caution: "Static relations can miss runtime dispatch and generated wiring.",
  },
  "security-and-privacy": {
    title: "Trust, security, and privacy",
    purpose:
      "Explain relevant boundaries and controls without claiming an unverified vulnerability.",
    signal: "security",
    caution: "A security-relevant surface is not proof of exploitability.",
  },
  "performance-and-cost": {
    title: "Scale, latency, and cost",
    purpose:
      "Explain what may grow and specify the measurement needed before calling it a bottleneck.",
    signal: "performance",
    caution: "Static structure does not prove runtime frequency, scale, or latency.",
  },
  "data-integrity": {
    title: "Data ownership and integrity",
    purpose: "Connect state ownership, persistence, constraints, and failure behavior.",
    signal: "data",
    caution: "Confirm schemas, transactions, and authoritative state in source.",
  },
  "reliability-and-concurrency": {
    title: "Failures, retries, and ordering",
    purpose:
      "Teach timeouts, retries, idempotency, ordering, and cancellation when the app signals them.",
    signal: "reliability",
    caution: "Runtime guarantees need implementation or operational evidence.",
  },
  "dependencies-and-versions": {
    title: "Dependencies and version constraints",
    purpose: "Connect manifests, lock evidence, imports, and compatibility impact.",
    signal: "dependencies",
    caution: "Declaration does not prove runtime use; observed usage is called out separately.",
  },
  "tests-and-testability": {
    title: "Tests and confidence",
    purpose: "Show which tests relate to the focus and what they do not establish.",
    signal: "testing",
    caution: "An import relation does not prove a behavior is asserted.",
  },
  "deployment-and-operations": {
    title: "Deployment and operations",
    purpose: "Connect runtime configuration, deployment assets, and recovery paths.",
    signal: "operations",
    caution: "Repository deployment files may not match the active production environment.",
  },
  "ui-accessibility": {
    title: "Interaction and accessibility",
    purpose: "Relate UI state, semantics, keyboard behavior, and user feedback.",
    signal: "ui",
    caution: "Framework presence does not prove a specific accessibility defect.",
  },
  "language-runtime": {
    title: "Language and runtime mechanics",
    purpose:
      "Explain syntax, lifecycle, ownership, or concurrency semantics that determine behavior.",
    signal: "language",
    caution: "Use only semantics supported by the detected language and verified source.",
  },
  "architecture-tradeoffs": {
    title: "Architecture and trade-offs",
    purpose: "Explain component ownership, coupling, alternatives, and consequences.",
    signal: "architecture",
    caution: "Repository layout is evidence of organization, not automatically a runtime boundary.",
  },
};

function words(value) {
  return new Set(
    String(value ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((item) => item.length > 1),
  );
}

function overlaps(left, right) {
  return [...left].some((item) => right.has(item));
}

function unique(values, maximum = 12) {
  return [...new Set(values.filter(Boolean))].sort().slice(0, maximum);
}

function evidenceFor(model, evidenceIds) {
  const wanted = new Set(evidenceIds);
  return model.evidence.filter((item) => wanted.has(item.id));
}

const CONTEXT_EDGE_KINDS = new Set([
  "imports",
  "tests",
  "depends-on",
  "calls",
  "reads",
  "writes",
  "emits",
  "handles",
  "guards",
  "transforms",
  "routes-to",
  "deploys",
  "observes",
  "configures",
]);

function relatedContext(model, focus) {
  const terms = words(focus);
  const fileLike = model.nodes.filter((node) => node.path && node.kind !== "area");
  const normalizedFocus = String(focus ?? "")
    .replace(/^\.\//, "")
    .replaceAll("\\", "/")
    .trim();
  const exactPathAnchors = normalizedFocus
    ? fileLike.filter(
        (node) =>
          node.path === normalizedFocus ||
          node.path?.endsWith(`/${normalizedFocus}`) ||
          normalizedFocus.endsWith(`/${node.path}`),
      )
    : [];
  let anchors =
    exactPathAnchors.length > 0
      ? exactPathAnchors
      : fileLike.filter((node) => overlaps(terms, words(`${node.path ?? ""} ${node.name}`)));
  // A named focus that finds no anchor is an evidence gap, not permission to
  // silently substitute unrelated global hubs.
  if (anchors.length === 0 && terms.size === 0) {
    const incoming = new Map();
    for (const edge of model.edges)
      incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + (edge.confidence >= 0.7 ? 1 : 0));
    anchors = fileLike
      .filter(
        (node) =>
          model.profile.entryPoints.includes(node.path) || (incoming.get(node.id) ?? 0) >= 3,
      )
      .sort((left, right) => (incoming.get(right.id) ?? 0) - (incoming.get(left.id) ?? 0));
  }
  anchors = anchors.slice(0, 12);
  const anchorIds = new Set(anchors.map((node) => node.id));
  const relatedIds = new Set(anchorIds);
  for (const edge of model.edges) {
    if (CONTEXT_EDGE_KINDS.has(edge.kind) && (anchorIds.has(edge.from) || anchorIds.has(edge.to))) {
      relatedIds.add(edge.from);
      relatedIds.add(edge.to);
    }
  }
  const nodes = model.nodes.filter((node) => relatedIds.has(node.id));
  const paths = new Set(nodes.map((node) => node.path).filter(Boolean));
  return { terms, anchors, relatedIds, paths };
}

function priority(model, id) {
  return model.profile.priorities.find((item) => item.lens === id);
}

function nodesMatching(model, predicate) {
  return model.nodes.filter(predicate);
}

function makeSignal(model, context, definition) {
  const candidateNodes = definition.nodes(model, context);
  const candidateEdges = definition.edges(model, context);
  const priorityItems = definition.priorities.map((id) => priority(model, id)).filter(Boolean);
  const candidateEvidenceIds = [
    ...candidateNodes.flatMap((node) => node.evidenceIds),
    ...candidateEdges.flatMap((edge) => edge.evidenceIds),
  ];
  const evidenceIds = unique(
    [
      ...candidateEvidenceIds,
      ...(!context.terms.size ? priorityItems.flatMap((item) => item.evidenceIds) : []),
    ],
    40,
  );
  const evidence = evidenceFor(model, evidenceIds);
  const evidencePaths = unique(
    [
      ...candidateNodes.map((node) => node.path),
      ...evidence.flatMap((item) => item.sources.map((source) => source.path)),
    ],
    20,
  );
  const independentSources = new Set(
    evidence.flatMap((item) => item.sources.map((source) => `${source.kind}:${source.path}`)),
  ).size;
  const localEvidence =
    candidateNodes.some((node) => context.relatedIds.has(node.id)) ||
    candidateEdges.some(
      (edge) => context.relatedIds.has(edge.from) || context.relatedIds.has(edge.to),
    ) ||
    evidencePaths.some((path) => context.paths.has(path));
  const focusRelated = !context.terms.size || localEvidence;
  const authoritative =
    definition.authoritative(model, context, candidateNodes, candidateEdges) && focusRelated;
  const base = Math.min(55, candidateNodes.length * 8 + candidateEdges.length * 7);
  const diversity = Math.min(25, independentSources * 5);
  const priorityScore = focusRelated
    ? Math.min(
        15,
        priorityItems.reduce((sum, item) => sum + Math.max(0, item.score - 40) / 8, 0),
      )
    : 0;
  const score = Math.min(
    100,
    Math.round(
      base + diversity + priorityScore + (focusRelated ? 8 : 0) + (authoritative ? 15 : 0),
    ),
  );
  const strong = authoritative || (score >= 55 && independentSources >= 2 && focusRelated);
  const strength = strong ? "strong" : score >= 35 ? "moderate" : score > 0 ? "weak" : "absent";
  return {
    id: definition.id,
    score,
    strength,
    independentSources,
    focusRelated,
    authoritative,
    evidencePaths,
    evidenceIds,
    reasons: definition.reasons(model, candidateNodes, candidateEdges, priorityItems),
    limitations: definition.limitations,
  };
}

const definitions = [
  {
    id: "relationships",
    priorities: ["maintainability", "correctness"],
    nodes: (model, context) => model.nodes.filter((node) => context.relatedIds.has(node.id)),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          CONTEXT_EDGE_KINDS.has(edge.kind) &&
          edge.kind !== "depends-on" &&
          edge.confidence >= 0.7 &&
          (context.relatedIds.has(edge.from) || context.relatedIds.has(edge.to)),
      ),
    authoritative: () => false,
    reasons: (_model, nodes, edges) => [
      `${nodes.length} focus-neighbor nodes and ${edges.length} high-confidence relations were modeled.`,
    ],
    limitations: [
      "Static relations can miss runtime dispatch, reflection, generated code, and network calls.",
    ],
  },
  {
    id: "security",
    priorities: ["security", "privacy"],
    nodes: (model, context) =>
      nodesMatching(model, (node) => {
        const value = words(`${node.path ?? ""} ${node.name}`);
        return (
          overlaps(
            value,
            new Set(["auth", "oauth", "session", "permission", "token", "secret", "user"]),
          ) &&
          (context.relatedIds.has(node.id) || !context.terms.size)
        );
      }),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          ["guards", "routes-to", "reads", "writes", "imports"].includes(edge.kind) &&
          (context.relatedIds.has(edge.from) || context.relatedIds.has(edge.to)),
      ),
    authoritative: () => false,
    reasons: (model, nodes, edges, priorities) => [
      `${nodes.length} security-named focus nodes, ${edges.length} related control/data relations, and ${model.profile.boundaryEvidence.length} boundary candidates were found.`,
      ...priorities.map((item) => `${item.lens} is ranked ${item.score}.`),
    ],
    limitations: ["These clues establish relevance, not a vulnerability or exploit."],
  },
  {
    id: "performance",
    priorities: ["performance", "cost"],
    nodes: (model, context) =>
      nodesMatching(model, (node) => {
        const value = words(`${node.path ?? ""} ${node.name}`);
        return (
          overlaps(
            value,
            new Set([
              "worker",
              "queue",
              "batch",
              "stream",
              "cache",
              "query",
              "pipeline",
              "benchmark",
            ]),
          ) &&
          (context.relatedIds.has(node.id) || !context.terms.size)
        );
      }),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          ["calls", "reads", "writes", "depends-on", "imports"].includes(edge.kind) &&
          (context.relatedIds.has(edge.from) || context.relatedIds.has(edge.to)),
      ),
    authoritative: () => false,
    reasons: (_model, nodes, edges, priorities) => [
      `${nodes.length} scale-relevant focus nodes and ${edges.length} work-path relations were found.`,
      ...priorities.map((item) => `${item.lens} is ranked ${item.score}.`),
    ],
    limitations: [
      "Static evidence cannot establish production frequency, latency, data volume, or cost.",
    ],
  },
  {
    id: "data",
    priorities: ["data-integrity", "privacy"],
    nodes: (model, context) =>
      nodesMatching(model, (node) => {
        const value = words(`${node.path ?? ""} ${node.name}`);
        const focusRelated = context.relatedIds.has(node.id) || !context.terms.size;
        return (
          focusRelated &&
          (node.kind === "data-store" ||
            overlaps(
              value,
              new Set([
                "data",
                "database",
                "db",
                "model",
                "schema",
                "migration",
                "repository",
                "store",
              ]),
            ))
        );
      }),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          ["reads", "writes", "transforms", "depends-on", "imports"].includes(edge.kind) &&
          (context.relatedIds.has(edge.from) || context.relatedIds.has(edge.to)),
      ),
    authoritative: () => false,
    reasons: (model, nodes, edges, priorities) => [
      `${nodes.length} state/data nodes, ${edges.length} related relations, and ${model.packs.filter((pack) => pack.capabilities.includes("data-store")).length} data-store packs were found.`,
      ...priorities.map((item) => `${item.lens} is ranked ${item.score}.`),
    ],
    limitations: [
      "Authoritative state and transaction behavior still require source verification.",
    ],
  },
  {
    id: "reliability",
    priorities: ["reliability", "operability", "offline-behavior"],
    nodes: (model, context) =>
      nodesMatching(model, (node) => {
        const value = words(`${node.path ?? ""} ${node.name}`);
        return (
          overlaps(
            value,
            new Set([
              "worker",
              "queue",
              "job",
              "retry",
              "timeout",
              "health",
              "error",
              "offline",
              "sync",
            ]),
          ) &&
          (context.relatedIds.has(node.id) || !context.terms.size)
        );
      }),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          ["handles", "emits", "calls", "routes-to", "imports"].includes(edge.kind) &&
          (context.relatedIds.has(edge.from) || context.relatedIds.has(edge.to)),
      ),
    authoritative: () => false,
    reasons: (_model, nodes, edges, priorities) => [
      `${nodes.length} failure/concurrency-named nodes and ${edges.length} related relations were found.`,
      ...priorities.map((item) => `${item.lens} is ranked ${item.score}.`),
    ],
    limitations: [
      "Retry, ordering, recovery, and idempotency guarantees require exact source or runtime evidence.",
    ],
  },
  {
    id: "dependencies",
    priorities: ["portability", "reproducibility", "security"],
    nodes: (model, context) =>
      model.nodes.filter(
        (node) =>
          node.kind === "dependency" &&
          (!context.terms.size ||
            context.relatedIds.has(node.id) ||
            overlaps(words(node.name), context.terms)),
      ),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          edge.kind === "depends-on" &&
          (!context.terms.size ||
            context.relatedIds.has(edge.from) ||
            context.relatedIds.has(edge.to)),
      ),
    authoritative: (model) => model.dependencies.some((item) => item.lockedVersions.length > 0),
    reasons: (model, nodes, edges) => [
      `${nodes.length} dependency nodes, ${edges.length} dependency relations, and ${model.dependencies.filter((item) => item.usedBy.length > 0).length} declarations with observed usage were found.`,
    ],
    limitations: [
      "Manifest and import evidence does not establish every runtime or transitive use.",
    ],
  },
  {
    id: "testing",
    priorities: ["testability", "correctness"],
    nodes: (model, context) =>
      model.nodes.filter(
        (node) => node.kind === "test" && (!context.terms.size || context.relatedIds.has(node.id)),
      ),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          edge.kind === "tests" &&
          (!context.terms.size ||
            context.relatedIds.has(edge.from) ||
            context.relatedIds.has(edge.to)),
      ),
    authoritative: () => false,
    reasons: (model, nodes, edges) => [
      `${nodes.length} focus-related tests and ${edges.length} test relations were found among ${model.profile.tests.length} modeled tests.`,
    ],
    limitations: [
      "Test files and imports do not prove assertions, coverage, or production parity.",
    ],
  },
  {
    id: "operations",
    priorities: ["operability", "reliability"],
    nodes: (model, context) =>
      nodesMatching(model, (node) => {
        const value = words(`${node.path ?? ""} ${node.name}`);
        const focusRelated = context.relatedIds.has(node.id) || !context.terms.size;
        return (
          focusRelated &&
          (["deployment", "configuration"].includes(node.kind) ||
            overlaps(
              value,
              new Set([
                "docker",
                "kubernetes",
                "helm",
                "deploy",
                "workflow",
                "config",
                "env",
                "terraform",
              ]),
            ))
        );
      }),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          ["configures", "deploys", "observes"].includes(edge.kind) &&
          (!context.terms.size ||
            context.relatedIds.has(edge.from) ||
            context.relatedIds.has(edge.to)),
      ),
    authoritative: () => false,
    reasons: (_model, nodes, edges, priorities) => [
      `${nodes.length} deployment/configuration nodes and ${edges.length} operational relations were found.`,
      ...priorities.map((item) => `${item.lens} is ranked ${item.score}.`),
    ],
    limitations: ["Repository configuration may differ from the currently deployed environment."],
  },
  {
    id: "ui",
    priorities: ["accessibility", "user-experience"],
    nodes: (model, context) =>
      nodesMatching(model, (node) => {
        const value = words(`${node.path ?? ""} ${node.name}`);
        return (
          overlaps(
            value,
            new Set([
              "component",
              "components",
              "view",
              "screen",
              "page",
              "route",
              "ui",
              "frontend",
            ]),
          ) &&
          (context.relatedIds.has(node.id) || !context.terms.size)
        );
      }),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          ["routes-to", "handles", "imports"].includes(edge.kind) &&
          (context.relatedIds.has(edge.from) || context.relatedIds.has(edge.to)),
      ),
    authoritative: () => false,
    reasons: (model, nodes, edges, priorities) => [
      `${nodes.length} UI-named nodes, ${edges.length} related relations, and ${model.profile.capabilities.includes("browser-ui") ? "a browser UI capability" : "no browser UI capability"} were found.`,
      ...priorities.map((item) => `${item.lens} is ranked ${item.score}.`),
    ],
    limitations: [
      "Framework and filename clues do not establish a specific interaction or accessibility defect.",
    ],
  },
  {
    id: "language",
    priorities: ["correctness", "memory-safety", "portability"],
    nodes: (model, context) =>
      model.nodes.filter(
        (node) =>
          node.path &&
          node.attributes.language &&
          (!context.terms.size || context.relatedIds.has(node.id)),
      ),
    edges: () => [],
    authoritative: () => false,
    reasons: (model, nodes) => [
      `${nodes.length} focus-related source files use ${model.profile.languages.map((item) => item.id).join(", ") || "unresolved languages"}.`,
    ],
    limitations: [
      "Exact semantics must be verified against source and the detected language/version.",
    ],
  },
  {
    id: "architecture",
    priorities: ["maintainability", "correctness"],
    nodes: (model, context) =>
      model.nodes.filter(
        (node) =>
          ["component", "area"].includes(node.kind) &&
          (!context.terms.size || context.relatedIds.has(node.id)),
      ),
    edges: (model, context) =>
      model.edges.filter(
        (edge) =>
          ["contains", "imports", "depends-on"].includes(edge.kind) &&
          (!context.terms.size ||
            context.relatedIds.has(edge.from) ||
            context.relatedIds.has(edge.to)),
      ),
    authoritative: (model) =>
      model.profile.boundaryEvidence.some((item) => item.signals.includes("user-configured-hint")),
    reasons: (model, nodes, edges) => [
      `${model.profile.components.length} components, ${model.profile.boundaryEvidence.length} boundary candidates, ${nodes.length} related structure nodes, and ${edges.length} structure relations were found.`,
    ],
    limitations: [
      "Workspace ownership and directories do not necessarily equal runtime boundaries.",
    ],
  },
];

function selectShape(model, context, kind, signals) {
  if (kind !== "auto") return { id: kind, reason: "The caller selected this lesson shape." };
  const focus = context.terms;
  /** @type {[string, string[]][]} */
  const keyed = [
    ["security-boundary", ["auth", "security", "permission", "privacy", "session", "token"]],
    ["performance-scale", ["performance", "latency", "scale", "cost", "slow", "memory"]],
    ["debugging-failure", ["debug", "error", "failure", "incident", "broken", "bug"]],
    ["change-impact", ["change", "diff", "pr", "migration", "refactor", "upgrade"]],
    ["testing-verification", ["test", "testing", "coverage", "verify"]],
    ["dependency-ecosystem", ["dependency", "package", "library", "version"]],
    ["operations-deployment", ["deploy", "deployment", "docker", "kubernetes", "operations"]],
    ["data-state", ["data", "database", "state", "schema", "transaction"]],
    ["ui-interaction", ["ui", "component", "screen", "page", "accessibility", "frontend"]],
    ["end-to-end-flow", ["flow", "request", "workflow", "lifecycle", "trace"]],
    ["code-mechanics", ["function", "syntax", "line", "code", "algorithm"]],
  ];
  for (const [id, terms] of keyed)
    if (terms.some((term) => focus.has(term)))
      return {
        id,
        reason: `Focus terms select the ${SHAPES[id].label.toLowerCase()} shape.`,
      };
  const strong = new Set(
    signals.filter((item) => item.strength === "strong").map((item) => item.id),
  );
  const anchorTerms = words(
    context.anchors.map((anchor) => `${anchor.path ?? ""} ${anchor.name}`).join(" "),
  );
  const uiAnchor = overlaps(
    anchorTerms,
    new Set(["component", "components", "view", "screen", "page", "ui", "frontend"]),
  );
  const dataAnchor = overlaps(
    anchorTerms,
    new Set(["data", "database", "db", "model", "schema", "repository", "store"]),
  );
  if (strong.has("ui") && context.anchors.length > 0 && uiAnchor)
    return {
      id: "ui-interaction",
      reason: "Strong UI signals intersect the selected focus.",
    };
  if (strong.has("data") && context.anchors.length > 0 && dataAnchor)
    return {
      id: "data-state",
      reason: "Strong data/state signals intersect the selected focus.",
    };
  if (
    context.anchors.length > 0 &&
    signals.find((item) => item.id === "relationships")?.score >= 55
  )
    return {
      id: "end-to-end-flow",
      reason: "The focus has enough related nodes to teach as a flow.",
    };
  return {
    id: "architecture-orientation",
    reason: "No narrower lesson intent was strongly established.",
  };
}

function requiredSection(id, context) {
  const [title, purpose] = SECTIONS[id];
  const anchorPaths = unique(
    context.anchors.map((node) => node.path),
    4,
  );
  const evidenceIds = unique(
    context.anchors.flatMap((node) => node.evidenceIds),
    12,
  );
  return {
    id,
    title,
    purpose,
    evidencePaths: anchorPaths,
    evidenceIds,
    strength: "required",
    caution: null,
  };
}

export function planLesson(model, options = {}) {
  const kind = options.kind ?? "auto";
  const depth = options.depth ?? "balanced";
  const focus = options.focus?.trim() || null;
  if (!["auto", ...shapeIds].includes(kind)) throw new Error(`Unknown lesson kind: ${kind}`);
  if (!["concise", "balanced", "deep"].includes(depth))
    throw new Error(`Unknown lesson depth: ${depth}`);
  const context = relatedContext(model, focus);
  const signals = definitions
    .map((definition) => makeSignal(model, context, definition))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const shapeSelection = selectShape(model, context, kind, signals);
  const shape = SHAPES[shapeSelection.id];
  const required = shape.required.map((id) => requiredSection(id, context));
  const maxOptional = { concise: 1, balanced: 2, deep: 4 }[depth];
  const signalById = new Map(signals.map((signal) => [signal.id, signal]));
  const candidates = Object.entries(OPTIONAL_SECTIONS)
    .map(([id, section]) => ({
      id,
      section,
      signal: signalById.get(section.signal),
    }))
    .filter(
      ({ section, signal }) =>
        !SHAPE_COVERED_SIGNALS[shapeSelection.id].has(section.signal) &&
        signal?.strength === "strong" &&
        signal.focusRelated,
    )
    .sort(
      (left, right) => right.signal.score - left.signal.score || left.id.localeCompare(right.id),
    );
  const activated = candidates.slice(0, maxOptional).map(({ id, section, signal }) => ({
    id,
    title: section.title,
    purpose: section.purpose,
    evidencePaths: signal.evidencePaths.slice(0, 6),
    evidenceIds: signal.evidenceIds.slice(0, 16),
    strength: signal.authoritative ? "authoritative" : "strong",
    caution: section.caution,
  }));
  const selected = new Set(activated.map((item) => item.id));
  const omitted = Object.entries(OPTIONAL_SECTIONS)
    .filter(([id]) => !selected.has(id))
    .map(([id, section]) => {
      const signal = signalById.get(section.signal);
      let reasonCode = "weak-signal";
      if (SHAPE_COVERED_SIGNALS[shapeSelection.id].has(section.signal))
        reasonCode = "covered-by-shape";
      else if (signal?.strength === "strong" && !signal.focusRelated)
        reasonCode = "not-focus-related";
      else if (signal?.strength === "strong") reasonCode = "lower-priority";
      else if (
        ["performance", "reliability"].includes(section.signal) &&
        signal?.strength !== "strong"
      )
        reasonCode = "requires-runtime-evidence";
      return { id, reasonCode };
    });
  const evidenceGaps = unique(
    [
      ...model.profile.uncertainties,
      ...(context.anchors.length === 0
        ? ["No focus anchor was found; confirm the lesson subject."]
        : []),
      ...(signals.find((item) => item.id === "relationships")?.strength !== "strong"
        ? ["Consumer and dependency relationships are not strong enough for a blast-radius claim."]
        : []),
    ],
    8,
  );
  const focusLabel = focus ?? context.anchors[0]?.path ?? model.profile.primaryArchetype;

  const diagramNodeIds = new Set(context.relatedIds);
  const packetForDiagram = {
    nodes: model.nodes.filter((node) => diagramNodeIds.has(node.id)),
    edges: model.edges.filter(
      (edge) =>
        CONTEXT_EDGE_KINDS.has(edge.kind) &&
        edge.confidence >= 0.7 &&
        diagramNodeIds.has(edge.from) &&
        diagramNodeIds.has(edge.to),
    ),
    focusNodeIds: context.anchors.map((anchor) => anchor.id),
  };
  const topicForDiagram = { chapter: shape.label };
  const diagramIntent = selectDiagramType(topicForDiagram, packetForDiagram);

  return lessonPlanSchema.parse({
    schemaVersion: LESSON_PLAN_VERSION,
    generatedAt: new Date().toISOString(),
    target: { root: model.target.root, scope: model.target.scope },
    request: { focus, kind, depth },
    lessonShape: {
      id: shapeSelection.id,
      label: shape.label,
      reason: shapeSelection.reason,
    },
    titleHint: `${shape.label}: ${focusLabel}`,
    simplePlan: [...required, ...activated],
    activatedOptionalSections: activated,
    omittedOptionalSections: omitted,
    signals,
    focusAnchors: context.anchors.map((node) => ({
      nodeId: node.id,
      kind: node.kind,
      path: node.path ?? null,
      name: node.name,
    })),
    evidenceGaps,
    diagramIntent,
    compositionRules: [
      "Keep the visible lesson to the planned sections; do not print scoring or empty placeholders.",
      "Verify every claim in live source and cite exact project-relative lines before teaching it.",
      "Treat optional sections as invitations to investigate, not proof of a defect or runtime behavior.",
      "Prefer clues that converge across files, relations, manifests, tests, configuration, tools, or confirmed memory.",
      diagramIntent.decision === "required"
        ? "Include the planned evidence-backed diagram and validate its Mermaid syntax before save."
        : diagramIntent.decision === "recommended"
          ? "Include the planned diagram when it reduces prose; otherwise record a concrete omission reason."
          : "Do not add a decorative diagram; the verified mechanism is clearer in code and prose.",
    ],
  });
}

export function composeMermaidBlock(intent) {
  if (!intent || intent.type === "none" || !intent.edges?.length) return "";

  const nodeIds = new Map(intent.nodes.map((node, index) => [node.id, `N${index}`]));
  const safeLabel = (value) => String(value).replaceAll('"', "'").replace(/[<>]/g, "");

  const lines = [
    "```mermaid",
    intent.type === "flowchart"
      ? "flowchart TD"
      : intent.type === "sequence"
        ? "sequenceDiagram"
        : intent.type === "state"
          ? "stateDiagram-v2"
          : intent.type === "er"
            ? "erDiagram"
            : "classDiagram",
    `    accTitle: ${intent.teachingQuestion || "Diagram"}`,
    `    accDescr: ${intent.reason || "Visual representation of relationships."}`,
    "",
  ];

  if (intent.type === "sequence") {
    intent.nodes.forEach((node) =>
      lines.push(`    participant ${nodeIds.get(node.id)} as ${safeLabel(node.label)}`),
    );
    intent.edges.forEach((edge) =>
      lines.push(
        `    ${nodeIds.get(edge.from)}->>${nodeIds.get(edge.to)}: ${safeLabel(edge.label)}`,
      ),
    );
  } else if (intent.type === "flowchart") {
    intent.nodes.forEach((node) =>
      lines.push(`    ${nodeIds.get(node.id)}["${safeLabel(node.label)}"]`),
    );
    intent.edges.forEach((edge) =>
      lines.push(
        `    ${nodeIds.get(edge.from)} -->|${safeLabel(edge.label)}| ${nodeIds.get(edge.to)}`,
      ),
    );
  } else if (intent.type === "state") {
    intent.nodes.forEach((node) =>
      lines.push(`    state "${safeLabel(node.label)}" as ${nodeIds.get(node.id)}`),
    );
    intent.edges.forEach((edge) =>
      lines.push(
        `    ${nodeIds.get(edge.from)} --> ${nodeIds.get(edge.to)}: ${safeLabel(edge.label)}`,
      ),
    );
  } else {
    return "";
  }

  lines.push("```", "");
  lines.push(
    "**What this shows:** " + (intent.reason || "Visual representation of relationships."),
  );
  return lines.join("\n");
}
