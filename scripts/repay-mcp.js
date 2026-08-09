#!/usr/bin/env node
/**
 * Optional stdio MCP-ish server: thin JSON-RPC over existing repay tools.
 * Register only when the host supports MCP; skill path works without this process.
 *
 * Wire protocol (minimal):
 *   {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
 *   {"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
 *   {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"repay_doctor","arguments":{"targetRoot":"..."}}}
 *
 * Ask before editing agent MCP config. Never required for teach/save/resume.
 */
import { createInterface } from "node:readline";
import { listRepayTools, callRepayTool } from "../src/tools/repay-tools.js";
import { isDirectCliInvocation } from "../src/foundations/cli-entry.js";

function help() {
  process.stdout.write(`Usage:
  node scripts/repay-mcp.js

Stdio JSON-RPC server for optional repay tools (doctor, trajectory, claims, PR,
save-evaluate, workbook, capabilities, status, list/get lesson, quality/evidence/faithfulness, progress).
Optional enhance - bundled scripts remain the default path when this process is not running.
`);
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function respondError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}

async function handle(message) {
  const id = message.id ?? null;
  const method = message.method;
  const params = message.params ?? {};

  if (method === "initialize") {
    return respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "repay-techdebt", version: "1.0.0" },
    });
  }
  if (method === "notifications/initialized" || method === "initialized") {
    return;
  }
  if (method === "tools/list") {
    return respond(id, { tools: listRepayTools() });
  }
  if (method === "tools/call") {
    const name = params.name;
    const args = params.arguments ?? params.args ?? {};
    try {
      const result = await callRepayTool(name, args);
      return respond(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: result.ok === false,
        structuredContent: result,
      });
    } catch (error) {
      return respond(id, {
        content: [{ type: "text", text: String(error?.message ?? error) }],
        isError: true,
      });
    }
  }
  if (method === "ping") return respond(id, {});
  return respondError(id, -32601, `Method not found: ${method}`);
}

if (isDirectCliInvocation(import.meta.url)) {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      respondError(null, -32700, "Parse error");
      return;
    }
    try {
      await handle(message);
    } catch (error) {
      respondError(message.id ?? null, -32603, String(error?.message ?? error));
    }
  });
}

export { handle, listRepayTools, callRepayTool };
