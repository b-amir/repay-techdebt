// Render lesson Markdown to HTML for the viewer plaque.
// Security: html:false (raw HTML in lessons is escaped, never interpreted),
// linkify on, and external links get rel="noopener" so loopback context stays safe.
import MarkdownIt from "markdown-it";
import markdownItMultimdTable from "markdown-it-multimd-table";
import hljs from "highlight.js/lib/common";

const LANG_ALIASES = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  yml: "yaml",
};

const LANG_LABELS = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  bash: "Bash",
  yaml: "YAML",
  json: "JSON",
  sql: "SQL",
  rust: "Rust",
  go: "Go",
  java: "Java",
  csharp: "C#",
  html: "HTML",
  css: "CSS",
  markdown: "Markdown",
  plaintext: "Plain text",
};

const md = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: true,
  typographer: false,
});

md.use(markdownItMultimdTable, {
  multiline: true,
  rowspan: true,
  headerless: false,
});

function escapeFenceText(text) {
  return String(text ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

function resolveLanguage(info) {
  const raw = String(info ?? "").trim().split(/\s+/)[0];
  if (!raw) return "";
  const lower = raw.toLowerCase();
  return LANG_ALIASES[lower] ?? lower;
}

function languageLabel(lang, { inferred = false } = {}) {
  if (!lang) return "Code";
  if (inferred && lang === "typescript") return "TypeScript";
  return LANG_LABELS[lang] ?? lang.replace(/^\w/, (c) => c.toUpperCase());
}

/** Infer TS/JS from lesson snippets; never use highlight.js auto-detect (guesses Kotlin/C#/PHP). */
function inferLessonLanguage(code) {
  const sample = String(code ?? "").slice(0, 4000);
  const tsSignals =
    /\b(interface|type)\s+\w+/.test(sample) ||
    /:\s*(string|number|boolean|void|unknown|Promise|UseChatReturn)/.test(sample) ||
    /<[A-Z][A-Za-z0-9]*>/.test(sample);
  const jsSignals =
    /\b(import|export)\s+/.test(sample) ||
    /=>/.test(sample) ||
    /\b(const|let|var)\s+\w+/.test(sample) ||
    /\bfunction\s+\w+/.test(sample) ||
    /\buse[A-Z]\w*\(/.test(sample);
  if (tsSignals || jsSignals) return "typescript";
  return "";
}

function highlightCode(code, lang) {
  const inferred = lang ? "" : inferLessonLanguage(code);
  const resolved = lang || inferred;
  if (resolved && hljs.getLanguage(resolved)) {
    return {
      html: hljs.highlight(code, { language: resolved }).value,
      lang: resolved,
      inferred: Boolean(inferred),
      plain: false,
    };
  }
  return { html: escapeFenceText(code), lang: "", inferred: false, plain: true };
}

md.renderer.rules.fence = function renderFence(tokens, idx) {
  const token = tokens[idx];
  const info = token.info.trim();
  const code = token.content;

  if (info.split(/\s+/)[0].toLowerCase() === "mermaid") {
    return `<div class="ds-mermaid-wrap"><pre class="mermaid">${escapeFenceText(code)}</pre></div>\n`;
  }

  const lang = resolveLanguage(info);
  const { html, lang: resolvedLang, inferred, plain } = highlightCode(code, lang);
  const label = languageLabel(resolvedLang, { inferred });
  const langClass = resolvedLang ? ` language-${resolvedLang}` : "";
  const preClass = plain ? "ds-code-plain" : "hljs";

  return `<div class="ds-codeblock">
  <div class="ds-codeblock-header"><span class="ds-codeblock-lang">${label}</span></div>
  <pre class="${preClass}"><code class="${plain ? "ds-code-plain" : `hljs${langClass}`}">${html}</code></pre>
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

export function renderMarkdown(source) {
  return md.render(String(source ?? ""));
}

export function extractTitle(source) {
  const match = String(source ?? "").match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : null;
}
