import { extractLessonCitations } from "./lesson-citation-check.js";

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

export function inspectLesson(markdown, { depth = "balanced", expectedEvidencePaths = [] } = {}) {
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

    // Prohibited experimental/unsupported diagrams
    if (
      /^\s*(pie|gitGraph|mindmap|sankey-beta|C4Context|C4Container|C4Component|C4Dynamic)/m.test(
        code,
      )
    ) {
      errors.push(
        "Lesson uses prohibited experimental Mermaid type. Use only flowchart, sequenceDiagram, stateDiagram-v2, erDiagram, or classDiagram.",
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
