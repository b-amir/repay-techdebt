import { extname } from "node:path";
import python from "@ast-grep/lang-python";
import astGrep from "@ast-grep/napi";
import { Project, SyntaxKind } from "ts-morph";

const { parse, registerDynamicLanguage } = astGrep;
registerDynamicLanguage({ python });

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndColumnAtPos(node.getStart()).line;
}

function javascriptRelationships(path, source) {
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(path, source, { overwrite: true });
  const results = [];
  const diagnostics = [];
  for (const declaration of sourceFile.getImportDeclarations())
    results.push({
      specifier: declaration.getModuleSpecifierValue(),
      line: lineOf(sourceFile, declaration),
      analyzer: "ts-morph",
      confidence: 0.99,
      form: "static-import",
    });
  for (const declaration of sourceFile.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (specifier)
      results.push({
        specifier,
        line: lineOf(sourceFile, declaration),
        analyzer: "ts-morph",
        confidence: 0.99,
        form: "re-export",
      });
  }
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression().getText();
    if (!new Set(["require", "import"]).has(expression)) continue;
    const argument = call.getArguments()[0];
    if (
      !argument ||
      !new Set([SyntaxKind.StringLiteral, SyntaxKind.NoSubstitutionTemplateLiteral]).has(
        argument.getKind(),
      )
    ) {
      diagnostics.push({
        severity: "warning",
        code: "computed-module-specifier",
        line: lineOf(sourceFile, call),
        message: `${expression} uses a computed module specifier that static resolution cannot enumerate.`,
      });
      continue;
    }
    results.push({
      specifier: argument.getLiteralText(),
      line: lineOf(sourceFile, call),
      analyzer: "ts-morph",
      confidence: 0.98,
      form: expression === "import" ? "dynamic-import" : "require",
    });
  }
  return { diagnostics, relations: results };
}

function walk(node, visit) {
  visit(node);
  for (const child of node.children()) walk(child, visit);
}

function pythonRelationships(source) {
  const root = parse("python", source).root();
  const results = [];
  walk(root, (node) => {
    if (!new Set(["import_statement", "import_from_statement"]).has(node.kind())) return;
    const text = node.text();
    const line = node.range().start.line + 1;
    if (node.kind() === "import_from_statement") {
      const specifier = text.match(/^\s*from\s+([.A-Za-z0-9_]+)/)?.[1];
      if (specifier)
        results.push({
          specifier,
          line,
          analyzer: "tree-sitter-python",
          confidence: 0.98,
          form: "from-import",
        });
    } else {
      const list = text.replace(/^\s*import\s+/, "").split(",");
      for (const item of list) {
        const specifier = item.trim().split(/\s+as\s+/)[0];
        if (specifier)
          results.push({
            specifier,
            line,
            analyzer: "tree-sitter-python",
            confidence: 0.98,
            form: "import",
          });
      }
    }
  });
  return results;
}

const regexAdapters = new Map([
  [".gleam", [/^\s*import\s+([A-Za-z0-9_/-]+)/gm]],
  [".ex", [/(?:^|\s)(?:alias|import|require|use)\s+([A-Z][A-Za-z0-9_.]+)/gm]],
  [".exs", [/(?:^|\s)(?:alias|import|require|use)\s+([A-Z][A-Za-z0-9_.]+)/gm]],
  [".go", [/^\s*import\s+["`]([^"`]+)["`]/gm, /^\s*["`]([^"`]+)["`]\s*$/gm]],
  [".rs", [/^\s*(?:use|mod)\s+([A-Za-z0-9_:]+)/gm]],
  [".java", [/^\s*import\s+([A-Za-z0-9_.]+)/gm]],
  [".kt", [/^\s*import\s+([A-Za-z0-9_.]+)/gm]],
  [".kts", [/^\s*import\s+([A-Za-z0-9_.]+)/gm]],
  [".cs", [/^\s*using\s+([A-Za-z0-9_.]+)/gm]],
  [".swift", [/^\s*import\s+([A-Za-z0-9_.]+)/gm]],
]);

function regexRelationships(extension, source) {
  const results = [];
  for (const pattern of regexAdapters.get(extension) ?? [])
    for (const match of source.matchAll(pattern))
      if (match[1])
        results.push({
          specifier: match[1],
          line: source.slice(0, match.index).split(/\r?\n/).length,
          analyzer: `regex-${extension.slice(1)}`,
          confidence: 0.72,
          form: "syntax-heuristic",
        });
  return results;
}

export function extractRelationships(path, source) {
  const extension = extname(path).toLowerCase();
  try {
    const extracted = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]).has(
      extension,
    )
      ? javascriptRelationships(path, source)
      : new Set([".py", ".pyi"]).has(extension)
        ? { diagnostics: [], relations: pythonRelationships(source) }
        : { diagnostics: [], relations: regexRelationships(extension, source) };
    const relations = extracted.relations;
    return {
      relations: [
        ...new Map(
          relations.map((item) => [`${item.specifier}:${item.line}:${item.form}`, item]),
        ).values(),
      ],
      diagnostics: extracted.diagnostics,
      semanticLevel: relations.some((item) => !item.analyzer.startsWith("regex-"))
        ? "ast"
        : relations.length > 0
          ? "syntax-heuristic"
          : "unsupported",
    };
  } catch (error) {
    return {
      relations: regexRelationships(extension, source),
      semanticLevel: "syntax-heuristic",
      diagnostics: [
        { severity: "error", code: "relationship-parser-failed", message: error.message },
      ],
    };
  }
}
