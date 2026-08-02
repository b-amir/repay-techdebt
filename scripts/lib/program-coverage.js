/**
 * Pure coverage aggregation for program models.
 * @param {object} input
 * @param {string} input.scope
 * @param {number} input.discoveredLength
 * @param {number} input.filesLength
 * @param {number} input.manifestFilesLength
 * @param {number} input.maxManifestFiles
 * @param {number} input.relationCandidateCount
 * @param {number} input.relationFilesRead
 * @param {number} input.skippedLargeFiles
 * @param {number} input.maxRelationFiles
 * @param {number} input.relationBytesRead
 * @param {number} input.maxRelationBytes
 * @param {number} input.unreadableFiles
 * @param {number} input.maxFiles
 * @param {string[]} input.relationLanguagesSupported
 * @param {string[]} input.relationLanguagesUnsupported
 * @param {Array<{ path: string, parser: string, severity: string, code: string, message: string, line?: number }>} input.parserDiagnostics
 * @param {Array<{ path: string, parser: string, severity: string, code: string, message: string, line?: number }>} input.relationshipDiagnostics
 */
export function buildCoverage(input) {
  const {
    scope,
    discoveredLength,
    filesLength,
    manifestFilesLength,
    maxManifestFiles,
    relationCandidateCount,
    relationFilesRead,
    skippedLargeFiles,
    maxRelationFiles,
    relationBytesRead,
    maxRelationBytes,
    unreadableFiles,
    maxFiles,
    relationLanguagesSupported,
    relationLanguagesUnsupported,
    parserDiagnostics,
    relationshipDiagnostics,
  } = input;

  const truncated =
    discoveredLength > filesLength ||
    manifestFilesLength > maxManifestFiles ||
    relationCandidateCount > relationFilesRead + skippedLargeFiles ||
    relationBytesRead >= maxRelationBytes;

  const reasonCodes = [];
  if (scope !== ".") reasonCodes.push("scoped-analysis");
  if (discoveredLength > filesLength) reasonCodes.push("file-limit-reached");
  if (manifestFilesLength > maxManifestFiles) reasonCodes.push("manifest-file-limit-reached");
  if (relationCandidateCount > relationFilesRead + skippedLargeFiles)
    reasonCodes.push("relation-file-limit-or-budget-reached");
  if (relationBytesRead >= maxRelationBytes) reasonCodes.push("relation-byte-budget-reached");
  if (skippedLargeFiles > 0) reasonCodes.push("oversized-relation-files-skipped");
  if (unreadableFiles > 0) reasonCodes.push("unreadable-files");
  if (relationshipDiagnostics.some((item) => item.severity === "error"))
    reasonCodes.push("relationship-parser-errors");
  if (relationshipDiagnostics.some((item) => item.code === "computed-module-specifier"))
    reasonCodes.push("computed-module-specifiers-unresolved");
  if (parserDiagnostics.some((item) => item.severity === "error"))
    reasonCodes.push("manifest-parser-errors");
  if (relationLanguagesUnsupported.length > 0)
    reasonCodes.push("unsupported-relationship-languages");

  return {
    status: truncated || reasonCodes.length > 0 ? "partial" : "complete",
    reasonCodes: [...new Set(reasonCodes)],
    discoveredFiles: discoveredLength,
    modeledFiles: filesLength,
    manifestFilesDiscovered: manifestFilesLength,
    manifestFilesRead: Math.min(manifestFilesLength, maxManifestFiles),
    relationFilesRead,
    relationBytesRead,
    fileLimit: maxFiles,
    manifestFileLimit: maxManifestFiles,
    relationFileLimit: maxRelationFiles,
    relationReadBudget: maxRelationBytes,
    truncated,
    skippedLargeFiles,
    unreadableFiles,
    relationLanguagesSupported,
    relationLanguagesUnsupported,
    parserDiagnostics: [...parserDiagnostics, ...relationshipDiagnostics],
  };
}
