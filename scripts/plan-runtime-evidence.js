import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { globby } from "globby";
import { formatTargetError, resolveTargetRoot } from "./lib/targeting.js";

function help() {
  process.stdout.write(`Usage:
  node plan-runtime-evidence.js <target-root> [--format json|markdown]

Discover candidate runtime evidence operations without executing them. Every operation remains
permission-gated because tests, builds, services, profilers, and scripts can mutate state or use
network and credentials even when their names look safe.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  let format = "json";
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--format") {
      format = argv[index + 1];
      index += 1;
    } else if (argv[index].startsWith("--")) throw new Error(`Unknown option: ${argv[index]}`);
    else positional.push(argv[index]);
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  if (!new Set(["json", "markdown"]).has(format))
    throw new Error("--format must be json or markdown");
  return { targetInput: positional[0], format };
}

function operation(id, source, proposedCommand, evidence, cautions) {
  return {
    id,
    source,
    proposedCommand,
    evidence,
    gate: "permission-required",
    requiredBeforeRun: [
      "inspect the resolved command/configuration rather than trusting its name",
      "confirm target-local writes, services, network, credentials, databases, queues, and external effects",
      "ask the user before execution unless the exact operation was already authorized",
    ],
    cautions,
  };
}

function markdown(report) {
  const lines = [
    "# Runtime Evidence Plan",
    "",
    `Target: \`${report.targetRoot}\``,
    "",
    "No operation below was executed. Every candidate is permission-gated.",
    "",
    "| Candidate | Source | Proposed command | Evidence gained | Key cautions |",
    "| --- | --- | --- | --- | --- |",
    ...report.operations.map(
      (item) =>
        `| ${item.id} | \`${item.source}\` | \`${item.proposedCommand}\` | ${item.evidence} | ${item.cautions.join("; ")} |`,
    ),
    "",
    ...report.unresolved.map((item) => `- ${item}`),
  ];
  return `${lines.join("\n")}\n`;
}

try {
  const { targetInput, format } = parse(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);
  const ignore = [
    "**/.git/**",
    "**/.repay-techdebt/**",
    "**/node_modules/**",
    "**/vendor/**",
    ...(target.relativeSkillRoot ? [`${target.relativeSkillRoot}/**`] : []),
  ];
  const manifests = await globby(
    [
      "**/package.json",
      "**/pyproject.toml",
      "**/pytest.ini",
      "**/go.mod",
      "**/Cargo.toml",
      "**/*.sln",
      "**/pom.xml",
      "**/build.gradle",
      "**/build.gradle.kts",
      "**/mix.exs",
      "**/gleam.toml",
    ],
    {
      cwd: target.targetRoot,
      dot: true,
      followSymbolicLinks: false,
      gitignore: true,
      ignore,
      onlyFiles: true,
    },
  );
  const lockFiles = await globby(
    [
      "**/pnpm-lock.yaml",
      "**/yarn.lock",
      "**/package-lock.json",
      "**/bun.lock",
      "**/bun.lockb",
      "**/uv.lock",
      "**/poetry.lock",
    ],
    {
      cwd: target.targetRoot,
      dot: true,
      followSymbolicLinks: false,
      gitignore: true,
      ignore,
      onlyFiles: true,
    },
  );
  const lockNames = new Set(lockFiles.map((path) => basename(path)));
  const operations = [];
  for (const path of manifests.slice(0, 200)) {
    const name = basename(path);
    if (name === "package.json") {
      try {
        const parsed = JSON.parse(await readFile(resolve(target.targetRoot, path), "utf8"));
        const declaredManager = String(parsed.packageManager ?? "").split("@")[0];
        const packageManager = new Set(["npm", "pnpm", "yarn", "bun"]).has(declaredManager)
          ? declaredManager
          : lockNames.has("pnpm-lock.yaml")
            ? "pnpm"
            : lockNames.has("yarn.lock")
              ? "yarn"
              : lockNames.has("bun.lock") || lockNames.has("bun.lockb")
                ? "bun"
                : "npm";
        for (const script of ["test", "check", "lint", "typecheck", "build", "bench", "e2e"].filter(
          (item) => parsed.scripts?.[item],
        ))
          operations.push(
            operation(
              `package-script-${script}`,
              path,
              `${packageManager} run ${script}`,
              `${script} behavior and diagnostics`,
              [
                "package scripts are arbitrary code",
                script === "build"
                  ? "may write build artifacts"
                  : "may write caches, snapshots, or reports",
              ],
            ),
          );
      } catch {
        operations.push(
          operation(
            "inspect-malformed-package-manifest",
            path,
            "none",
            "resolve malformed package metadata",
            ["manifest could not be parsed; do not guess a package command"],
          ),
        );
      }
    } else if (name === "go.mod")
      operations.push(
        operation("go-tests", path, "go test ./...", "Go compilation, behavior, and failures", [
          "tests may use network, files, databases, or environment",
        ]),
      );
    else if (name === "Cargo.toml")
      operations.push(
        operation("rust-tests", path, "cargo test", "Rust compilation, behavior, and failures", [
          "may build artifacts and run arbitrary test code",
        ]),
      );
    else if (name === "pyproject.toml" || name === "pytest.ini")
      operations.push(
        operation(
          "python-tests",
          path,
          lockNames.has("uv.lock")
            ? "uv run pytest"
            : lockNames.has("poetry.lock")
              ? "poetry run pytest"
              : "python -m pytest",
          "Python behavior and failures",
          ["test plugins and fixtures may have external effects"],
        ),
      );
    else if (name.endsWith(".sln"))
      operations.push(
        operation("dotnet-tests", path, `dotnet test ${path}`, ".NET compilation and behavior", [
          "may restore packages, build, and run arbitrary test code",
        ]),
      );
    else if (name === "mix.exs")
      operations.push(
        operation("elixir-tests", path, "mix test", "Elixir compilation, behavior, and failures", [
          "Mix may fetch dependencies, compile artifacts, and run arbitrary test setup",
        ]),
      );
    else if (name === "gleam.toml")
      operations.push(
        operation("gleam-tests", path, "gleam test", "Gleam compilation, behavior, and failures", [
          "Gleam may fetch dependencies, compile artifacts, and execute BEAM or JavaScript test code",
        ]),
      );
    else if (name === "pom.xml")
      operations.push(
        operation("maven-tests", path, "mvn test", "JVM compilation and behavior", [
          "plugins may download dependencies and execute arbitrary goals",
        ]),
      );
    else if (name.startsWith("build.gradle"))
      operations.push(
        operation("gradle-tests", path, "./gradlew test", "JVM compilation and behavior", [
          "wrapper and plugins may download dependencies and run arbitrary tasks",
        ]),
      );
  }
  const unique = [
    ...new Map(operations.map((item) => [`${item.id}:${item.source}`, item])).values(),
  ];
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    targetRoot: target.targetRoot,
    status: unique.length > 0 ? "candidates-found" : "no-candidates",
    executed: [],
    operations: unique,
    unresolved: [
      "Static discovery cannot prove a candidate is hermetic, read-only, safe, fast, configured, or representative.",
      "Production frequency, latency, scale, data shape, and failure rates require authorized telemetry or reproducible runtime evidence.",
      ...(unique.length === 0
        ? [
            "No conventional runtime/test manifest was found; ask how this program is built and exercised.",
          ]
        : []),
    ],
  };
  process.stdout.write(
    format === "json" ? `${JSON.stringify(report, null, 2)}\n` : markdown(report),
  );
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "runtime-plan-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
