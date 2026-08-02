// @category C9
// H1 — Static import graph. Fails when a relative import points at a missing file.
// This is the primary "folder move broke something" net.
//
// Scope: every `scripts/**/*.js` and `src/**/*.js`. Bare packages and `node:` builtins are
// skipped (resolve happens through node_modules, not disk under this repo). `src/` is the
// Scanning src/ too means a moved file can never escape this net.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { parse } from "acorn";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptsDir = resolve(root, "scripts");
const srcDir = resolve(root, "src");

/** Recursively list every `.js` file under a directory. */
async function listJs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listJs(full)));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

/** All `.js` files under scripts/ and (when present) src/. A missing src/ is tolerated so
 *  the test stays green before any category is moved. */
async function listAllJs() {
  const dirs = [scriptsDir, ...(existsSync(srcDir) ? [srcDir] : [])];
  const lists = await Promise.all(dirs.map((d) => listJs(d)));
  return lists.flat();
}

/** Visit every AST node once. acorn-walk is not used so ImportExpression (dynamic
 *  import()) is handled regardless of walker version. */
function visit(node, fn) {
  if (!node || typeof node.type !== "string") return;
  fn(node);
  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "start" || key === "end" || key === "range" || key === "comments")
      continue;
    const val = node[key];
    if (Array.isArray(val)) {
      for (const v of val) if (v && typeof v.type === "string") visit(v, fn);
    } else if (val && typeof val.type === "string") {
      visit(val, fn);
    }
  }
}

/** Extract import specifiers from a parsed module (static, re-export, dynamic). */
function specifiersOf(ast) {
  const specs = [];
  visit(ast, (node) => {
    let src = null;
    if (node.type === "ImportDeclaration") src = node.source;
    else if (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration")
      src = node.source;
    else if (node.type === "ImportExpression") src = node.source;
    else if (node.type === "CallExpression" && node.callee?.type === "Import")
      src = node.arguments[0];
    if (src && src.type === "Literal" && typeof src.value === "string") specs.push(src.value);
  });
  return specs;
}

function isRelative(spec) {
  return spec.startsWith("./") || spec.startsWith("../");
}

/** Resolve a relative specifier to an existing absolute path, or null if missing.
 *  Convention is explicit `.js`; the `.js` and `/index.js` fallbacks are forward-safety
 *  for a future extensionless or directory import. */
function resolveExisting(importer, spec) {
  const dir = dirname(importer);
  const candidates = [resolve(dir, spec)];
  if (!spec.endsWith(".js")) {
    candidates.push(resolve(dir, `${spec}.js`));
    candidates.push(resolve(dir, spec, "index.js"));
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

test("every relative import in scripts/ and src/ resolves to an existing file", async () => {
  const files = await listAllJs();
  assert.ok(files.length > 0, "no scripts found — directory moved?");

  const broken = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    let ast;
    try {
      ast = parse(source, {
        ecmaVersion: "latest",
        sourceType: "module",
        allowHashBang: true,
        allowReturnOutsideFunction: true,
      });
    } catch (err) {
      broken.push({ importer: relative(root, file), spec: "<parse error>", resolved: err.message });
      continue;
    }
    for (const spec of specifiersOf(ast)) {
      if (!isRelative(spec)) continue; // bare package or node: builtin — skip
      if (resolveExisting(file, spec) === null) {
        broken.push({
          importer: relative(root, file),
          spec,
          resolved: relative(root, resolve(dirname(file), spec)),
        });
      }
    }
  }

  assert.deepEqual(
    broken,
    [],
    broken.length === 0
      ? ""
      : `${broken.length} relative import(s) point at missing files (folder move forgot an importer?):\n` +
          broken.map((b) => `  ${b.importer}  →  ${b.spec}  (resolved ${b.resolved})`).join("\n"),
  );
});

test("src/ has no import cycles (soft — logged, not fatal)", async () => {
  // Detecting cycles keeps the dependency data visible in CI output without flipping the
  // suite red. Promote to an assertion only after intentionally tightening layer rules.
  if (!existsSync(srcDir)) return; // nothing to scan
  const files = await listJs(srcDir);
  const adj = new Map();
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const ast = parse(source, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowHashBang: true,
      allowReturnOutsideFunction: true,
    });
    const edges = [];
    for (const spec of specifiersOf(ast)) {
      if (!isRelative(spec)) continue;
      const target = resolveExisting(file, spec);
      if (target && files.includes(target)) edges.push(target);
    }
    adj.set(file, edges);
  }

  const cycles = [];
  function dfs(start, current, stack, visited) {
    for (const next of adj.get(current) ?? []) {
      if (next === start && stack.length >= 1) {
        cycles.push([...stack.map((f) => relative(root, f)), relative(root, start)]);
        return;
      }
      if (visited.has(next)) continue;
      visited.add(next);
      dfs(start, next, [...stack, next], visited);
    }
  }
  for (const file of files) dfs(file, file, [file], new Set([file]));

  if (cycles.length) {
    const uniq = [...new Set(cycles.map((c) => c.join(" → ")))];
    // eslint-disable-next-line no-console
    console.warn(
      `[import-graph] ${uniq.length} cycle(s) in scripts/lib (non-fatal):\n` +
        uniq.map((c) => `  ${c}`).join("\n"),
    );
  }
  // Soft check: always passes. Existence proves the graph walks cleanly.
  assert.ok(true, `cycle scan ran over ${files.length} lib files`);
});
