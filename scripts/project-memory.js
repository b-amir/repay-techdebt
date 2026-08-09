#!/usr/bin/env node
// Dependency-free entrypoint: establish the linked runtime before loading the
// project-memory implementation and its package-backed module graph.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const formatIndex = args.indexOf("--format");
const isJson = formatIndex !== -1 && args[formatIndex + 1] === "json";

if (isJson && !process.env.REPAY_TECHDEBT_NO_STDERR) {
  const result = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: ["inherit", "inherit", "pipe"],
    env: { ...process.env, REPAY_TECHDEBT_NO_STDERR: "1" },
  });
  if (result.stderr) {
    const stderrStr = result.stderr.toString();
    const filtered = stderrStr
      .split("\n")
      .filter(
        (line) =>
          !line.includes("SecTrustSettingsCopyCertificates") && !line.includes("certificate"),
      )
      .join("\n");
    if (filtered.trim()) {
      process.stderr.write(filtered);
      if (!filtered.endsWith("\n")) process.stderr.write("\n");
    }
  }
  process.exit(result.status ?? 1);
}

import { ensureSkillRuntime, RuntimeBootstrapError } from "../src/foundations/ensure-runtime.js";

const skillRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const implementationPath = fileURLToPath(new URL("./project-memory-main.js", import.meta.url));

try {
  await ensureSkillRuntime({ skillRoot });
  process.argv[1] = implementationPath;
  await import("./project-memory-main.js");
} catch (error) {
  if (error instanceof RuntimeBootstrapError) {
    if (isJson) {
      process.stdout.write(
        JSON.stringify(
          { type: "error", status: "fail", message: error.message, details: error.details },
          null,
          2,
        ) + "\n",
      );
    } else {
      process.stderr.write(`Project memory runtime failed: ${error.message}\n`);
      if (error.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
  } else {
    if (isJson) {
      process.stdout.write(
        JSON.stringify({ type: "error", status: "fail", message: error.message }, null, 2) + "\n",
      );
    } else {
      process.stderr.write(`Project memory failed: ${error.message}\n`);
    }
  }
  process.exit(1);
}
