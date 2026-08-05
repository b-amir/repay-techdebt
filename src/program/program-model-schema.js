import { z } from "zod";

export const MODEL_VERSION = 2;

const evidenceStateSchema = z.enum([
  "observed",
  "derived",
  "inferred",
  "hypothesis",
  "contradicted",
  "stale",
]);

export const evidenceSchema = z.object({
  id: z.string(),
  state: evidenceStateSchema,
  confidence: z.number().min(0).max(1),
  claim: z.string(),
  sources: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().positive().optional(),
      endLine: z.number().int().positive().optional(),
      kind: z.enum(["file", "manifest", "relation", "name", "configuration"]),
      analyzer: z.string().optional(),
      operation: z.string().optional(),
    }),
  ),
  observedAt: z.string(),
  limitations: z.array(z.string()).default([]),
});

export const programNodeSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "system",
    "component",
    "area",
    "file",
    "entry-point",
    "test",
    "manifest",
    "configuration",
    "technology",
    "dependency",
    "capability",
    "domain",
    "flow",
    "module",
    "symbol",
    "function",
    "expression",
    "route",
    "screen",
    "command",
    "endpoint",
    "job",
    "event",
    "state-owner",
    "database-entity",
    "config-key",
    "data-store",
    "integration",
    "deployment",
    "runtime-observation",
  ]),
  name: z.string(),
  path: z.string().optional(),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  evidenceIds: z.array(z.string()).default([]),
});

export const programEdgeSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "contains",
    "imports",
    "tests",
    "declares",
    "implements",
    "configures",
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
  ]),
  from: z.string(),
  to: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string()).default([]),
});

const detectedPackSchema = z.object({
  id: z.string(),
  kind: z.enum(["language", "framework"]),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(z.string()),
  capabilities: z.array(z.string()),
  possibleCapabilities: z.array(z.string()),
  lenses: z.array(z.string()),
  investigations: z.array(z.string()),
});

export const programModelSchema = z.object({
  schemaVersion: z.literal(MODEL_VERSION),
  generatedAt: z.string(),
  target: z.object({
    root: z.string(),
    excludedSkillPath: z.string().nullable(),
    scope: z.string(),
  }),
  coverage: z.object({
    status: z.enum(["complete", "partial", "unsupported", "failed"]),
    reasonCodes: z.array(z.string()),
    discoveredFiles: z.number().int().nonnegative(),
    modeledFiles: z.number().int().nonnegative(),
    manifestFilesDiscovered: z.number().int().nonnegative(),
    manifestFilesRead: z.number().int().nonnegative(),
    relationFilesRead: z.number().int().nonnegative(),
    relationBytesRead: z.number().int().nonnegative(),
    fileLimit: z.number().int().positive(),
    manifestFileLimit: z.number().int().positive(),
    relationFileLimit: z.number().int().positive(),
    relationReadBudget: z.number().int().positive(),
    truncated: z.boolean(),
    skippedLargeFiles: z.number().int().nonnegative(),
    unreadableFiles: z.number().int().nonnegative(),
    relationLanguagesSupported: z.array(z.string()),
    relationLanguagesUnsupported: z.array(z.string()),
    parserDiagnostics: z.array(
      z.object({
        path: z.string(),
        parser: z.string(),
        severity: z.enum(["notice", "warning", "error"]),
        code: z.string(),
        message: z.string(),
        line: z.number().int().positive().optional(),
      }),
    ),
  }),
  profile: z.object({
    archetypes: z.array(
      z.object({
        id: z.string(),
        score: z.number(),
        reasons: z.array(z.string()),
      }),
    ),
    primaryArchetype: z.string(),
    components: z.array(
      z.object({
        id: z.string(),
        root: z.string(),
        files: z.number().int().nonnegative(),
        manifests: z.array(z.string()),
        archetypes: z.array(
          z.object({
            id: z.string(),
            score: z.number(),
            reasons: z.array(z.string()),
          }),
        ),
        primaryArchetype: z.string(),
      }),
    ),
    languages: z.array(z.object({ id: z.string(), files: z.number(), share: z.number() })),
    technologies: z.array(z.string()),
    capabilities: z.array(z.string()),
    entryPoints: z.array(z.string()),
    tests: z.array(z.string()),
    boundaries: z.array(z.string()),
    boundaryEvidence: z.array(
      z.object({
        path: z.string(),
        signals: z.array(z.string()),
        confidence: z.number().min(0).max(1),
      }),
    ),
    criticalWorkflows: z.array(z.string()),
    priorities: z.array(
      z.object({
        lens: z.string(),
        score: z.number(),
        reasons: z.array(z.string()),
        evidenceIds: z.array(z.string()),
      }),
    ),
    uncertainties: z.array(z.string()),
  }),
  packs: z.array(detectedPackSchema),
  dependencies: z.array(
    z.object({
      name: z.string(),
      scope: z.string(),
      direct: z.boolean(),
      lockedVersions: z.array(z.string()),
      manifests: z.array(z.string()),
      usedBy: z.array(z.string()),
      evidenceIds: z.array(z.string()),
    }),
  ),
  evidence: z.array(evidenceSchema),
  nodes: z.array(programNodeSchema),
  edges: z.array(programEdgeSchema),
});

const toolStepSchema = z.object({
  tool: z.string(),
  operation: z.string(),
  availability: z.string(),
  sideEffects: z.enum(["none", "reads-target", "writes-target", "network", "executes-target"]),
  confidence: z.enum(["authoritative", "high", "medium", "low"]),
  limitations: z.array(z.string()),
  gate: z.enum(["none", "ask-before-use", "ask-on-failure"]),
});

export const analysisPlanSchema = z.object({
  schemaVersion: z.literal(2),
  generatedAt: z.string(),
  target: programModelSchema.shape.target,
  request: z.object({
    mode: z.enum(["pr", "workbook", "focused"]),
    focus: z.string().nullable(),
    depth: z.enum(["concise", "balanced", "deep"]),
  }),
  coverage: programModelSchema.shape.coverage,
  profileSummary: z.object({
    primaryArchetype: z.string(),
    languages: z.array(z.string()),
    capabilities: z.array(z.string()),
    highestPriorityLenses: z.array(z.string()),
  }),
  investigations: z.array(
    z.object({
      id: z.string(),
      zoom: z.enum([
        "ecosystem",
        "system",
        "domain",
        "flow",
        "module",
        "symbol",
        "function",
        "expression",
      ]),
      priority: z.number(),
      question: z.string(),
      why: z.array(z.string()),
      evidenceNeeded: z.array(z.string()),
      preferredTool: z.string(),
      fallback: z.string(),
      toolChain: z.array(toolStepSchema).min(1),
      gate: z.enum(["none", "ask-on-failure", "permission-required"]),
      evidenceIds: z.array(z.string()),
    }),
  ),
  stoppingRules: z.array(z.string()),
  unresolved: z.array(z.string()),
  role: z.enum(["gate", "inventory", "retrieve", "propose", "check"]).default("propose"),
  coverageStatus: z.string().optional(),
  blindSpots: z.array(z.string()).default([]),
  mustNotClaim: z.array(z.string()).default([]),
  nextAsks: z
    .array(
      z.object({
        who: z.enum(["agent", "script", "tool", "user"]),
        do: z.string(),
        why: z.string().optional(),
        when: z.string().optional(),
        question: z.string().optional(),
      }),
    )
    .default([]),
});
