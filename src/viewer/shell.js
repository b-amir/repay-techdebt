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
  return `<div class="ds-stats" role="group" aria-label="Filter by status">
    <button type="button" class="ds-stats-item" data-filter="done" aria-pressed="false" title="Show done lessons">
      <span class="ds-stats-value">${counts.done}</span>
      <span class="ds-stats-label">done</span>
    </button>
    <button type="button" class="ds-stats-item" data-filter="written" aria-pressed="false" title="Show written lessons">
      <span class="ds-stats-value">${counts.written}</span>
      <span class="ds-stats-label">written</span>
    </button>
    <button type="button" class="ds-stats-item" data-filter="planned" aria-pressed="false" title="Show planned topics">
      <span class="ds-stats-value">${counts.planned}</span>
      <span class="ds-stats-label">planned</span>
    </button>
  </div>
  <button type="button" class="ds-filter-clear" data-filter-clear hidden><span class="ds-filter-clear-arrow" aria-hidden="true">←</span> Show all</button>`;
}

function brandLockup(workbookTitle) {
  const { project, suffix } = parseWorkbookBrand(workbookTitle);
  const suffixHtml = suffix ? `<span class="ds-brand-suffix">${escapeHtml(suffix)}</span>` : "";
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

function viewSettingsPanel() {
  return `<div class="ds-settings-root">
  <button type="button" class="ds-settings-gear" aria-expanded="false" aria-controls="ds-settings-panel" aria-label="View settings">
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fill-rule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267.96a7.072 7.072 0 0 1 0 2.224l1.267.96a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-.96a7.072 7.072 0 0 1 0-2.224l-1.267-.96a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.993 6.993 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd"/>
    </svg>
  </button>
  <div class="ds-settings-panel" id="ds-settings-panel" role="dialog" aria-label="View settings">
    ${viewSettingsMarkup()}
  </div>
</div>`;
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

const NAV_CHECK_MARK = `<span class="ds-nav-mark ds-nav-mark-done" aria-hidden="true">✓</span>`;
const NAV_DOT_MARK = `<span class="ds-nav-mark ds-nav-mark-dot" aria-hidden="true">·</span>`;
const COPY_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 10.5h-1a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" stroke="currentColor" stroke-width="1.3"/></svg>`;
const TOC_ICON = `<span class="ds-rail-toc-icon" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M2 6h8M2 9h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></span>`;

function navMarkFor(item) {
  if (item.state === "done") return NAV_CHECK_MARK;
  return NAV_DOT_MARK;
}

function renderSidebar(sidebar, workbookTitle) {
  const chapters = sidebar.chapters
    .map((chapter) => {
      const items = chapter.items
        .map((item) => {
          if (item.state === "planned") {
            const classes = ["ds-nav", "ds-nav-planned"];
            if (item.current) classes.push("ds-nav-current");
            return `<a class="${classes.join(" ")}" href="${plannedHref(item.id)}" data-nav-state="planned" data-nav-title="${escapeHtml(item.title)}" title="${escapeHtml(item.outcome ?? "Not written yet")}">${NAV_DOT_MARK}<span class="ds-nav-label">${escapeHtml(item.title)}</span></a>`;
          }
          const classes = ["ds-nav"];
          if (item.current) classes.push("ds-nav-current");
          if (item.state === "done") classes.push("ds-nav-done");
          const mark = navMarkFor(item);
          const state = item.state === "done" ? "done" : "open";
          return `<a class="${classes.join(" ")}" href="${lessonHref(item.lessonKey)}" data-nav-state="${state}" data-nav-title="${escapeHtml(item.title)}" data-lesson-key="${escapeHtml(item.lessonKey)}">${mark}<span class="ds-nav-label">${escapeHtml(item.title)}</span></a>`;
        })
        .join("\n");
      return `<div class="ds-chapter"><h2 class="ds-chapter-title">${escapeHtml(chapter.title)}</h2><div class="ds-chapter-items">${items}</div></div>`;
    })
    .join("\n");
  const header = workbookTitle
    ? `<div class="ds-rail-header">
    <div class="ds-rail-header-row">${brandLockup(workbookTitle)}${sidebarToggleButton("ds-sidebar-toggle-rail", true)}</div>
    <button type="button" class="ds-search-trigger" data-open-search aria-label="Search lessons and claims">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.4"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      <span class="ds-search-trigger-label">Search</span>
      <kbd class="ds-kbd">/</kbd>
    </button>
  </div>`
    : "";
  return `<aside class="ds-rail" id="ds-rail">
    ${header}
    <div class="ds-rail-progress">${progressStats(sidebar.counts)}</div>
    <nav class="ds-nav-list" aria-label="Lessons">${chapters || '<p class="ds-empty">No curriculum yet.</p>'}</nav>
  </aside>`;
}

// system stack only (offline skill). Self-host woff2 under static/fonts/ if brand needs Source*.

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
    r.setAttribute("data-focus",p.focusMode?"on":"off");
    var scheme=theme==="dark"?"dark":"light";
    r.style.colorScheme=scheme;
    var m=document.querySelector('meta[name="color-scheme"]');
    if(m)m.setAttribute("content",scheme);
  }catch(e){}
})();
</script>`;
}

function renderShell({
  documentTitle,
  sidebarHtml,
  mainHtml,
  rightRailHtml = "",
  progress = null,
}) {
  const scrollAttr = progress?.lastScroll
    ? ` data-last-scroll="${escapeHtml(String(progress.lastScroll))}"`
    : "";
  const lastReadAttr = progress?.lastRead
    ? ` data-last-read="${escapeHtml(String(progress.lastRead))}"`
    : "";
  const layoutClass = rightRailHtml ? "ds-layout ds-layout-toc" : "ds-layout";
  return `<!doctype html>
<html lang="en" data-theme="paper" data-scale="m" data-accent="teal" data-sidebar="open" data-focus="off"${scrollAttr}${lastReadAttr}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(documentTitle)}</title>
${prefsBootstrapScript()}
<link rel="stylesheet" href="/assets/viewer.css">
</head>
<body class="ds-shell">
<a class="ds-skip-link" href="#ds-main-content">Skip to content</a>
<div class="${layoutClass}">
${sidebarHtml}
<main class="ds-main" id="ds-main-content" tabindex="-1">${sidebarToggleButton("ds-sidebar-toggle-float", false)}<div class="ds-main-inner">${mainHtml}</div></main>
${rightRailHtml}
</div>
${viewSettingsPanel()}
<script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}

/**
 * Thin covered-map chips for home: done / next why / evidence — not an LMS.
 * @param {object} sidebar
 * @param {object | null} progress
 * @param {{ written: any[], planned: any[] }} items
 */
export function buildCoveredMapChips(sidebar, progress, items) {
  const { written, planned } = items;
  const doneTitles = written.filter((item) => item.state === "done").map((item) => item.title);
  const nextPlanned = planned[0] ?? null;
  const nextWritten = written.find((item) => item.state === "written") ?? null;
  const next = nextWritten ?? nextPlanned;
  const nextWhy =
    next?.learnerOutcome ||
    next?.why ||
    next?.reason ||
    (next?.state === "planned"
      ? "Next planned topic"
      : next
        ? "Continue this lesson"
        : "No next topic yet");
  const evidenceState =
    written.length === 0
      ? "No written evidence yet"
      : `${written.filter((i) => i.state === "done").length}/${written.length} written marked done`;

  return {
    done: doneTitles.slice(0, 6),
    nextTitle: next?.title ?? null,
    nextWhy,
    nextHref: next
      ? next.lessonKey
        ? lessonHref(next.lessonKey)
        : next.id
          ? plannedHref(next.id)
          : null
      : null,
    evidenceState,
    continueKey: progress?.lastRead ?? null,
  };
}

export function renderHome({ workbookTitle, sidebar, progress }) {
  const { written, planned } = collectSidebarItems(sidebar);
  const continueItem = findContinueLesson(sidebar, progress);
  const chips = buildCoveredMapChips(sidebar, progress, { written, planned });
  const { project } = parseWorkbookBrand(workbookTitle);
  const { counts, total } = sidebar;
  const readPct = counts.written > 0 ? Math.round((counts.done / counts.written) * 100) : 0;

  // One primary CTA. Prefer last-read continue; else first open/next from covered map.
  let primaryCard;
  if (continueItem) {
    const why =
      chips.nextTitle && chips.nextTitle !== continueItem.title
        ? `<span class="ds-home-primary-why">Next after this: ${escapeHtml(chips.nextTitle)}</span>`
        : chips.nextWhy && chips.nextWhy !== "Continue this lesson"
          ? `<span class="ds-home-primary-why">${escapeHtml(chips.nextWhy)}</span>`
          : "";
    primaryCard = `<a class="ds-home-primary" href="${lessonHref(continueItem.lessonKey)}">
    <span class="ds-home-primary-label">Continue</span>
    <span class="ds-home-primary-title">${escapeHtml(continueItem.title)}</span>
    ${why}
    <span class="ds-home-primary-cta">Open lesson →</span>
  </a>`;
  } else if (chips.nextTitle && chips.nextHref) {
    primaryCard = `<a class="ds-home-primary" href="${chips.nextHref}">
    <span class="ds-home-primary-label">Start</span>
    <span class="ds-home-primary-title">${escapeHtml(chips.nextTitle)}</span>
    <span class="ds-home-primary-why">${escapeHtml(chips.nextWhy)}</span>
    <span class="ds-home-primary-cta">Open →</span>
  </a>`;
  } else if (counts.written > 0) {
    primaryCard = `<div class="ds-home-primary ds-home-primary-static">
    <span class="ds-home-primary-label">All caught up</span>
    <span class="ds-home-primary-title">Every written lesson is marked done</span>
    <span class="ds-home-primary-why">Pick any lesson below or from the sidebar</span>
  </div>`;
  } else {
    primaryCard = `<div class="ds-home-primary ds-home-primary-static">
    <span class="ds-home-primary-label">No lessons yet</span>
    <span class="ds-home-primary-title">Pick a planned topic to create your first lesson</span>
  </div>`;
  }

  const stats = `<div class="ds-home-stats" aria-label="Workbook progress">
    <div class="ds-home-stats-row">
      <span class="ds-home-stat"><strong>${counts.done}</strong> done</span>
      <span class="ds-home-stat-sep" aria-hidden="true">·</span>
      <span class="ds-home-stat"><strong>${counts.written}</strong> written</span>
      <span class="ds-home-stat-sep" aria-hidden="true">·</span>
      <span class="ds-home-stat"><strong>${counts.planned}</strong> planned</span>
    </div>
    <div class="ds-home-progress">
      <div class="ds-home-progress-track" role="progressbar" aria-valuenow="${readPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Marked done">
        <span class="ds-home-progress-fill" style="width: ${readPct}%"></span>
      </div>
      <p class="ds-home-progress-note">${counts.done} of ${counts.written} written · ${readPct}%</p>
    </div>
  </div>`;

  const writtenCards = written
    .slice(0, 12)
    .map((item) => {
      const done = item.state === "done";
      return `<a class="ds-lesson-card${done ? " ds-lesson-card-is-done" : ""}" href="${lessonHref(item.lessonKey)}">
    <span class="ds-lesson-card-title">${escapeHtml(item.title)}</span>
    <span class="ds-lesson-card-status${done ? " ds-lesson-card-done" : ""}">${done ? "Done" : "Open"}</span>
  </a>`;
    })
    .join("");

  const plannedCards = planned
    .slice(0, 8)
    .map(
      (item) =>
        `<a class="ds-lesson-card ds-lesson-card-planned" href="${plannedHref(item.id)}">
    <span class="ds-lesson-card-title">${escapeHtml(item.title)}</span>
    <span class="ds-lesson-card-status">Planned</span>
  </a>`,
    )
    .join("");

  const main = `<div class="ds-home-dashboard">
    <header class="ds-home-hero">
      <div class="ds-home-hero-text">
        <h1 class="ds-home-title">${escapeHtml(project)}</h1>
        <p class="ds-home-sub">${escapeHtml(total)} topics</p>
      </div>
    </header>

    <div class="ds-home-top">
      ${primaryCard}
      ${stats}
    </div>

    ${
      written.length
        ? `<section class="ds-home-section">
      <h2 class="ds-home-section-title">Written</h2>
      <div class="ds-home-card-grid">${writtenCards}</div>
    </section>`
        : ""
    }

    ${
      planned.length
        ? `<section class="ds-home-section">
      <h2 class="ds-home-section-title">Planned</h2>
      <div class="ds-home-card-grid">${plannedCards}</div>
    </section>`
        : ""
    }
  </div>`;

  return renderShell({
    documentTitle: workbookTitle,
    sidebarHtml: renderSidebar(sidebar, workbookTitle),
    mainHtml: main,
    progress,
  });
}

function collectSidebarItems(sidebar) {
  const written = [];
  const planned = [];
  for (const chapter of sidebar.chapters) {
    for (const item of chapter.items) {
      if (item.state === "planned") planned.push(item);
      else if (item.lessonKey) written.push(item);
    }
  }
  return { written, planned };
}

function findContinueLesson(sidebar, progress) {
  if (progress && progress.lastRead) {
    for (const chapter of sidebar.chapters) {
      for (const item of chapter.items) {
        if (item.lessonKey === progress.lastRead) return item;
      }
    }
  }
  for (const chapter of sidebar.chapters) {
    for (const item of chapter.items) {
      if (item.state === "written") return item;
    }
  }
  for (const chapter of sidebar.chapters) {
    for (const item of chapter.items) {
      if (item.lessonKey && item.state === "done") return item;
    }
  }
  return null;
}

/**
 * Defense-in-depth: strip any CLAIMS residue that still made it into HTML
 * (bare list, wrapped details, or html:false-escaped comment form).
 * Prefer stripAgentMetaMarkdown in prepareLessonMarkdown — that is the main path.
 */
export function stripClaimsHtml(html) {
  return String(html ?? "")
    .replace(/<details class="ds-claims">[\s\S]*?<\/details>/gi, "")
    .replace(/<p>CLAIMS:\s*<\/p>\s*(?:<ol>[\s\S]*?<\/ol>|<ul>[\s\S]*?<\/ul>)?/gi, "")
    .replace(
      /<p>&lt;!--\s*CLAIMS:[\s\S]*?(?:--&gt;\s*<\/p>|<ol>[\s\S]*?--&gt;<\/li>\s*<\/ol>)/gi,
      "",
    );
}

/**
 * @deprecated Prefer prepareLessonMarkdown (strips agent meta pre-render).
 * Kept for tooling that still post-processes HTML.
 */
export function wrapClaims(html) {
  return stripClaimsHtml(html);
}

/** Lessons often repeat the title as a markdown H1; strip it when the shell renders the title. */
export function stripLeadingTitleHtml(html) {
  return String(html ?? "").replace(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
}

function renderTocRail(headings) {
  if (headings.filter((h) => h.level === 2).length < 4) return "";
  const listItems = headings
    .map((h) => {
      const cls = h.level === 3 ? "ds-toc-h3" : "ds-toc-h2";
      return `<li class="${cls}"><a href="#${escapeHtml(h.id)}" class="ds-toc-link" data-id="${escapeHtml(h.id)}">${h.text}</a></li>`;
    })
    .join("\n");
  return `<aside class="ds-rail ds-rail-toc" id="ds-toc-rail" aria-label="On this page">
  <div class="ds-rail-toc-inner">
    <div class="ds-rail-toc-head">${TOC_ICON}<h2 class="ds-rail-toc-title">On this page</h2></div>
    <ul class="ds-toc-list">${listItems}</ul>
  </div>
</aside>`;
}

function formatLearningStage(stage) {
  const match = String(stage ?? "").match(/^\d+\.\s*(.+)$/);
  const label = match ? match[1] : String(stage ?? "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function citationHref(targetRoot, raw) {
  const match = String(raw).match(/^(.+?):(\d+)$/);
  const filePath = match ? match[1] : raw;
  const line = match ? match[2] : "1";
  const abs = filePath.startsWith("/")
    ? filePath
    : `${String(targetRoot ?? "").replace(/\/$/, "")}/${filePath}`;
  return `vscode://file/${abs}:${line}`;
}

function lessonNavCell(nav, dir) {
  const label = dir === "prev" ? "Previous" : "Next";
  if (nav) {
    return `<a class="ds-lesson-nav ds-lesson-nav-${dir}" href="${lessonHref(nav.key)}" rel="${dir}">
      <span class="ds-lesson-nav-kicker">${label}</span>
      <span class="ds-lesson-nav-title">${escapeHtml(nav.title)}</span>
    </a>`;
  }
  return `<span class="ds-lesson-nav ds-lesson-nav-${dir} ds-lesson-nav-muted" aria-hidden="true"></span>`;
}

function renderPlannedCommandRow(command, label = "command") {
  return `<div class="ds-planned-cmd">
    <div class="ds-cmd-row">
      <code class="ds-cmd-text">${escapeHtml(command)}</code>
      <button type="button" class="ds-btn-copy ds-btn-copy-icon" aria-label="Copy ${escapeHtml(label)}">${COPY_ICON}</button>
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
  progress,
  prev,
  next,
}) {
  const buttonClass = completed ? "ds-mark-done ds-mark-done-complete" : "ds-mark-done";
  const buttonLabel = completed ? "Mark not done" : "Mark as done";
  const button = `<button type="button" class="${buttonClass}" data-lesson="${escapeHtml(lessonKey)}" data-completed="${completed ? "true" : "false"}" aria-pressed="${completed ? "true" : "false"}"><span class="ds-mark-done-check" aria-hidden="true">✓</span><span class="ds-mark-done-label">${buttonLabel}</span></button>`;
  const footer = `<footer class="ds-lesson-footer">
    ${button}
    <nav class="ds-lesson-footer-nav" aria-label="Lesson navigation" data-lesson-nav>
      ${lessonNavCell(prev, "prev")}
      ${lessonNavCell(next, "next")}
    </nav>
  </footer>`;

  let currentChapter = "";
  let currentIndex = 0;
  let totalWrittenInChapter = 0;
  for (const chapter of sidebar.chapters) {
    let writtenCount = 0;
    let found = false;
    for (const item of chapter.items) {
      if (item.lessonKey) {
        writtenCount++;
        if (item.lessonKey === lessonKey) {
          currentIndex = writtenCount;
          found = true;
        }
      }
    }
    if (found) {
      currentChapter = chapter.title;
      totalWrittenInChapter = writtenCount;
      break;
    }
  }

  const statusStr = completed ? "Done" : "Open";
  const orientationStrip = `<div class="ds-orientation-strip">${escapeHtml(currentChapter)} · Lesson ${currentIndex} of ${totalWrittenInChapter} written · ${statusStr}</div>`;

  const headings = [];
  const headingRegex = /<h([23])\s+id="([^"]+)"[^>]*>(.*?)<\/h\1>/g;
  let match;
  while ((match = headingRegex.exec(bodyHtml)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, ""),
    });
  }

  let jumpList = "";
  if (headings.filter((h) => h.level === 2).length >= 4) {
    const listItems = headings
      .map((h) => {
        const cls = h.level === 3 ? "ds-toc-h3" : "ds-toc-h2";
        return `<li class="${cls}"><a href="#${escapeHtml(h.id)}" class="ds-toc-link" data-id="${escapeHtml(h.id)}">${h.text}</a></li>`;
      })
      .join("\n");
    jumpList = `<aside class="ds-toc-mobile" aria-label="On this page">
      <details class="ds-toc-details">
        <summary>On this page</summary>
        <ul class="ds-toc-list">${listItems}</ul>
      </details>
    </aside>`;
  }

  const progressBar = `<div class="ds-reading-progress" aria-hidden="true"><div class="ds-reading-progress-bar"></div></div>`;
  const bodyContent = stripClaimsHtml(stripLeadingTitleHtml(bodyHtml));

  const main = `<article class="ds-plaque">
    ${progressBar}
    <header class="ds-lesson-header">
      <h1 class="ds-lesson-title">${escapeHtml(title)}</h1>
      ${orientationStrip}
    </header>
    ${jumpList}
    <div class="ds-plaque-body">${bodyContent}</div>
    ${footer}
  </article>`;

  const rightRailHtml = renderTocRail(headings);

  return renderShell({
    documentTitle: `${title} · ${workbookTitle}`,
    sidebarHtml: renderSidebar(sidebar, workbookTitle),
    mainHtml: main,
    rightRailHtml,
    progress,
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
 * Placeholder for a curriculum topic with no lesson yet. Chat activation only.
 */
export function renderPlanned({ workbookTitle, sidebar, topic, targetRoot }) {
  const createArg = topic.id;
  const chatCmd = `/repay-techdebt --create ${createArg}`;
  const evidencePaths = (topic.evidencePaths ?? []).slice(0, 8);
  const evidenceHtml =
    evidencePaths.length > 0
      ? `<div class="ds-planned-evidence">
    <p class="ds-planned-evidence-label">Evidence anchors</p>
    <ul class="ds-planned-evidence-list">
      ${evidencePaths
        .map((raw) => {
          const href = citationHref(targetRoot, raw);
          return `<li><a class="ds-citation" href="${escapeHtml(href)}">${escapeHtml(raw)}</a></li>`;
        })
        .join("")}
    </ul>
  </div>`
      : "";
  const stageLabel = topic.learningStage ? formatLearningStage(topic.learningStage) : "";
  const metaHtml = `<p class="ds-planned-meta">Not written yet${stageLabel ? ` · ${escapeHtml(stageLabel)}` : ""}</p>`;
  const main = `<article class="ds-plaque ds-plaque-planned">
    <header class="ds-planned-header">
      ${metaHtml}
      <h1 class="ds-lesson-title">${escapeHtml(topic.title)}</h1>
      ${
        topic.learnerOutcome
          ? `<p class="ds-planned-outcome">${escapeHtml(topic.learnerOutcome)}</p>`
          : ""
      }
    </header>
    <section class="ds-planned-cta">
      <p class="ds-planned-cta-lead">Ask your agent to write this lesson from project evidence.</p>
      ${renderPlannedCommandRow(chatCmd, "create command")}
    </section>
    ${evidenceHtml}
  </article>`;
  return renderShell({
    documentTitle: `${topic.title} · ${workbookTitle}`,
    sidebarHtml: renderSidebar(sidebar, workbookTitle),
    mainHtml: main,
  });
}
