// @category C1
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { discoverWorkflows } from "../src/program/workflow-discovery.js";

test("discoverWorkflows labels single clues as weak", () => {
  const model = {
    nodes: [{ id: "1", kind: "file", name: "routes.js" }],
  };
  const workflows = discoverWorkflows(model);
  assert.equal(workflows.length, 1);
  assert.ok(workflows[0].confidence <= 0.4);
  assert.match(workflows[0].reasons[0], /weak signal/);
});

test("discoverWorkflows raises confidence for converging clues", () => {
  const model = {
    nodes: [
      { id: "1", kind: "route", name: "GET /api/users" },
      { id: "2", kind: "route", name: "POST /api/users" },
    ],
  };
  const workflows = discoverWorkflows(model);
  assert.equal(workflows.length, 1);
  assert.ok(workflows[0].confidence > 0.7);
  assert.match(workflows[0].reasons[0], /Found 2 route nodes/);
});

test("discoverWorkflows distinguishes commands from routes", () => {
  const model = {
    nodes: [
      { id: "1", kind: "command", name: "start" },
      { id: "2", kind: "file", name: "cli.js" },
    ],
  };
  const workflows = discoverWorkflows(model);
  assert.equal(workflows.length, 1);
  assert.equal(workflows[0].name, "CLI Execution");
  assert.ok(workflows[0].confidence > 0.7);
});
