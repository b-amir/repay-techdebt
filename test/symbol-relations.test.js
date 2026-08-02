import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { extractSymbolRelations } from "../scripts/lib/relations/ts-adapter.js";

test("ts-adapter extracts function and class definitions", () => {
  const content = `
    class User {}
    function login() {}
    const x = 5;
  `;
  const result = extractSymbolRelations("test.ts", content);
  
  const classSym = result.symbols.find(s => s.name === "User");
  const fnSym = result.symbols.find(s => s.name === "login");
  const varSym = result.symbols.find(s => s.name === "x");
  
  assert.ok(classSym);
  assert.equal(classSym.kind, "class");
  
  assert.ok(fnSym);
  assert.equal(fnSym.kind, "function");

  assert.ok(varSym);
  assert.equal(varSym.kind, "variable");
});

test("ts-adapter extracts inheritance", () => {
  const content = `
    class Base {}
    class Derived extends Base {}
  `;
  const result = extractSymbolRelations("test.ts", content);
  
  const rel = result.relations.find(r => r.kind === "implements");
  assert.ok(rel);
  // Confidence check
  assert.equal(rel.confidence, 0.8);
});

test("ts-adapter extracts basic calls", () => {
  const content = `
    function action() {
      doSomething();
    }
  `;
  const result = extractSymbolRelations("test.ts", content);
  
  const rel = result.relations.find(r => r.kind === "calls");
  assert.ok(rel);
});
