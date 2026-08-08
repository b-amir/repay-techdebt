import { readFile, realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { extractLessonCitations } from "./lesson-citation-check.js";

const CLAIMS_HEADER = /(?:^|\n)CLAIMS:\s*(?:\n|$)/i;
const CLAIM_LINE =
  /^\s*\d+\.\s*"([^"]+)"\s*—\s*([^\s—]+?\.[A-Za-z0-9]+:[1-9]\d*)\s*—\s*support:\s*(yes|no|gap)\s*(?:—\s*state:\s*(\w+))?/im;

/**
 * Parse explicit CLAIMS: blocks from bottleneck B6 sense step.
 * @param {{ detailed?: boolean }} [options]
 * @returns {Array<{ claim: string, citation: string, support: string, state: string|null }> | { present: boolean, claims: Array<{ claim: string, citation: string, support: string, state: string|null }>, malformedLines: string[] }}
 */
export function parseClaimsBlock(markdown, options = {}) {
  const detailed = parseClaimsBlockDetailed(markdown);
  return options.detailed ? detailed : detailed.claims;
}

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
    claims.push({
      claim: match[1].trim(),
      citation: match[2].trim(),
      support: match[3].toLowerCase(),
      state: match[4]?.toLowerCase() ?? null,
    });
  }
  if (!sawEntry && malformedLines.length === 0) malformedLines.push("(no numbered claims)");
  return { present: true, claims, malformedLines };
}

function significantTokens(text) {
  return [
    ...new Set(
      String(text)
        .toLowerCase()
        .replace(/[^a-z0-9_./-]+/g, " ")
        .split(/\s+/)
        .filter(
          (token) =>
            token.length >= 4 &&
            !/^(this|that|with|from|into|when|then|than|have|been|will|your|their|about|which|where|what)$/.test(
              token,
            ),
        ),
    ),
  ];
}

function snippetAround(source, lineNumber, radius = 2) {
  const lines = source.split(/\r?\n/);
  const index = Math.max(0, lineNumber - 1);
  const start = Math.max(0, index - radius);
  const end = Math.min(lines.length, index + radius + 1);
  return lines.slice(start, end).join("\n");
}

/**
 * Deterministic claim↔snippet overlap check (faithfulness floor, not an LLM judge).
 * Prefer explicit CLAIMS blocks; otherwise pair nearby prose sentences with citations.
 */
export async function assessClaimFaithfulness(targetRoot, markdown, options = {}) {
  const minOverlap = options.minOverlap ?? 0.35;
  const root = await realpath(targetRoot);
  const explicit = parseClaimsBlock(markdown);
  const problems = [];
  const assessments = [];

  if (explicit.length > 0) {
    for (const item of explicit) {
      const assessment = await assessOne(root, item.claim, item.citation, minOverlap);
      assessment.declaredSupport = item.support;
      assessment.declaredState = item.state;
      if (item.support === "yes" && assessment.support === "no")
        problems.push(
          `Claim declared support:yes but snippet does not support it: "${item.claim}" @ ${item.citation}`,
        );
      if (item.support === "yes" && assessment.citationMissing)
        problems.push(`Claim cites missing file: ${item.citation}`);
      assessments.push(assessment);
    }
  } else {
    // Lightweight auto mode: for each citation, take the preceding sentence as claim.
    const citations = extractLessonCitations(markdown);
    for (const citation of citations.slice(0, options.maxAutoClaims ?? 5)) {
      const claim = precedingSentence(markdown, citation);
      if (!claim) continue;
      const assessment = await assessOne(root, claim, citation, minOverlap);
      assessments.push(assessment);
      if (assessment.citationMissing) problems.push(`Citation does not resolve: ${citation}`);
      else if (assessment.support === "no")
        problems.push(`Weak claim↔snippet overlap for "${claim.slice(0, 80)}…" @ ${citation}`);
    }
  }

  return {
    ok: problems.length === 0,
    mode: explicit.length > 0 ? "explicit-claims" : "auto-near-citation",
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

async function assessOne(root, claim, citation, minOverlap) {
  const match = citation.match(/^(.*):([1-9]\d*)$/);
  if (!match) {
    return {
      claim,
      citation,
      support: "gap",
      citationMissing: true,
      overlap: 0,
      snippet: "",
    };
  }
  try {
    const source = await readFile(resolve(root, match[1]), "utf8");
    const snippet = snippetAround(source, Number(match[2]));
    const claimTokens = significantTokens(claim);
    const snippetTokens = new Set(significantTokens(snippet));
    const hits = claimTokens.filter((token) => snippetTokens.has(token));
    const overlap = claimTokens.length === 0 ? 0 : hits.length / claimTokens.length;
    return {
      claim,
      citation,
      support: overlap >= minOverlap ? "yes" : "no",
      citationMissing: false,
      overlap: Number(overlap.toFixed(3)),
      matchedTokens: hits.slice(0, 12),
      snippet: snippet.slice(0, 400),
    };
  } catch {
    return {
      claim,
      citation,
      support: "gap",
      citationMissing: true,
      overlap: 0,
      snippet: "",
    };
  }
}
