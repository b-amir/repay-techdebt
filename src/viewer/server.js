// Loopback-only HTTP server for the workbook viewer. One shell, always. Reads
// curriculum.json + progress.json + Markdown lessons; never interprets raw HTML
// (markdown-it html:false in markdown-render.js). Lesson paths are sandboxed to
// the workbook lessons directory.
import http from "node:http";
import { readFile, readdir, realpath, stat, writeFile, rename, rm } from "node:fs/promises";
import { basename, resolve, isAbsolute } from "node:path";
import { isSameOrInside, skillRoot } from "../foundations/targeting.js";
import { readCurriculum, writeCurriculum } from "../memory/curriculum-store.js";
import { renderCurriculumMarkdown } from "../curriculum/curriculum-planning.js";
import { readProgress, setCompletion, normalizeLessonKey } from "./progress-store.js";
import { buildSidebar, buildLessonsSidebar } from "./sidebar.js";
import { renderHome, renderLesson, renderEmpty, renderPlanned, lessonHref } from "./shell.js";
import { renderMarkdown, extractTitle } from "./markdown-render.js";

const CSS_PATH = resolve(skillRoot, "src", "viewer", "static", "viewer.css");
let cssCache = null;

async function loadCss() {
  if (cssCache) return cssCache;
  cssCache = await readFile(CSS_PATH, "utf8");
  return cssCache;
}

function send(res, status, type, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, "application/json; charset=utf-8", `${JSON.stringify(value)}\n`);
}

async function readCurriculumSafe(path) {
  try {
    const { data } = await readCurriculum(path);
    return data;
  } catch {
    return null;
  }
}

async function listLessonFiles(lessonsDir) {
  let entries;
  try {
    entries = await readdir(lessonsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = entries.filter(
    (e) => e.isFile() && e.name.endsWith(".md") && !/^index\.md$/i.test(e.name),
  );
  return Promise.all(
    files.map(async (e) => {
      const full = resolve(lessonsDir, e.name);
      let title = e.name.replace(/\.md$/, "");
      try {
        title = extractTitle(await readFile(full, "utf8")) ?? title;
      } catch {
        /* keep filename title */
      }
      return { name: e.name, key: `lessons/${e.name}`, title };
    }),
  );
}

/**
 * Resolve a lesson key (e.g. `lessons/foo.md`) to an absolute file inside the
 * workbook lessons directory, or null if it escapes, is not Markdown, or is absent.
 */
async function resolveLessonFile(workbook, key) {
  if (!key || isAbsolute(key) || key.includes("..") || key.includes("\0")) return null;
  const absolute = resolve(workbook.workbookRoot, key);
  if (!isSameOrInside(absolute, workbook.lessonsDir)) return null;
  if (!absolute.endsWith(".md")) return null;
  let real;
  try {
    real = await realpath(absolute);
  } catch {
    return null;
  }
  if (!isSameOrInside(real, workbook.workbookRoot)) return null;
  return real;
}

async function workbookTitle(curriculum, workbookRoot) {
  const root = curriculum?.target?.root ?? workbookRoot;
  const name = basename(root === "." ? workbookRoot : root);
  return name ? `${name} workbook` : "Repay Tech Debt workbook";
}

async function buildModel(workbook, currentKey) {
  const [curriculum, progress, fallbackFiles] = await Promise.all([
    readCurriculumSafe(workbook.curriculumPath),
    readProgress(workbook.progressPath),
    readCurriculumSafe(workbook.curriculumPath).then((c) =>
      c?.topics?.length ? null : listLessonFiles(workbook.lessonsDir),
    ),
  ]);
  const sidebar =
    curriculum?.topics?.length > 0
      ? buildSidebar(curriculum, progress, currentKey)
      : buildLessonsSidebar(fallbackFiles ?? [], progress, currentKey);
  return { curriculum, progress, sidebar };
}

function flattenWritten(sidebar) {
  const out = [];
  for (const chapter of sidebar.chapters) {
    for (const item of chapter.items) {
      if (item.lessonKey) out.push({ key: item.lessonKey, title: item.title });
    }
  }
  return out;
}

function neighbor(written, currentKey, dir) {
  const idx = written.findIndex((l) => l.key === currentKey);
  if (idx === -1) return null;
  const target = dir === "prev" ? idx - 1 : idx + 1;
  return written[target] ?? null;
}

async function atomicWriteIndex(path, content) {
  const temporary = `${path}.${process.pid}-${Date.now()}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
  try {
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/**
 * Mirror a completion toggle into the private curriculum (learnerCompletion) and
 * re-render INDEX.md so its checkboxes reflect progress.json. Best-effort:
 * progress.json remains the authority if this fails.
 */
async function mirrorCompletion(workbook, key, completed) {
  const { data: curriculum, revision } = await readCurriculum(workbook.curriculumPath);
  if (!curriculum || !Array.isArray(curriculum.topics)) return;
  const topic = curriculum.topics.find((t) => t.lessonPath === key);
  curriculum.learnerCompletion = curriculum.learnerCompletion ?? {};
  if (topic) curriculum.learnerCompletion[topic.id] = Boolean(completed);
  await writeCurriculum(workbook.curriculumPath, curriculum, revision);
  await atomicWriteIndex(workbook.indexPath, renderCurriculumMarkdown(curriculum));
}

/**
 * @param {object} opts
 * @param {object} opts.workbook  Resolved layout from resolve-workbook.js.
 * @param {() => string} [opts.now]  ISO clock for data timestamps (injectable for tests).
 */
export function createViewerServer({ workbook, now = defaultNow }) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const pathname = url.pathname;

    try {
      if (req.method === "GET" && pathname === "/api/health")
        return sendJson(res, 200, { ok: true });
      if (req.method === "GET" && pathname === "/api/progress") {
        return sendJson(res, 200, await readProgress(workbook.progressPath));
      }
      if (req.method === "GET" && pathname === "/assets/viewer.css") {
        return send(res, 200, "text/css; charset=utf-8", await loadCss());
      }
      if (req.method === "GET" && pathname === "/api/lesson-mtime") {
        const file = await resolveLessonFile(workbook, url.searchParams.get("path") ?? "");
        if (!file) return sendJson(res, 404, { error: "not found" });
        const stats = await stat(file);
        return sendJson(res, 200, { mtimeMs: stats.mtimeMs });
      }

      if (req.method === "POST" && pathname === "/api/completion") {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return sendJson(res, 400, { error: "invalid json" });
        }
        if (!payload || typeof payload.path !== "string") {
          return sendJson(res, 400, { error: "path required" });
        }
        let result;
        try {
          result = await setCompletion(workbook.progressPath, payload.path, workbook.workbookRoot, {
            nowIso: now(),
            completed: payload.completed,
            topicId: payload.topicId,
          });
        } catch (error) {
          return sendJson(res, 400, { error: error.message });
        }
        try {
          await mirrorCompletion(workbook, result.key, result.completed);
        } catch (error) {
          process.stderr.write(`viewer: INDEX mirror skipped (${error.message})\n`);
        }
        const model = await buildModel(workbook, result.key);
        return sendJson(res, 200, {
          key: result.key,
          completed: result.completed,
          counts: model.sidebar.counts,
        });
      }

      if (req.method === "GET" && pathname === "/") {
        if (!workbook.ready) {
          return send(
            res,
            200,
            "text/html; charset=utf-8",
            renderEmpty({
              workbookTitle: "Repay Tech Debt workbook",
              reason: "No workbook initialized for this target yet.",
            }),
          );
        }
        const { curriculum, sidebar } = await buildModel(workbook, null);
        const title = await workbookTitle(curriculum, workbook.workbookRoot);
        return send(
          res,
          200,
          "text/html; charset=utf-8",
          renderHome({ workbookTitle: title, sidebar }),
        );
      }

      if (req.method === "GET" && pathname.startsWith("/planned/")) {
        const topicId = decodeURIComponent(pathname.slice("/planned/".length));
        const curriculum = await readCurriculumSafe(workbook.curriculumPath);
        const topic = curriculum?.topics?.find((item) => item.id === topicId);
        if (!topic) return send(res, 404, "text/plain; charset=utf-8", "Topic not found.\n");
        if (topic.lessonPath) {
          const redirectKey = topic.lessonPath.replaceAll("\\", "/");
          res.writeHead(302, { Location: lessonHref(redirectKey) });
          res.end();
          return;
        }
        const currentKey = `planned:${topicId}`;
        const { sidebar } = await buildModel(workbook, currentKey);
        const title = await workbookTitle(curriculum, workbook.workbookRoot);
        const html = renderPlanned({
          workbookTitle: title,
          sidebar,
          topic,
        });
        return send(res, 200, "text/html; charset=utf-8", html);
      }

      if (req.method === "GET" && pathname.startsWith("/lesson/")) {
        const key = decodeURIComponent(pathname.slice("/lesson/".length));
        const file = await resolveLessonFile(workbook, key);
        if (!file) return send(res, 404, "text/plain; charset=utf-8", "Lesson not found.\n");
        const normalizedKey = normalizeLessonKey(key, workbook.workbookRoot);
        const source = await readFile(file, "utf8");
        const { curriculum, sidebar } = await buildModel(workbook, normalizedKey);
        const title = extractTitle(source) ?? basename(file, ".md");
        const completed = Boolean(
          (await readProgress(workbook.progressPath)).completed[normalizedKey],
        );
        const written = flattenWritten(sidebar);
        const html = renderLesson({
          workbookTitle: await workbookTitle(curriculum, workbook.workbookRoot),
          sidebar,
          title,
          bodyHtml: renderMarkdown(source.replace(/^#\s+.+\r?\n?/, "")),
          lessonKey: normalizedKey,
          completed,
          prev: neighbor(written, normalizedKey, "prev"),
          next: neighbor(written, normalizedKey, "next"),
        });
        return send(res, 200, "text/html; charset=utf-8", html);
      }

      return send(res, 404, "text/plain; charset=utf-8", "Not found.\n");
    } catch (error) {
      process.stderr.write(`viewer: ${error.message}\n`);
      return sendJson(res, 500, { error: error.message });
    }
  });
}

function readBody(req, limit = 1 << 20) {
  return new Promise((resolveBody, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function defaultNow() {
  return new Date().toISOString();
}
