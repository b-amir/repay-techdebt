// Single workbook shell HTML. Light Read-mode layout: soft sidebar rail + open
// reading column. Server injects pre-rendered article HTML and a small vanilla client script.
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

export function plannedHref(topicId) {
  return `/planned/${encodeURIComponent(topicId)}`;
}

/** Split "frontend workbook" → project name + suffix for brand lockup. */
export function parseWorkbookBrand(workbookTitle) {
  const trimmed = String(workbookTitle ?? "").trim();
  const match = trimmed.match(/^(.+?)\s+workbook$/i);
  return {
    project: match ? match[1].trim() : trimmed,
    suffix: match ? "workbook" : "",
  };
}

function progressStats(counts) {
  return `<div class="ds-stats" aria-label="Progress summary">
    <div class="ds-stats-item"><span class="ds-stats-value">${counts.done}</span><span class="ds-stats-label">done</span></div>
    <div class="ds-stats-item"><span class="ds-stats-value">${counts.written}</span><span class="ds-stats-label">written</span></div>
    <div class="ds-stats-item"><span class="ds-stats-value">${counts.planned}</span><span class="ds-stats-label">planned</span></div>
  </div>`;
}

function brandLockup(workbookTitle) {
  const { project, suffix } = parseWorkbookBrand(workbookTitle);
  const suffixHtml = suffix
    ? `<span class="ds-brand-suffix">${escapeHtml(suffix)}</span>`
    : "";
  return `<a class="ds-brand" href="/">
    <span class="ds-brand-icon" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 3.5h9.2L17 6.3v12.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.4"/>
        <path d="M7 3.5V17.5" stroke="currentColor" stroke-width="1.4"/>
        <path d="M14 3.5V6.5" stroke="currentColor" stroke-width="1.4"/>
      </svg>
    </span>
    <span class="ds-brand-text">
      <span class="ds-brand-project">${escapeHtml(project)}</span>
      ${suffixHtml}
    </span>
  </a>`;
}

function sidebarToggleButton(className, expanded) {
  const label = expanded ? "Hide sidebar" : "Show sidebar";
  return `<button type="button" class="ds-sidebar-toggle ${className}" aria-expanded="${expanded ? "true" : "false"}" aria-controls="ds-rail" aria-label="${label}">
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M11.5 4.5L6.5 9l5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>`;
}

function viewSettingsMarkup() {
  return `<div class="ds-settings" aria-label="Reading settings">
    <p class="ds-settings-title">View</p>
    <div class="ds-setting">
      <span class="ds-setting-label">Theme</span>
      <div class="ds-seg" role="group" aria-label="Theme">
        <button type="button" class="ds-seg-btn" data-pref="theme" data-value="white">White</button>
        <button type="button" class="ds-seg-btn" data-pref="theme" data-value="paper">Paper</button>
        <button type="button" class="ds-seg-btn" data-pref="theme" data-value="dark">Dark</button>
      </div>
    </div>
    <div class="ds-setting">
      <span class="ds-setting-label">Size</span>
      <div class="ds-seg" role="group" aria-label="Text size">
        <button type="button" class="ds-seg-btn" data-pref="scale" data-value="s">S</button>
        <button type="button" class="ds-seg-btn" data-pref="scale" data-value="m">M</button>
        <button type="button" class="ds-seg-btn" data-pref="scale" data-value="l">L</button>
      </div>
    </div>
    <div class="ds-setting">
      <span class="ds-setting-label">Accent</span>
      <div class="ds-seg" role="group" aria-label="Accent color">
        <button type="button" class="ds-seg-btn" data-pref="accent" data-value="teal">Teal</button>
        <button type="button" class="ds-seg-btn" data-pref="accent" data-value="slate">Slate</button>
        <button type="button" class="ds-seg-btn" data-pref="accent" data-value="warm">Warm</button>
      </div>
    </div>
  </div>`;
}

function renderSidebar(sidebar, workbookTitle) {
  const chapters = sidebar.chapters
    .map((chapter) => {
      const items = chapter.items
        .map((item) => {
          if (item.state === "planned") {
            const classes = ["ds-nav", "ds-nav-planned"];
            if (item.current) classes.push("ds-nav-current");
            const hint = item.current
              ? `<span class="ds-nav-hint">Not written yet</span>`
              : "";
            return `<a class="${classes.join(" ")}" href="${plannedHref(item.id)}" title="${escapeHtml(item.outcome ?? "Not written yet")}">${escapeHtml(item.title)}${hint}</a>`;
          }
          const classes = ["ds-nav"];
          if (item.current) classes.push("ds-nav-current");
          if (item.state === "done") classes.push("ds-nav-done");
          const check =
            item.state === "done" ? '<span class="ds-check" aria-hidden="true">✓</span> ' : "";
          return `<a class="${classes.join(" ")}" href="${lessonHref(item.lessonKey)}">${check}${escapeHtml(item.title)}</a>`;
        })
        .join("\n");
      return `<div class="ds-chapter"><h2 class="ds-chapter-title">${escapeHtml(chapter.title)}</h2><div class="ds-chapter-items">${items}</div></div>`;
    })
    .join("\n");
  const header = workbookTitle
    ? `<div class="ds-rail-header">
    <div class="ds-rail-header-row">${brandLockup(workbookTitle)}${sidebarToggleButton("ds-sidebar-toggle-rail", true)}</div>
  </div>`
    : "";
  return `<aside class="ds-rail" id="ds-rail">
    ${header}
    <div class="ds-rail-progress">${progressStats(sidebar.counts)}</div>
    <nav class="ds-nav-list" aria-label="Lessons">${chapters || '<p class="ds-empty">No curriculum yet.</p>'}</nav>
    <div class="ds-rail-footer">${viewSettingsMarkup()}</div>
  </aside>`;
}

function fontLinks() {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=JetBrains+Mono:wght@400;500&display=swap">`;
}

function prefsBootstrapScript() {
  return `<script>
(function(){
  var k="repay-viewer-prefs";
  try{
    var p=JSON.parse(localStorage.getItem(k)||"{}");
    var r=document.documentElement;
    var dark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme=p.themeChosen?p.theme:(dark?"dark":"paper");
    r.setAttribute("data-theme",theme);
    r.setAttribute("data-scale",p.scale||"m");
    r.setAttribute("data-accent",p.accent||"teal");
    r.setAttribute("data-sidebar",p.sidebarCollapsed?"collapsed":"open");
    var scheme=theme==="dark"?"dark":"light";
    r.style.colorScheme=scheme;
    var m=document.querySelector('meta[name="color-scheme"]');
    if(m)m.setAttribute("content",scheme);
  }catch(e){}
})();
</script>`;
}

function renderShell({ documentTitle, sidebarHtml, mainHtml }) {
  return `<!doctype html>
<html lang="en" data-theme="paper" data-scale="m" data-accent="teal" data-sidebar="open">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(documentTitle)}</title>
${prefsBootstrapScript()}
${fontLinks()}
<link rel="stylesheet" href="/assets/viewer.css">
</head>
<body class="ds-shell">
<div class="ds-layout">
${sidebarHtml}
<main class="ds-main">${sidebarToggleButton("ds-sidebar-toggle-float", false)}<div class="ds-main-inner">${mainHtml}</div></main>
</div>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

export function renderHome({ workbookTitle, sidebar }) {
  const next = firstOpenLesson(sidebar);
  const { project } = parseWorkbookBrand(workbookTitle);
  const main = `<header class="ds-home">
    <h1 class="ds-home-title">${escapeHtml(project)}</h1>
    <p class="ds-home-lead"><strong>${sidebar.counts.written}</strong> ${sidebar.counts.written === 1 ? "lesson" : "lessons"} written · <strong>${sidebar.counts.done}</strong> marked done · <strong>${sidebar.counts.planned}</strong> planned.</p>
    ${
      next
        ? `<p class="ds-home-next"><a class="ds-btn-primary" href="${lessonHref(next)}">Continue next lesson</a></p>`
        : sidebar.counts.written > 0
          ? `<p class="ds-home-next ds-muted">All written lessons are done. Pick any subject from the sidebar.</p>`
          : `<p class="ds-home-next ds-muted">No lessons yet. Select a planned topic in the sidebar to create one.</p>`
    }
  </header>`;
  return renderShell({
    documentTitle: workbookTitle,
    sidebarHtml: renderSidebar(sidebar, workbookTitle),
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

function renderCopyBlock(label, command) {
  return `<div class="ds-create-block">
    <p class="ds-create-label">${escapeHtml(label)}</p>
    <div class="ds-create-row">
      <pre class="ds-create-cmd"><code>${escapeHtml(command)}</code></pre>
      <button type="button" class="ds-btn-copy" aria-label="Copy ${escapeHtml(label)} command">Copy</button>
    </div>
  </div>`;
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
  const buttonLabel = completed ? "Mark not done" : "Mark done";
  const button = `<button type="button" class="${buttonClass}" data-lesson="${escapeHtml(lessonKey)}" data-completed="${completed ? "true" : "false"}">${buttonLabel}</button>`;
  const prevHtml = prev
    ? `<a class="ds-btn-ghost" href="${lessonHref(prev.key)}" rel="prev">← ${escapeHtml(prev.title)}</a>`
    : "";
  const nextHtml = next
    ? `<a class="ds-btn-ghost" href="${lessonHref(next.key)}" rel="next">${escapeHtml(next.title)} →</a>`
    : "";
  const prevNext =
    prevHtml || nextHtml
      ? `<nav class="ds-prevnext" aria-label="Lesson navigation">${prevHtml}${nextHtml}</nav>`
      : "";
  const main = `<article class="ds-plaque">
    <h1 class="ds-plaque-title">${escapeHtml(title)}</h1>
    <div class="ds-plaque-body">${wrapClaims(bodyHtml)}</div>
    <div class="ds-plaque-actions">${button}</div>
    ${prevNext}
  </article>`;
  return renderShell({
    documentTitle: `${title} · ${workbookTitle}`,
    sidebarHtml: renderSidebar(sidebar, workbookTitle),
    mainHtml: main,
  });
}

export function renderEmpty({ workbookTitle, reason }) {
  const main = `<header class="ds-home">
    <h1 class="ds-home-title">${escapeHtml(parseWorkbookBrand(workbookTitle).project)}</h1>
    <p class="ds-home-lead ds-muted">${escapeHtml(reason)}</p>
  </header>`;
  return renderShell({
    documentTitle: workbookTitle,
    sidebarHtml: renderSidebar(
      { chapters: [], counts: { written: 0, done: 0, planned: 0 } },
      workbookTitle,
    ),
    mainHtml: main,
  });
}

/**
 * Placeholder for a curriculum topic with no lesson yet. Includes --create activation hint.
 */
export function renderPlanned({
  workbookTitle,
  sidebar,
  topic,
  targetRoot,
  teachTopicScript,
}) {
  const createArg = topic.id;
  const chatCmd = `/repay-techdebt --create ${createArg}`;
  const cliCmd = `node ${teachTopicScript} ${targetRoot} ${createArg}`;
  const main = `<article class="ds-plaque ds-plaque-planned">
    <p class="ds-planned-badge">Not written yet</p>
    <h1 class="ds-plaque-title">${escapeHtml(topic.title)}</h1>
    ${
      topic.learnerOutcome
        ? `<p class="ds-planned-outcome">${escapeHtml(topic.learnerOutcome)}</p>`
        : ""
    }
    <p class="ds-planned-lead">This lesson is not written yet. Ask your agent to create it from project evidence.</p>
    <div class="ds-create-box">
      ${renderCopyBlock("In chat", chatCmd)}
      ${renderCopyBlock("Or run", cliCmd)}
    </div>
  </article>`;
  return renderShell({
    documentTitle: `${topic.title} · ${workbookTitle}`,
    sidebarHtml: renderSidebar(sidebar, workbookTitle),
    mainHtml: main,
  });
}
