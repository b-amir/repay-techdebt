import { access, realpath, readdir, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { projectStoragePaths } from "./private-storage.js";

export const skillRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export class TargetRootError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "TargetRootError";
    this.code = code;
    this.details = details;
  }
}

export function isSameOrInside(candidate, parent) {
  const pathFromParent = relative(resolve(parent), resolve(candidate));
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." &&
      !pathFromParent.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromParent))
  );
}

const PROJECT_MARKERS = new Set([
  "package.json",
  "pyproject.toml",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "mix.exs",
  "Gemfile",
]);
const NESTED_SCAN_IGNORES = new Set([".git", ".hg", ".svn", "node_modules", "vendor"]);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function hasProjectMarker(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && PROJECT_MARKERS.has(entry.name));
  } catch {
    return false;
  }
}

async function findGitRoot(directory) {
  let current = directory;
  while (true) {
    if (await exists(resolve(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

async function nestedRepositoryCandidates(targetRoot, canonicalSkillRoot, maxDepth = 2) {
  const candidates = [];
  async function visit(directory, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || NESTED_SCAN_IGNORES.has(entry.name)) continue;
      const child = resolve(directory, entry.name);
      if (isSameOrInside(child, canonicalSkillRoot)) continue;
      const [gitMarker, projectMarker] = await Promise.all([
        exists(resolve(child, ".git")),
        hasProjectMarker(child),
      ]);
      if (gitMarker && projectMarker) {
        const storage = projectStoragePaths(child);
        candidates.push({
          path: child,
          name: basename(child),
          existingMemory: await exists(resolve(storage.privateRoot, "config.json")),
        });
        continue;
      }
      await visit(child, depth + 1);
    }
  }
  await visit(targetRoot, 1);
  return candidates.sort((left, right) => left.path.localeCompare(right.path));
}

export async function resolveTargetRoot(input) {
  if (!input) {
    throw new TargetRootError(
      "An explicit target repository path is required; the current directory is never assumed.",
      "TARGET_REQUIRED",
    );
  }

  const requestedTarget = resolve(input);
  let targetRoot;
  try {
    const details = await stat(requestedTarget);
    if (!details.isDirectory()) {
      throw new TargetRootError(
        `Target repository path is not a directory: ${requestedTarget}`,
        "TARGET_NOT_DIRECTORY",
        { requestedTarget },
      );
    }
    targetRoot = await realpath(requestedTarget);
  } catch (error) {
    if (error instanceof TargetRootError) throw error;
    throw new TargetRootError(
      `Target repository path cannot be resolved: ${requestedTarget}`,
      "TARGET_UNAVAILABLE",
      { requestedTarget },
    );
  }

  const canonicalSkillRoot = await realpath(skillRoot);
  if (isSameOrInside(targetRoot, canonicalSkillRoot)) {
    throw new TargetRootError(
      "Refusing to analyze the repay-techdebt skill directory or anything inside it. Pass the repository whose technical debt should be analyzed.",
      "TARGET_IS_SKILL",
      { requestedTarget: targetRoot },
    );
  }

  const [rootHasMarker, nestedCandidates] = await Promise.all([
    hasProjectMarker(targetRoot),
    nestedRepositoryCandidates(targetRoot, canonicalSkillRoot),
  ]);
  const skillIsNested = isSameOrInside(canonicalSkillRoot, targetRoot);
  const nestedHasExistingMemory = nestedCandidates.some((candidate) => candidate.existingMemory);
  if (
    !skillIsNested &&
    nestedCandidates.length > 0 &&
    (!rootHasMarker || nestedHasExistingMemory)
  ) {
    throw new TargetRootError(
      "The supplied directory looks like a workspace containing nested project repositories. Choose the repository to analyze explicitly.",
      "TARGET_AMBIGUOUS",
      {
        requestedTarget: targetRoot,
        candidates: nestedCandidates,
        targetWrites: [],
        requiredAction: "Choose one candidate path and rerun the command with that exact target.",
        fallback: "none; the workspace root is not selected automatically",
      },
    );
  }

  const relativeSkillRoot = skillIsNested
    ? relative(targetRoot, canonicalSkillRoot).replaceAll("\\", "/")
    : null;

  return {
    targetRoot,
    relativeSkillRoot,
    identity: {
      name: basename(targetRoot),
      gitRoot: await findGitRoot(targetRoot),
      nestedCandidates,
    },
  };
}

export function formatTargetError(error) {
  if (!(error instanceof TargetRootError)) return null;
  const {
    requiredAction = "Provide the explicit root path of the repository to analyze.",
    fallback = "none; analyzing the skill repository is not an allowed fallback",
    ...details
  } = error.details;
  return JSON.stringify({
    type: "target-error",
    code: error.code,
    reason: error.message,
    ...details,
    requiredAction,
    fallback,
  });
}
