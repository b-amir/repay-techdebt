import { basename } from "node:path";
import pLimit from "p-limit";
import parseDiff from "parse-diff";
import { z } from "zod";
import { formatTargetError, resolveTargetRoot, runCommand } from "./lib/tooling.js";

const LOCKFILES = new Set([
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const IMAGE_EXTENSIONS = /\.(?:avif|bmp|gif|ico|jpe?g|png|svg|tiff?|webp)$/i;
const GENERATED_DIRECTORY =
  /(^|\/)(?:\.repay-techdebt|\.serena|build|coverage|dist|graphify-out|out|target)(\/|$)/;
const GENERATED_FILE = /(^|\/)(?:\.graphifyignore|repomix-output\.[^/]+)$/;
const resultSchema = z.array(
  z.object({
    file: z.string(),
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
    hunks: z.array(
      z.object({
        oldStart: z.number().int(),
        oldLines: z.number().int(),
        newStart: z.number().int(),
        newLines: z.number().int(),
        content: z.string(),
      }),
    ),
    diff: z.string(),
  }),
);

function printHelp() {
  process.stdout.write(
    "Usage: node get-pr-changes.js <target-project-directory> [git-ref-or-range]\n\n",
  );
  process.stdout.write("Print educationally relevant Git changes as structured JSON.\n");
  process.stdout.write(
    "Use this only after GitHub MCP is unavailable, failed, or the user selected local Git.\n",
  );
}

async function git(projectRoot, args) {
  const result = await runCommand("git", args, {
    cwd: projectRoot,
    timeout: 60_000,
    maxBuffer: 50 * 1024 * 1024,
  });
  if (!result.ok) throw new Error(result.reason || `git ${args[0]} failed`);
  return result.stdout;
}

async function resolveRevisionArguments(projectRoot, target) {
  await git(projectRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (!target) {
    await git(projectRoot, ["rev-parse", "--verify", "HEAD~1^{commit}"]);
    return ["HEAD~1", "HEAD"];
  }
  if (target.startsWith("-")) throw new Error("Git refs must not begin with '-'");
  if (target.includes("..")) {
    await git(projectRoot, ["rev-list", "--max-count=1", target]);
    return [target];
  }
  const targetCommit = (
    await git(projectRoot, ["rev-parse", "--verify", `${target}^{commit}`])
  ).trim();
  const headCommit = (await git(projectRoot, ["rev-parse", "--verify", "HEAD^{commit}"])).trim();
  if (targetCommit === headCommit) {
    await git(projectRoot, ["rev-parse", "--verify", `${target}^`]);
    return [`${target}^`, target];
  }
  return [`${target}...HEAD`];
}

function shouldInclude(file, relativeSkillRoot) {
  const normalized = file.replaceAll("\\", "/");
  return (
    (!relativeSkillRoot ||
      (normalized !== relativeSkillRoot && !normalized.startsWith(`${relativeSkillRoot}/`))) &&
    !LOCKFILES.has(basename(normalized)) &&
    !IMAGE_EXTENSIONS.test(normalized) &&
    !GENERATED_DIRECTORY.test(normalized) &&
    !GENERATED_FILE.test(normalized)
  );
}

async function changedFiles(projectRoot, revisions, relativeSkillRoot) {
  const output = await git(projectRoot, [
    "diff",
    "--name-only",
    "--no-ext-diff",
    "--diff-filter=ACDMRTUXB",
    "-z",
    ...revisions,
    "--",
  ]);
  return output
    .split("\0")
    .filter(Boolean)
    .filter((file) => shouldInclude(file, relativeSkillRoot))
    .sort();
}

function normalizeParsedDiff(rawDiff, fallbackFile) {
  const parsed = parseDiff(rawDiff)[0];
  if (!parsed) return { file: fallbackFile, additions: 0, deletions: 0, hunks: [], diff: rawDiff };
  return {
    file: parsed.to === "/dev/null" ? parsed.from : parsed.to || parsed.from || fallbackFile,
    additions: parsed.additions ?? 0,
    deletions: parsed.deletions ?? 0,
    hunks: (parsed.chunks ?? []).map((chunk) => ({
      oldStart: chunk.oldStart,
      oldLines: chunk.oldLines,
      newStart: chunk.newStart,
      newLines: chunk.newLines,
      content: chunk.content,
    })),
    diff: rawDiff,
  };
}

try {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.length > 2)
    throw new Error("Expected a target project directory and an optional Git ref or range");
  const target = await resolveTargetRoot(args[0]);
  const revisions = await resolveRevisionArguments(target.targetRoot, args[1]);
  const files = await changedFiles(target.targetRoot, revisions, target.relativeSkillRoot);
  const limit = pLimit(6);
  const entries = await Promise.all(
    files.map((file) =>
      limit(async () => {
        const diff = await git(target.targetRoot, [
          "diff",
          "--no-ext-diff",
          "--no-color",
          "--unified=40",
          ...revisions,
          "--",
          file,
        ]);
        return normalizeParsedDiff(diff, file);
      }),
    ),
  );
  process.stdout.write(`${JSON.stringify(resultSchema.parse(entries), null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? `Git change extraction failed: ${error.message}`}\n`,
  );
  process.exitCode = 1;
}
