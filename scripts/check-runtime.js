import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function printHelp() {
  process.stdout.write("Usage: node check-runtime.js [--format table|json]\n\n");
  process.stdout.write("Dependency-free bootstrap check for the bundled skill runtime.\n");
}

function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const formatIndex = argv.indexOf("--format");
  const format = formatIndex >= 0 ? argv[formatIndex + 1] : "table";
  if (!new Set(["json", "table"]).has(format)) throw new Error("--format must be table or json");
  return format;
}

try {
  const format = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(resolve(skillRoot, "package.json"), "utf8"));
  const packages = Object.keys(manifest.dependencies ?? {});
  const currentNodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  const nodeSupported = currentNodeMajor >= 22;
  const results = packages.map((name) => {
    const installed = existsSync(resolve(skillRoot, "node_modules", ...name.split("/")));
    return {
      package: name,
      status: installed ? "ready" : "missing",
      expectedVersion: manifest.dependencies[name],
    };
  });
  const report = {
    node: {
      current: process.versions.node,
      required: manifest.engines?.node ?? "unspecified",
      status: nodeSupported ? "ready" : "unsupported",
    },
    status: !nodeSupported
      ? "unsupported-runtime"
      : results.every((item) => item.status === "ready")
        ? "ready"
        : "missing-dependencies",
    packages: results,
  };
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `Bundled runtime: ${report.status} (Node ${report.node.current}: ${report.node.status}; required ${report.node.required})\n\n`,
    );
    process.stdout.write("| Package | Expected | Status |\n| --- | --- | --- |\n");
    for (const item of results)
      process.stdout.write(`| ${item.package} | ${item.expectedVersion} | ${item.status} |\n`);
  }
  if (report.status !== "ready") process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Runtime check failed: ${error.message}\n`);
  process.exitCode = 1;
}
