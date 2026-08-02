// Sidebar model: chapters → topics, each classified written | done | planned, plus
// the current row. Planned topics link to a script-rendered placeholder page.
// exists, fall back to a single chapter built from the lesson files on disk so the
// shell still shows a directory rail.

/**
 * @param {object|null} curriculum   Parsed curriculum.json (may be absent).
 * @param {object}      progress     progress.json { completed: { [lessonPath]: ... } }
 * @param {string|null} currentKey   Forward-slash-relative lesson path of the open lesson.
 */
export function buildSidebar(curriculum, progress, currentKey) {
  const topics = Array.isArray(curriculum?.topics) ? curriculum.topics : [];
  return buildFromTopics(topics, progress, currentKey);
}

function buildFromTopics(topics, progress, currentKey) {
  const completed = progress?.completed ?? {};
  const chapterOrder = [];
  const byChapter = new Map();
  const counts = { written: 0, done: 0, planned: 0 };

  for (const topic of topics) {
    const chapter = topic.chapter ?? "Lessons";
    if (!byChapter.has(chapter)) {
      byChapter.set(chapter, []);
      chapterOrder.push(chapter);
    }
    const lessonKey = topic.lessonPath ?? null;
    const isDone = lessonKey && Boolean(completed[lessonKey]);
    const isWritten = Boolean(lessonKey);
    const state = isDone ? "done" : isWritten ? "written" : "planned";
    counts[state] += 1;
    byChapter.get(chapter).push({
      id: topic.id,
      title: topic.title,
      outcome: topic.learnerOutcome ?? null,
      lessonKey,
      state,
      current:
        (state === "planned" && currentKey === `planned:${topic.id}`) ||
        (lessonKey && currentKey && lessonKey === currentKey),
    });
  }

  return {
    total: topics.length,
    counts,
    chapters: chapterOrder.map((title) => ({ title, items: byChapter.get(title) })),
  };
}

/**
 * Fallback sidebar when no curriculum exists: one chapter from lesson files. Each
 * `lessonFiles` entry is `{ name, key }` where key is the relative path (e.g.
 * `lessons/foo.md`). `index.md`/`INDEX.md` are excluded by the caller.
 */
export function buildLessonsSidebar(lessonFiles, progress, currentKey) {
  const completed = progress?.completed ?? {};
  const items = lessonFiles.map((file) => {
    const isDone = Boolean(completed[file.key]);
    return {
      title: file.title ?? file.name.replace(/\.md$/, ""),
      outcome: null,
      lessonKey: file.key,
      state: isDone ? "done" : "written",
      current: currentKey && file.key === currentKey,
    };
  });
  const counts = {
    written: items.filter((i) => i.state === "written").length,
    done: items.filter((i) => i.state === "done").length,
    planned: 0,
  };
  return {
    total: items.length,
    counts,
    chapters: items.length ? [{ title: "Lessons", items }] : [],
  };
}
