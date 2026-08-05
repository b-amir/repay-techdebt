import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditSkillRuntime } from "../src/foundations/runtime-audit.js";

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
  const report = await auditSkillRuntime(skillRoot);
  if (format === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(
      `Bundled runtime: ${report.status} (Node ${report.node.current}: ${report.node.status}; required ${report.node.required})\n\n`,
    );
    process.stdout.write("| Package | Expected | Status |\n| --- | --- | --- |\n");
    for (const item of report.packages)
      process.stdout.write(`| ${item.package} | ${item.expectedVersion} | ${item.status} |\n`);
  }
  if (report.status !== "ready") process.exitCode = 2;
} catch (error) {
  process.stderr.write(`Runtime check failed: ${error.message}\n`);
  process.exitCode = 1;
}
