// Single workbook shell HTML. One layout always: stone directory rail + plaster
// main column (dashboard home or reading plaque). Flat surfaces, hairlines, patina
// only for current row / focus / primary Mark done — Gallery wall labels visual system.
// Server injects pre-rendered plaque HTML and a small vanilla client script.
import { CLIENT_SCRIPT } from "./client-script.js";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function lessonHref(key) {
  return `/lesson/${encodeURIComponent(key)}`;
}

function progressChip(counts) {
  return `<span class="ds-progress">${counts.done} done · ${counts.written} written · ${counts.planned} planned</span>`;
}

function renderSidebar(sidebar) {
  const chapters = sidebar.chapters
    .map((chapter) => {
      const items = chapter.items
        .map((item) => {
          if (item.state === "planned") {
            return `<span class="ds-nav-planned" title="${escapeHtml(item.outcome ?? "Not written yet")}">${escapeHtml(item.title)} <span class="ds-nav-hint">Not written yet</span></span>`;
          }
          const classes = ["ds-nav"];
          if (item.current) classes.push("ds-nav-current");
          if (item.state === "done") classes.push("ds-nav-done");
          const check =
            item.state === "done" ? '<span class="ds-check" aria-hidden="true">✓</span> ' : "";
          return `<a class="${classes.join(" ")}" href="${lessonHref(item.lessonKey)}">${check}${escapeHtml(item.title)}</a>`;
        })
        .join("\n");
      return `<div class="ds-chapter"><h2 class="ds-chapter-title">${escapeHtml(chapter.title)}</h2>${items}</div>`;
    })
    .join("\n");
  return `<aside class="ds-rail">
    <div class="ds-rail-progress">${progressChip(sidebar.counts)}</div>
    <nav class="ds-nav-list">${chapters || '<p class="ds-empty">No curriculum yet.</p>'}</nav>
  </aside>`;
}

function renderShell({ documentTitle, sidebarHtml, mainHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(documentTitle)}</title>
<link rel="stylesheet" href="/assets/viewer.css">
</head>
<body class="ds-shell">
<div class="ds-layout">
${sidebarHtml}
<main class="ds-main">${mainHtml}</main>
</div>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

export function renderHome({ workbookTitle, sidebar }) {
  const next = firstOpenLesson(sidebar);
  const main = `<header class="ds-home">
    <h1 class="ds-home-title">${escapeHtml(workbookTitle)}</h1>
    ${progressChip(sidebar.counts)}
    <p class="ds-home-lead">This workbook has <strong>${sidebar.total}</strong> ${sidebar.total === 1 ? "subject" : "subjects"}: ${sidebar.counts.written} ${sidebar.counts.written === 1 ? "lesson is" : "lessons are"} written, ${sidebar.counts.done} ${sidebar.counts.done === 1 ? "is" : "are"} marked done.</p>
    ${
      next
        ? `<p class="ds-home-next"><a class="ds-btn-primary" href="${lessonHref(next)}">Continue with the next written lesson</a></p>`
        : sidebar.counts.written > 0
          ? `<p class="ds-home-next ds-muted">Every written lesson is marked done. Pick any subject from the directory.</p>`
          : `<p class="ds-home-next ds-muted">No lessons are written yet. Planned subjects appear in the directory but are not openable until written.</p>`
    }
  </header>`;
  return renderShell({
    documentTitle: workbookTitle,
    sidebarHtml: renderSidebar(sidebar),
    mainHtml: main,
  });
}

function firstOpenLesson(sidebar) {
  for (const chapter of sidebar.chapters) {
    for (const item of chapter.items) {
      if (item.state === "written") return item.lessonKey;
    }
  }
  return null;
}

/**
 * Wrap a CLAIMS: paragraph (and the list that follows it) in a collapsed
 * <details> so it reads as secondary evidence, not plaque body. Best-effort.
 */
export function wrapClaims(html) {
  return html.replace(
    /<p>CLAIMS:\s*<\/p>\s*(<ol>[\s\S]*?<\/ol>|<ul>[\s\S]*?<\/ul>)?/,
    (match, list) =>
      `<details class="ds-claims"><summary>Show claims</summary>${list ?? ""}</details>`,
  );
}

export function renderLesson({
  workbookTitle,
  sidebar,
  title,
  bodyHtml,
  lessonKey,
  completed,
  prev,
  next,
}) {
  const buttonClass = completed ? "ds-btn-ghost ds-mark-done" : "ds-btn-primary ds-mark-done";
  const buttonLabel = completed ? "Mark as not done" : "Mark lesson as done";
  const button = `<button type="button" class="${buttonClass}" data-lesson="${escapeHtml(lessonKey)}" data-completed="${completed ? "true" : "false"}">${buttonLabel}</button>`;
  const prevHtml = prev
    ? `<a class="ds-btn-ghost" href="${lessonHref(prev.key)}" rel="prev">← ${escapeHtml(prev.title)}</a>`
    : "";
  const nextHtml = next
    ? `<a class="ds-btn-ghost" href="${lessonHref(next.key)}" rel="next">${escapeHtml(next.title)} →</a>`
    : "";
  const prevNext =
    prevHtml || nextHtml ? `<nav class="ds-prevnext">${prevHtml}${nextHtml}</nav>` : "";
  const main = `<article class="ds-plaque">
    <h1 class="ds-plaque-title">${escapeHtml(title)}</h1>
    <div class="ds-plaque-body">${wrapClaims(bodyHtml)}</div>
    <div class="ds-plaque-actions">${button}</div>
    ${prevNext}
  </article>`;
  return renderShell({
    documentTitle: `${title} · ${workbookTitle}`,
    sidebarHtml: renderSidebar(sidebar),
    mainHtml: main,
  });
}

export function renderEmpty({ workbookTitle, reason }) {
  const main = `<header class="ds-home">
    <h1 class="ds-home-title">${escapeHtml(workbookTitle)}</h1>
    <p class="ds-home-lead ds-muted">${escapeHtml(reason)}</p>
  </header>`;
  return renderShell({
    documentTitle: workbookTitle,
    sidebarHtml: renderSidebar({ chapters: [], counts: { written: 0, done: 0, planned: 0 } }),
    mainHtml: main,
  });
}
