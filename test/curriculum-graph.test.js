import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { buildStudyOrder } from "../scripts/lib/curriculum-graph.js";

test("buildStudyOrder sequences purpose before architecture and implementation", () => {
  const topics = [
    { id: "1", kind: "file", focus: "impl.js", importance: 50 },
    { id: "2", kind: "workflow", focus: "auth", importance: 90 },
    { id: "3", kind: "component", focus: "src", importance: 80 }
  ];
  
  const result = buildStudyOrder(topics);
  assert.equal(result.length, 3);
  assert.equal(result[0].kind, "workflow");
  assert.equal(result[1].kind, "component");
  assert.equal(result[2].kind, "file");
});

test("buildStudyOrder respects prerequisites", () => {
  const topics = [
    { id: "area1", kind: "area", focus: "src/api", prerequisites: [] },
    { id: "comp1", kind: "component", focus: "src", prerequisites: [] }
  ];
  
  const result = buildStudyOrder(topics);
  
  const areaIdx = result.findIndex(t => t.id === "area1");
  const compIdx = result.findIndex(t => t.id === "comp1");
  assert.ok(compIdx < areaIdx); // Component comes before Area inside it
});

test("buildStudyOrder handles cycles gracefully", () => {
  const topics = [
    { id: "a", kind: "file", prerequisites: ["b"] },
    { id: "b", kind: "file", prerequisites: ["a"] }
  ];
  const result = buildStudyOrder(topics);
  assert.equal(result.length, 2);
});
