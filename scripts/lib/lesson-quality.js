const DEPTH_RANGES = {
  concise: [250, 650],
  balanced: [450, 950],
  deep: [700, 1300],
};

const EMPTY_HEADING =
  /^(?:introduction|overview|details|more information|conclusion|predict|read|run|investigate|modify|make)$/i;
const AI_PUFFERY =
  /\b(?:delve|game[- ]changer|revolutionary|cutting[- ]edge|robust and scalable|seamlessly|in today(?:'s)? (?:fast-paced|digital) world)\b/i;
const EVIDENCE_PATH =
  /(?:^|[\s`(])([A-Za-z0-9_.@+-]+(?:\/[A-Za-z0-9_.@+()[\]-]+)+\.[A-Za-z0-9]+):([1-9]\d*)(?:-[1-9]\d*)?(?=$|[\s`),.;])/gm;

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
  const evidence = [...markdown.matchAll(EVIDENCE_PATH)].map((match) => `${match[1]}:${match[2]}`);
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
