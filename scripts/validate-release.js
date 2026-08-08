#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parse, parseAllDocuments } from "yaml";
import { selectRuntimeLockDocument } from "../src/foundations/runtime-lock.js";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]),
  );
}

function isProjectLockDocument(value) {
  if (!value || typeof value !== "object") return false;
  if (value.overrides && Object.keys(value.overrides).length > 0) return true;
  const rootImporter = value.importers?.["."];
  return Boolean(
    rootImporter &&
    ["dependencies", "devDependencies", "optionalDependencies"].some(
      (key) => rootImporter[key] && Object.keys(rootImporter[key]).length > 0,
    ),
  );
}

export function validateReleaseLock(lockText, workspaceText) {
  const documents = parseAllDocuments(lockText);
  const parseErrors = documents.flatMap((document) => document.errors ?? []);
  if (parseErrors.length > 0) {
    return { ok: false, reason: `pnpm-lock.yaml is invalid YAML: ${parseErrors[0].message}` };
  }
  const values = documents.map((document) => document.toJS());
  const projectDocuments = values.filter(isProjectLockDocument);
  if (projectDocuments.length !== 1) {
    return {
      ok: false,
      reason:
        "pnpm-lock.yaml must contain exactly one project dependency document; regenerate it with pinned pnpm",
    };
  }

  const workspace = parse(workspaceText) ?? {};
  const workspaceOverrides = stable(workspace.overrides ?? {});
  const lockOverrides = stable(projectDocuments[0].overrides ?? {});
  if (JSON.stringify(workspaceOverrides) !== JSON.stringify(lockOverrides)) {
    return {
      ok: false,
      reason:
        "pnpm-lock.yaml overrides do not match pnpm-workspace.yaml; regenerate both with pinned pnpm",
    };
  }
  try {
    const runtimeLock = selectRuntimeLockDocument(lockText);
    const runtimeDocuments = parseAllDocuments(runtimeLock);
    const runtimeErrors = runtimeDocuments.flatMap((document) => document.errors ?? []);
    if (runtimeDocuments.length !== 1 || runtimeErrors.length > 0) {
      return {
        ok: false,
        reason: "The materialized runtime lock must be one valid YAML document",
      };
    }
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  return {
    ok: true,
    sourceDocumentCount: documents.length,
    runtimeDocumentCount: 1,
    projectDocumentCount: 1,
  };
}

async function validateRelease() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const requiredReviews = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--help" || args[index] === "-h") {
      process.stdout.write(
        "Usage: node scripts/validate-release.js [--require-independent-review <judgment.json>]\n",
      );
      return;
    }
    if (args[index] !== "--require-independent-review")
      throw new Error(`Unknown option: ${args[index]}`);
    const reviewPath = args[++index];
    if (!reviewPath) throw new Error("Missing path for --require-independent-review");
    requiredReviews.push(reviewPath);
  }
  process.stdout.write(`Validating release from: ${root}\n`);
  let failed = false;

  // 1. Verify package.json
  try {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    if (!pkg.name || !pkg.version) {
      process.stderr.write("❌ package.json must contain a name and version\n");
      failed = true;
    }
  } catch (err) {
    process.stderr.write(`❌ Failed to read package.json: ${err.message}\n`);
    failed = true;
  }

  // 2. Verify SKILL.md frontmatter
  try {
    const skill = await readFile(join(root, "SKILL.md"), "utf8");
    if (!skill.startsWith("---")) {
      process.stderr.write("❌ SKILL.md must begin with YAML frontmatter\n");
      failed = true;
    } else if (!skill.includes("name:") || !skill.includes("description:")) {
      process.stderr.write("❌ SKILL.md frontmatter must declare name and description\n");
      failed = true;
    }
  } catch (err) {
    process.stderr.write(`❌ Failed to read SKILL.md: ${err.message}\n`);
    failed = true;
  }

  // 3. Verify the Vite+ source lock can materialize the single project lock
  // consumed by pnpm during a clean skill-runtime installation.
  try {
    const [lockText, workspaceText] = await Promise.all([
      readFile(join(root, "pnpm-lock.yaml"), "utf8"),
      readFile(join(root, "pnpm-workspace.yaml"), "utf8"),
    ]);
    const lockCheck = validateReleaseLock(lockText, workspaceText);
    if (!lockCheck.ok) {
      process.stderr.write(`❌ ${lockCheck.reason}\n`);
      failed = true;
    }
  } catch (err) {
    process.stderr.write(`❌ Failed to validate pnpm release lock: ${err.message}\n`);
    failed = true;
  }

  // 4. Verify bundle size (e.g., node_modules excluded from git, but let's check repo size)
  try {
    // A real implementation would recursively stat.
    // For this demonstration, we'll just check if SKILL.md is reasonable.
    const s = await stat(join(root, "SKILL.md"));
    if (s.size > 1024 * 500) {
      process.stderr.write("❌ SKILL.md is unreasonably large (> 500KB)\n");
      failed = true;
    }
  } catch {
    failed = true;
  }

  // 5. Forward-test review provenance is optional by default, but release
  // callers can require one or more clean independent judgments explicitly.
  for (const reviewPath of requiredReviews) {
    try {
      const judgment = JSON.parse(await readFile(reviewPath, "utf8"));
      if (!new Set(["independent-agent", "human"]).has(judgment.reviewerProvenance)) {
        process.stderr.write(
          `❌ Required review is not independent: ${reviewPath} (${judgment.reviewerProvenance ?? "missing provenance"})\n`,
        );
        failed = true;
      }
      if (!Array.isArray(judgment.mustFix) || judgment.mustFix.length > 0) {
        process.stderr.write(`❌ Required review still has mustFix items: ${reviewPath}\n`);
        failed = true;
      }
    } catch (err) {
      process.stderr.write(`❌ Failed to read required review ${reviewPath}: ${err.message}\n`);
      failed = true;
    }
  }

  if (failed) {
    process.stderr.write("\nRelease validation FAILED.\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("\n✅ Release validation passed!\n");
  }
}

validateRelease().catch((err) => {
  process.stderr.write(`Unexpected error: ${err.stack || err}\n`);
  process.exitCode = 1;
});
