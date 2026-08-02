// @category C9
// Orphaned-file detection. The import-graph test catches an import that points at a
// MISSING file; this catches the opposite failure mode — a file that EXISTS but nothing
// imports (a stale copy left behind by a botched move, or a dead module). Together they
// mean a restructure cannot silently drop or duplicate a module.
//
// A library file with zero importers is an orphan unless it is a declared entry point
// (a category barrel, or an explicit public entry listed below).
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import { parse } from "acorn";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const libraryRoots = [resolve(root, "src"), resolve(root, "scripts/lib")].filter((d) =>
  existsSync(d),
);
const importerRoots = [
  resolve(root, "src"),
  resolve(root, "scripts"),
  resolve(root, "test"),
].filter((d) => existsSync(d));

async function listJs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listJs(full)));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function relativeSpecs(ast) {
  const specs = [];
  (function visit(node) {
    if (!node || typeof node.type !== "string") return;
    let src = null;
    if (node.type === "ImportDeclaration") src = node.source;
    else if (node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration")
      src = node.source;
    else if (node.type === "ImportExpression") src = node.source;
    else if (node.type === "CallExpression" && node.callee?.type === "Import")
      src = node.arguments[0];
    if (src && src.type === "Literal" && typeof src.value === "string") specs.push(src.value);
    for (const key of Object.keys(node)) {
      if (["loc", "start", "end", "range", "comments"].includes(key)) continue;
      const val = node[key];
      if (Array.isArray(val)) val.forEach((v) => v && typeof v.type === "string" && visit(v));
      else if (val && typeof val.type === "string") visit(val);
    }
  })(ast);
  return specs;
}

function isRelative(spec) {
  return spec.startsWith("./") || spec.startsWith("../");
}

// Declared entry points: a barrel re-exports a category's public surface and may be
// imported only through the package or by name (zero in-repo importers is normal).
function isDeclaredEntry(absPath) {
  const name = absPath.split("/").pop();
  return name === "index.js" || /^index-[a-z]+\.js$/.test(name);
}

test("no library file is orphaned (every non-entry module has ≥1 importer)", async () => {
  const libraryFiles = (await Promise.all(libraryRoots.map(listJs))).flat();
  const importerFiles = (await Promise.all(importerRoots.map(listJs))).flat();

  // Map every relative import to the absolute file it resolves to, and tally importers.
  const importerCount = new Map();
  for (const file of importerFiles) {
    let ast;
    try {
      ast = parse(await readFile(file, "utf8"), {
        ecmaVersion: "latest",
        sourceType: "module",
        allowHashBang: true,
        allowReturnOutsideFunction: true,
      });
    } catch {
      continue; // unparseable files are flagged by cli-load; don't double-report here.
    }
    for (const spec of relativeSpecs(ast)) {
      if (!isRelative(spec)) continue;
      const target = resolve(dirname(file), spec);
      importerCount.set(target, (importerCount.get(target) ?? 0) + 1);
    }
  }

  const orphans = libraryFiles.filter(
    (file) => !isDeclaredEntry(file) && (importerCount.get(file) ?? 0) === 0,
  );

  assert.deepEqual(
    orphans.map((f) => relative(root, f)).sort(),
    [],
    orphans.length === 0
      ? ""
      : `${orphans.length} library file(s) are imported by nothing (dead module, or a stale ` +
          `copy left by a move). Delete them or, if they are a real public entry, rename to ` +
          `index.js / index-<category>.js:\n` +
          orphans.map((f) => `  ${relative(root, f)}`).join("\n"),
  );
});
