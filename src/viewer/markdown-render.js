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
    return `<div class="ds-mermaid-wrap"><pre class="mermaid">${escapeFenceText(code)}</pre></div>\n`;
  }

  const lang = resolveLanguage(info);
  const { html, lang: resolvedLang } = highlightCode(code, lang);
  const langClass = resolvedLang ? ` language-${resolvedLang}` : "";
  const displayLang = resolvedLang || "code";

  return `<div class="ds-codeblock">
  <div class="ds-codeblock-header">
    <span class="ds-codeblock-lang">${escapeFenceText(displayLang)}</span>
    <button type="button" class="ds-btn-copy" aria-label="Copy code">Copy</button>
  </div>
  <pre class="hljs"><code class="hljs${langClass}">${html}</code></pre>
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
 * @param {string} source
 * @param {{ targetRoot?: string }} [options]
 */
export function renderMarkdown(source, { targetRoot } = {}) {
  const html = md.render(String(source ?? ""));
  return linkifyCitations(html, targetRoot);
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
  /** @type {{ num: number, label: string, href: string }[]} */
  const notes = [];
  /** @type {Map<string, number>} */
  const keyToNum = new Map();

  const body = html.replace(/<code>([^<]+?):(\d+)<\/code>/g, (match, filePath, line) => {
    if (!/^[\w./@-]+$/.test(filePath)) return match;
    const key = `${filePath}:${line}`;
    let num = keyToNum.get(key);
    let first = false;
    if (!num) {
      num = notes.length + 1;
      keyToNum.set(key, num);
      first = true;
      const abs = filePath.startsWith("/") ? filePath : `${root}/${filePath}`;
      notes.push({ num, label: key, href: `vscode://file/${abs}:${line}` });
    }
    const idAttr = first ? ` id="fnref-${num}"` : "";
    return `<sup class="ds-fn-ref"><a href="#fn-${num}"${idAttr} aria-describedby="fn-${num}">${num}</a></sup>`;
  });

  if (notes.length === 0) return body;

  const list = notes
    .map(
      (n) =>
        `<li id="fn-${n.num}" class="ds-fn-item"><a class="ds-citation" href="${escapeAttr(n.href)}" title="Open in editor"><code>${escapeAttr(n.label)}</code></a> <a class="ds-fn-back" href="#fnref-${n.num}" aria-label="Back to reference ${n.num}">↩</a></li>`,
    )
    .join("");
  return `${body}<footer class="ds-footnotes" aria-label="Source references"><h2 class="ds-footnotes-title">Sources</h2><ol class="ds-fn-list">${list}</ol></footer>`;
}

export function extractTitle(source) {
  const match = String(source ?? "").match(/^#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : null;
}
