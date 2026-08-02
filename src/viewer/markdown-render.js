// Render lesson Markdown to HTML for the viewer plaque.
// Security: html:false (raw HTML in lessons is escaped, never interpreted),
// linkify on, and external links get rel="noopener" so loopback context stays safe.
import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: true,
  typographer: false,
});

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
