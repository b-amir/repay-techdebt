import { readFile, writeFile } from "node:fs/promises";

function splitYamlDocuments(lockText) {
  return lockText
    .split(/^---\s*$/mu)
    .map((document) => document.trim())
    .filter(Boolean);
}

function isProjectDependencyDocument(document) {
  const lines = document.split(/\r?\n/u);
  const importerStart = lines.findIndex((line) => /^importers:\s*$/u.test(line));
  if (importerStart < 0) return false;
  const importerEnd = lines.findIndex(
    (line, index) => index > importerStart && /^\S[^:]*:\s*$/u.test(line),
  );
  const importerSection = lines
    .slice(importerStart, importerEnd < 0 ? undefined : importerEnd)
    .join("\n");
  return (
    /^\s{2}\.\s*:\s*$/mu.test(importerSection) &&
    /^\s{4}(?:dependencies|devDependencies|optionalDependencies):\s*$/mu.test(importerSection)
  );
}

/**
 * Vite+ may store its package-manager bootstrap and the project dependency lock
 * as separate YAML documents. pnpm consumes a conventional single-document
 * lock, so runtime installation must receive only the project document.
 */
export function selectRuntimeLockDocument(lockText) {
  const documents = splitYamlDocuments(lockText);
  const projectDocuments = documents.filter(isProjectDependencyDocument);
  if (projectDocuments.length !== 1) {
    throw new Error(
      `Expected exactly one project dependency document in pnpm-lock.yaml; found ${projectDocuments.length}`,
    );
  }
  return `${projectDocuments[0]}\n`;
}

export async function materializeRuntimeLock(sourcePath, destinationPath) {
  const lockText = await readFile(sourcePath, "utf8");
  await writeFile(destinationPath, selectRuntimeLockDocument(lockText), "utf8");
}
