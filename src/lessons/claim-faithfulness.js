import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { extractLessonCitations } from "./lesson-citation-check.js";
import { parseCitation } from "./citation-model.js";

const CLAIMS_HEADER = /(?:^|\n)CLAIMS:\s*(?:\n|$)/i;
const CLAIM_LINE =
  /^\s*\d+\.\s*"([^"]+)"\s*(?:-|\u2014)\s*(.+?)\s*(?:-|\u2014)\s*support:\s*(yes|no|gap)\s*(?:(?:-|\u2014)\s*state:\s*(\w+))?/im;

/** @typedef {{ claim: string, citation: string, citations: string[], support: string, state: string | null }} ClaimEntry */
/** @typedef {{ present: boolean, claims: ClaimEntry[], malformedLines: string[] }} ClaimBlockDetails */

/**
 * @overload
 * @param {string} markdown
 * @param {{ detailed: true }} options
 * @returns {ClaimBlockDetails}
 */
/**
 * @overload
 * @param {string} markdown
 * @param {{ detailed?: false }} [options]
 * @returns {ClaimEntry[]}
 */
/**
 * Parse explicit CLAIMS blocks from the semantic review step.
 * @param {string} markdown
 * @param {{ detailed?: boolean }} [options]
 * @returns {ClaimEntry[] | ClaimBlockDetails}
 */
export function parseClaimsBlock(markdown, options = {}) {
  const detailed = parseClaimsBlockDetailed(markdown);
  return options.detailed ? detailed : detailed.claims;
}

/** @returns {ClaimBlockDetails} */
function parseClaimsBlockDetailed(markdown) {
  const text = String(markdown);
  const header = text.match(CLAIMS_HEADER);
  if (!header) return { present: false, claims: [], malformedLines: [] };
  const remainder = text.slice((header.index ?? 0) + header[0].length);
  const claims = [];
  const malformedLines = [];
  let sawEntry = false;
  for (const line of remainder.split(/\n/)) {
    if (!line.trim()) continue;
    if (!/^\s*\d+\.\s*/.test(line)) {
      if (sawEntry) break;
      malformedLines.push(line.trim());
      break;
    }
    sawEntry = true;
    const match = line.match(CLAIM_LINE);
    if (!match) {
      malformedLines.push(line.trim());
      continue;
    }
    const citations = extractLessonCitations(match[2]);
    if (citations.length === 0) {
      malformedLines.push(line.trim());
      continue;
    }
    claims.push({
      claim: match[1].trim(),
      citation: citations[0],
      citations,
      support: match[3].toLowerCase(),
      state: match[4]?.toLowerCase() ?? null,
    });
  }
  if (!sawEntry && malformedLines.length === 0) malformedLines.push("(no numbered claims)");
  return { present: true, claims, malformedLines };
}

function normalizeToken(token) {
  return String(token)
    .toLowerCase()
    .replace(/(?:ing|ed|es|s)$/i, "")
    .replace(/[^a-z0-9_./-]+/g, "");
}

function significantTokens(text) {
  return [
    ...new Set(
      String(text)
        .replace(/[^a-z0-9_./-]+/gi, " ")
        .split(/\s+/)
        .map(normalizeToken)
        .filter(
          (token) =>
            token.length >= 3 &&
            !/^(thi|that|with|from|into|when|then|than|have|been|will|your|their|about|which|where|what|after|before|through)$/.test(
              token,
            ),
        ),
    ),
  ];
}

function codeAnchors(text) {
  return [
    ...new Set(
      String(text)
        .split(/\s+/)
        .map((token) => token.replace(/^[`'"([{]+|[`'"\])},.:;]+$/g, ""))
        .filter(
          (token) =>
            /[a-z][A-Z]|_|\.[A-Za-z]|^[A-Z][A-Za-z0-9]+$|^[A-Za-z]+\(\)$/.test(token) &&
            token.length >= 3,
        )
        .map((token) => token.replace(/\(\)$/, "")),
    ),
  ];
}

function checkableClauses(claim) {
  const clauses = String(claim)
    .split(/;|,\s+(?:and|but|while|whereas)\s+/i)
    .map((item) => item.trim())
    .filter(Boolean);
  return clauses.length > 0 ? clauses : [String(claim)];
}

function snippetAround(source, lineNumber, radius = 6) {
  const lines = source.split(/\r?\n/);
  const index = Math.max(0, lineNumber - 1);
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join("\n");
}

/**
 * Check conservative evidence-anchor coverage. This does not claim semantic
 * proof; the agent still judges whether the cited code means what the prose says.
 */
export async function assessClaimFaithfulness(targetRoot, markdown, options = {}) {
  const minOverlap = options.minOverlap ?? 0.18;
  const root = await realpath(targetRoot);
  const explicit = parseClaimsBlock(markdown);
  const problems = [];
  const assessments = [];

  if (explicit.length > 0) {
    for (const item of explicit) {
      const citations = item.citations ?? [item.citation];
      const assessment = await assessOne(root, item.claim, citations, minOverlap);
      assessment.declaredSupport = item.support;
      assessment.declaredState = item.state;
      if (item.support === "yes" && assessment.support === "no") {
        problems.push(
          `Claim declared support:yes but cited anchors do not support clause "${assessment.unsupportedClauses?.[0] ?? item.claim}" @ ${citations.join(", ")}`,
        );
      }
      if (item.support === "yes" && assessment.citationMissing)
        problems.push(`Claim cites missing file: ${assessment.missingCitations.join(", ")}`);
      assessments.push(assessment);
    }
  } else {
    const citations = extractLessonCitations(markdown);
    for (const citation of citations.slice(0, options.maxAutoClaims ?? 5)) {
      const claim = precedingSentence(markdown, citation);
      if (!claim) continue;
      const assessment = await assessOne(root, claim, [citation], minOverlap);
      assessments.push(assessment);
      if (assessment.citationMissing) problems.push(`Citation does not resolve: ${citation}`);
      else if (assessment.support === "no")
        problems.push(`Weak evidence-anchor coverage for "${claim.slice(0, 80)}…" @ ${citation}`);
    }
  }

  return {
    ok: problems.length === 0,
    mode: explicit.length > 0 ? "explicit-claims" : "auto-near-citation",
    verificationKind: "deterministic-evidence-anchor-coverage",
    semanticReviewRequired: true,
    assessments,
    problems,
  };
}

function precedingSentence(markdown, citation) {
  const index = markdown.indexOf(citation);
  if (index < 0) return null;
  const before = markdown.slice(0, index).replace(/\s+/g, " ").trim();
  const parts = before.split(/(?<=[.!?])\s+/);
  return parts.at(-1)?.trim() || before.slice(-160);
}

async function assessOne(root, claim, citations, minOverlap) {
  const snippets = [];
  const missingCitations = [];
  for (const citation of citations) {
    const parsed = parseCitation(citation);
    if (!parsed) {
      missingCitations.push(citation);
      continue;
    }
    try {
      const source = await readFile(resolve(root, parsed.path), "utf8");
      snippets.push(snippetAround(source, parsed.startLine));
    } catch {
      missingCitations.push(citation);
    }
  }
  if (snippets.length === 0) {
    return {
      claim,
      citation: citations[0],
      citations,
      support: "gap",
      citationMissing: true,
      missingCitations,
      overlap: 0,
      snippet: "",
      unsupportedClauses: checkableClauses(claim),
    };
  }

  const snippet = snippets.join("\n");
  const snippetTokens = new Set(significantTokens(snippet));
  const snippetLower = snippet.toLowerCase();
  const unsupportedClauses = [];
  const clauseAssessments = checkableClauses(claim).map((clause) => {
    const claimTokens = significantTokens(clause);
    const hits = claimTokens.filter((token) => snippetTokens.has(token));
    const anchors = codeAnchors(clause);
    const matchedAnchors = anchors.filter((anchor) => snippetLower.includes(anchor.toLowerCase()));
    const overlap = claimTokens.length === 0 ? 0 : hits.length / claimTokens.length;
    const semanticOnly =
      /\b(?:always|never|only|all|none|cannot|guarantees?|impossible|does not|do not|is not|are not|no longer)\b/i.test(
        clause,
      );
    const anchorsEnough =
      anchors.length === 0
        ? hits.length >= Math.min(2, Math.max(1, claimTokens.length))
        : matchedAnchors.length >= Math.max(1, Math.ceil(anchors.length / 2));
    const supported = overlap >= minOverlap && anchorsEnough && !semanticOnly;
    if (!supported) unsupportedClauses.push(clause);
    return {
      clause,
      supported,
      overlap: Number(overlap.toFixed(3)),
      matchedTokens: hits.slice(0, 12),
      anchors,
      matchedAnchors,
      limitation: semanticOnly
        ? "absence, negation, and guarantee claims require semantic review beyond a cited window"
        : null,
    };
  });
  const averageOverlap =
    clauseAssessments.reduce((sum, item) => sum + item.overlap, 0) / clauseAssessments.length;
  return {
    claim,
    citation: citations[0],
    citations,
    support: unsupportedClauses.length === 0 ? "yes" : "no",
    citationMissing: missingCitations.length > 0,
    missingCitations,
    overlap: Number(averageOverlap.toFixed(3)),
    matchedTokens: [...new Set(clauseAssessments.flatMap((item) => item.matchedTokens))].slice(
      0,
      16,
    ),
    clauseAssessments,
    unsupportedClauses,
    snippet: snippet.slice(0, 1_200),
  };
}
