#!/usr/bin/env node
// Dependency-free entrypoint: establish the linked runtime before loading the
// project-memory implementation and its package-backed module graph.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSkillRuntime, RuntimeBootstrapError } from "../src/foundations/ensure-runtime.js";

const skillRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const implementationPath = fileURLToPath(new URL("./project-memory-main.js", import.meta.url));

try {
  await ensureSkillRuntime({ skillRoot });
  process.argv[1] = implementationPath;
  await import("./project-memory-main.js");
} catch (error) {
  if (error instanceof RuntimeBootstrapError) {
    process.stderr.write(`Project memory runtime failed: ${error.message}\n`);
    if (error.details) process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
  } else {
    process.stderr.write(`Project memory failed: ${error.message}\n`);
  }
  process.exit(1);
}
