import { extractLessonCitations } from "./lesson-citation-check.js";
import { parseClaimsBlock } from "./claim-faithfulness.js";
import { inspectLessonShape } from "./lesson-shape.js";

const DEPTH_RANGES = {
  concise: [250, 650],
  balanced: [450, 950],
  deep: [700, 1300],
};

const EMPTY_HEADING =
  /^(?:introduction|overview|details|more information|conclusion|predict|read|run|investigate|modify|make)$/i;
const AI_PUFFERY =
  /\b(?:delve|game[- ]changer|revolutionary|cutting[- ]edge|robust and scalable|seamlessly|in today(?:'s)? (?:fast-paced|digital) world)\b/i;
const TEMPLATED_CLAIMS = [
  /Explains the purpose of/i,
  /Explains how it is called by/i,
  /Explains dependency on/i,
];

function wordCount(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`#>*_[\]()|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @param {string} markdown
 * @param {{ depth?: string, expectedEvidencePaths?: string[], subject?: string }} [options]
 */
export function inspectLesson(
  markdown,
  { depth = "balanced", expectedEvidencePaths = [], subject } = {},
) {
  if (!DEPTH_RANGES[depth]) throw new Error("depth must be concise, balanced, or deep");
  const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
  const evidence = extractLessonCitations(markdown);
  const paragraphs = markdown
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/)
    .filter((paragraph) => !/^\s*(?:#|[-*]|\||>)/.test(paragraph))
    .map((paragraph) => ({
      text: paragraph,
      words: paragraph.split(/\s+/).filter(Boolean).length,
    }));
  const count = wordCount(markdown);
  const [minimum, maximum] = DEPTH_RANGES[depth];
  const errors = [];
  const warnings = [];
  if (count < minimum)
    errors.push(`Lesson has ${count} words; ${depth} lessons need at least ${minimum}.`);
  if (count > maximum)
    errors.push(
      `Lesson has ${count} words; split this subject because ${depth} lessons stop at ${maximum}.`,
    );
  if (headings.length < 3 || headings.length > 8)
    errors.push(`Lesson has ${headings.length} level-two sections; use 3–8 clear sections.`);
  const generic = headings.filter((heading) => EMPTY_HEADING.test(heading));
  if (generic.length > 0)
    errors.push(`Replace process labels with subject headings: ${generic.join(", ")}.`);
  if (new Set(evidence.map((item) => item.replace(/:\d+$/, ""))).size < 2)
    errors.push("Cite at least two verified project-relative source paths with line numbers.");
  const citedPaths = [...new Set(evidence.map((item) => item.replace(/:\d+$/, "")))];
  if (
    expectedEvidencePaths.length > 0 &&
    !citedPaths.some((cited) =>
      expectedEvidencePaths.some(
        (expected) => cited === expected || cited.startsWith(`${expected.replace(/\/$/, "")}/`),
      ),
    )
  )
    errors.push("Cite at least one source anchor selected for this curriculum topic.");
  if (AI_PUFFERY.test(markdown))
    errors.push("Remove generic or promotional AI phrasing; use concrete project language.");

  // Reject templated claims
  const templatedMatches = TEMPLATED_CLAIMS.filter((regex) => regex.test(markdown));
  if (templatedMatches.length >= 2) {
    errors.push(
      "Lesson uses templated claim language. Make specific, evidence-derived claims instead.",
    );
  }

  // Diagram constraints (Task 19)
  const mermaidBlocks = [...markdown.matchAll(/```mermaid\n([\s\S]*?)\n```/g)];
  for (const block of mermaidBlocks) {
    const code = block[1];
    const sourceLines = code
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("%%") && !/^acc(?:Title|Descr):/.test(line));
    const diagramHeader = sourceLines[0] ?? "";

    if (
      !/^(?:flowchart|sequenceDiagram|stateDiagram-v2|erDiagram|classDiagram)\b/.test(diagramHeader)
    ) {
      errors.push(
        "Lesson uses prohibited experimental Mermaid type. Use only flowchart, sequenceDiagram, stateDiagram-v2, erDiagram, or classDiagram.",
      );
    }

    if (/^flowchart\s+(?:LR|RL)\b/.test(diagramHeader)) {
      warnings.push(
        "Horizontal Mermaid flowchart detected. Prefer a compact TD/TB portrait layout that reads without zooming; keep LR/RL only when horizontal order is essential and the rendered graph stays narrow.",
      );
    }

    // Accessibility
    if (!/^\s*accTitle:/m.test(code)) {
      errors.push("Mermaid diagram is missing accTitle.");
    }
    if (!/^\s*accDescr:/m.test(code)) {
      errors.push("Mermaid diagram is missing accDescr.");
    }

    // Size constraints
    const lines = code.split("\n").length;
    if (lines > 30) {
      errors.push("Mermaid diagram is too long (> 30 lines). Simplify or use prose.");
    }
    const relation =
      /<\|--|--\|>|-->>|->>|-->|==>|-\.->|\|\|--o\{|o\{--\|\||\}o--\|\||\|\|--\|\||--/;
    const nodes = new Set();
    let edges = 0;
    for (const line of sourceLines.slice(1)) {
      const match = line.match(relation);
      if (match) {
        edges += 1;
        const left = line
          .slice(0, match.index)
          .trim()
          .match(/^([A-Za-z][\w-]*)/);
        const rightSource = line
          .slice((match.index ?? 0) + match[0].length)
          .replace(/^\s*\|[^|]*\|\s*/, "");
        const right = rightSource.match(/^([A-Za-z][\w-]*)/);
        if (left) nodes.add(left[1]);
        if (right) nodes.add(right[1]);
      }
      const declaration = line.match(/^(?:participant|actor|state|class)\s+([A-Za-z][\w-]*)/);
      if (declaration) nodes.add(declaration[1]);
    }
    if (nodes.size > 8 || edges > 10) {
      errors.push(
        `Mermaid diagram exceeds the explanatory budget (${nodes.size} nodes, ${edges} edges; maximum 8 nodes and 10 edges). Reduce it to the smallest useful subgraph.`,
      );
    }
    if (/\binteracts(?:\s+with)?\b/i.test(code)) {
      errors.push(
        "Mermaid relationships must name the verified action or transition; replace generic 'interacts' edges.",
      );
    }
  }

  // Check for the mandatory takeaway if a diagram exists
  if (mermaidBlocks.length > 0 && !/\*\*What this shows:\*\*/i.test(markdown)) {
    errors.push("Lesson with a diagram must include a '**What this shows:**' summary.");
  }

  // Reject diagram sidecars
  if (/!\[.*?\]\(.*?\.(?:mmd|svg|png|jpg)\)/.test(markdown)) {
    errors.push("Do not use external image or diagram sidecars. Use fenced Mermaid blocks.");
  }

  const longParagraphs = paragraphs.filter((paragraph) => paragraph.words > 140);
  if (longParagraphs.length > 0)
    warnings.push(
      `${longParagraphs.length} paragraph(s) exceed 140 words; give each paragraph one job.`,
    );
  if (!/\b(?:you|your)\b/i.test(markdown))
    warnings.push(
      "Address the learner directly at least once so the outcome and action are explicit.",
    );
  if (!/\b(?:because|therefore|so that|which means|as a result)\b/i.test(markdown))
    warnings.push("Add at least one explicit cause-and-consequence explanation.");

  const nonMermaidFence = [...markdown.matchAll(/^```([^\n`]*)\n[\s\S]*?^```/gm)].some(
    (match) => match[1].trim().split(/\s+/)[0]?.toLowerCase() !== "mermaid",
  );
  if (!nonMermaidFence) {
    warnings.push(
      "Add at least one verified non-Mermaid fenced code snippet from the primary path.",
    );
  }

  const shape = inspectLessonShape(markdown, { subject });
  for (const error of shape.errors) {
    if (!errors.includes(error)) errors.push(error);
  }
  for (const warning of shape.warnings) {
    if (!warnings.includes(warning)) warnings.push(warning);
  }
  const checkSection = shape.sections.check;
  if (
    checkSection &&
    !/\b(?:modify|change|debug|fix|predict|run|assert|expect|break|remove|add|replace)\b/i.test(
      checkSection,
    )
  ) {
    warnings.push(
      "Check section appears recall-only; end with a modify, debug, run, or prediction job.",
    );
  }

  const claimBlock = parseClaimsBlock(markdown, { detailed: true });
  if (claimBlock.malformedLines.length > 0) {
    errors.push(
      `Malformed CLAIMS entries must use the documented numbered format: ${claimBlock.malformedLines.slice(0, 3).join(" | ")}`,
    );
  }
  if (claimBlock.claims.length > 5) {
    warnings.push(
      `Lesson has ${claimBlock.claims.length} parsed CLAIMS; prefer at most 5 material claims.`,
    );
  }
  const existenceClaims = claimBlock.claims.filter((item) =>
    /\b(?:exports?|defines?|declares?|exists?|export\s+(?:function|const|class)|is\s+an?\s+(?:function|class|constant|type))\b/i.test(
      item.claim,
    ),
  );
  if (claimBlock.claims.length > 0 && existenceClaims.length / claimBlock.claims.length > 0.5) {
    warnings.push(
      "Most CLAIMS are existence/export-shaped; explain behavioral mechanisms instead.",
    );
  }
  return {
    ok: errors.length === 0,
    depth,
    wordCount: count,
    sectionCount: headings.length,
    evidenceCount: new Set(evidence).size,
    evidencePaths: citedPaths,
    citations: [...new Set(evidence)],
    errors,
    warnings,
    shape,
  };
}

export function evaluateSpecification(markdown, spec) {
  const errors = [];

  // A simplistic heuristic since we don't have an LLM here:
  // We check if required claims are mentioned by keywords.
  for (const item of spec.requiredClaims) {
    const claim = typeof item === "string" ? item : item.claim;
    // Basic heuristic: check if any word of the claim > 4 letters is in the markdown
    const keyWords = claim
      .split(/[^a-zA-Z0-9]+/)
      .filter((w) => w.length > 4)
      .map((w) => w.toLowerCase());
    const mdLower = markdown.toLowerCase();
    const missing = keyWords.filter((w) => !mdLower.includes(w));
    if (missing.length === keyWords.length && keyWords.length > 0) {
      errors.push(`Missing required claim: ${claim}`);
    }
  }

  // Also verify challenge exists
  if (!/challenge|task|exercise/i.test(markdown)) {
    errors.push("Missing transfer challenge/task at the end of the lesson.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
