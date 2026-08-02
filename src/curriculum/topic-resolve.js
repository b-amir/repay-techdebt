// Resolve a curriculum topic from a user or agent selector (id, id prefix, title slug, focus).

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * @param {object|null} curriculum
 * @param {string} selector Topic id, id prefix, title slug, or focus string.
 * @returns {object|null}
 */
export function resolveTopicSelector(curriculum, selector) {
  if (!selector || typeof selector !== "string") return null;
  const topics = Array.isArray(curriculum?.topics) ? curriculum.topics : [];
  const trimmed = selector.trim();
  if (!trimmed) return null;

  let topic = topics.find((item) => item.id === trimmed);
  if (topic) return topic;

  topic = topics.find((item) => item.id.startsWith(trimmed));
  if (topic) return topic;

  const needle = slugify(trimmed);
  topic = topics.find((item) => slugify(item.title) === needle);
  if (topic) return topic;

  topic = topics.find((item) => item.focus === trimmed);
  if (topic) return topic;

  topic = topics.find((item) => slugify(item.focus) === needle);
  return topic ?? null;
}
