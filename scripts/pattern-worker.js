import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import python from "@ast-grep/lang-python";
import astGrep from "@ast-grep/napi";
import { Parser } from "acorn";
import tsPlugin from "acorn-typescript";
import * as walk from "acorn-walk";
import { Project, SyntaxKind } from "ts-morph";

const { parse, registerDynamicLanguage } = astGrep;
registerDynamicLanguage({ python });

const MAX_FILE_BYTES = 1_000_000;
const LOOP_TYPES = new Set([
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "WhileStatement",
]);
const TypeScriptParser = Parser.extend(tsPlugin({ jsx: true }));

function genericWalker(node, state, callback) {
  for (const [key, value] of Object.entries(node)) {
    if (new Set(["loc", "range", "start", "end"]).has(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value)
        if (child && typeof child.type === "string") callback(child, state);
    } else if (value && typeof value.type === "string") callback(value, state);
  }
}

const visitorBase = new Proxy(walk.base, {
  get(target, property) {
    return Reflect.get(target, property) ?? genericWalker;
  },
});

function snippetFor(source, lineNumber) {
  const compact = (source.split(/\r?\n/)[lineNumber - 1] ?? "").trim().replace(/\s+/g, " ");
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact;
}

function add(findings, source, file, line, pattern, analyzer) {
  findings.push({ file, line, pattern, snippet: snippetFor(source, line), analyzer });
}

function detectAcorn(source, file, extension) {
  const parser = new Set([".ts", ".tsx", ".jsx"]).has(extension) ? TypeScriptParser : Parser;
  const ast = parser.parse(source, {
    allowHashBang: true,
    ecmaVersion: "latest",
    locations: true,
    sourceType: "module",
  });
  const findings = [];
  const loopVisitor = (node, _state, ancestors) => {
    if (ancestors.slice(0, -1).some((ancestor) => LOOP_TYPES.has(ancestor.type)))
      add(findings, source, file, node.loc.start.line, "Nested Loop", "acorn");
  };
  walk.ancestor(
    ast,
    {
      CallExpression(node) {
        if (
          node.callee?.type === "Identifier" &&
          ["useCallback", "useEffect"].includes(node.callee.name)
        )
          add(
            findings,
            source,
            file,
            node.loc.start.line,
            `React Hook: ${node.callee.name}`,
            "acorn",
          );
        if (
          node.callee?.type === "MemberExpression" &&
          node.callee.object?.name === "Promise" &&
          node.callee.property?.name === "all"
        )
          add(findings, source, file, node.loc.start.line, "Promise.all aggregation", "acorn");
      },
      CatchClause(node) {
        if (node.body?.body?.length === 0)
          add(findings, source, file, node.loc.start.line, "Empty Catch Block", "acorn");
      },
      DoWhileStatement: loopVisitor,
      ForInStatement: loopVisitor,
      ForOfStatement: loopVisitor,
      ForStatement: loopVisitor,
      WhileStatement: loopVisitor,
    },
    visitorBase,
  );
  return findings;
}

function detectTypeScript(source, file) {
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(file, source, { overwrite: true });
  const findings = [];
  for (const node of sourceFile.getDescendants()) {
    const line = sourceFile.getLineAndColumnAtPos(node.getStart()).line;
    if (node.getKind() === SyntaxKind.AsExpression && node.getTypeNode()?.getText() === "any")
      add(findings, source, file, line, "Type escape: as any", "ts-morph");
    if (node.getKind() === SyntaxKind.NonNullExpression)
      add(findings, source, file, line, "Non-null assertion", "ts-morph");
    if (
      new Set([
        SyntaxKind.FunctionDeclaration,
        SyntaxKind.MethodDeclaration,
        SyntaxKind.TypeAliasDeclaration,
        SyntaxKind.InterfaceDeclaration,
      ]).has(node.getKind()) &&
      typeof node.getTypeParameters === "function" &&
      node.getTypeParameters().length > 0
    )
      add(findings, source, file, line, "Generic type parameters", "ts-morph");
  }
  return findings;
}

function walkPython(node, visit) {
  visit(node);
  for (const child of node.children()) walkPython(child, visit);
}

function detectPython(source, file) {
  const root = parse("python", source).root();
  const findings = [];
  walkPython(root, (node) => {
    const line = node.range().start.line + 1;
    const firstLine = node.text().split(/\r?\n/, 1)[0];
    if (node.kind() === "function_definition" && /(?:=\s*\[|=\s*\{|=\s*set\s*\()/.test(firstLine))
      add(findings, source, file, line, "Python mutable default argument", "ast-grep");
    if (node.kind() === "except_clause" && /^\s*except\s*:/.test(firstLine))
      add(findings, source, file, line, "Python broad except", "ast-grep");
    if (node.kind() === "decorator")
      add(findings, source, file, line, "Python decorator", "ast-grep");
    if (node.kind() === "list_comprehension")
      add(findings, source, file, line, "Python list comprehension", "ast-grep");
    if (node.kind() === "with_statement")
      add(findings, source, file, line, "Python context manager", "ast-grep");
  });
  return findings;
}

export default async function analyzeFile({ absolutePath, file }) {
  const details = await stat(absolutePath);
  if (details.size > MAX_FILE_BYTES)
    return { findings: [], warning: `Pattern scan: skipped oversized file ${file}.` };
  const source = await readFile(absolutePath, "utf8");
  const extension = extname(file).toLowerCase();
  if (extension === ".py") return { findings: detectPython(source, file) };
  const findings = detectAcorn(source, file, extension);
  if (new Set([".ts", ".tsx"]).has(extension)) findings.push(...detectTypeScript(source, file));
  return { findings };
}
