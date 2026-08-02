import { lstat, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { globby } from "globby";
import { z } from "zod";
import { stableId } from "./identity.js";
import { parseManifest } from "./manifest-intelligence.js";
import { locateProjectMemory } from "./private-storage.js";
import { extractRelationships } from "./relationship-intelligence.js";
import { isSameOrInside, skillRoot } from "./targeting.js";

const MODEL_VERSION = 2;
const DEFAULT_MAX_FILES = 30_000;
const DEFAULT_MAX_MANIFEST_FILES = 1_000;
const DEFAULT_MAX_RELATION_FILES = 1_500;
const DEFAULT_READ_BUDGET = 12 * 1024 * 1024;
const MAX_RELATION_FILE_SIZE = 512 * 1024;

const IGNORES = [
  "**/.git/**",
  "**/.hg/**",
  "**/.svn/**",
  "**/.repay-techdebt/**",
  "**/.serena/**",
  "**/.venv/**",
  "**/__pycache__/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.svelte-kit/**",
  "**/bower_components/**",
  "**/build/**",
  "**/coverage/**",
  "**/dist/**",
  "**/generated/**",
  "**/graphify-out/**",
  "**/node_modules/**",
  "**/out/**",
  "**/repomix-output.*",
  "**/target/**",
  "**/vendor/**",
  "**/.env",
  "**/.env.*",
  "**/.gitignore",
  "**/.graphifyignore",
  "**/*.{key,pem,p12,pfx,keystore,jks}",
];

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
      z.object({ id: z.string(), score: z.number(), reasons: z.array(z.string()) }),
    ),
    primaryArchetype: z.string(),
    components: z.array(
      z.object({
        id: z.string(),
        root: z.string(),
        files: z.number().int().nonnegative(),
        manifests: z.array(z.string()),
        archetypes: z.array(
          z.object({ id: z.string(), score: z.number(), reasons: z.array(z.string()) }),
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
});

const extensionLanguage = new Map([
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".mts", "TypeScript"],
  [".cts", "TypeScript"],
  [".py", "Python"],
  [".pyi", "Python"],
  [".go", "Go"],
  [".rs", "Rust"],
  [".java", "Java"],
  [".kt", "Kotlin"],
  [".kts", "Kotlin"],
  [".scala", "Scala"],
  [".cs", "C#"],
  [".fs", "F#"],
  [".vb", "Visual Basic"],
  [".c", "C"],
  [".h", "C/C++"],
  [".cc", "C++"],
  [".cpp", "C++"],
  [".cxx", "C++"],
  [".hpp", "C++"],
  [".swift", "Swift"],
  [".m", "Objective-C/MATLAB"],
  [".mm", "Objective-C++"],
  [".rb", "Ruby"],
  [".php", "PHP"],
  [".ex", "Elixir"],
  [".exs", "Elixir"],
  [".dart", "Dart"],
  [".r", "R"],
  [".R", "R"],
  [".jl", "Julia"],
  [".hs", "Haskell"],
  [".ml", "OCaml"],
  [".mli", "OCaml"],
  [".clj", "Clojure"],
  [".erl", "Erlang"],
  [".gleam", "Gleam"],
  [".sh", "Shell"],
  [".bash", "Shell"],
  [".zsh", "Shell"],
  [".fish", "Shell"],
  [".ps1", "PowerShell"],
  [".sql", "SQL"],
  [".tf", "Terraform"],
  [".hcl", "HCL"],
  [".graphql", "GraphQL"],
  [".proto", "Protocol Buffers"],
  [".sol", "Solidity"],
  [".lua", "Lua"],
  [".ipynb", "Notebook"],
]);

const manifestNames = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "Pipfile",
  "setup.py",
  "go.mod",
  "go.work",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "settings.gradle",
  "settings.gradle.kts",
  "build.sbt",
  "global.json",
  "CMakeLists.txt",
  "Makefile",
  "meson.build",
  "conanfile.txt",
  "vcpkg.json",
  "Package.swift",
  "Podfile",
  "Gemfile",
  "composer.json",
  "mix.exs",
  "pubspec.yaml",
  "DESCRIPTION",
  "Project.toml",
  "renv.lock",
  "poetry.lock",
  "uv.lock",
  "composer.lock",
  "stack.yaml",
  "cabal.project",
  "dune-project",
  "deps.edn",
  "rebar.config",
  "gleam.toml",
  "Chart.yaml",
  "Pulumi.yaml",
  "serverless.yml",
  "serverless.yaml",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "go.sum",
  "Cargo.lock",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
]);

const entryNames =
  /^(?:(?:main|index|app|server|client|cli|worker|application|program|manage|wsgi|asgi)|.+(?:_|-)(?:main|app|server|client|worker))(?:\.[^.]+)+$/i;
const testPattern =
  /(?:^|\/)(?:test|tests|spec|specs|__tests__)(?:\/|$)|(?:\.test|\.spec|_test|test_)\.[^/]+$/i;
const boundaryPattern =
  /(?:^|\/)(?:api|routes?|controllers?|handlers?|commands?|consumers?|workers?|jobs?|repositories|adapters?|gateways?|ports?|migrations?|schemas?|contracts?|events?)(?:\/|$)/i;
const boundarySegmentPattern =
  /^(?:api|routes?|controllers?|handlers?|commands?|consumers?|workers?|jobs?|repositories|adapters?|gateways?|ports?|migrations?|schemas?|contracts?|events?)$/i;
const deploymentPattern =
  /(?:^|\/)(?:Dockerfile|(?:docker-)?compose\.ya?ml|k8s|kubernetes|helm|terraform|infra|deploy|\.github\/workflows|\.gitlab-ci|serverless)/i;

function normalized(path) {
  return path.replaceAll("\\", "/");
}

function normalizeScope(value) {
  const scope = normalized(String(value ?? "."))
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
  if (scope.startsWith("/") || scope.split("/").includes("..") || scope.includes("\0"))
    throw new Error("scope must be a safe target-relative path");
  return scope || ".";
}

function conventionalBoundaryRoot(path) {
  const segments = normalized(path).split("/");
  const index = segments.findIndex((segment) => boundarySegmentPattern.test(segment));
  return index < 0 ? null : segments.slice(0, index + 1).join("/");
}

function wildcardMatches(pattern, filename) {
  if (!pattern.includes("*")) return pattern === filename;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i").test(filename);
}

async function loadJson(relativePath) {
  return JSON.parse(await readFile(resolve(skillRoot, relativePath), "utf8"));
}

export async function loadPackRegistry() {
  const [program, frameworks, lenses] = await Promise.all([
    loadJson("packs/program-packs.json"),
    loadJson("packs/framework-packs.json"),
    loadJson("packs/lenses.json"),
  ]);
  const languagePack = z.object({
    id: z.string(),
    kind: z.literal("language"),
    detect: z.object({ extensions: z.array(z.string()), manifests: z.array(z.string()) }),
    capabilities: z.array(z.string()),
    lenses: z.array(z.string()),
    investigations: z.array(z.string()),
  });
  const frameworkPack = z.object({
    id: z.string(),
    kind: z.literal("framework"),
    packages: z.array(z.string()),
    signals: z.array(z.string()),
    lenses: z.array(z.string()),
    investigations: z.array(z.string()),
  });
  const lens = z.object({
    id: z.string(),
    questions: z.array(z.string()),
    evidence: z.array(z.string()),
  });
  return {
    languagePacks: z.array(languagePack).parse(program.packs),
    frameworkPacks: z.array(frameworkPack).parse(frameworks.packs),
    lenses: z.array(lens).parse(lenses.lenses),
  };
}

function classifyFile(path) {
  const name = basename(path);
  if (deploymentPattern.test(path)) return "deployment";
  if (manifestNames.has(name) || /\.(?:csproj|fsproj|sln|xcodeproj|xcworkspace)$/.test(name))
    return "manifest";
  if (
    /(?:^|\/)config(?:\/|$)|(?:^|\/)\.github\/workflows(?:\/|$)|\.(?:toml|ya?ml|jsonc)$/i.test(path)
  )
    return "configuration";
  if (testPattern.test(path)) return "test";
  if (entryNames.test(name)) return "entry-point";
  return "file";
}

function resolveRelativeImport(source, specifier, fileSet) {
  if (!specifier.startsWith(".")) return null;
  const base = normalized(resolve(dirname(source), specifier));
  const candidates = [base];
  const emittedExtension = extname(base).toLowerCase();
  if (new Set([".js", ".jsx", ".mjs", ".cjs"]).has(emittedExtension)) {
    const withoutEmittedExtension = base.slice(0, -emittedExtension.length);
    for (const extension of [".ts", ".tsx", ".mts", ".cts", ".d.ts"])
      candidates.push(`${withoutEmittedExtension}${extension}`);
  }
  for (const extension of extensionLanguage.keys()) candidates.push(`${base}${extension}`);
  for (const extension of extensionLanguage.keys()) candidates.push(`${base}/index${extension}`);
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

function resolvePythonImport(source, specifier, fileSet, projectRoot) {
  if (!specifier.startsWith(".")) {
    const modulePath = specifier.replaceAll(".", "/");
    const bases = [
      normalized(resolve(dirname(source), modulePath)),
      normalized(resolve(projectRoot, modulePath)),
    ];
    return (
      bases
        .flatMap((base) => [`${base}.py`, `${base}/__init__.py`])
        .find((candidate) => fileSet.has(candidate)) ?? null
    );
  }
  const dots = specifier.match(/^\.+/)?.[0].length ?? 0;
  const suffix = specifier.slice(dots).replaceAll(".", "/");
  let directory = dirname(source);
  for (let index = 1; index < dots; index += 1) directory = dirname(directory);
  const base = normalized(resolve(directory, suffix));
  return (
    [base, `${base}.py`, `${base}/__init__.py`].find((candidate) => fileSet.has(candidate)) ?? null
  );
}

function resolveGleamImport(specifier, fileSet, projectRoot) {
  return ["src", "test"]
    .map((directory) => normalized(resolve(projectRoot, directory, `${specifier}.gleam`)))
    .find((candidate) => fileSet.has(candidate));
}

function snakeCaseSegment(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function resolveElixirImport(specifier, fileSet, projectRoot) {
  const segments = specifier.split(".").map(snakeCaseSegment);
  const candidates = [segments, segments.slice(1)]
    .filter((parts) => parts.length > 0)
    .flatMap((parts) => [
      normalized(resolve(projectRoot, "lib", `${parts.join("/")}.ex`)),
      normalized(resolve(projectRoot, "test", `${parts.join("/")}.exs`)),
    ]);
  return candidates.find((candidate) => fileSet.has(candidate));
}

function scoreArchetypes(files, packages, capabilities) {
  const scores = new Map();
  const reasons = new Map();
  const bump = (id, amount, reason) => {
    scores.set(id, (scores.get(id) ?? 0) + amount);
    if (!reasons.has(id)) reasons.set(id, new Set());
    reasons.get(id).add(reason);
  };
  for (const capability of capabilities) bump(capability, 12, `detected ${capability} capability`);
  for (const path of files) {
    if (/^(?:app|src\/app|pages|src\/pages)\//.test(path))
      bump("application", 5, "application entry structure");
    if (/(?:api|routes?|controllers?|handlers?)\//i.test(path))
      bump("server", 3, "request boundary files");
    if (/(?:pipelines?|etl|dags?|notebooks?)\//i.test(path))
      bump("data-pipeline", 5, "pipeline-oriented structure");
    if (deploymentPattern.test(path)) bump("deployed-service", 3, "deployment configuration");
    if (/(?:packages|libs?|crates)\//i.test(path))
      bump("library-or-monorepo", 3, "package/library structure");
  }
  if ([...packages].some((item) => /react|vue|svelte|angular|next|nuxt/.test(item)))
    bump("browser-ui", 20, "UI framework dependency");
  if ([...packages].some((item) => /express|fastify|django|flask|spring|aspnet|rails/.test(item)))
    bump("server", 20, "server framework dependency");
  if (scores.size === 0) bump("unknown-program", 1, "insufficient executable signals");
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score, reasons: [...reasons.get(id)].sort() }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

function priorityProfile(packs, archetypes, evidenceByPack) {
  const weights = new Map([
    ["correctness", 40],
    ["reliability", 25],
    ["security", 20],
    ["data-integrity", 20],
    ["maintainability", 20],
    ["testability", 20],
    ["performance", 15],
    ["operability", 15],
  ]);
  const reasons = new Map();
  const evidence = new Map();
  const add = (lens, amount, reason, evidenceIds = []) => {
    weights.set(lens, Math.min(100, (weights.get(lens) ?? 10) + amount));
    if (!reasons.has(lens)) reasons.set(lens, new Set());
    reasons.get(lens).add(reason);
    if (!evidence.has(lens)) evidence.set(lens, new Set());
    for (const id of evidenceIds) evidence.get(lens).add(id);
  };
  for (const pack of packs)
    for (const lens of pack.lenses)
      add(lens, pack.kind === "framework" ? 12 : 7, `${pack.id} pack`, evidenceByPack.get(pack.id));
  const highImpact = new Map([
    ["server", ["security", "reliability", "operability"]],
    ["data-pipeline", ["data-integrity", "reproducibility", "performance"]],
    ["browser-ui", ["accessibility", "user-experience", "performance"]],
    ["mobile", ["privacy", "offline-behavior", "accessibility"]],
    ["systems", ["memory-safety", "performance", "portability"]],
    ["infrastructure", ["security", "reliability", "cost"]],
    ["ml", ["quality", "reproducibility", "data-integrity", "cost"]],
    ["distributed-system", ["reliability", "operability", "data-integrity"]],
  ]);
  for (const archetype of archetypes.slice(0, 4))
    for (const lens of highImpact.get(archetype.id) ?? [])
      add(lens, 12, `${archetype.id} criticality`);
  return [...weights.entries()]
    .map(([lens, score]) => ({
      lens,
      score,
      reasons: [...(reasons.get(lens) ?? ["universal baseline"])].sort(),
      evidenceIds: [...(evidence.get(lens) ?? [])],
    }))
    .sort((left, right) => right.score - left.score || left.lens.localeCompare(right.lens));
}

function testCandidate(path, fileSet) {
  const extension = extname(path);
  const stem = path.slice(0, -extension.length).replace(/(?:\.test|\.spec|_test)$/, "");
  const candidates = [stem + extension, stem.replace(/(?:^|\/)tests?\//, "/") + extension];
  if (extension === ".exs" && path.startsWith("test/"))
    candidates.push(`lib/${stem.replace(/^test\//, "")}.ex`);
  return candidates.find((candidate) => candidate !== path && fileSet.has(candidate)) ?? null;
}

async function readAnalysisPreferences(targetRoot) {
  try {
    const location = await locateProjectMemory(targetRoot);
    const path = location.config;
    if (!location.ready) return { config: {}, diagnostic: null };
    const details = await lstat(path);
    if (details.isSymbolicLink() || !details.isFile())
      return {
        config: {},
        diagnostic: {
          path:
            location.mode === "private"
              ? "private-project-memory/config.json"
              : ".repay-techdebt/config.json",
          parser: "project-memory",
          severity: "error",
          code: "unsafe-analysis-config",
          message: "Analysis preferences were ignored because config.json is not a regular file.",
        },
      };
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return { config: parsed.analysis ?? {}, diagnostic: null };
  } catch (error) {
    if (error.code === "ENOENT") return { config: {}, diagnostic: null };
    return {
      config: {},
      diagnostic: {
        path: "project-memory/config.json",
        parser: "project-memory",
        severity: "error",
        code: "analysis-config-unreadable",
        message: `Analysis preferences were ignored: ${error.message}`,
      },
    };
  }
}

function componentRoots(files, manifestResults) {
  const roots = new Set(["."]);
  for (const result of manifestResults) {
    if (result.parser === "unsupported") continue;
    const directory = normalized(dirname(result.path));
    if (directory !== ".") roots.add(directory);
    for (const pattern of result.workspaces) {
      const prefix = normalized(String(pattern)).split("*")[0].replace(/\/$/, "");
      for (const path of files) {
        const directory = normalized(dirname(path));
        if (prefix && directory.startsWith(prefix) && manifestNames.has(basename(path)))
          roots.add(directory);
      }
    }
  }
  return [...roots].sort(
    (left, right) => left.split("/").length - right.split("/").length || left.localeCompare(right),
  );
}

function componentFor(path, roots) {
  return [...roots]
    .sort((left, right) => right.length - left.length)
    .find((root) => root === "." || path === root || path.startsWith(`${root}/`));
}

function packageKey(specifier, declaredNames = []) {
  if (!specifier || specifier.startsWith(".") || specifier.startsWith("/")) return null;
  const normalizedSpecifier = specifier.toLowerCase();
  const declarations = [...declaredNames];
  const declaredMatch = declarations
    .filter(
      (name) =>
        normalizedSpecifier === name ||
        normalizedSpecifier.startsWith(`${name}/`) ||
        normalizedSpecifier.startsWith(`${name}:`),
    )
    .sort((left, right) => right.length - left.length)[0];
  if (declaredMatch) return declaredMatch;
  const importAlias = new Map([
    ["jwt", "pyjwt"],
    ["yaml", "pyyaml"],
    ["pil", "pillow"],
    ["cv2", "opencv-python"],
    ["sklearn", "scikit-learn"],
    ["bs4", "beautifulsoup4"],
  ]).get(normalizedSpecifier.split(/[./:]/)[0]);
  if (importAlias && declarations.includes(importAlias)) return importAlias;
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/").toLowerCase();
  return specifier.split(/[/:]/)[0].toLowerCase();
}

function deduplicateIdentities(items, label) {
  const byId = new Map();
  for (const item of items) {
    const prior = byId.get(item.id);
    if (!prior) {
      byId.set(item.id, item);
      continue;
    }
    if (
      label === "edge" &&
      prior.kind === item.kind &&
      prior.from === item.from &&
      prior.to === item.to
    ) {
      prior.confidence = Math.max(prior.confidence, item.confidence);
      prior.evidenceIds = [...new Set([...prior.evidenceIds, ...item.evidenceIds])];
      continue;
    }
    const signature = (value) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== "evidenceIds")
            .sort(([left], [right]) => left.localeCompare(right)),
        ),
      );
    if (signature(prior) !== signature(item))
      throw new Error(`Identity collision detected for ${label} ${item.id}`);
    prior.evidenceIds = [...new Set([...(prior.evidenceIds ?? []), ...(item.evidenceIds ?? [])])];
  }
  return [...byId.values()];
}

export async function buildProgramModel(target, options = {}) {
  const preferences = await readAnalysisPreferences(target.targetRoot);
  const configuredBudgets = preferences.config.budgets ?? {};
  const budgetDiagnostics = [];
  const budget = (name, requested, fallback, maximum) => {
    if (requested === undefined) return fallback;
    if (Number.isInteger(requested) && requested >= 1 && requested <= maximum) return requested;
    budgetDiagnostics.push({
      path: "project-memory/config.json",
      parser: "project-memory",
      severity: "error",
      code: "invalid-analysis-budget",
      message: `${name} must be an integer from 1 to ${maximum}; using ${fallback}.`,
    });
    return fallback;
  };
  const maxFiles = budget(
    "maxFiles",
    options.maxFiles ?? configuredBudgets.maxFiles,
    DEFAULT_MAX_FILES,
    1_000_000,
  );
  const maxRelationFiles = budget(
    "maxRelationFiles",
    options.maxRelationFiles ?? configuredBudgets.maxRelationFiles,
    DEFAULT_MAX_RELATION_FILES,
    1_000_000,
  );
  const maxManifestFiles = budget(
    "maxManifestFiles",
    options.maxManifestFiles ?? configuredBudgets.maxManifestFiles,
    DEFAULT_MAX_MANIFEST_FILES,
    100_000,
  );
  const maxRelationBytes = budget(
    "maxRelationBytes",
    options.maxRelationBytes ?? configuredBudgets.maxRelationBytes,
    DEFAULT_READ_BUDGET,
    2_000_000_000,
  );
  const scope = normalizeScope(options.scope);
  const generatedAt = new Date().toISOString();
  const registry = await loadPackRegistry();
  const ignore = [
    ...IGNORES,
    ...(target.relativeSkillRoot ? [`${target.relativeSkillRoot}/**`] : []),
  ];
  const discovered = (
    await globby("**/*", {
      cwd: target.targetRoot,
      absolute: false,
      dot: true,
      followSymbolicLinks: false,
      gitignore: true,
      ignore,
      onlyFiles: true,
    })
  )
    .map(normalized)
    .filter((path) => scope === "." || path === scope || path.startsWith(`${scope}/`))
    .sort();
  const files = discovered.slice(0, maxFiles);
  const absoluteFiles = files.map((path) => resolve(target.targetRoot, path));
  if (
    target.relativeSkillRoot &&
    absoluteFiles.some((path) =>
      isSameOrInside(path, resolve(target.targetRoot, target.relativeSkillRoot)),
    )
  )
    throw new Error("Internal error: nested skill path entered the program model");
  const fileSet = new Set(absoluteFiles.map(normalized));
  const relativeByAbsolute = new Map(
    absoluteFiles.map((path, index) => [normalized(path), files[index]]),
  );
  const evidence = [];
  const nodes = [];
  const edges = [];
  const addEvidence = (state, confidence, claim, sources, limitations = []) => {
    const id = stableId("evidence", { state, claim, sources, limitations });
    const candidate = {
      id,
      state,
      confidence,
      claim,
      sources,
      observedAt: generatedAt,
      limitations,
    };
    const prior = evidence.find((item) => item.id === id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(candidate))
      throw new Error(`Identity collision detected for evidence ${id}`);
    if (!prior) evidence.push(candidate);
    return id;
  };
  const systemEvidence = addEvidence(
    "observed",
    1,
    scope === "."
      ? "Target root was explicitly resolved"
      : `Target root and analysis scope ${scope} were explicitly resolved`,
    [{ path: scope, kind: "configuration" }],
  );
  nodes.push({
    id: "system:root",
    kind: "system",
    name: basename(target.targetRoot),
    path: ".",
    attributes: {},
    evidenceIds: [systemEvidence],
  });

  const areas = new Set(["."]);
  const manifestFiles = [];
  const entryPoints = [];
  const tests = [];
  const boundaries = [];
  const languageCounts = new Map();
  for (const path of files) {
    const extension = extname(path);
    const language = extensionLanguage.get(extension);
    if (language) languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
    const kind = classifyFile(path);
    if (kind === "manifest") manifestFiles.push(path);
    if (kind === "entry-point") entryPoints.push(path);
    if (kind === "test") tests.push(path);
    if (!["test", "deployment"].includes(kind) && boundaryPattern.test(path))
      boundaries.push(conventionalBoundaryRoot(path));
    const segments = path.split("/");
    for (let depth = 1; depth <= Math.min(4, segments.length - 1); depth += 1)
      areas.add(segments.slice(0, depth).join("/"));
    const evidenceId = addEvidence("observed", 1, `${kind} file exists`, [
      { path, kind: kind === "manifest" ? "manifest" : "file" },
    ]);
    nodes.push({
      id: stableId("file", path),
      kind,
      name: basename(path),
      path,
      attributes: language ? { language } : {},
      evidenceIds: [evidenceId],
    });
  }
  for (const area of [...areas].sort()) {
    const evidenceId = addEvidence("derived", 0.98, "Area is derived from repository layout", [
      { path: area, kind: "name" },
    ]);
    nodes.push({
      id: stableId("area", area),
      kind: "area",
      name: area === "." ? basename(target.targetRoot) : basename(area),
      path: area,
      attributes: {},
      evidenceIds: [evidenceId],
    });
    const parent = area === "." ? "system:root" : stableId("area", dirname(area) || ".");
    edges.push({
      id: stableId("edge", `contains:${parent}:${area}`),
      kind: "contains",
      from: parent,
      to: stableId("area", area),
      confidence: 1,
      evidenceIds: [evidenceId],
    });
  }
  for (const path of files) {
    const segments = path.split("/");
    const area =
      segments.length > 1 ? segments.slice(0, Math.min(4, segments.length - 1)).join("/") : ".";
    edges.push({
      id: stableId("edge", `contains:${area}:${path}`),
      kind: "contains",
      from: stableId("area", area),
      to: stableId("file", path),
      confidence: 1,
      evidenceIds: [],
    });
  }

  const packages = new Set();
  const packageSources = new Map();
  const packageDeclarations = new Map();
  const manifestResults = [];
  const parserDiagnostics = [
    ...(preferences.diagnostic ? [preferences.diagnostic] : []),
    ...budgetDiagnostics,
  ];
  let unreadableFiles = 0;
  for (const path of manifestFiles.slice(0, maxManifestFiles)) {
    try {
      const content = await readFile(resolve(target.targetRoot, path), "utf8");
      const parsed = parseManifest(path, content.slice(0, 2 * 1024 * 1024));
      manifestResults.push(parsed);
      parserDiagnostics.push(
        ...parsed.diagnostics.map((item) => ({ path, parser: parsed.parser, ...item })),
      );
      for (const record of parsed.dependencies) {
        if (record.direct) packages.add(record.name);
        if (!packageSources.has(record.name)) packageSources.set(record.name, new Set());
        packageSources.get(record.name).add(path);
        if (!packageDeclarations.has(record.name)) packageDeclarations.set(record.name, []);
        packageDeclarations.get(record.name).push({ path, ...record });
      }
    } catch (error) {
      unreadableFiles += 1;
      parserDiagnostics.push({
        path,
        parser: "filesystem",
        severity: "error",
        code: "manifest-unreadable",
        message: error.message,
      });
    }
  }

  const detectedPacks = [];
  const evidenceByPack = new Map();
  const invalidManifestPaths = new Set(
    parserDiagnostics
      .filter(
        (item) => item.code === "manifest-parse-failed" || item.code === "manifest-unreadable",
      )
      .map((item) => item.path),
  );
  for (const pack of registry.languagePacks) {
    const matchingFiles = files.filter((path) => pack.detect.extensions.includes(extname(path)));
    const matchingManifests = manifestFiles.filter(
      (path) =>
        !invalidManifestPaths.has(path) &&
        pack.detect.manifests.some((pattern) => wildcardMatches(pattern, basename(path))),
    );
    if (matchingFiles.length === 0 && matchingManifests.length === 0) continue;
    const sources = [...matchingFiles.slice(0, 12), ...matchingManifests.slice(0, 6)].map(
      (path) => ({ path, kind: manifestFiles.includes(path) ? "manifest" : "file" }),
    );
    const evidenceId = addEvidence(
      "observed",
      0.99,
      `${pack.id} pack matched repository files`,
      sources,
    );
    evidenceByPack.set(pack.id, [evidenceId]);
    detectedPacks.push({
      id: pack.id,
      kind: pack.kind,
      confidence: matchingFiles.length > 0 ? 0.99 : 0.8,
      evidenceIds: [evidenceId],
      capabilities: [],
      possibleCapabilities: pack.capabilities,
      lenses: pack.lenses,
      investigations: pack.investigations,
    });
  }
  for (const pack of registry.frameworkPacks) {
    const matches = pack.packages.filter((candidate) =>
      [...packages].some(
        (dependency) => dependency === candidate || dependency.endsWith(`/${candidate}`),
      ),
    );
    if (matches.length === 0) continue;
    const sourcePaths = [
      ...new Set(
        matches.flatMap((candidate) =>
          [...packages]
            .filter(
              (dependency) => dependency === candidate || dependency.endsWith(`/${candidate}`),
            )
            .flatMap((dependency) => [...(packageSources.get(dependency) ?? [])]),
        ),
      ),
    ];
    const evidenceId = addEvidence(
      "observed",
      0.92,
      `${pack.id} dependencies were declared: ${matches.slice(0, 8).join(", ")}`,
      sourcePaths.map((path) => ({ path, kind: "manifest" })),
      ["Dependency declaration does not prove the framework is exercised at runtime."],
    );
    evidenceByPack.set(pack.id, [evidenceId]);
    detectedPacks.push({
      id: pack.id,
      kind: pack.kind,
      confidence: 0.92,
      evidenceIds: [evidenceId],
      capabilities: pack.signals,
      possibleCapabilities: [],
      lenses: pack.lenses,
      investigations: pack.investigations,
    });
  }
  const capabilities = [...new Set(detectedPacks.flatMap((pack) => pack.capabilities))].sort();
  for (const capability of capabilities) {
    const supportingPacks = detectedPacks.filter((pack) => pack.capabilities.includes(capability));
    const evidenceIds = supportingPacks.flatMap((pack) => pack.evidenceIds);
    nodes.push({
      id: stableId("capability", capability),
      kind: "capability",
      name: capability,
      attributes: {},
      evidenceIds,
    });
    edges.push({
      id: stableId("edge", `implements:${capability}`),
      kind: "implements",
      from: "system:root",
      to: stableId("capability", capability),
      confidence: Math.max(...supportingPacks.map((pack) => pack.confidence)),
      evidenceIds,
    });
  }
  for (const pack of detectedPacks) {
    nodes.push({
      id: stableId("technology", pack.id),
      kind: "technology",
      name: pack.id,
      attributes: { packKind: pack.kind },
      evidenceIds: pack.evidenceIds,
    });
    edges.push({
      id: stableId("edge", `declares:${pack.id}`),
      kind: "declares",
      from: "system:root",
      to: stableId("technology", pack.id),
      confidence: pack.confidence,
      evidenceIds: pack.evidenceIds,
    });
    if (pack.kind === "framework") {
      const supportingPaths = pack.evidenceIds.flatMap(
        (id) => evidence.find((item) => item.id === id)?.sources.map((source) => source.path) ?? [],
      );
      for (const path of supportingPaths) {
        const manifestNode = nodes.find((node) => node.path === path && node.kind === "manifest");
        if (!manifestNode) continue;
        edges.push({
          id: stableId("edge", `depends-on:${path}:${pack.id}`),
          kind: "depends-on",
          from: manifestNode.id,
          to: stableId("technology", pack.id),
          confidence: pack.confidence,
          evidenceIds: pack.evidenceIds,
        });
      }
    }
  }

  let relationFilesRead = 0;
  let relationBytesRead = 0;
  let skippedLargeFiles = 0;
  const relationshipDiagnostics = [];
  const dependencyUsage = new Map();
  const observedTestTargets = new Set();
  const relationCandidates = files.filter(
    (path) => extensionLanguage.has(extname(path)) && !path.endsWith(".ipynb"),
  );
  for (const path of relationCandidates) {
    if (relationFilesRead >= maxRelationFiles || relationBytesRead >= maxRelationBytes) break;
    const absolutePath = resolve(target.targetRoot, path);
    try {
      const details = await stat(absolutePath);
      if (details.size > MAX_RELATION_FILE_SIZE) {
        skippedLargeFiles += 1;
        continue;
      }
      if (relationBytesRead + details.size > maxRelationBytes) break;
      const content = await readFile(absolutePath, "utf8");
      relationFilesRead += 1;
      relationBytesRead += details.size;
      const extracted = extractRelationships(path, content);
      relationshipDiagnostics.push(
        ...extracted.diagnostics.map((item) => ({
          path,
          parser: "relationship-adapter",
          ...item,
        })),
      );
      for (const relation of extracted.relations) {
        const specifier = relation.specifier;
        const externalPackage = packageKey(specifier, packageDeclarations.keys());
        if (externalPackage) {
          if (!dependencyUsage.has(externalPackage))
            dependencyUsage.set(externalPackage, new Set());
          dependencyUsage.get(externalPackage).add(path);
        }
        const absoluteSource = normalized(absolutePath);
        const resolvedImport =
          extname(path).toLowerCase() === ".py"
            ? resolvePythonImport(absoluteSource, specifier, fileSet, target.targetRoot)
            : extname(path).toLowerCase() === ".gleam"
              ? resolveGleamImport(specifier, fileSet, target.targetRoot)
              : new Set([".ex", ".exs"]).has(extname(path).toLowerCase())
                ? resolveElixirImport(specifier, fileSet, target.targetRoot)
                : resolveRelativeImport(absoluteSource, specifier, fileSet);
        if (!resolvedImport) continue;
        const targetPath = relativeByAbsolute.get(resolvedImport);
        if (!targetPath || targetPath === path) continue;
        const evidenceId = addEvidence(
          "observed",
          relation.confidence,
          `${path} declares a source dependency on ${targetPath}`,
          [
            {
              path,
              line: relation.line,
              kind: "relation",
              analyzer: relation.analyzer,
              operation: relation.form,
            },
            { path: targetPath, kind: "file" },
          ],
          ["Static import does not prove the path executes at runtime."],
        );
        edges.push({
          id: stableId("edge", `imports:${path}:${targetPath}`),
          kind: "imports",
          from: stableId("file", path),
          to: stableId("file", targetPath),
          confidence: relation.confidence,
          evidenceIds: [evidenceId],
        });
        if (tests.includes(path) && !tests.includes(targetPath)) {
          const testEvidenceId = addEvidence(
            "observed",
            relation.confidence,
            `${path} directly imports ${targetPath} from test source`,
            [
              {
                path,
                line: relation.line,
                kind: "relation",
                analyzer: relation.analyzer,
                operation: "test-import",
              },
              { path: targetPath, kind: "file" },
            ],
            ["An import proves a test dependency, not that a specific behavior is asserted."],
          );
          edges.push({
            id: stableId("edge", `tests-observed:${path}:${targetPath}`),
            kind: "tests",
            from: stableId("file", path),
            to: stableId("file", targetPath),
            confidence: relation.confidence,
            evidenceIds: [testEvidenceId],
          });
          observedTestTargets.add(path);
        }
      }
    } catch {
      unreadableFiles += 1;
    }
  }
  for (const path of tests) {
    if (observedTestTargets.has(path)) continue;
    const candidate = testCandidate(path, new Set(files));
    if (!candidate) continue;
    const evidenceId = addEvidence(
      "inferred",
      0.45,
      `${path} likely tests ${candidate} based on naming`,
      [
        { path, kind: "name" },
        { path: candidate, kind: "name" },
      ],
      ["Confirm test imports and assertions before treating this relation as observed."],
    );
    edges.push({
      id: stableId("edge", `tests:${path}:${candidate}`),
      kind: "tests",
      from: stableId("file", path),
      to: stableId("file", candidate),
      confidence: 0.45,
      evidenceIds: [evidenceId],
    });
  }

  const dependencies = [];
  for (const name of [...packageDeclarations.keys()].sort()) {
    const manifests = [...(packageSources.get(name) ?? [])].sort();
    const declarations = packageDeclarations.get(name) ?? [];
    const direct = declarations.some((item) => item.direct);
    const lockedVersions = [
      ...new Set(
        declarations
          .filter((item) => item.scope.includes("lock") && item.version)
          .map((item) => item.version),
      ),
    ].sort();
    const usedBy = [...(dependencyUsage.get(name) ?? [])].sort();
    const evidenceId = addEvidence(
      "observed",
      0.99,
      `${name} is declared as an external dependency`,
      declarations.map((item) => ({
        path: item.path,
        line: item.line,
        kind: "manifest",
        analyzer: `${item.parser}-manifest-adapter`,
        operation: `${item.scope}-dependency-declaration`,
      })),
      usedBy.length === 0
        ? [
            "No matching source import was observed within current relationship coverage; runtime or generated use remains possible.",
          ]
        : [],
    );
    const id = stableId("dependency", name);
    nodes.push({
      id,
      kind: "dependency",
      name,
      attributes: { declared: true, direct, observedUsageFiles: usedBy.length },
      evidenceIds: [evidenceId],
    });
    edges.push({
      id: stableId("edge", `depends-on:system:${name}`),
      kind: "depends-on",
      from: "system:root",
      to: id,
      confidence: 0.99,
      evidenceIds: [evidenceId],
    });
    for (const path of usedBy.slice(0, 200))
      edges.push({
        id: stableId("edge", `depends-on:${path}:${name}`),
        kind: "depends-on",
        from: stableId("file", path),
        to: id,
        confidence: 0.94,
        evidenceIds: [evidenceId],
      });
    dependencies.push({
      name,
      scope: [...new Set(declarations.map((item) => item.scope))].sort().join(","),
      direct,
      lockedVersions,
      manifests,
      usedBy,
      evidenceIds: [evidenceId],
    });
  }

  const roots = componentRoots(files, manifestResults);
  const componentFiles = new Map(roots.map((root) => [root, []]));
  for (const path of files) componentFiles.get(componentFor(path, roots)).push(path);
  const components = [];
  for (const root of roots) {
    const ownedFiles = componentFiles.get(root);
    const manifests = manifestFiles.filter((path) => componentFor(path, roots) === root);
    const componentPackages = new Set(
      manifestResults
        .filter((item) => componentFor(item.path, roots) === root)
        .flatMap((item) =>
          item.dependencies.filter((record) => record.direct).map((record) => record.name),
        ),
    );
    const componentCapabilities = [
      ...new Set(
        registry.frameworkPacks
          .filter((pack) =>
            pack.packages.some((candidate) =>
              [...componentPackages].some(
                (name) => name === candidate || name.endsWith(`/${candidate}`),
              ),
            ),
          )
          .flatMap((pack) => pack.signals),
      ),
    ];
    const componentArchetypes = scoreArchetypes(
      ownedFiles.map((path) => (root === "." ? path : path.slice(root.length + 1))),
      componentPackages,
      componentCapabilities,
    );
    const evidenceId = addEvidence(
      "derived",
      root === "." ? 0.96 : 0.9,
      `Component boundary ${root} is derived from workspace and manifest ownership`,
      (manifests.length > 0 ? manifests : [root]).map((path) => ({
        path,
        kind: manifests.includes(path) ? "manifest" : "name",
        analyzer: "component-discovery",
        operation: "workspace-boundary",
      })),
      ["Deployment and runtime boundaries may differ from workspace ownership."],
    );
    const id = stableId("component", root);
    nodes.push({
      id,
      kind: "component",
      name:
        preferences.config.aliases?.[root] ??
        (root === "." ? basename(target.targetRoot) : basename(root)),
      path: root,
      attributes: { files: ownedFiles.length },
      evidenceIds: [evidenceId],
    });
    edges.push({
      id: stableId("edge", `contains:system:component:${root}`),
      kind: "contains",
      from: "system:root",
      to: id,
      confidence: 0.95,
      evidenceIds: [evidenceId],
    });
    components.push({
      id,
      root,
      files: ownedFiles.length,
      manifests,
      archetypes: componentArchetypes,
      primaryArchetype: componentArchetypes[0]?.id ?? "unknown-program",
    });
  }

  const boundarySignals = new Map();
  const addBoundary = (path, signal) => {
    if (!path) return;
    if (!boundarySignals.has(path)) boundarySignals.set(path, new Set());
    boundarySignals.get(path).add(signal);
  };
  for (const path of boundaries) addBoundary(path, "conventional-boundary-path");
  for (const component of components.filter((item) => item.root !== "."))
    addBoundary(component.root, "workspace-or-manifest-root");
  const incoming = new Map();
  for (const edge of edges.filter((item) => item.kind === "imports"))
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  for (const node of nodes.filter((item) => item.path && (incoming.get(item.id) ?? 0) >= 3))
    addBoundary(dirname(node.path), "relationship-hub");
  for (const hint of preferences.config.boundaryHints ?? []) {
    const hintPath = typeof hint === "string" ? hint : hint.path;
    if (scope === "." || hintPath === scope || hintPath.startsWith(`${scope}/`))
      addBoundary(hintPath, "user-configured-hint");
  }
  const boundaryEvidence = [...boundarySignals.entries()]
    .map(([path, signals]) => ({
      path,
      signals: [...signals].sort(),
      confidence: signals.has("user-configured-hint")
        ? 1
        : Math.min(0.98, 0.62 + signals.size * 0.12),
    }))
    .sort(
      (left, right) => right.confidence - left.confidence || left.path.localeCompare(right.path),
    );

  const archetypes = scoreArchetypes(files, packages, capabilities);
  const priorities = priorityProfile(detectedPacks, archetypes, evidenceByPack);
  const sourceCount = [...languageCounts.values()].reduce((sum, count) => sum + count, 0);
  const languages = [...languageCounts.entries()]
    .map(([id, count]) => ({
      id,
      files: count,
      share: sourceCount === 0 ? 0 : Number((count / sourceCount).toFixed(4)),
    }))
    .sort((left, right) => right.files - left.files || left.id.localeCompare(right.id));
  const supportedRelationLanguages = new Set([
    "JavaScript",
    "TypeScript",
    "Python",
    "Gleam",
    "Elixir",
  ]);
  const relationLanguagesSupported = languages
    .map((item) => item.id)
    .filter((language) => supportedRelationLanguages.has(language));
  const relationLanguagesUnsupported = languages
    .map((item) => item.id)
    .filter((language) => !supportedRelationLanguages.has(language));
  const truncated =
    discovered.length > files.length ||
    manifestFiles.length > maxManifestFiles ||
    relationCandidates.length > relationFilesRead + skippedLargeFiles ||
    relationBytesRead >= maxRelationBytes;
  const reasonCodes = [];
  if (scope !== ".") reasonCodes.push("scoped-analysis");
  if (discovered.length > files.length) reasonCodes.push("file-limit-reached");
  if (manifestFiles.length > maxManifestFiles) reasonCodes.push("manifest-file-limit-reached");
  if (relationCandidates.length > relationFilesRead + skippedLargeFiles)
    reasonCodes.push("relation-file-limit-or-budget-reached");
  if (relationBytesRead >= maxRelationBytes) reasonCodes.push("relation-byte-budget-reached");
  if (skippedLargeFiles > 0) reasonCodes.push("oversized-relation-files-skipped");
  if (unreadableFiles > 0) reasonCodes.push("unreadable-files");
  if (relationshipDiagnostics.some((item) => item.severity === "error"))
    reasonCodes.push("relationship-parser-errors");
  if (relationshipDiagnostics.some((item) => item.code === "computed-module-specifier"))
    reasonCodes.push("computed-module-specifiers-unresolved");
  if (parserDiagnostics.some((item) => item.severity === "error"))
    reasonCodes.push("manifest-parser-errors");
  if (relationLanguagesUnsupported.length > 0)
    reasonCodes.push("unsupported-relationship-languages");
  const uncertainties = [];
  if (scope !== ".")
    uncertainties.push(
      `Analysis was intentionally scoped to ${scope}; conclusions do not cover files outside that scope.`,
    );
  if (truncated)
    uncertainties.push(
      "Coverage limits were reached; unmodeled files or relationships may change conclusions.",
    );
  if (detectedPacks.length === 0)
    uncertainties.push(
      "No language or framework pack matched; analysis must begin with manual ecosystem discovery.",
    );
  if (entryPoints.length === 0)
    uncertainties.push(
      "No conventional entry point was detected; startup and invocation paths remain unresolved.",
    );
  if (boundaries.length === 0)
    uncertainties.push(
      boundaryEvidence.length > 0
        ? "No conventional boundary directory names were detected; learned workspace, relationship-hub, or user-hint candidates still require verification."
        : "No boundary candidates were detected; trust and data-flow boundaries require manual tracing.",
    );
  if (relationLanguagesUnsupported.length > 0)
    uncertainties.push(
      `Bundled local relation resolution is unavailable for: ${relationLanguagesUnsupported.join(", ")}. Use a language-aware graph, compiler, or LSP before claiming consumers or call paths.`,
    );
  uncertainties.push(
    "Static relations do not establish runtime frequency, latency, data volume, or failure behavior.",
  );
  uncertainties.push(
    "Purpose and business criticality are inferred from repository evidence until confirmed by the user or authoritative project documentation.",
  );
  return programModelSchema.parse({
    schemaVersion: MODEL_VERSION,
    generatedAt,
    target: { root: target.targetRoot, excludedSkillPath: target.relativeSkillRoot, scope },
    coverage: {
      status: truncated || reasonCodes.length > 0 ? "partial" : "complete",
      reasonCodes: [...new Set(reasonCodes)],
      discoveredFiles: discovered.length,
      modeledFiles: files.length,
      manifestFilesDiscovered: manifestFiles.length,
      manifestFilesRead: Math.min(manifestFiles.length, maxManifestFiles),
      relationFilesRead,
      relationBytesRead,
      fileLimit: maxFiles,
      manifestFileLimit: maxManifestFiles,
      relationFileLimit: maxRelationFiles,
      relationReadBudget: maxRelationBytes,
      truncated,
      skippedLargeFiles,
      unreadableFiles,
      relationLanguagesSupported,
      relationLanguagesUnsupported,
      parserDiagnostics: [...parserDiagnostics, ...relationshipDiagnostics],
    },
    profile: {
      archetypes,
      primaryArchetype: archetypes[0]?.id ?? "unknown-program",
      components,
      languages,
      technologies: detectedPacks.map((pack) => pack.id).sort(),
      capabilities,
      entryPoints: entryPoints.slice(0, 100),
      tests: tests.slice(0, 200),
      boundaries: boundaryEvidence.map((item) => item.path).slice(0, 200),
      boundaryEvidence: boundaryEvidence.slice(0, 200),
      criticalWorkflows: (preferences.config.criticalWorkflows ?? []).slice(0, 100),
      priorities,
      uncertainties,
    },
    packs: detectedPacks,
    dependencies,
    evidence,
    nodes: deduplicateIdentities(nodes, "node"),
    edges: deduplicateIdentities(edges, "edge"),
  });
}

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
    ],
    unresolved: model.profile.uncertainties,
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
