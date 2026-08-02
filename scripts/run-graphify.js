import { lstat, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { projectStoragePaths, pathExists } from "../src/foundations/private-storage.js";
import {
  formatTargetError,
  resolveTargetRoot,
  runCommand,
  sanitizeDiagnostic,
} from "../src/tools/tooling.js";

function help() {
  process.stdout.write(`Usage:
  node run-graphify.js paths <target-root>
  node run-graphify.js extract <target-root> [--force] --yes
  node run-graphify.js query <target-root> --question <text> [--dfs] [--budget <count>]
  node run-graphify.js path <target-root> --from <node> --to <node>
  node run-graphify.js explain <target-root> --node <node>

The wrapper never installs Graphify, project hooks, or agent instructions. Extraction writes only
to Repay Tech Debt's external private cache. Query logging is forced off.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const [action, targetInput, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const name = argument.slice(2);
    if (new Set(["yes", "force", "dfs"]).has(name)) options[name] = true;
    else {
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      options[name] = value;
      index += 1;
    }
  }
  if (!new Set(["paths", "extract", "query", "path", "explain"]).has(action))
    throw new Error("Expected paths, extract, query, path, or explain");
  return { action, options, targetInput };
}

function graphifyPaths(targetRoot) {
  const storage = projectStoragePaths(targetRoot);
  const outputRoot = resolve(storage.cacheRoot, "graphify");
  return {
    projectId: storage.projectId,
    cacheRoot: storage.cacheRoot,
    outputRoot,
    graphPath: resolve(outputRoot, "graphify-out", "graph.json"),
  };
}

async function requireGraph(path) {
  const details = await lstat(path);
  if (!details.isFile() || details.isSymbolicLink())
    throw new Error("The private Graphify graph is not a regular file");
}

function toolFailure(reason, paths) {
  return {
    type: "tool-failure",
    tool: "graphify",
    reason: sanitizeDiagnostic(reason),
    setup: 'uv tool install "graphifyy[mcp]"',
    installationScope: "isolated user tool environment; never the target project",
    privateGraph: paths.graphPath,
    fallback:
      "ask whether to install/repair and retry, use the bundled normalized relation graph, or skip graph analysis",
  };
}

async function runGraphify(args, paths, timeout = 300_000) {
  const command = process.env.REPAY_GRAPHIFY_COMMAND || "graphify";
  return runCommand(command, args, {
    cwd: paths.cacheRoot,
    env: { ...process.env, GRAPHIFY_QUERY_LOG_DISABLE: "1" },
    timeout,
    maxBuffer: 50 * 1024 * 1024,
  });
}

try {
  const { action, options, targetInput } = parse(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);
  const paths = graphifyPaths(target.targetRoot);
  if (action === "paths") {
    process.stdout.write(
      `${JSON.stringify(
        {
          status: (await pathExists(paths.graphPath)) ? "ready" : "not-indexed",
          targetRoot: target.targetRoot,
          targetWrites: [],
          ...paths,
        },
        null,
        2,
      )}\n`,
    );
  } else if (action === "extract") {
    if (!options.yes) {
      process.stdout.write(
        `${JSON.stringify(
          {
            type: "consent-required",
            status: "not-extracted",
            targetRoot: target.targetRoot,
            privateWrites: [paths.outputRoot],
            targetWrites: [],
            network: false,
            requiredAction:
              "Confirm private-cache extraction, then rerun with --yes; installation remains a separate consent decision.",
          },
          null,
          2,
        )}\n`,
      );
      process.exitCode = 2;
    } else {
      await mkdir(paths.cacheRoot, { recursive: true });
      const arguments_ = [
        "extract",
        target.targetRoot,
        "--code-only",
        "--out",
        paths.outputRoot,
        ...(options.force ? ["--force"] : []),
      ];
      const result = await runGraphify(arguments_, paths);
      if (!result.ok) {
        process.stderr.write(`${JSON.stringify(toolFailure(result.reason, paths))}\n`);
        process.exitCode = 2;
      } else if (!(await pathExists(paths.graphPath))) {
        process.stderr.write(
          `${JSON.stringify(toolFailure("Graphify exited successfully but produced no private graph", paths))}\n`,
        );
        process.exitCode = 2;
      } else {
        await requireGraph(paths.graphPath);
        process.stdout.write(
          `${JSON.stringify(
            {
              analyzer: "graphify",
              operation: "extract-code-only",
              status: "succeeded",
              targetRoot: target.targetRoot,
              graphPath: paths.graphPath,
              privateWrites: [paths.outputRoot],
              targetWrites: [],
              network: false,
              detail: sanitizeDiagnostic(result.stdout || result.stderr, 1000),
            },
            null,
            2,
          )}\n`,
        );
      }
    }
  } else {
    if (!(await pathExists(paths.graphPath))) {
      process.stderr.write(
        `${JSON.stringify(
          toolFailure(
            "No private graph exists; ask before running external-cache extraction",
            paths,
          ),
        )}\n`,
      );
      process.exitCode = 2;
    } else {
      await requireGraph(paths.graphPath);
      let arguments_;
      if (action === "query") {
        if (!options.question) throw new Error("--question is required for query");
        const budget = options.budget === undefined ? null : Number(options.budget);
        if (budget !== null && (!Number.isInteger(budget) || budget < 1 || budget > 100_000))
          throw new Error("--budget must be an integer from 1 to 100000");
        arguments_ = [
          "query",
          options.question,
          ...(options.dfs ? ["--dfs"] : []),
          ...(budget === null ? [] : ["--budget", String(budget)]),
          "--graph",
          paths.graphPath,
        ];
      } else if (action === "path") {
        if (!options.from || !options.to) throw new Error("--from and --to are required for path");
        arguments_ = ["path", options.from, options.to, "--graph", paths.graphPath];
      } else {
        if (!options.node) throw new Error("--node is required for explain");
        arguments_ = ["explain", options.node, "--graph", paths.graphPath];
      }
      const result = await runGraphify(arguments_, paths, 60_000);
      if (!result.ok) {
        process.stderr.write(`${JSON.stringify(toolFailure(result.reason, paths))}\n`);
        process.exitCode = 2;
      } else {
        process.stdout.write(
          `${JSON.stringify(
            {
              analyzer: "graphify",
              operation: action,
              status: "succeeded",
              targetRoot: target.targetRoot,
              graphPath: paths.graphPath,
              targetWrites: [],
              output: result.stdout,
            },
            null,
            2,
          )}\n`,
        );
      }
    }
  }
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? `Graphify wrapper failed: ${error.message}`}\n`,
  );
  process.exitCode = 1;
}
