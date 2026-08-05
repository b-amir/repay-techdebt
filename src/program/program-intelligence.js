import { lstat, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { z } from "zod";
import { buildCoverage } from "./program-coverage.js";
import { MODEL_VERSION, programModelSchema } from "./program-model-schema.js";
export {
  MODEL_VERSION,
  evidenceSchema,
  programNodeSchema,
  programEdgeSchema,
  programModelSchema,
  analysisPlanSchema,
} from "./program-model-schema.js";
export { planAnalysis, summarizeModel } from "./plan-analysis-core.js";
import { stableId } from "./identity.js";
import { parseManifest } from "./manifest-intelligence.js";
import { locateProjectMemory } from "../foundations/private-storage.js";
import { extractRelationships } from "./relationship-intelligence.js";
import { skillRoot } from "../foundations/targeting.js";
import {
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_MANIFEST_FILES,
  DEFAULT_MAX_RELATION_FILES,
  DEFAULT_READ_BUDGET,
  MAX_RELATION_FILE_SIZE,
  boundaryPattern,
  classifyFile,
  conventionalBoundaryRoot,
  deploymentPattern,
  discoverTargetFiles,
  extensionLanguage,
  manifestNames,
  normalized,
  wildcardMatches,
} from "./program-scan.js";

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
    detect: z.object({
      extensions: z.array(z.string()),
      manifests: z.array(z.string()),
    }),
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

/**
 * @param {string} specifier
 * @param {Iterable<string>} [declaredNames]
 */
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
  const { scope, discovered, files, absoluteFiles } = await discoverTargetFiles({
    targetRoot: target.targetRoot,
    relativeSkillRoot: target.relativeSkillRoot,
    scope: options.scope,
    maxFiles,
  });
  const generatedAt = new Date().toISOString();
  const registry = await loadPackRegistry();
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
        ...parsed.diagnostics.map((item) => ({
          path,
          parser: parsed.parser,
          ...item,
        })),
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
      (path) => ({
        path,
        kind: manifestFiles.includes(path) ? "manifest" : "file",
      }),
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
  const coverage = buildCoverage({
    scope,
    discoveredLength: discovered.length,
    filesLength: files.length,
    manifestFilesLength: manifestFiles.length,
    maxManifestFiles,
    relationCandidateCount: relationCandidates.length,
    relationFilesRead,
    skippedLargeFiles,
    maxRelationFiles,
    relationBytesRead,
    maxRelationBytes,
    unreadableFiles,
    maxFiles,
    relationLanguagesSupported,
    relationLanguagesUnsupported,
    parserDiagnostics,
    relationshipDiagnostics,
  });
  const uncertainties = [];
  if (scope !== ".")
    uncertainties.push(
      `Analysis was intentionally scoped to ${scope}; conclusions do not cover files outside that scope.`,
    );
  if (coverage.truncated)
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
    target: {
      root: target.targetRoot,
      excludedSkillPath: target.relativeSkillRoot,
      scope,
    },
    coverage,
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
