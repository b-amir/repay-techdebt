import { z } from "zod";

const ANGLES_SCHEMA = z.object({
  angles: z
    .array(
      z.object({
        sentence: z.string(),
        hint: z.string(),
      }),
    )
    .length(3),
});

/**
 * Prepares the profile string from the project model for the purpose suggester.
 * @param {Object} model The project model from profile-project.js
 * @returns {string} The profile summary facts.
 */
export function buildProfileFacts(model) {
  if (!model || !model.profile) return "No project profile available.";

  const workflows = model.profile.criticalWorkflows || [];
  const boundaries = model.profile.boundaryEvidence || [];

  let facts = "";
  if (workflows.length > 0) {
    facts += `- Top workflows: ${workflows.join(", ")}\n`;
  }

  if (boundaries.length > 0) {
    // Take top 2 boundaries based on confidence
    const sorted = [...boundaries].sort((a, b) => b.confidence - a.confidence).slice(0, 2);
    facts += `- Key boundaries: ${sorted.map((b) => b.path).join(", ")}\n`;
  }

  if (!facts) {
    facts = "- Generic codebase (no specific workflows or boundaries detected).";
  }

  return facts.trim();
}

/**
 * Validates the agent's output shape for purpose suggestions.
 * @param {Object} data The parsed JSON object from the agent.
 * @returns {Object} Validated angles or throws an error.
 */
export function validatePurposeAngles(data) {
  return ANGLES_SCHEMA.parse(data);
}
