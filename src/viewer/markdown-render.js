// Render lesson Markdown to HTML for the viewer plaque.
// Security: html:false (raw HTML in lessons is escaped, never interpreted),
// linkify on, and external links get rel="noopener" so loopback context stays safe.
import MarkdownIt from "markdown-it";
import markdownItMultimdTable from "markdown-it-multimd-table";
import hljs from "highlight.js/lib/common";
import { parseCitation } from "../lessons/citation-model.js";
import { parseLessonFrontmatter } from "../lessons/lesson-frontmatter.js";

const LANG_ALIASES = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  yml: "yaml",
};

const md = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: true,
  typographer: false,
});

// CJS default export; package types don't match markdown-it's PluginWithOptions overloads.
md.use(/** @type {any} */ (markdownItMultimdTable), {
  multiline: true,
  rowspan: true,
  headerless: false,
});

function escapeFenceText(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;");
}

function resolveLanguage(info) {
  const raw = String(info ?? "")
    .trim()
    .split(/\s+/)[0];
  if (!raw) return "";
  const lower = raw.toLowerCase();
  return LANG_ALIASES[lower] ?? lower;
}

function highlightCode(code, lang) {
  if (lang && hljs.getLanguage(lang)) {
    return { html: hljs.highlight(code, { language: lang }).value, lang };
  }
  const auto = hljs.highlightAuto(code);
  return { html: auto.value, lang: auto.language ?? "" };
}

const slugify = (str) =>
  String(str)
    .trim()
    .toLowerCase()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");

md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token.tag === "h2" || token.tag === "h3") {
    const inlineToken = tokens[idx + 1];
    let title = "";
    if (inlineToken && inlineToken.type === "inline") {
      title = inlineToken.content;
    }
    const id = slugify(title) || `heading-${idx}`;
    token.attrSet("id", id);
    token.attrJoin("class", "ds-section-heading");
  }
  return self.renderToken(tokens, idx, options);
};

md.renderer.rules.fence = function renderFence(tokens, idx) {
  const token = tokens[idx];
  const info = token.info.trim();
  const code = token.content;

  if (info.split(/\s+/)[0].toLowerCase() === "mermaid") {
    return `<figure class="ds-mermaid-wrap"><button type="button" class="ds-mermaid-expand" aria-label="Open larger diagram" title="Open larger diagram"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.5 2.5H13.5V6.5M6.5 13.5H2.5V9.5M13.5 2.5L9 7M2.5 13.5L7 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>View</span></button><pre class="mermaid">${escapeFenceText(code)}</pre></figure>\n`;
  }

  const lang = resolveLanguage(info);
  const { html, lang: resolvedLang } = highlightCode(code, lang);
  const langClass = resolvedLang ? ` language-${resolvedLang}` : "";
  const displayLang = resolvedLang || "code";
  const lineCount = code.replace(/\n$/, "").split("\n").length;
  const collapsible = lineCount > 18;
  const codeId = `ds-code-${idx}`;

  return `<div class="ds-codeblock${collapsible ? " ds-codeblock-collapsible" : ""}" data-lines="${lineCount}">
  <div class="ds-codeblock-header">
    <span class="ds-codeblock-lang">${escapeFenceText(displayLang)}</span>
    <span class="ds-codeblock-actions">${collapsible ? `<button type="button" class="ds-codeblock-toggle" aria-expanded="false" aria-controls="${codeId}">Show more</button>` : ""}<button type="button" class="ds-btn-copy" aria-label="Copy code">Copy</button></span>
  </div>
  <pre class="hljs ds-codeblock-code" id="${codeId}"><code class="hljs${langClass}">${html}</code></pre>
</div>\n`;
};

// Harden rendered anchors: external links open in a new browsing context with noopener.
const defaultLinkRenderer =
  md.renderer.rules.link_open ||
  function defaultLink(tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };
md.renderer.rules.link_open = function hardenLink(tokens, idx, options, env, self) {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex("href");
  const href = hrefIndex >= 0 ? token.attrs[hrefIndex][1] : "";
  if (/^https?:\/\//i.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkRenderer(tokens, idx, options, env, self);
};

/**
 * Drop agent-only noise before markdown-it (html:false would otherwise escape
 * HTML comments into visible text). Fenced code is preserved.
 * @param {string} markdown
 */
export function stripAgentMetaMarkdown(markdown) {
  const fences = [];
  let text = String(markdown ?? "").replace(/```[\s\S]*?```/g, (block) => {
    fences.push(block);
    return `\uE000FENCE${fences.length - 1}\uE001`;
  });
  // HTML comments (CLAIMS ledger lives here in real workbooks).
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  // Bare CLAIMS: block + consecutive numbered entries.
  text = text.replace(/(?:^|\n)CLAIMS:\s*\n(?:[ \t]*\d+\.[^\n]*(?:\n|$))*/gi, "\n");
  text = text.replace(/\uE000FENCE(\d+)\uE001/g, (_, i) => fences[Number(i)] ?? "");
  return text.replace(/\n{3,}/g, "\n\n").trimEnd();
}

/**
 * @param {string} source
 * @param {{ targetRoot?: string }} [options]
 */
export function renderMarkdown(source, { targetRoot } = {}) {
  const html = enhanceEditorialPatterns(md.render(String(source ?? "")));
  return linkifyCitations(html, targetRoot);
}

function enhanceEditorialPatterns(html) {
  const prepared = String(html)
    .replace(
      /<p><strong>What this shows:<\/strong>\s*/gi,
      '<p class="ds-figure-caption"><span class="ds-figure-caption-label">What this shows</span> ',
    )
    .replace(
      /<blockquote>\s*<p><strong>(Note|Tip|Warning):<\/strong>/gi,
      (_, kind) =>
        `<blockquote class="ds-callout ds-callout-${kind.toLowerCase()}"><p><strong class="ds-callout-label">${kind}</strong>`,
    );

  return enhanceDevtoolsLabs(
    enhanceLearningChecks(enhanceReflectionBlocks(enhancePredictionBlocks(prepared))),
  );
}

function enhancePredictionBlocks(html) {
  return String(html).replace(
    /<blockquote>\s*<p><strong>Prediction:<\/strong>\s*([\s\S]*?)<\/p>\s*<p><strong>(?:Reveal|Answer):<\/strong>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
    (_match, question, answer) =>
      `<details class="ds-prediction"><summary><span class="ds-prediction-label">Prediction</span><span class="ds-prediction-question">${question}</span></summary><div class="ds-prediction-answer"><span class="ds-prediction-answer-label">Answer</span>${answer}</div></details>`,
  );
}

function enhanceReflectionBlocks(html) {
  return String(html).replace(
    /<blockquote>\s*<p><strong>Think first:<\/strong>\s*([\s\S]*?)<\/p>\s*<p><strong>Answer:<\/strong>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
    (_match, question, answer) =>
      `<details class="ds-reflection"><summary><span class="ds-reflection-label">Think first</span><span class="ds-reflection-question">${question}</span></summary><div class="ds-reflection-answer"><span class="ds-reflection-answer-label">Answer</span>${answer}</div></details>`,
  );
}

function enhanceLearningChecks(html) {
  return String(html).replace(
    /<blockquote>\s*<p><strong>Quick check:<\/strong>\s*([\s\S]*?)<\/p>\s*<ul>\s*([\s\S]*?)<\/ul>\s*<p><strong>(?:Why|Explanation):<\/strong>\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
    (block, question, list, explanation, offset) => {
      const options = [...String(list).matchAll(/<li>\s*\[([ xX])\]\s*([\s\S]*?)<\/li>/gi)].map(
        (match) => ({ correct: match[1].toLowerCase() === "x", html: match[2] }),
      );
      if (
        options.length < 2 ||
        options.length > 4 ||
        options.filter((item) => item.correct).length !== 1
      )
        return block;

      const id = `ds-quiz-${offset}`;
      const correctOption = options.find((option) => option.correct);
      const choices = options
        .map(
          (option, index) => `<label class="ds-quiz-option" for="${id}-${index}">
  <input id="${id}-${index}" type="radio" name="${id}" value="${index}" data-correct="${option.correct}">
  <span class="ds-quiz-control" aria-hidden="true"></span>
  <span class="ds-quiz-option-text">${option.html}</span>
  <span class="ds-quiz-option-status" hidden></span>
</label>`,
        )
        .join("");

      return `<form class="ds-quiz" data-quiz>
  <fieldset>
    <legend><span class="ds-quiz-label">Quick check</span><span class="ds-quiz-question">${question}</span></legend>
    <div class="ds-quiz-options">${choices}</div>
    <div class="ds-quiz-actions"><button type="submit" class="ds-quiz-submit" disabled>Check answer</button></div>
    <span class="ds-quiz-announcement" role="status" aria-live="polite"></span>
    <div class="ds-quiz-feedback" id="${id}-feedback" hidden><strong data-quiz-result></strong> <span class="ds-quiz-explanation">${explanation}</span></div>
    <noscript><details class="ds-quiz-fallback"><summary>Show answer</summary><p><strong>Answer:</strong> ${correctOption.html}. ${explanation}</p></details></noscript>
  </fieldset>
</form>`;
    },
  );
}

function enhanceDevtoolsLabs(html) {
  return String(html).replace(
    /<blockquote>\s*<p><strong>See for yourself:<\/strong>\s*([\s\S]*?)<\/p>([\s\S]*?)<\/blockquote>/gi,
    (_match, introduction, body) =>
      `<aside class="ds-devtools-lab" aria-label="See for yourself"><header class="ds-devtools-lab-header"><span class="ds-devtools-lab-label">See for yourself</span><p>${introduction}</p></header><div class="ds-devtools-lab-body">${body}</div></aside>`,
  );
}

/**
 * Strip craft YAML + leading markdown H1 for reader display.
 * Frontmatter is agent/save metadata (id, shape, mapAnswers…) - not lesson prose.
 * @param {string} source
 * @returns {{ body: string, title: string | null }}
 */
export function prepareLessonMarkdown(source) {
  const { frontmatter, body } = parseLessonFrontmatter(source);
  const fmTitle =
    typeof frontmatter.title === "string" && frontmatter.title.trim()
      ? frontmatter.title.trim()
      : null;
  const title = extractTitle(body) ?? fmTitle;
  // Drop leading ATX H1; shell paints the title once.
  // Drop HTML comments + CLAIMS ledger - agent evidence, not learner prose.
  const displayBody = stripAgentMetaMarkdown(body.replace(/^\s*#\s+.+\r?\n?/, ""));
  return { body: displayBody, title };
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function linkifyCitations(html, targetRoot) {
  if (!targetRoot) return html;
  const root = String(targetRoot).replace(/\/$/, "");
  /** @type {{ num: number, path: string, ranges: string[], label: string, href: string }[]} */
  const notes = [];
  /** @type {Map<string, number>} */
  const keyToNum = new Map();
  let referenceOccurrence = 0;

  // Eat optional surrounding parens/spaces so prose (`path:line`) → bare footnote number.
  const body = html.replace(
    /(?:\(|（)?\s*<code>([^<]+)<\/code>\s*(?:\)|）)?/g,
    (match, rawCitation) => {
      const citation = parseCitation(rawCitation);
      if (!citation) return match;
      const key = citation.path;
      const range =
        citation.startLine === citation.endLine
          ? String(citation.startLine)
          : `${citation.startLine}-${citation.endLine}`;
      let num = keyToNum.get(key);
      let first = false;
      if (!num) {
        num = notes.length + 1;
        keyToNum.set(key, num);
        first = true;
        const abs = citation.path.startsWith("/") ? citation.path : `${root}/${citation.path}`;
        notes.push({
          num,
          path: citation.path,
          ranges: [range],
          label: citation.label,
          href: `vscode://file/${abs}:${citation.startLine}`,
        });
      } else {
        const note = notes[num - 1];
        if (note && !note.ranges.includes(range)) {
          note.ranges.push(range);
          note.label = `${note.path}:${note.ranges.join(", ")}`;
        }
      }
      const idAttr = first ? ` id="fnref-${num}"` : "";
      referenceOccurrence += 1;
      const previewId = `fn-preview-${num}-${referenceOccurrence}`;
      const fileName = citation.path.split("/").pop() || citation.path;
      const preview = `${fileName} · ${citation.startLine === citation.endLine ? `line ${citation.startLine}` : `lines ${citation.startLine}-${citation.endLine}`}`;
      return `<sup class="ds-fn-ref"><a href="#fn-${num}"${idAttr} aria-describedby="${previewId} fn-${num}" data-source-preview>${num}</a><span class="ds-fn-preview" id="${previewId}" role="tooltip" hidden>${escapeAttr(preview)}</span></sup>`;
    },
  );

  if (notes.length === 0) return body;

  const list = notes
    .map(
      (n) =>
        `<li id="fn-${n.num}" class="ds-fn-item"><a class="ds-citation" href="${escapeAttr(n.href)}" title="Open in editor"><code><bdi>${escapeAttr(n.label)}</bdi></code></a> <a class="ds-fn-back" href="#fnref-${n.num}" aria-label="Back to reference ${n.num}">↩</a></li>`,
    )
    .join("");
  return `${body}<footer class="ds-footnotes" aria-label="Source references"><h2 class="ds-footnotes-title">Sources</h2><ol class="ds-fn-list">${list}</ol></footer>`;
}

export function extractTitle(source) {
  const match = String(source ?? "").match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : null;
}
