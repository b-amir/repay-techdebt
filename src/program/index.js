// Program model (C1) public API.
// When you make a function public, add it to this barrel.
export { normalized, normalizeScope, classifyFile, discoverTargetFiles } from "./program-scan.js";

export { buildCoverage } from "./program-coverage.js";

export {
  MODEL_VERSION,
  evidenceSchema,
  programNodeSchema,
  programEdgeSchema,
  programModelSchema,
  analysisPlanSchema,
} from "./program-model-schema.js";

export { buildProgramModel, loadPackRegistry } from "./program-intelligence.js";

export { parseManifest } from "./manifest-intelligence.js";

export { extractRelationships } from "./relationship-intelligence.js";

export { discoverWorkflows } from "./workflow-discovery.js";

export { buildWorkflowGraph } from "./workflow-graph.js";

export { planAnalysis, summarizeModel } from "./plan-analysis-core.js";
