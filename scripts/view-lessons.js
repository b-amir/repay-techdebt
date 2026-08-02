#!/usr/bin/env node
// Local workbook viewer. Always-on shell (sidebar + lesson list + progress + mark-done).
// Loopback only; never serves a chrome-less orphan lesson page.
//
//   node scripts/view-lessons.js <target-root> [--port 8765] [--open] [--lesson <rel-path>]
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapSkillRuntime } from "../src/foundations/runtime-install.js";

const skillRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

const { values, positionals } = parseArgs({
  options: {
    port: { type: "string", default: "8765" },
    open: { type: "boolean" },
    lesson: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  process.stdout.write(`Usage:
  node scripts/view-lessons.js <target-root> [--port 8765] [--open] [--lesson <rel-path>]

Serves the always-on workbook shell on 127.0.0.1. Markdown lessons + progress.json
in the workbook output; curriculum.json (private) drives the directory rail.
--lesson selects the current row (deep link into the same shell).
`);
  process.exit(values.help ? 0 : 1);
}

function openInBrowser(url) {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? ["open", [url]]
      : platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  spawn(command[0], command[1], { detached: true, stdio: "ignore" }).unref();
}

async function main() {
  await bootstrapSkillRuntime(skillRoot);

  const { ensureSkillRuntime } = await import("../src/foundations/ensure-runtime.js");
  await ensureSkillRuntime({ skillRoot });

  const { resolveTargetRoot, formatTargetError, TargetRootError } = await import(
    "../src/foundations/targeting.js",
  );
  const { resolveWorkbook } = await import("../src/viewer/resolve-workbook.js");
  const { createViewerServer } = await import("../src/viewer/server.js");

  const { targetRoot } = await resolveTargetRoot(positionals[0]);
  const workbook = await resolveWorkbook(targetRoot);
  const requestedPort = Number(values.port);
  if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
    throw new Error("--port must be an integer from 1 to 65535");
  }
  const server = createViewerServer({ workbook });

  const port = await listenWithFallback(server, requestedPort);
  const deepPath = values.lesson ? `/lesson/${encodeURI(values.lesson)}` : "/";
  const url = `http://127.0.0.1:${port}${deepPath}`;
  process.stdout.write(`Workbook viewer for ${targetRoot}\n  ${url}\n`);
  process.stdout.write(
    workbook.ready ? "  Workbook ready.\n" : "  No workbook yet — initialize the target first.\n",
  );
  process.stdout.write("  Ctrl-C to stop.\n");
  if (values.open) openInBrowser(url);
}

function listenWithFallback(server, requested) {
  return new Promise((resolveP, reject) => {
    const tryPort = (port, attemptsLeft) => {
      server.once("error", (error) => {
        if (error.code === "EADDRINUSE" && attemptsLeft > 0 && port < 65535) {
          server.removeAllListeners("listening");
          tryPort(port + 1, attemptsLeft - 1);
        } else {
          reject(error);
        }
      });
      server.listen(port, "127.0.0.1", () => {
        server.removeAllListeners("error");
        resolveP(port);
      });
    };
    tryPort(requested, 16);
  });
}

main().catch(async (error) => {
  const { formatTargetError, TargetRootError } = await import("../src/foundations/targeting.js");
  if (error instanceof TargetRootError) {
    const formatted = formatTargetError(error);
    process.stderr.write(formatted ? `${formatted}\n` : `${error.message}\n`);
  } else {
    process.stderr.write(`Viewer failed: ${error.message}\n`);
  }
  process.exit(1);
});
