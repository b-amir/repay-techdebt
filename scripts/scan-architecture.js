import { readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { globby } from "globby";
import { z } from "zod";
import {
  bundledBinary,
  formatTargetError,
  isSameOrInside,
  resolveTargetRoot,
  runCommand,
  sanitizeDiagnostic,
} from "../src/tools/tooling.js";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".repay-techdebt",
  ".serena",
  ".venv",
  "__pycache__",
  "build",
  "dist",
  "graphify-out",
  "node_modules",
]);
const TREE_DEPTH = 3;
const DEFAULT_FILE_SCAN_LIMIT = 20_000;
const IGNORED_FILE = /^(?:\.graphifyignore|repomix-output\.)/;
const cruiserSchema = z.object({
  modules: z.array(
    z.object({
      source: z.string(),
      dependencies: z
        .array(
          z.object({
            resolved: z.string().optional(),
            module: z.string().optional(),
            circular: z.boolean().optional(),
          }),
        )
        .default([]),
    }),
  ),
});

function printHelp() {
  process.stdout.write(
    "Usage: node scan-architecture.js <target-project-directory> [--fallback tree] [--format markdown|json] [--max-files 1..1000000] [--scope <relative-path>] [--resume-after <cursor>]\n\n",
  );
  process.stdout.write("Run bundled dependency-cruiser without modifying the analyzed project.\n");
  process.stdout.write(
    "Without --fallback tree, a cruiser failure exits with code 2 so the agent must ask before downgrading.\n",
  );
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  let fallback = null;
  let format = "markdown";
  let maxFiles = DEFAULT_FILE_SCAN_LIMIT;
  let scope = ".";
  let resumeAfter = null;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--fallback") {
      fallback = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--format") {
      format = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--max-files") {
      maxFiles = Number(argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--scope") {
      scope = String(argv[index + 1] ?? "")
        .replaceAll("\\", "/")
        .replace(/^\.\//, "");
      index += 1;
    } else if (argv[index] === "--resume-after") {
      resumeAfter = String(argv[index + 1] ?? "").replaceAll("\\", "/");
      index += 1;
    } else {
      positional.push(argv[index]);
    }
  }
  if (fallback !== null && fallback !== "tree")
    throw new Error("--fallback currently accepts only tree");
  if (!new Set(["json", "markdown"]).has(format))
    throw new Error("--format must be markdown or json");
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 1_000_000)
    throw new Error("--max-files must be an integer from 1 to 1000000");
  for (const [name, value] of [
    ["--scope", scope],
    ["--resume-after", resumeAfter],
  ])
    if (value && (value.startsWith("/") || value.split("/").includes("..") || value.includes("\0")))
      throw new Error(`${name} must be a safe target-relative path`);
  if (positional.length > 1) throw new Error("Expected exactly one target project directory");
  return {
    fallback,
    format,
    maxFiles,
    resumeAfter,
    scope: scope || ".",
    targetInput: positional[0],
  };
}

async function sortedEntries(directory, excludedRoot) {
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => !entry.isSymbolicLink())
    .filter((entry) => !entry.isFile() || !IGNORED_FILE.test(entry.name))
    .filter((entry) => !(entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)))
    .filter(
      (entry) => !excludedRoot || !isSameOrInside(resolve(directory, entry.name), excludedRoot),
    )
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
}

async function buildTree(directory, excludedRoot, depth = 0, prefix = "") {
  if (depth >= TREE_DEPTH) return [];
  let entries;
  try {
    entries = await sortedEntries(directory, excludedRoot);
  } catch {
    return [];
  }
  const lines = [];
  for (const [index, entry] of entries.entries()) {
    const isLast = index === entries.length - 1;
    lines.push(
      `${prefix}${isLast ? "└── " : "├── "}${entry.name}${entry.isDirectory() ? "/" : ""}`,
    );
    if (entry.isDirectory()) {
      lines.push(
        ...(await buildTree(
          resolve(directory, entry.name),
          excludedRoot,
          depth + 1,
          `${prefix}${isLast ? "    " : "│   "}`,
        )),
      );
    }
  }
  return lines;
}

async function summarizeFiles(projectRoot, relativeSkillRoot, options) {
  const extensionCounts = new Map();
  const topLevelCounts = new Map();
  const ignore = [
    ...[...IGNORED_DIRECTORIES].map((name) => `**/${name}/**`),
    "**/.graphifyignore",
    "**/repomix-output.*",
    ...(relativeSkillRoot ? [`${relativeSkillRoot}/**`] : []),
  ];
  const allFiles = (
    await globby("**/*", {
      cwd: projectRoot,
      absolute: false,
      dot: true,
      followSymbolicLinks: false,
      gitignore: true,
      ignore,
      onlyFiles: true,
    })
  )
    .map((path) => path.replaceAll("\\", "/"))
    .filter(
      (path) =>
        options.scope === "." || path === options.scope || path.startsWith(`${options.scope}/`),
    )
    .sort();
  const start = options.resumeAfter
    ? allFiles.findIndex((path) => path === options.resumeAfter) + 1
    : 0;
  if (options.resumeAfter && start === 0)
    throw new Error("--resume-after cursor was not found in the selected scope");
  const page = allFiles.slice(start, start + options.maxFiles);
  for (const path of page) {
    const extension = extname(path).toLowerCase() || "[no extension]";
    extensionCounts.set(extension, (extensionCounts.get(extension) ?? 0) + 1);
    const topLevel = path.split("/")[0] || ".";
    topLevelCounts.set(topLevel, (topLevelCounts.get(topLevel) ?? 0) + 1);
  }
  const remainingFiles = Math.max(0, allFiles.length - start - page.length);
  const reasonCodes = [];
  if (remainingFiles > 0) reasonCodes.push("file-limit-reached");
  if (options.scope !== ".") reasonCodes.push("scoped-analysis");
  if (options.resumeAfter) reasonCodes.push("resumed-page");
  const top = (counts) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12);
  return {
    discoveredFiles: allFiles.length,
    scannedFiles: page.length,
    status: reasonCodes.length > 0 ? "partial" : "complete",
    reasonCodes,
    fileLimit: options.maxFiles,
    scope: options.scope,
    resumeAfter: options.resumeAfter,
    nextCursor: remainingFiles > 0 ? page.at(-1) : null,
    remainingFiles,
    truncated: remainingFiles > 0,
    extensions: top(extensionCounts),
    topLevel: top(topLevelCounts),
  };
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function cruise(projectRoot, relativeSkillRoot, scope = ".") {
  const command = bundledBinary("depcruise");
  if (!command) return { ok: false, reason: "bundled depcruise binary is missing" };
  const excludedDirectories = [
    "node_modules",
    "dist",
    "build",
    ".git",
    ".repay-techdebt",
    ".serena",
    ".venv",
    "__pycache__",
    "graphify-out",
  ];
  const excludePattern = `(^|/)(${excludedDirectories.map(escapeRegularExpression).join("|")})(/|$)${
    relativeSkillRoot ? `|^${escapeRegularExpression(relativeSkillRoot)}(/|$)` : ""
  }`;
  const result = await runCommand(
    command,
    ["--output-type", "json", "--no-config", "--exclude", excludePattern, scope],
    { cwd: projectRoot, timeout: 120_000, maxBuffer: 50 * 1024 * 1024 },
  );
  if (!result.ok) return { ok: false, reason: result.reason || "dependency-cruiser failed" };
  try {
    const parsed = cruiserSchema.parse(JSON.parse(result.stdout));
    if (parsed.modules.length === 0) {
      return {
        ok: false,
        reason: "dependency-cruiser found no supported JavaScript or TypeScript modules",
      };
    }
    const edges = parsed.modules.flatMap((module) =>
      module.dependencies
        .filter((dependency) => dependency.resolved || dependency.module)
        .map((dependency) => ({
          from: module.source,
          to: dependency.resolved || dependency.module,
          circular: dependency.circular === true,
        })),
    );
    return { ok: true, modules: parsed.modules.length, edges };
  } catch (error) {
    return {
      ok: false,
      reason: `invalid dependency-cruiser JSON: ${sanitizeDiagnostic(error.message)}`,
    };
  }
}

function table(rows, firstHeading, secondHeading) {
  return [
    `| ${firstHeading} | ${secondHeading} |`,
    "| --- | ---: |",
    ...rows.map(([label, count]) => `| ${label} | ${count} |`),
  ].join("\n");
}

function renderMarkdown(result) {
  const lines = [
    "# Architecture Scan",
    "",
    `Project root: \`${result.projectRoot}\``,
    "",
    "## Tool Status",
    "",
    `- dependency-cruiser: **${result.backend.status}**${result.backend.reason ? ` — ${result.backend.reason}` : ""}`,
    `- fallback: **${result.backend.fallbackUsed ? "tree accepted" : "not used"}**`,
    "",
    "## Module Summary",
    "",
    `Scanned ${result.summary.scannedFiles} of ${result.summary.discoveredFiles} files in scope \`${result.summary.scope}\`; coverage is **${result.summary.status}**${result.summary.truncated ? ` (limit ${result.summary.fileLimit} reached; ${result.summary.remainingFiles} remain; resume after \`${result.summary.nextCursor}\`)` : ""}.`,
    "",
    table(result.summary.extensions, "Extension", "Files"),
    "",
    table(result.summary.topLevel, "Top-level area", "Files"),
    "",
  ];
  if (result.graph) {
    lines.push(
      "## Dependency Relations",
      "",
      `Found ${result.graph.modules} modules and ${result.graph.edges.length} edges.`,
    );
    if (result.graph.edges.length > 0) {
      lines.push(
        "",
        "Representative relations:",
        "",
        ...result.graph.edges
          .slice(0, 50)
          .map(
            (edge) => `- \`${edge.from}\` → \`${edge.to}\`${edge.circular ? " (circular)" : ""}`,
          ),
      );
    }
    const circular = result.graph.edges.filter((edge) => edge.circular);
    if (circular.length > 0) {
      lines.push(
        "",
        "Circular edges:",
        "",
        ...circular.slice(0, 50).map((edge) => `- \`${edge.from}\` → \`${edge.to}\``),
      );
    }
  } else {
    lines.push("## Structural Tree", "", "```text", result.treeRoot, ...result.tree, "```");
  }
  return `${lines.join("\n")}\n`;
}

try {
  const options = parseArguments(process.argv.slice(2));
  const target = await resolveTargetRoot(options.targetInput);
  const excludedRoot = target.relativeSkillRoot
    ? resolve(target.targetRoot, target.relativeSkillRoot)
    : null;
  const summary = await summarizeFiles(target.targetRoot, target.relativeSkillRoot, options);
  const graphResult = await cruise(target.targetRoot, target.relativeSkillRoot, options.scope);
  if (!graphResult.ok && options.fallback !== "tree") {
    process.stderr.write(
      `${JSON.stringify({
        type: "tool-failure",
        tool: "dependency-cruiser",
        reason: graphResult.reason,
        fallback: "rerun with --fallback tree only after the user accepts",
      })}\n`,
    );
    process.exit(2);
  }
  const treeDirectory =
    options.scope === "." ? target.targetRoot : resolve(target.targetRoot, options.scope);
  const result = {
    projectRoot: target.targetRoot,
    excludedSkillPath: target.relativeSkillRoot,
    summary,
    backend: {
      status: graphResult.ok ? "succeeded" : "failed",
      reason: graphResult.ok ? undefined : graphResult.reason,
      fallbackUsed: !graphResult.ok,
    },
    graph: graphResult.ok ? { modules: graphResult.modules, edges: graphResult.edges } : null,
    treeRoot: `${treeDirectory.split(/[\\/]/).pop() || treeDirectory}/`,
    tree: graphResult.ok ? [] : await buildTree(treeDirectory, excludedRoot),
  };
  process.stdout.write(
    options.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : renderMarkdown(result),
  );
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? `Architecture scan failed: ${error.message}`}\n`,
  );
  process.exitCode = 1;
}
