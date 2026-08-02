// Viewer (C-viewer) public API.
// When you make a function public, add it to this barrel.
export { resolveWorkbook } from "./resolve-workbook.js";

export {
  PROGRESS_SCHEMA_VERSION,
  emptyProgress,
  readProgress,
  setCompletion,
  normalizeLessonKey,
} from "./progress-store.js";

export { renderMarkdown, extractTitle } from "./markdown-render.js";

export { buildSidebar, buildLessonsSidebar } from "./sidebar.js";

export {
  escapeHtml,
  lessonHref,
  wrapClaims,
  renderHome,
  renderLesson,
  renderEmpty,
} from "./shell.js";

export { createViewerServer } from "./server.js";
