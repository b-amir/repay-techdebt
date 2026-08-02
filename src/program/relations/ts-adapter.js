import { Project, SyntaxKind } from "ts-morph";
import { stableId } from "../identity.js";

/**
 * Parses a TypeScript/JavaScript file and extracts symbol-level relationships.
 *
 * @param {string} filePath The path to the file to parse.
 * @param {string} fileContent The source code of the file.
 * @returns {Object} Extracted definitions, references, calls, and inheritance relations.
 */
export function extractSymbolRelations(filePath, fileContent) {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(filePath, fileContent);

  const relations = [];
  const symbols = [];

  // 1. Find Definitions (Functions, Classes)
  sourceFile.forEachDescendant((node) => {
    if (
      node.isKind(SyntaxKind.FunctionDeclaration) ||
      node.isKind(SyntaxKind.ClassDeclaration) ||
      node.isKind(SyntaxKind.VariableDeclaration)
    ) {
      const nameNode = node.getNameNode();
      if (nameNode) {
        symbols.push({
          id: stableId("symbol", `${filePath}:${nameNode.getText()}`),
          name: nameNode.getText(),
          kind: node.getKindName().replace("Declaration", "").toLowerCase(),
        });
      }
    }

    // 2. Find Calls
    if (node.isKind(SyntaxKind.CallExpression)) {
      const expression = node.getExpression();
      const callName = expression.getText();
      // Simplistic, normally would use type checker to find exact symbol
      relations.push({
        from: stableId("symbol", `${filePath}:[caller]`), // Need to track containing scope
        to: stableId("symbol", `[external]:${callName}`),
        kind: "calls",
        confidence: 0.5, // High confidence needs full program type-checking
      });
    }

    // 3. Inheritance
    if (node.isKind(SyntaxKind.ClassDeclaration)) {
      const name = node.getName();
      const baseClass = node.getBaseClass();
      if (baseClass) {
        relations.push({
          from: stableId("symbol", `${filePath}:${name}`),
          to: stableId("symbol", `[external]:${baseClass.getName()}`),
          kind: "implements",
          confidence: 0.8,
        });
      }
    }
  });

  return { symbols, relations };
}
