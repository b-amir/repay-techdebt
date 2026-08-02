import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { promisify } from "node:util";
import { isSameOrInside, resolveTargetRoot, skillRoot } from "../src/foundations/targeting.js";
import {
  LOCAL_MEMORY_DIRECTORY,
  pathExists,
  projectStoragePaths,
} from "../src/foundations/private-storage.js";
import { resolveMemoryPaths } from "../src/foundations/memory-paths.js";
import { computeEvidenceDigests } from "../src/memory/curriculum-refresh.js";
import { readCurriculum, writeCurriculum } from "../src/memory/curriculum-store.js";
import { renderCurriculumMarkdown } from "../src/curriculum/curriculum-planning.js";
import { evaluateLessonForSave } from "../src/lessons/save-lesson.js";
import { recordExercise, scheduleReview } from "../src/memory/learning-progress.js";
import { validateCurriculum } from "../src/curriculum/approve-curriculum.js";

export { resolveMemoryPaths } from "../src/foundations/memory-paths.js";

const MEMORY_DIRECTORY = LOCAL_MEMORY_DIRECTORY;
const CONFIG_FILE = "config.json";
const SHARING = new Set(["private", "team", "local"]);
const STORAGE_MODES = new Set(["private", "project-local", "team"]);
const MODES = new Set(["ask", "pr", "workbook"]);
const DEPTHS = new Set(["concise", "balanced", "deep"]);
const SAVE_POLICIES = new Set(["ask", "automatic"]);
const OUTPUT_LOCATIONS = new Set(["sister", "private", "custom"]);
const execute = promisify(execFile);

function printHelp() {
  process.stdout.write(`Usage:
  node project-memory.js status <target-root> [--storage private|project-local|team] [--format table|json]
  node project-memory.js init <target-root> [--storage private|project-local|team] [--output-location sister|private|custom] [--output-root <path>] [--mode ask|pr|workbook] [--depth concise|balanced|deep] [--save-policy ask|automatic] [--boundary-hints <csv>] [--critical-workflows <csv>] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>] [--allow-non-git] [--yes|--interactive]
  node project-memory.js save-curriculum <target-root> --input <curriculum.json> --yes

Curriculum JSON must include agentApproval (approvedAt, purposeStatus accepted|unresolved,
corroboratedTopicIds for naming-heuristic topics, acceptedPartialScope when coverage is partial).
--yes alone is not an agent shortlist.
  node project-memory.js save-lesson <target-root> --topic-id <id> --title <title> --input <markdown-file> --yes
  node project-memory.js configure-output <target-root> --output-location sister|custom [--output-root <path>] --yes
  node project-memory.js record-decision <target-root> --decision <text> [--reason <text>] [--scope <text>] --yes
  node project-memory.js save-artifact <target-root> --type atlas|snapshot|notebook --title <title> --input <file> [--verified] --yes
  node project-memory.js migrate <target-root> --yes
  node project-memory.js repair-index <target-root> --yes

Private-external machine memory plus a discoverable sister workbook is the default and leaves the
target unchanged. --sharing team|local is a legacy alias for --storage team|project-local. Status is read-only. Mutations require consent.
Agents should ask in conversation and pass --yes; --interactive is for human terminal use.
`);
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const [action, targetInput, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const name = argument.slice(2);
    if (new Set(["yes", "interactive", "allow-non-git", "verified"]).has(name))
      options[name] = true;
    else {
      if (index + 1 >= rest.length || rest[index + 1].startsWith("--"))
        throw new Error(`Missing value for --${name}`);
      options[name] = rest[index + 1];
      index += 1;
    }
  }
  return { action, options, targetInput };
}

function workbookPaths(memory, config) {
  const location = config.output?.location ?? "private";
  const root = location === "private" ? memory.root : resolve(config.output.root);
  return {
    location,
    root,
    lessons: resolve(root, "lessons"),
    lessonIndex:
      location === "private" ? resolve(root, "lessons", "index.md") : resolve(root, "INDEX.md"),
  };
}

async function requireSafePath(path, kind) {
  const details = await lstat(path);
  if (details.isSymbolicLink())
    throw new Error(`Refusing symbolic link in project memory: ${path}`);
  if (kind === "directory" && !details.isDirectory())
    throw new Error(`Expected project-memory directory: ${path}`);
  if (kind === "file" && !details.isFile())
    throw new Error(`Expected project-memory file: ${path}`);
}

function validateConfig(config) {
  if (!config || !new Set([1, 2]).has(config.schemaVersion))
    throw new Error("Unsupported project-memory schema");
  if (!SHARING.has(config.sharing)) throw new Error("Invalid project-memory sharing mode");
  if (!MODES.has(config.defaults?.mode)) throw new Error("Invalid default analysis mode");
  if (!DEPTHS.has(config.defaults?.lessonDepth)) throw new Error("Invalid lesson depth");
  if (config.defaults?.fallbackPolicy !== "ask")
    throw new Error("fallbackPolicy must remain 'ask'");
  if (config.output?.format !== "markdown" || config.output?.directory !== "lessons")
    throw new Error("Markdown lessons in lessons/ must remain the default output");
  const compatibilityWarnings = [];
  const normalized = structuredClone(config);
  if (normalized.output.location === undefined) {
    normalized.output.location = "private";
    compatibilityWarnings.push(
      "output.location is absent; existing lessons remain in private project memory. Preview configure-output --output-location sister to create a discoverable workbook.",
    );
  }
  if (!OUTPUT_LOCATIONS.has(normalized.output.location))
    throw new Error("output.location must be sister, private, or custom");
  if (normalized.output.location !== "private" && typeof normalized.output.root !== "string")
    throw new Error("Discoverable lesson output requires output.root");
  if (normalized.output?.savePolicy === undefined) {
    normalized.output.savePolicy = "ask";
    compatibilityWarnings.push(
      "output.savePolicy is absent; using the safe legacy default 'ask' without changing the file.",
    );
  }
  if (!SAVE_POLICIES.has(normalized.output?.savePolicy))
    throw new Error("output.savePolicy must be ask or automatic");
  if (config.schemaVersion === 1)
    compatibilityWarnings.push(
      "Project memory uses schema v1; typed artifacts and analysis hints require an explicit migration.",
    );
  if (config.schemaVersion === 2) {
    if (config.storage !== undefined) {
      if (!STORAGE_MODES.has(config.storage.mode))
        throw new Error("Version 2 storage.mode must be private, project-local, or team");
      if (config.storage.mode === "private" && typeof config.storage.projectId !== "string")
        throw new Error("Private project memory requires storage.projectId");
    } else {
      compatibilityWarnings.push(
        "storage.mode is absent; treating this as legacy target-local memory without changing the file.",
      );
    }
    if (
      config.tooling !== undefined &&
      (config.tooling.targetMutationPolicy !== "deny" ||
        config.tooling.installationPolicy !== "ask-user-scoped" ||
        config.tooling.artifactPolicy !== "private-cache")
    )
      throw new Error("Version 2 tooling policy must preserve target-pure defaults");
    if (!Array.isArray(config.output.artifactTypes))
      throw new Error("Version 2 output.artifactTypes must be an array");
    const budgets = config.analysis?.budgets;
    if (
      !budgets ||
      ![
        budgets.maxFiles,
        budgets.maxManifestFiles ?? 1000,
        budgets.maxRelationFiles,
        budgets.maxRelationBytes,
      ].every(Number.isInteger) ||
      budgets.maxFiles < 1 ||
      budgets.maxFiles > 1_000_000 ||
      (budgets.maxManifestFiles !== undefined &&
        (budgets.maxManifestFiles < 1 || budgets.maxManifestFiles > 100_000)) ||
      budgets.maxRelationFiles < 1 ||
      budgets.maxRelationFiles > 1_000_000 ||
      budgets.maxRelationBytes < 1 ||
      budgets.maxRelationBytes > 2_000_000_000
    )
      throw new Error("Version 2 analysis budgets are required integers");
    if (
      !Array.isArray(config.analysis.boundaryHints) ||
      !Array.isArray(config.analysis.criticalWorkflows)
    )
      throw new Error("Version 2 analysis hints must be arrays");
  }
  return { config: normalized, compatibilityWarnings };
}

async function gitRepositoryStatus(targetRoot, candidate = `${MEMORY_DIRECTORY}/${CONFIG_FILE}`) {
  try {
    await execute("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: targetRoot,
      timeout: 10_000,
    });
  } catch (error) {
    return {
      available: error.code !== "ENOENT",
      isRepository: false,
      memoryIgnored: null,
    };
  }
  try {
    await execute("git", ["check-ignore", "--quiet", "--no-index", "--", candidate], {
      cwd: targetRoot,
      timeout: 10_000,
    });
    return { available: true, isRepository: true, memoryIgnored: true };
  } catch (error) {
    if (error.code === 1) return { available: true, isRepository: true, memoryIgnored: false };
    return { available: true, isRepository: true, memoryIgnored: null };
  }
}

async function repositoryRootFor(targetRoot) {
  try {
    const result = await execute("git", ["rev-parse", "--show-toplevel"], {
      cwd: targetRoot,
      timeout: 10_000,
    });
    return await realpath(result.stdout.trim());
  } catch {
    return targetRoot;
  }
}

async function proposedOutputRoot(targetRoot, options, memoryRoot) {
  const location = options["output-location"] ?? "sister";
  if (!OUTPUT_LOCATIONS.has(location))
    throw new Error("--output-location must be sister, private, or custom");
  if (location === "private") return { location, root: memoryRoot };
  if (location === "custom") {
    if (!options["output-root"]) throw new Error("--output-root is required for custom output");
    return { location, root: resolve(options["output-root"]) };
  }
  if (options["output-root"])
    throw new Error("--output-root can be used only with --output-location custom");
  const repositoryRoot = await repositoryRootFor(targetRoot);
  const projectName = basename(targetRoot).replace(/[^A-Za-z0-9._-]+/g, "-");
  return { location, root: resolve(dirname(repositoryRoot), `repay-${projectName}-techdebt`) };
}

async function readConfig(paths) {
  await requireSafePath(paths.root, "directory");
  await requireSafePath(paths.config, "file");
  return validateConfig(JSON.parse(await readFile(paths.config, "utf8")));
}

function emit(value, format = "json") {
  if (format === "json") process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  else {
    process.stdout.write(`Project memory: ${value.status}\n`);
    process.stdout.write(`Target: ${value.targetRoot}\n`);
    process.stdout.write(`Location: ${value.memoryRoot}\n`);
    if (value.outputRoot) process.stdout.write(`Workbook: ${value.outputRoot}\n`);
    if (value.config)
      process.stdout.write(
        `Sharing: ${value.config.sharing}; mode: ${value.config.defaults.mode}; lesson depth: ${value.config.defaults.lessonDepth}; save policy: ${value.config.output.savePolicy}\n`,
      );
    if (typeof value.lessonCount === "number")
      process.stdout.write(`Saved lessons: ${value.lessonCount}\n`);
    if (typeof value.curriculumTopicCount === "number")
      process.stdout.write(
        `Curriculum: ${value.curriculumTopicCount} subjects; ${value.pendingTopicCount} planned\n`,
      );
    for (const warning of value.warnings ?? []) process.stdout.write(`Warning: ${warning}\n`);
  }
}

async function status(targetRoot, options) {
  const format = options.format ?? "json";
  if (!new Set(["json", "table"]).has(format)) throw new Error("--format must be json or table");
  const paths = await resolveMemoryPaths(targetRoot, options);
  const git = await gitRepositoryStatus(targetRoot);
  if (!(await pathExists(paths.config))) {
    if (await pathExists(paths.root)) {
      const details = await lstat(paths.root);
      emit(
        {
          type: details.isSymbolicLink() ? "unsafe-symlink" : "incomplete-memory",
          status: "broken",
          initialized: false,
          targetRoot,
          memoryRoot: paths.root,
          requiredAction:
            "Inspect the existing path and ask whether to repair, migrate, rename, or remove it. Never overwrite it silently.",
        },
        format,
      );
      process.exitCode = 2;
      return;
    }
    const result = {
      type: "first-run",
      status: "not-initialized",
      initialized: false,
      targetRoot,
      memoryRoot: paths.root,
      choices: {
        storage: ["private", "session-only", "project-local", "team"],
        lessonOutput: ["sister", "private", "custom"],
        mode: ["ask", "pr", "workbook"],
        lessonDepth: ["balanced", "concise", "deep"],
        savePolicy: ["ask", "automatic"],
        optional: ["boundaryHints", "criticalWorkflows", "analysisBudgets"],
      },
      git,
      requiredAction:
        "Recommend private memory with a discoverable sister workbook, preview its exact path, then ask whether to persist it and collect mode, depth, and save-policy preferences.",
      targetMutationPolicy: "deny",
      privateCacheRoot: paths.location.cacheRoot,
      suggestedOutputRoot: (await proposedOutputRoot(targetRoot, {}, paths.root)).root,
    };
    emit(result, format);
    return;
  }

  const { config, compatibilityWarnings } = await readConfig(paths);
  const workbook = workbookPaths(paths, config);
  let artifactCount = 0;
  let curriculumTopicCount = 0;
  let pendingTopicCount = 0;
  await requireSafePath(paths.curriculum, "file");
  await requireSafePath(paths.decisions, "file");
  await requireSafePath(workbook.root, "directory");
  await requireSafePath(workbook.lessons, "directory");
  await requireSafePath(workbook.lessonIndex, "file");
  if (await pathExists(paths.curriculumData)) {
    await requireSafePath(paths.curriculumData, "file");
    const { data: curriculum } = await readCurriculum(paths.curriculumData);
    if (Array.isArray(curriculum.topics) && curriculum.topics.length > 0) {
      curriculumTopicCount = curriculum.topics.length;
      pendingTopicCount = curriculum.topics.filter((topic) => !topic.lessonPath).length;
    } else if (!Array.isArray(curriculum.topics)) {
      throw new Error("Curriculum state must contain a topics array");
    }
  }
  if (config.schemaVersion === 2) {
    await requireSafePath(paths.artifacts, "directory");
    await requireSafePath(paths.artifactIndex, "file");
    const index = JSON.parse(await readFile(paths.artifactIndex, "utf8"));
    if (index.schemaVersion !== 1 || !Array.isArray(index.artifacts))
      throw new Error("Unsupported typed-artifact index schema");
    artifactCount = index.artifacts.length;
    for (const directory of ["atlases", "snapshots", "notebooks"])
      await requireSafePath(resolve(paths.artifacts, directory), "directory");
    for (const artifact of index.artifacts) {
      if (
        typeof artifact.path !== "string" ||
        artifact.path.startsWith("/") ||
        artifact.path.split(/[\\/]/).includes("..") ||
        !/^artifacts\/(?:atlases|snapshots|notebooks)\/[^/]+$/.test(artifact.path)
      )
        throw new Error("Typed-artifact index contains an unsafe path");
      await requireSafePath(resolve(paths.root, artifact.path), "file");
    }
  }
  if (await pathExists(paths.lessonLock)) {
    emit(
      {
        type: "lesson-index-locked",
        status: "busy-or-interrupted",
        initialized: true,
        targetRoot,
        memoryRoot: paths.root,
        requiredAction:
          "Retry after the active lesson save finishes. If no save is active, ask before removing the stale lock.",
      },
      format,
    );
    process.exitCode = 2;
    return;
  }
  if (await pathExists(paths.artifactLock)) {
    emit(
      {
        type: "artifact-index-locked",
        status: "busy-or-interrupted",
        initialized: true,
        targetRoot,
        memoryRoot: paths.root,
        requiredAction:
          "Retry after the active artifact save finishes. If no save is active, ask before removing the stale lock.",
      },
      format,
    );
    process.exitCode = 2;
    return;
  }
  const lessons = (await readdir(workbook.lessons, { withFileTypes: true })).filter(
    (entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md",
  );
  const lessonIndex = await readFile(workbook.lessonIndex, "utf8");
  const orphanedLessons = lessons
    .map((entry) => entry.name)
    .filter(
      (name) =>
        !lessonIndex.includes(`](./${name})`) &&
        !lessonIndex.includes(`](lessons/${name})`) &&
        !lessonIndex.includes(`](./lessons/${name})`),
    );
  const lessonNames = new Set(lessons.map((entry) => entry.name));
  const indexedLessons = [
    ...lessonIndex.matchAll(/\]\((?:\.\/)?(?:lessons\/)?([^)/]+\.md)\)/g),
  ].map((match) => match[1]);
  const missingLessons = indexedLessons.filter((name) => !lessonNames.has(name));
  if (orphanedLessons.length > 0 || missingLessons.length > 0) {
    emit(
      {
        type: "incomplete-lesson-index",
        status: "broken",
        initialized: true,
        targetRoot,
        memoryRoot: paths.root,
        orphanedLessons,
        missingLessons,
        requiredAction:
          "Ask whether to run project-memory.js repair-index <target-root> --yes before continuing.",
      },
      format,
    );
    process.exitCode = 2;
    return;
  }
  const warnings = [...compatibilityWarnings];
  if (config.sharing === "team" && !git.isRepository)
    warnings.push("Team sharing is configured, but the target is not a Git repository.");
  if (config.sharing === "team" && git.memoryIgnored)
    warnings.push("Team sharing is configured, but Git ignore rules exclude project memory.");
  emit(
    {
      status: warnings.length > 0 ? "ready-with-warning" : "ready",
      initialized: true,
      targetRoot,
      memoryRoot: paths.root,
      outputRoot: workbook.root,
      storageMode: config.storage?.mode ?? paths.location.mode,
      privateCacheRoot: paths.location.cacheRoot,
      config,
      git,
      lessonCount: lessons.length,
      curriculumTopicCount,
      pendingTopicCount,
      artifactCount,
      warnings,
    },
    format,
  );
}

async function askHumanWizard(options) {
  if (!stdin.isTTY || !stdout.isTTY)
    throw new Error("--interactive requires a terminal; agents must ask in chat and use --yes");
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const storage = (
      await prompt.question("Storage (private/project-local/team/session-only) [private]: ")
    ).trim();
    options.storage = storage || "private";
    if (options.storage === "session-only")
      throw new Error("Session-only mode creates no project memory; continue without init");
    const outputLocation = (
      await prompt.question("Lesson output (sister/private/custom) [sister]: ")
    ).trim();
    options["output-location"] = outputLocation || "sister";
    if (options["output-location"] === "custom")
      options["output-root"] = (
        await prompt.question("Absolute or current-directory-relative output path: ")
      ).trim();
    const mode = (await prompt.question("Default mode (ask/pr/workbook) [ask]: ")).trim();
    options.mode = mode || "ask";
    const depth = (
      await prompt.question("Lesson depth (concise/balanced/deep) [balanced]: ")
    ).trim();
    options.depth = depth || "balanced";
    const automatic = (
      await prompt.question("Auto-save explicitly requested lessons? [y/N] ")
    ).trim();
    options["save-policy"] = /^y(?:es)?$/i.test(automatic) ? "automatic" : "ask";
    const boundaries = (
      await prompt.question("Unusual component or boundary paths (comma-separated) [none]: ")
    ).trim();
    if (boundaries) options["boundary-hints"] = boundaries;
    const workflows = (
      await prompt.question("Critical workflows (comma-separated) [none]: ")
    ).trim();
    if (workflows) options["critical-workflows"] = workflows;
    const confirmed = (await prompt.question("Create private project memory now? [y/N] ")).trim();
    options.yes = /^y(?:es)?$/i.test(confirmed);
  } finally {
    prompt.close();
  }
  return options;
}

function storageModeFor(options) {
  const legacy =
    options.sharing === "team"
      ? "team"
      : options.sharing === "local"
        ? "project-local"
        : options.sharing === "private"
          ? "private"
          : null;
  const requested = options.storage ?? legacy ?? "private";
  if (!STORAGE_MODES.has(requested))
    throw new Error("--storage must be private, project-local, or team");
  if (options.storage && legacy && options.storage !== legacy)
    throw new Error("--storage conflicts with legacy --sharing");
  return requested;
}

function configFor(options, targetRoot, output) {
  const storageMode = storageModeFor(options);
  const sharing = storageMode === "private" ? "private" : storageMode === "team" ? "team" : "local";
  const mode = options.mode ?? "ask";
  const lessonDepth = options.depth ?? "balanced";
  const savePolicy = options["save-policy"] ?? "ask";
  if (!SHARING.has(sharing)) throw new Error("Invalid derived sharing mode");
  if (!MODES.has(mode)) throw new Error("--mode must be ask, pr, or workbook");
  if (!DEPTHS.has(lessonDepth)) throw new Error("--depth must be concise, balanced, or deep");
  if (!SAVE_POLICIES.has(savePolicy)) throw new Error("--save-policy must be ask or automatic");
  const integerOption = (name, fallback, maximum) => {
    if (options[name] === undefined) return fallback;
    const value = Number(options[name]);
    if (!Number.isInteger(value) || value < 1 || value > maximum)
      throw new Error(`--${name} must be an integer from 1 to ${maximum}`);
    return value;
  };
  const csv = (value) =>
    String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: 2,
    sharing,
    storage: {
      mode: storageMode,
      projectId: projectStoragePaths(targetRoot).projectId,
    },
    defaults: { mode, lessonDepth, fallbackPolicy: "ask" },
    output: {
      format: "markdown",
      directory: "lessons",
      location: output.location,
      ...(output.location === "private" ? {} : { root: output.root }),
      savePolicy,
      lessonQuality: "strict",
      artifactTypes: ["atlas", "snapshot", "notebook"],
    },
    memory: { recordDecisions: true, maintainCurriculum: true, typedArtifacts: true },
    analysis: {
      budgets: {
        maxFiles: integerOption("max-files", 30000, 1_000_000),
        maxManifestFiles: integerOption("max-manifest-files", 1000, 100_000),
        maxRelationFiles: integerOption("max-relation-files", 1500, 1_000_000),
        maxRelationBytes: integerOption("max-relation-bytes", 12582912, 2_000_000_000),
      },
      boundaryHints: csv(options["boundary-hints"]),
      criticalWorkflows: csv(options["critical-workflows"]),
      aliases: {},
    },
    tooling: {
      targetMutationPolicy: "deny",
      installationPolicy: "ask-user-scoped",
      artifactPolicy: "private-cache",
    },
    createdAt: timestamp,
  };
}

async function appendIgnoreEntry(targetRoot, filename, entry) {
  const ignorePath = resolve(targetRoot, filename);
  if (await pathExists(ignorePath)) await requireSafePath(ignorePath, "file");
  const existing = (await pathExists(ignorePath)) ? await readFile(ignorePath, "utf8") : "";
  if (existing.split(/\r?\n/).includes(entry)) return false;
  const separator = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  await appendFile(ignorePath, `${separator}${entry}\n`, "utf8");
  return true;
}

async function init(targetRoot, initialOptions) {
  const options = initialOptions.interactive
    ? await askHumanWizard({ ...initialOptions })
    : initialOptions;
  const storageMode = storageModeFor(options);
  const paths = await resolveMemoryPaths(targetRoot, { storage: storageMode });
  const output = await proposedOutputRoot(targetRoot, options, paths.root);
  if (output.root === targetRoot) throw new Error("Lesson output cannot replace the target root");
  const outputInsideTarget = isSameOrInside(output.root, targetRoot);
  const config = configFor(options, targetRoot, output);
  const git = await gitRepositoryStatus(targetRoot);
  if (paths.location.competingReady) {
    emit({
      type: "memory-location-conflict",
      status: "not-created",
      targetRoot,
      memoryRoot: paths.root,
      outputRoot: output.root,
      requiredAction:
        "Choose the authoritative existing memory location; do not create a second store.",
    });
    process.exitCode = 2;
    return;
  }
  if (await pathExists(paths.root)) {
    const details = await lstat(paths.root);
    const type = details.isSymbolicLink() ? "unsafe-symlink" : "already-exists";
    emit({ type, status: "not-created", targetRoot, memoryRoot: paths.root });
    process.exitCode = 2;
    return;
  }
  if (config.sharing === "team" && !git.isRepository && !options["allow-non-git"]) {
    emit({
      type: "team-sharing-unavailable",
      status: "not-created",
      targetRoot,
      git,
      requiredAction:
        "Choose private storage, initialize Git, or explicitly accept non-Git portability with --allow-non-git.",
    });
    process.exitCode = 2;
    return;
  }
  if (config.sharing === "team" && git.memoryIgnored) {
    emit({
      type: "team-memory-ignored",
      status: "not-created",
      targetRoot,
      git,
      requiredAction:
        "Remove the applicable Git ignore rule or choose private storage before initializing.",
    });
    process.exitCode = 2;
    return;
  }
  if (!options.yes) {
    emit({
      type: "consent-required",
      status: "not-created",
      targetRoot,
      memoryRoot: paths.root,
      proposedConfig: config,
      writes:
        storageMode === "private"
          ? [paths.root, ...(output.root === paths.root ? [] : [output.root])]
          : [
              `${MEMORY_DIRECTORY}/${CONFIG_FILE}`,
              `${MEMORY_DIRECTORY}/decisions.md`,
              `${MEMORY_DIRECTORY}/curriculum.md`,
              `${MEMORY_DIRECTORY}/curriculum.json`,
              `${MEMORY_DIRECTORY}/lessons/index.md`,
              `${MEMORY_DIRECTORY}/artifacts/index.json`,
              `.graphifyignore: add ${MEMORY_DIRECTORY}/`,
              ...(config.sharing === "local" ? [`.gitignore: add ${MEMORY_DIRECTORY}/`] : []),
              ...(output.root === paths.root ? [] : [output.root]),
            ],
      targetWrites: [
        ...(storageMode === "private" ? [] : [MEMORY_DIRECTORY]),
        ...(outputInsideTarget ? [relative(targetRoot, output.root).replaceAll("\\", "/")] : []),
      ],
      futureToolArtifactRoot: storageMode === "private" ? paths.location.cacheRoot : undefined,
      requiredAction: "Obtain user approval, then rerun with the selected options and --yes.",
    });
    process.exitCode = 2;
    return;
  }

  await mkdir(dirname(paths.root), { recursive: true });
  const stagingRoot = await mkdtemp(resolve(dirname(paths.root), ".repay-techdebt-init-"));
  let outputStaging = null;
  let gitignoreUpdated = false;
  let graphifyIgnoreUpdated = false;
  try {
    await mkdir(resolve(stagingRoot, "lessons"));
    await mkdir(resolve(stagingRoot, "artifacts", "atlases"), { recursive: true });
    await mkdir(resolve(stagingRoot, "artifacts", "snapshots"), { recursive: true });
    await mkdir(resolve(stagingRoot, "artifacts", "notebooks"), { recursive: true });
    await Promise.all([
      writeFile(resolve(stagingRoot, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, "utf8"),
      writeFile(
        resolve(stagingRoot, "decisions.md"),
        "# Repay Tech Debt Decisions\n\nRecord only user-confirmed, durable learning and analysis decisions.\n\n| Date | Scope | Decision | Reason |\n| --- | --- | --- | --- |\n",
        "utf8",
      ),
      writeFile(
        resolve(stagingRoot, "curriculum.md"),
        "# Learning Curriculum\n\nTrack concepts worth revisiting without treating coverage as a quota.\n\n| Topic | Status | Evidence | Next step |\n| --- | --- | --- | --- |\n",
        "utf8",
      ),
      writeFile(
        resolve(stagingRoot, "curriculum.json"),
        `${JSON.stringify({ schemaVersion: 1, topics: [] }, null, 2)}\n`,
        "utf8",
      ),
      writeFile(
        resolve(stagingRoot, "lessons", "index.md"),
        "# Saved Lessons\n\n| Date | Lesson | Scope |\n| --- | --- | --- |\n",
        "utf8",
      ),
      writeFile(
        resolve(stagingRoot, "artifacts", "index.json"),
        `${JSON.stringify({ schemaVersion: 1, artifacts: [] }, null, 2)}\n`,
        "utf8",
      ),
    ]);
    graphifyIgnoreUpdated =
      storageMode === "private"
        ? false
        : await appendIgnoreEntry(targetRoot, ".graphifyignore", `${MEMORY_DIRECTORY}/`);
    gitignoreUpdated =
      config.sharing === "local"
        ? await appendIgnoreEntry(targetRoot, ".gitignore", `${MEMORY_DIRECTORY}/`)
        : false;
    if (output.root !== paths.root) {
      await mkdir(dirname(output.root), { recursive: true });
      outputStaging = await mkdtemp(resolve(dirname(output.root), ".repay-techdebt-output-"));
      await mkdir(resolve(outputStaging, "lessons"));
      await writeFile(
        resolve(outputStaging, "INDEX.md"),
        "# Learning index\n\nNo curriculum has been generated yet. Run `plan-curriculum.js`, then save it with `project-memory.js save-curriculum`.\n",
        "utf8",
      );
    }
    await rename(stagingRoot, paths.root);
    if (outputStaging) await rename(outputStaging, output.root);
  } catch (error) {
    await rm(stagingRoot, { force: true, recursive: true });
    if (outputStaging) await rm(outputStaging, { force: true, recursive: true });
    if (await pathExists(paths.root)) await rm(paths.root, { force: true, recursive: true });
    throw error;
  }

  emit({
    type: "initialized",
    status: "ready",
    targetRoot,
    memoryRoot: paths.root,
    outputRoot: output.root,
    privateCacheRoot: paths.location.cacheRoot,
    targetWrites: [
      ...(storageMode === "private" ? [] : [MEMORY_DIRECTORY]),
      ...(outputInsideTarget ? [relative(targetRoot, output.root).replaceAll("\\", "/")] : []),
    ],
    config,
    git,
    graphifyIgnoreUpdated,
    gitignoreUpdated,
  });
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
  if (!slug) throw new Error("Lesson title must contain letters or numbers");
  return slug;
}

async function uniqueLessonPath(paths, title) {
  const date = new Date().toISOString().slice(0, 10);
  const base = `${date}-${slugify(title)}`;
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const name = suffix === 1 ? `${base}.md` : `${base}-${suffix}.md`;
    const path = resolve(paths.lessons, name);
    if (!(await pathExists(path))) return { name, path };
  }
  throw new Error("Could not allocate a unique lesson filename");
}

async function appendLessonIndex(paths, line) {
  const current = await readFile(paths.lessonIndex, "utf8");
  await replaceLessonIndex(paths, `${current}${line}`);
}

async function replaceLessonIndex(paths, content) {
  const temporary = resolve(
    dirname(paths.lessonIndex),
    `.index-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
  );
  await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
  try {
    await rename(temporary, paths.lessonIndex);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function saveCurriculum(targetRoot, options) {
  if (!options.input) throw new Error("--input is required");
  const paths = await resolveMemoryPaths(targetRoot, options);
  const { config } = await readConfig(paths);
  const workbook = workbookPaths(paths, config);
  await requireSafePath(workbook.root, "directory");
  await requireSafePath(workbook.lessons, "directory");
  await requireSafePath(workbook.lessonIndex, "file");
  if (!options.yes) {
    emit({
      type: "consent-required",
      status: "not-saved",
      targetRoot,
      outputRoot: workbook.root,
      requiredAction:
        "Confirm the ranked learning index should be persisted, then rerun with --yes.",
    });
    process.exitCode = 2;
    return;
  }
  const input = validateCurriculum(
    JSON.parse(await readFile(await realpath(resolve(options.input)), "utf8")),
    targetRoot,
  );
  let priorRevision = undefined;
  if (await pathExists(paths.curriculumData)) {
    const { data: prior, revision } = await readCurriculum(paths.curriculumData);
    priorRevision = revision;
    const completed = new Map(
      (prior.topics ?? []).filter((topic) => topic.lessonPath).map((topic) => [topic.id, topic]),
    );
    for (const topic of input.topics) {
      const existing = completed.get(topic.id);
      if (existing) Object.assign(topic, { status: "written", lessonPath: existing.lessonPath });
    }
  }
  const markdown = renderCurriculumMarkdown(input);
  const checked = await secretCheck(markdown, workbook.lessonIndex);
  if (!checked.ok) {
    emit({
      type: "secret-risk",
      status: "not-saved",
      targetRoot,
      diagnostics: checked.output.trim(),
      requiredAction: "Remove or redact the detected value and retry.",
    });
    process.exitCode = 2;
    return;
  }
  await acquireLessonLock(paths);
  try {
    input.history = input.history || [];
    input.history.push({ action: "save-curriculum", date: new Date().toISOString() });
    await writeCurriculum(paths.curriculumData, input, priorRevision);
    await replaceLessonIndex(workbook, markdown);
  } finally {
    await rm(paths.lessonLock, { force: true, recursive: true });
  }
  emit({
    type: "curriculum-saved",
    status: "saved",
    targetRoot,
    memoryRoot: paths.root,
    outputRoot: workbook.root,
    index: workbook.lessonIndex,
    topicCount: input.topics.length,
  });
}

async function configureOutput(targetRoot, options) {
  const paths = await resolveMemoryPaths(targetRoot, options);
  const { config } = await readConfig(paths);
  const current = workbookPaths(paths, config);
  const destination = await proposedOutputRoot(targetRoot, options, paths.root);
  if (destination.location === "private")
    throw new Error("configure-output is for a discoverable sister or custom workbook");
  if (destination.root === current.root) {
    emit({
      type: "output-configuration-not-needed",
      status: "ready",
      targetRoot,
      outputRoot: current.root,
    });
    return;
  }
  if (await pathExists(destination.root))
    throw new Error(`Refusing to merge with an existing output path: ${destination.root}`);
  const lessonNames = (await readdir(current.lessons, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md")
    .map((entry) => entry.name);
  if (!options.yes) {
    emit({
      type: "consent-required",
      status: "not-configured",
      targetRoot,
      currentOutputRoot: current.root,
      proposedOutputRoot: destination.root,
      lessonCount: lessonNames.length,
      writes: [destination.root, paths.config],
      preservedBackup: current.root,
      requiredAction:
        "Approve the visible workbook export and configuration update, then rerun with --yes.",
    });
    process.exitCode = 2;
    return;
  }
  await mkdir(dirname(destination.root), { recursive: true });
  const staging = await mkdtemp(resolve(dirname(destination.root), ".repay-techdebt-output-"));
  const SECRET_PATTERNS = [
    /\b(?:sk|ghp|github_pat|glpat|xox[baprs]|AKIA)[-_A-Za-z0-9]{8,}\b/gi,
    /\b(?:token|password|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,
    /(?:Authorization:\s*(?:Bearer|Basic)\s+)\S+/gi,
  ];

  function sanitizeContent(text) {
    let scrubbed = text;
    for (const pattern of SECRET_PATTERNS) {
      scrubbed = scrubbed.replace(pattern, "[REDACTED]");
    }
    // Replace absolute targetRoot paths with relative paths
    const rootPattern = new RegExp(targetRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    scrubbed = scrubbed.replace(rootPattern, ".");
    return scrubbed;
  }

  try {
    await mkdir(resolve(staging, "lessons"));
    for (const name of lessonNames) {
      const rawContent = await readFile(resolve(current.lessons, name), "utf8");
      await writeFile(resolve(staging, "lessons", name), sanitizeContent(rawContent), "utf8");
    }
    const oldIndex = await readFile(current.lessonIndex, "utf8");
    const visibleIndex = oldIndex
      .replace(/^# Saved Lessons/m, "# Learning index")
      .replaceAll("](./", "](lessons/");
    await writeFile(resolve(staging, "INDEX.md"), sanitizeContent(visibleIndex), "utf8");
    await rename(staging, destination.root);
    await replaceJsonFile(paths.config, {
      ...config,
      output: {
        ...config.output,
        location: destination.location,
        root: destination.root,
        lessonQuality: "strict",
      },
      outputConfiguredAt: new Date().toISOString(),
    });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    if (await pathExists(destination.root))
      await rm(destination.root, { recursive: true, force: true });
    throw error;
  }
  emit({
    type: "output-configured",
    status: "ready",
    targetRoot,
    outputRoot: destination.root,
    copiedLessons: lessonNames.length,
    preservedBackup: current.root,
  });
}

async function acquireLessonLock(paths) {
  try {
    await mkdir(paths.lessonLock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Another lesson save is active or left a stale lock; retry, then inspect .lesson-index.lock if the problem persists.",
      );
    throw error;
  }
}

async function secretCheck(content, filePath) {
  const { createEngine } = await import("@secretlint/node");
  const engine = await createEngine({
    color: false,
    configFilePath: resolve(skillRoot, ".secretlintrc.json"),
    cwd: skillRoot,
    formatter: "compact",
    maskSecrets: true,
    terminalLink: false,
  });
  return engine.executeOnContent({ content, filePath });
}

async function saveLesson(targetRoot, options) {
  const paths = await resolveMemoryPaths(targetRoot, options);
  const { config } = await readConfig(paths);
  const workbook = workbookPaths(paths, config);
  await requireSafePath(workbook.root, "directory");
  await requireSafePath(workbook.lessons, "directory");
  await requireSafePath(workbook.lessonIndex, "file");
  if (!options.title || !options.input) throw new Error("--title and --input are required");
  let curriculum = null;
  let expectedRevision = undefined;
  if (await pathExists(paths.curriculumData)) {
    const { data, revision } = await readCurriculum(paths.curriculumData);
    curriculum = data;
    expectedRevision = revision;
    if (curriculum.topics?.length > 0 && !options["topic-id"])
      throw new Error("--topic-id is required so the lesson can be linked from the learning index");
  }
  const topic = options["topic-id"]
    ? curriculum?.topics?.find((item) => item.id === options["topic-id"])
    : null;
  if (options["topic-id"] && !topic)
    throw new Error(`Unknown curriculum topic: ${options["topic-id"]}`);
  if (!options.yes) {
    emit({
      type: "consent-required",
      status: "not-saved",
      targetRoot,
      input: resolve(options.input),
      requiredAction: "Confirm the lesson should be persisted, then rerun with --yes.",
    });
    process.exitCode = 2;
    return;
  }
  const title = options.title.replace(/\s+/g, " ").trim();
  const inputPath = await realpath(resolve(options.input));
  const body = await readFile(inputPath, "utf8");
  const content = `# ${title}\n\n${body.trim()}\n`;
  const { ok, quality } = await evaluateLessonForSave(targetRoot, content, {
    depth: config.defaults.lessonDepth,
    expectedEvidencePaths: topic?.evidencePaths ?? [],
  });
  if (!ok) {
    emit({
      type: "lesson-quality-failed",
      status: "not-saved",
      targetRoot,
      quality,
      requiredAction:
        "Keep one subject, strengthen its project evidence, and fix every error before saving.",
    });
    process.exitCode = 2;
    return;
  }
  await acquireLessonLock(paths);
  try {
    const candidate = await uniqueLessonPath(workbook, title);
    const checked = await secretCheck(content, candidate.path);
    if (!checked.ok) {
      emit({
        type: "secret-risk",
        status: "not-saved",
        targetRoot,
        diagnostics: checked.output.trim(),
        requiredAction: "Remove or redact the detected value and retry.",
      });
      process.exitCode = 2;
      return;
    }
    await writeFile(candidate.path, content, { encoding: "utf8", flag: "wx" });
    const date = new Date().toISOString().slice(0, 10);
    try {
      if (topic) {
        const previousCurriculum = structuredClone(curriculum);
        topic.status = "written";
        topic.lessonPath = `lessons/${candidate.name}`;
        topic.writtenAt = new Date().toISOString();
        if (topic.evidencePaths && topic.evidencePaths.length > 0) {
          topic.evidenceDigests = await computeEvidenceDigests(targetRoot, topic.evidencePaths);
        } else {
          topic.evidenceDigests = {};
        }
        try {
          curriculum.history = curriculum.history || [];
          curriculum.history.push({
            action: "save-lesson",
            topicId: topic.id,
            date: new Date().toISOString(),
          });
          await writeCurriculum(paths.curriculumData, curriculum, expectedRevision);
          await replaceLessonIndex(workbook, renderCurriculumMarkdown(curriculum));
        } catch (error) {
          // Revert on failure, pass previous curriculum (blind overwrite to restore, lock held in writeCurriculum)
          await writeCurriculum(paths.curriculumData, previousCurriculum);
          throw error;
        }
      } else {
        await appendLessonIndex(
          workbook,
          `| ${date} | [${markdownLabel(title)}](./${candidate.name}) | ${config.defaults.mode} |\n`,
        );
      }
    } catch (error) {
      await rm(candidate.path, { force: true });
      throw error;
    }
    emit({
      type: "lesson-saved",
      status: "saved",
      targetRoot,
      memoryRoot: paths.root,
      outputRoot: workbook.root,
      topicId: topic?.id ?? null,
      file: relative(workbook.root, candidate.path).replaceAll("\\", "/"),
    });
  } finally {
    await rm(paths.lessonLock, { force: true, recursive: true });
  }
}

function tableCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownLabel(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("|", "\\|");
}

async function repairIndex(targetRoot, options) {
  const paths = await resolveMemoryPaths(targetRoot, options);
  const { config } = await readConfig(paths);
  const workbook = workbookPaths(paths, config);
  await requireSafePath(workbook.lessons, "directory");
  await requireSafePath(workbook.lessonIndex, "file");
  if (!options.yes) {
    emit({
      type: "consent-required",
      status: "not-repaired",
      targetRoot,
      requiredAction: "Confirm the lesson index should be rebuilt, then rerun with --yes.",
    });
    process.exitCode = 2;
    return;
  }
  await acquireLessonLock(paths);
  try {
    let expectedRevision = undefined;
    if (await pathExists(paths.curriculumData)) {
      const { data, revision } = await readCurriculum(paths.curriculumData);
      const curriculum = data;
      expectedRevision = revision;
      if ((curriculum.topics ?? []).length > 0) {
        let indexContent = "";
        try {
          indexContent = await readFile(workbook.lessonIndex, "utf8");
        } catch {
          // Ignore if missing
        }

        curriculum.learnerCompletion = curriculum.learnerCompletion || {};
        const lines = indexContent.split(/\r?\n/);
        for (const line of lines) {
          const match = line.match(/^- \[(x|X| )\] \*\*\[(.*?)\]\((.*?)\)\*\*/);
          if (match) {
            const isChecked = match[1].toLowerCase() === "x";
            const lessonPath = match[3];
            const topic = curriculum.topics.find((t) => t.lessonPath === lessonPath);
            if (topic) {
              curriculum.learnerCompletion[topic.id] = isChecked;
            }
          }
        }

        const files = new Set(
          (await readdir(workbook.lessons)).filter((name) => name.endsWith(".md")),
        );
        let changed = false;
        for (const topic of curriculum.topics) {
          const name = topic.lessonPath?.split("/").at(-1);
          if (name && files.has(name)) topic.status = "written";
          const isWritten = name && files.has(name);
          if (isWritten && topic.status !== "written") {
            topic.status = "written";
            changed = true;
          } else if (!isWritten && topic.status !== "planned") {
            topic.status = "planned";
            topic.lessonPath = null;
            delete topic.writtenAt;
            changed = true;
          }
        }
        if (changed) {
          curriculum.history = curriculum.history || [];
          curriculum.history.push({ action: "status-sync", date: new Date().toISOString() });
          await writeCurriculum(paths.curriculumData, curriculum, expectedRevision);
        }
        await replaceLessonIndex(workbook, renderCurriculumMarkdown(curriculum));
        emit({
          type: "lesson-index-repaired",
          status: "ready",
          targetRoot,
          indexedLessons: curriculum.topics.filter((topic) => topic.lessonPath).length,
        });
        return;
      }
    }
    const current = await readFile(workbook.lessonIndex, "utf8");
    const existingLines = current.split(/\r?\n/).filter((line) => line.startsWith("| "));
    const files = (await readdir(workbook.lessons, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "index.md")
      .sort((left, right) => left.name.localeCompare(right.name));
    const rows = [];
    for (const file of files) {
      const existing = existingLines.find((line) => line.includes(`](./${file.name})`));
      if (existing) {
        rows.push(existing);
        continue;
      }
      const content = await readFile(resolve(workbook.lessons, file.name), "utf8");
      const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.name.replace(/\.md$/, "");
      const date = /^\d{4}-\d{2}-\d{2}/.test(file.name)
        ? file.name.slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      rows.push(
        `| ${date} | [${markdownLabel(title)}](./${file.name}) | ${config.defaults.mode} |`,
      );
    }
    await replaceLessonIndex(
      workbook,
      `# Saved Lessons\n\n| Date | Lesson | Scope |\n| --- | --- | --- |\n${rows.length > 0 ? `${rows.join("\n")}\n` : ""}`,
    );
    emit({
      type: "lesson-index-repaired",
      status: "ready",
      targetRoot,
      indexedLessons: files.length,
    });
  } finally {
    await rm(paths.lessonLock, { force: true, recursive: true });
  }
}

async function recordDecision(targetRoot, options) {
  const paths = await resolveMemoryPaths(targetRoot, options);
  await readConfig(paths);
  await requireSafePath(paths.decisions, "file");
  if (!options.decision) throw new Error("--decision is required");
  if (!options.yes) {
    emit({
      type: "consent-required",
      status: "not-recorded",
      targetRoot,
      decision: options.decision,
      requiredAction: "Confirm this is a durable project decision, then rerun with --yes.",
    });
    process.exitCode = 2;
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  await appendFile(
    paths.decisions,
    `| ${date} | ${tableCell(options.scope || "project")} | ${tableCell(options.decision)} | ${tableCell(options.reason || "Not recorded")} |\n`,
    "utf8",
  );
  emit({ type: "decision-recorded", status: "saved", targetRoot, memoryRoot: paths.root });
}

async function acquireArtifactLock(paths) {
  try {
    await mkdir(paths.artifactLock);
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(
        "Another artifact save is active or left a stale lock; retry, then inspect .artifact-index.lock if the problem persists.",
      );
    throw error;
  }
}

async function replaceJsonFile(path, value) {
  const temporary = `${path}.${process.pid}-${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  try {
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

function artifactDefinition(type) {
  return {
    atlas: { directory: "atlases", extension: ".md", contentType: "text/markdown" },
    snapshot: { directory: "snapshots", extension: ".json", contentType: "application/json" },
    notebook: {
      directory: "notebooks",
      extension: ".ipynb",
      contentType: "application/x-ipynb+json",
    },
  }[type];
}

function sanitizeNotebook(content) {
  const notebook = JSON.parse(content);
  if (!Array.isArray(notebook.cells)) throw new Error("Notebook input must contain a cells array");
  let removedOutputs = 0;
  for (const cell of notebook.cells) {
    if (cell.cell_type !== "code") continue;
    removedOutputs += Array.isArray(cell.outputs) ? cell.outputs.length : 0;
    cell.outputs = [];
    cell.execution_count = null;
  }
  return { content: `${JSON.stringify(notebook, null, 2)}\n`, removedOutputs };
}

async function saveArtifact(targetRoot, options) {
  const paths = await resolveMemoryPaths(targetRoot, options);
  const { config } = await readConfig(paths);
  if (config.schemaVersion !== 2)
    throw new Error("Typed artifacts require project-memory schema v2; ask before running migrate");
  const definition = artifactDefinition(options.type);
  if (!definition) throw new Error("--type must be atlas, snapshot, or notebook");
  if (!options.title || !options.input) throw new Error("--title and --input are required");
  if (options.type === "snapshot" && !options.verified)
    throw new Error(
      "Snapshots require --verified so raw or unverified analyzer dumps are not persisted",
    );
  if (!options.yes) {
    emit({
      type: "consent-required",
      status: "not-saved",
      targetRoot,
      artifactType: options.type,
      input: resolve(options.input),
      requiredAction: "Confirm the typed artifact should be persisted, then rerun with --yes.",
    });
    process.exitCode = 2;
    return;
  }
  await requireSafePath(paths.artifacts, "directory");
  await requireSafePath(paths.artifactIndex, "file");
  const inputPath = await realpath(resolve(options.input));
  const inputDetails = await lstat(inputPath);
  if (!inputDetails.isFile() || inputDetails.size > 10 * 1024 * 1024)
    throw new Error("Artifact input must be a regular file no larger than 10 MiB");
  let content = await readFile(inputPath, "utf8");
  let sanitization = { removedOutputs: 0 };
  if (options.type === "notebook") {
    const sanitized = sanitizeNotebook(content);
    content = sanitized.content;
    sanitization = { removedOutputs: sanitized.removedOutputs };
  } else if (options.type === "snapshot") {
    content = `${JSON.stringify(JSON.parse(content), null, 2)}\n`;
  }
  const checked = await secretCheck(content, inputPath);
  if (!checked.ok) {
    emit({
      type: "secret-risk",
      status: "not-saved",
      targetRoot,
      diagnostics: checked.output.trim(),
      requiredAction: "Remove or redact the detected value and retry.",
    });
    process.exitCode = 2;
    return;
  }
  const directory = resolve(paths.artifacts, definition.directory);
  await requireSafePath(directory, "directory");
  const date = new Date().toISOString().slice(0, 10);
  const stem = `${date}-${slugify(options.title)}`;
  let candidate;
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const name = `${stem}${suffix === 1 ? "" : `-${suffix}`}${definition.extension}`;
    const path = resolve(directory, name);
    if (!(await pathExists(path))) {
      candidate = { name, path };
      break;
    }
  }
  if (!candidate) throw new Error("Could not allocate a unique artifact filename");
  await acquireArtifactLock(paths);
  try {
    await writeFile(candidate.path, content, { encoding: "utf8", flag: "wx" });
    try {
      const index = JSON.parse(await readFile(paths.artifactIndex, "utf8"));
      const relativePath = relative(paths.root, candidate.path).replaceAll("\\", "/");
      const entry = {
        id: createHash("sha256").update(`${options.type}:${relativePath}:${content}`).digest("hex"),
        type: options.type,
        title: options.title.replace(/\s+/g, " ").trim(),
        path: relativePath,
        contentType: definition.contentType,
        generatedAt: new Date().toISOString(),
        digest: createHash("sha256").update(content).digest("hex"),
        sourceScope: options.scope ?? "project",
        evidenceIds: String(options.evidence ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        verified: options.type === "snapshot" ? true : Boolean(options.verified),
        sanitization,
      };
      index.artifacts.push(entry);
      await replaceJsonFile(paths.artifactIndex, index);
      emit({
        type: "artifact-saved",
        status: "saved",
        targetRoot,
        memoryRoot: paths.root,
        artifact: entry,
      });
    } catch (error) {
      await rm(candidate.path, { force: true });
      throw error;
    }
  } finally {
    await rm(paths.artifactLock, { force: true, recursive: true });
  }
}

async function migrate(targetRoot, options) {
  const paths = await resolveMemoryPaths(targetRoot, options);
  const { config } = await readConfig(paths);
  if (config.schemaVersion === 2 && config.storage && config.tooling) {
    emit({ type: "migration-not-needed", status: "ready", targetRoot, schemaVersion: 2 });
    return;
  }
  const migrated = {
    ...config,
    schemaVersion: 2,
    output: {
      ...config.output,
      artifactTypes: ["atlas", "snapshot", "notebook"],
    },
    memory: { ...config.memory, typedArtifacts: true },
    sharing: config.sharing ?? (paths.location.mode === "private" ? "private" : "local"),
    storage: {
      mode:
        paths.location.mode === "private"
          ? "private"
          : config.sharing === "team"
            ? "team"
            : "project-local",
      projectId: paths.location.projectId,
    },
    analysis: {
      budgets: {
        maxFiles: 30000,
        maxManifestFiles: 1000,
        maxRelationFiles: 1500,
        maxRelationBytes: 12582912,
      },
      boundaryHints: [],
      criticalWorkflows: [],
      aliases: {},
    },
    tooling: {
      targetMutationPolicy: "deny",
      installationPolicy: "ask-user-scoped",
      artifactPolicy: "private-cache",
    },
    migratedAt: new Date().toISOString(),
  };
  if (!options.yes) {
    emit({
      type: "consent-required",
      status: "not-migrated",
      targetRoot,
      proposedConfig: migrated,
      writes: [
        paths.config,
        ...(config.schemaVersion === 1
          ? [paths.artifactIndex, `${paths.artifacts}/{atlases,snapshots,notebooks}/`]
          : []),
      ],
      requiredAction: "Review the v2 configuration and rerun migrate with --yes.",
    });
    process.exitCode = 2;
    return;
  }
  if (config.schemaVersion === 2) {
    await replaceJsonFile(paths.config, migrated);
    emit({ type: "memory-migrated", status: "ready", targetRoot, schemaVersion: 2 });
    return;
  }
  const staging = resolve(paths.root, `.artifacts-migration-${process.pid}-${Date.now()}`);
  await mkdir(resolve(staging, "atlases"), { recursive: true });
  await mkdir(resolve(staging, "snapshots"), { recursive: true });
  await mkdir(resolve(staging, "notebooks"), { recursive: true });
  await writeFile(
    resolve(staging, "index.json"),
    `${JSON.stringify({ schemaVersion: 1, artifacts: [] }, null, 2)}\n`,
    "utf8",
  );
  let installedArtifacts = false;
  try {
    await rename(staging, paths.artifacts);
    installedArtifacts = true;
    await replaceJsonFile(paths.config, migrated);
  } catch (error) {
    if (await pathExists(staging)) await rm(staging, { recursive: true, force: true });
    if (installedArtifacts) await rm(paths.artifacts, { recursive: true, force: true });
    throw error;
  }
  emit({ type: "memory-migrated", status: "ready", targetRoot, schemaVersion: 2 });
}

async function recordExerciseAction(targetRoot, options) {
  if (!options["topic-id"] || !options.type || !options.answer) {
    throw new Error("--topic-id, --type, and --answer are required");
  }
  const result = recordExercise(
    options["topic-id"],
    options.type,
    options.answer,
    !!options["session-only"],
  );
  process.stdout.write(`Exercise recorded (stored: ${result.stored}).\n`);
}

async function scheduleReviewAction(targetRoot, options) {
  if (!options["topic-id"]) throw new Error("--topic-id is required");
  scheduleReview(options["topic-id"], parseInt(options.days, 10) || 3);
  process.stdout.write("Review scheduled.\n");
}

import { fileURLToPath } from "node:url";

if (import.meta.url.startsWith("file:") && process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { action, options, targetInput } = parseArguments(process.argv.slice(2));
    if (
      !new Set([
        "status",
        "init",
        "save-lesson",
        "save-curriculum",
        "configure-output",
        "save-artifact",
        "record-decision",
        "repair-index",
        "migrate",
        "record-exercise",
        "schedule-review",
      ]).has(action)
    ) {
      printHelp();
      throw new Error(
        "Expected status, init, configure-output, save-curriculum, save-lesson, save-artifact, record-decision, migrate, repair-index, record-exercise, or schedule-review",
      );
    }
    const { targetRoot } = await resolveTargetRoot(targetInput);
    if (action === "status") await status(targetRoot, options);
    else if (action === "init") await init(targetRoot, options);
    else if (action === "configure-output") await configureOutput(targetRoot, options);
    else if (action === "save-curriculum") await saveCurriculum(targetRoot, options);
    else if (action === "save-lesson") await saveLesson(targetRoot, options);
    else if (action === "save-artifact") await saveArtifact(targetRoot, options);
    else if (action === "record-decision") await recordDecision(targetRoot, options);
    else if (action === "migrate") await migrate(targetRoot, options);
    else if (action === "repair-index") await repairIndex(targetRoot, options);
    else if (action === "record-exercise") await recordExerciseAction(targetRoot, options);
    else if (action === "schedule-review") await scheduleReviewAction(targetRoot, options);
  } catch (error) {
    if (error.code === "NO_MEMORY") {
      process.stderr.write(
        JSON.stringify({
          type: "target-error",
          code: error.code,
          reason: error.message,
          requestedTarget: error.target,
        }) + "\n",
      );
    } else if (error.code === "TARGET_IS_SKILL") {
      process.stderr.write(JSON.stringify(error) + "\n");
    } else {
      process.stderr.write(`Project memory failed: ${error.message}\n`);
    }
    process.exit(1);
  }
}
