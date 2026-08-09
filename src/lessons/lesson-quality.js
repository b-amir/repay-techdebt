import { extractLessonCitations } from "./lesson-citation-check.js";
import { parseCitation } from "./citation-model.js";
import { parseClaimsBlock } from "./claim-faithfulness.js";
import { inspectLessonShape } from "./lesson-shape.js";
import { inspectLearningMoments } from "./learning-moments.js";
import { USEFULNESS_FLOORS } from "./usefulness-floors.js";
import { parseLessonFrontmatter, craftFieldsFromFrontmatter } from "./lesson-frontmatter.js";
import { inspectHeadingVariety } from "./heading-variety.js";

const DEPTH_RANGES = {
  concise: [USEFULNESS_FLOORS.minBodyWords.concise, USEFULNESS_FLOORS.maxBodyWords.concise],
  balanced: [USEFULNESS_FLOORS.minBodyWords.balanced, USEFULNESS_FLOORS.maxBodyWords.balanced],
  deep: [USEFULNESS_FLOORS.minBodyWords.deep, USEFULNESS_FLOORS.maxBodyWords.deep],
};

const EMPTY_HEADING =
  /^(?:introduction|overview|details|more information|conclusion|predict|read|run|investigate|modify|make|the mechanism|mechanism|pitfall|try it|invariant|takeaway|the tricky part|tricky part|check yourself|your turn|walk the path(?: in code)?|read the whole mechanism|how it works|change(?: it)? safely)$/i;
const AI_PUFFERY =
  /\b(?:delve|game[- ]changer|revolutionary|cutting[- ]edge|robust and scalable|seamlessly|in today(?:'s)? (?:fast-paced|digital) world)\b/i;
const TEMPLATED_CLAIMS = [
  /Explains the purpose of/i,
  /Explains how it is called by/i,
  /Explains dependency on/i,
];
const HOLLOW_OPENING =
  /\b(?:in this lesson|this lesson (?:will|covers|explores|discusses)|we (?:will|are going to) (?:explore|cover|discuss)|welcome to)\b/i;
const FREEFORM_BRIEF =
  /(?:^|\n)#\s+Lesson\s*:|(?:^|\n)###\s+(?:Goal|Overview|Summary|Key Mechanisms\b)|(?:^|\n)\*\*(?:Topic ID|Date|Focus|Chapter)\*\*\s*:/i;
const VERIFICATION_LANGUAGE =
  /\b(?:test|assert|expect|verify|check|run|observe|measure|log|trace|rollback|recover|diagnos|reproduce)\w*\b/i;
const UNSAFE_DEVTOOLS_ACTION =
  /\b(?:copy|paste|share|expose|reveal)\b.{0,60}\b(?:secret|token|password|cookie value|authorization header)\b|\b(?:disable|remove|bypass)\b.{0,50}\b(?:auth|guard|permission|security|csrf|validation)\b|\b(?:delete|mutate|edit|change|write(?:\s+to)?)\b.{0,50}\bproduction\b|\bproduction\b.{0,50}\b(?:delete|mutate|edit|change|write)\b/i;

function normalizeEvidencePath(value) {
  return String(value ?? "")
    .replace(/^\.\//, "")
    .replaceAll("\\", "/")
    .replace(/\/$/, "");
}

function evidencePathsOverlap(left, right) {
  const a = normalizeEvidencePath(left);
  const b = normalizeEvidencePath(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function wordCount(markdown) {
  const { body } = parseLessonFrontmatter(markdown);
  return (body || markdown)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[`#>*_[\]()|-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * @param {string} markdown
 * @param {{ depth?: string, expectedEvidencePaths?: string[], subject?: string, requireLearningMomentDecisions?: boolean }} [options]
 */
export function inspectLesson(
  markdown,
  {
    depth = "balanced",
    expectedEvidencePaths = [],
    subject,
    requireLearningMomentDecisions = false,
  } = {},
) {
  if (!DEPTH_RANGES[depth]) throw new Error("depth must be concise, balanced, or deep");
  const { frontmatter } = parseLessonFrontmatter(markdown);
  const craft = craftFieldsFromFrontmatter(frontmatter);
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
    warnings.push(
      `Visible lesson prose has ${count} words, outside the broad ${depth} review band of ${minimum}–${maximum}. Length alone does not block save. Check that the mechanism has enough evidence and explanation.`,
    );
  if (count > maximum)
    warnings.push(
      `Visible lesson prose has ${count} words, outside the broad ${depth} review band of ${minimum}–${maximum}. Length alone does not block save. Split only when the lesson contains more than one teaching job.`,
    );
  if (headings.length < 3 || headings.length > 8)
    errors.push(`Lesson has ${headings.length} level-two sections; use 3–8 clear sections.`);
  const generic = headings.filter((heading) => EMPTY_HEADING.test(heading));
  if (generic.length > 0)
    errors.push(`Replace process labels with subject headings: ${generic.join(", ")}.`);
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const variety = inspectHeadingVariety(headings, {
    title: craft.title ?? titleMatch?.[1]?.trim() ?? null,
    focus: craft.focus ?? craft.primaryPaths[0] ?? null,
    sectionRoles: craft.sectionRoles,
  });
  for (const error of variety.errors) {
    if (!errors.includes(error)) errors.push(error);
  }
  for (const warning of variety.warnings) {
    if (!warnings.includes(warning)) warnings.push(warning);
  }
  const citedPaths = [
    ...new Set(evidence.map((item) => parseCitation(item)?.path).filter(Boolean)),
  ];
  if (citedPaths.length < 2)
    errors.push("Cite at least two verified project-relative source paths with line numbers.");
  if (
    expectedEvidencePaths.length > 0 &&
    !citedPaths.some((cited) =>
      expectedEvidencePaths.some((expected) => evidencePathsOverlap(cited, expected)),
    )
  )
    warnings.push(
      "Verified live sources re-anchor this topic. Continue without asking the user to repair curriculum metadata.",
    );
  if (AI_PUFFERY.test(markdown))
    errors.push("Remove generic or promotional AI phrasing; use concrete project language.");

  const proseWithoutMeta = markdown
    .replace(/^---[\s\S]*?^---\s*/m, "")
    .replace(/^#\s+.+\n+/, "")
    .replace(/```[\s\S]*?```/g, "");
  const opening = proseWithoutMeta
    .split(/\n\s*\n/)
    .find((block) => block.trim() && !block.trim().startsWith("#"));
  if (opening && HOLLOW_OPENING.test(opening)) {
    errors.push(
      "Replace the generic opening with the learner outcome, project consequence, and concrete mechanism.",
    );
  }
  if (FREEFORM_BRIEF.test(markdown)) {
    errors.push(
      "Draft uses a freeform brief/outline (Lesson:/Goal/Overview/Summary or Topic ID metadata). Rewrite into the repay lesson shape with topic-specific ## sections, sectionRoles, citations, and a transfer job, then save only via save-lesson.",
    );
  }
  const introductionCount = (markdown.match(/\b(?:in|throughout) this lesson\b/gi) ?? []).length;
  if (introductionCount > 1) {
    warnings.push(
      "Lesson repeatedly announces itself; state the project behavior directly instead.",
    );
  }

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
  const pathHeavyParagraphs = paragraphs.filter(
    (paragraph) => extractLessonCitations(paragraph.text).length >= 3,
  );
  if (pathHeavyParagraphs.length > 0)
    warnings.push(
      `${pathHeavyParagraphs.length} paragraph(s) contain three or more source paths; keep the explanation readable and move supporting locations to compact citations.`,
    );
  const codeBlocks = [...markdown.matchAll(/^```([^\n`]*)\n([\s\S]*?)^```/gm)].filter(
    (match) => match[1].trim().split(/\s+/)[0]?.toLowerCase() !== "mermaid",
  );
  const oversizedCodeBlocks = codeBlocks.filter(
    (match) => match[2].replace(/\n$/, "").split("\n").length > 40,
  );
  if (oversizedCodeBlocks.length > 0) {
    warnings.push(
      `${oversizedCodeBlocks.length} code block(s) exceed 40 lines; excerpt the verified mechanism and move surrounding code behind viewer disclosure.`,
    );
  }
  const sectionBodies = [...markdown.matchAll(/^##\s+(.+)\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gm)].map(
    (match) => ({
      heading: match[1].trim(),
      words: wordCount(match[2]),
    }),
  );
  const longSections = sectionBodies.filter((section) => section.words > 350);
  if (longSections.length > 0) {
    warnings.push(
      `Section(s) exceed 350 words (${longSections.map((section) => section.heading).join(", ")}); split the reasoning or remove a second teaching job.`,
    );
  }
  if (!/\b(?:you|your)\b/i.test(markdown))
    warnings.push(
      "Address the learner directly at least once so the outcome and action are explicit.",
    );
  if (!/\b(?:because|therefore|so that|which means|as a result)\b/i.test(markdown))
    warnings.push("Add at least one explicit cause-and-consequence explanation.");

  const quotedBlocks = markdown.match(/(?:^>.*(?:\n|$))+/gm) ?? [];
  const learningChecks = quotedBlocks.filter((block) => /\*\*Quick check:\*\*/i.test(block));
  for (const block of learningChecks) {
    const options = [...block.matchAll(/^>\s*-\s*\[([ xX])\]\s+.+$/gm)];
    const correct = options.filter((option) => option[1].toLowerCase() === "x");
    if (options.length < 2 || options.length > 4 || correct.length !== 1) {
      errors.push(
        "Quick check must have two to four choices and exactly one `[x]` correct answer.",
      );
    }
    if (!/^>\s*\*\*(?:Why|Explanation):\*\*/im.test(block)) {
      errors.push(
        "Quick check must include a Why/Explanation that teaches the mechanism after the choice.",
      );
    }
  }

  const reflectionBlocks = quotedBlocks.filter((block) => /\*\*Think first:\*\*/i.test(block));
  for (const block of reflectionBlocks) {
    if (!/^>\s*\*\*Answer:\*\*/im.test(block)) {
      errors.push("Think first prompt must include its collapsed Answer in the same quote block.");
    }
  }

  const devtoolsLabs = quotedBlocks.filter((block) => /\*\*See for yourself:\*\*/i.test(block));
  for (const block of devtoolsLabs) {
    if (!/^>\s*\d+\.\s+/m.test(block)) {
      warnings.push("See for yourself walkthrough should give the learner ordered DevTools steps.");
    }
    if (!/^>\s*\*\*Change one thing:\*\*/im.test(block)) {
      warnings.push(
        "See for yourself walkthrough should include one safe variation under Change one thing.",
      );
    }
    if (!/^>\s*\*\*Look for:\*\*/im.test(block)) {
      warnings.push(
        "See for yourself walkthrough should name the observable signal under Look for.",
      );
    }
    if (!/^>\s*\*\*Reset:\*\*/im.test(block)) {
      warnings.push(
        "See for yourself walkthrough should explain how to restore the starting state under Reset.",
      );
    }
    if (
      !/\b(?:local(?:host| development)?|development|dev server|test environment|staging|sandbox|read-only|non-production)\b/i.test(
        block,
      )
    ) {
      warnings.push(
        "See for yourself walkthrough should name a safe execution context such as local development, a sandbox, or a read-only observation.",
      );
    }
    const unsafeLines = block
      .split("\n")
      .filter((line) => !/\b(?:do not|don't|never|without)\b/i.test(line))
      .filter((line) => UNSAFE_DEVTOOLS_ACTION.test(line));
    if (unsafeLines.length > 0) {
      errors.push(
        "See for yourself walkthrough includes an unsafe action involving secrets, production mutation, or bypassing a protection.",
      );
    }
  }

  const interactiveCount =
    learningChecks.length +
    reflectionBlocks.length +
    devtoolsLabs.length +
    (markdown.match(/\*\*Prediction:\*\*/gi) ?? []).length;
  if (interactiveCount > 3) {
    warnings.push(
      `Lesson contains ${interactiveCount} interactive moments; keep only the pauses that materially improve understanding.`,
    );
  }

  const learningMoments = inspectLearningMoments(markdown, {
    depth,
    requireDecisions: requireLearningMomentDecisions,
  });
  errors.push(...learningMoments.errors);
  warnings.push(...learningMoments.warnings);

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
  if (checkSection && !VERIFICATION_LANGUAGE.test(checkSection)) {
    warnings.push(
      "Final learning job does not name verification or an observable regression signal.",
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
    learningMoments,
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
