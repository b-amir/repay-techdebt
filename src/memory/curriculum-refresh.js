import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const DURABLE_TOPIC_FIELDS = [
  "status",
  "lessonPath",
  "writtenAt",
  "evidenceDigests",
  "staleReasons",
  "lessonHistory",
];

/** Preserve written lessons and learner progress when an approved curriculum map is refreshed. */
export function preserveCurriculumProgress(next, prior) {
  if (!next || !Array.isArray(next.topics) || !prior || !Array.isArray(prior.topics)) return next;
  const nextById = new Map(next.topics.map((topic) => [topic.id, topic]));
  const durablePrior = prior.topics.filter((topic) => topic.lessonPath);

  for (const previous of durablePrior) {
    const current = nextById.get(previous.id);
    if (current) {
      for (const field of DURABLE_TOPIC_FIELDS) {
        if (previous[field] !== undefined) current[field] = structuredClone(previous[field]);
      }
      continue;
    }
    const retained = structuredClone(previous);
    retained.rank = next.topics.length + 1;
    retained.retainedFromPriorCurriculum = true;
    next.topics.push(retained);
    nextById.set(retained.id, retained);

    if (next.delivery?.learningPathTopics) {
      next.delivery.learningPathTopics.push(retained.id);
    }
    const chapters = next.blueprint?.chapters;
    if (Array.isArray(chapters)) {
      let chapter = chapters.find((item) => item.title === retained.chapter);
      if (!chapter) {
        chapter = {
          id: `chapter-retained-${chapters.length + 1}`,
          title: retained.chapter ?? "Previously written lessons",
          learnerCapability:
            "Keep previously learned mechanisms available after curriculum refresh.",
          prerequisiteChapterIds: [],
          topicIds: [],
          mechanismFamilies: [],
          domainFamilies: [],
        };
        chapters.push(chapter);
      }
      if (!chapter.topicIds.includes(retained.id)) chapter.topicIds.push(retained.id);
    }
  }

  next.learnerCompletion = {
    ...next.learnerCompletion,
    ...prior.learnerCompletion,
  };
  if (Array.isArray(prior.preservedLessons) && prior.preservedLessons.length > 0) {
    next.preservedLessons = structuredClone(prior.preservedLessons);
  }
  next.history = [...(prior.history ?? []), ...(next.history ?? [])];
  if (next.scale) next.scale.selectedTopics = next.topics.length;
  if (next.blueprint?.coverage) {
    next.blueprint.coverage.topicCount = next.topics.length;
    next.blueprint.coverage.chapterCount = next.blueprint.chapters?.length ?? 0;
  }
  return next;
}

export async function computeEvidenceDigests(targetRoot, evidencePaths) {
  const digests = {};
  for (const evidencePath of evidencePaths) {
    try {
      // First try to use Git if available (fast and reliable for repo tracking)
      const { stdout } = await exec("git", ["hash-object", evidencePath], {
        cwd: targetRoot,
      });
      digests[evidencePath] = stdout.trim();
    } catch {
      // Fallback to content hashing if not in a Git repo or Git fails
      try {
        const absolutePath = resolve(targetRoot, evidencePath);
        const content = await readFile(absolutePath, "utf8");
        digests[evidencePath] = createHash("sha256").update(content).digest("hex");
      } catch {
        digests[evidencePath] = "missing";
      }
    }
  }
  return digests;
}

export async function refreshCurriculum(targetRoot, curriculum) {
  const result = {
    unchanged: 0,
    affected: 0,
    invalidated: 0,
    newlyRelevant: 0,
    staleTopics: [],
  };

  if (!curriculum || !Array.isArray(curriculum.topics)) {
    return result;
  }

  for (const topic of curriculum.topics) {
    if (topic.status !== "written" || !topic.evidenceDigests) {
      continue;
    }

    const currentDigests = await computeEvidenceDigests(targetRoot, topic.evidencePaths || []);

    let isStale = false;
    const staleReasons = [];

    for (const [path, oldDigest] of Object.entries(topic.evidenceDigests)) {
      const currentDigest = currentDigests[path];
      if (currentDigest === "missing") {
        isStale = true;
        staleReasons.push(`Evidence deleted or moved: ${path}`);
      } else if (currentDigest !== oldDigest) {
        isStale = true;
        staleReasons.push(`Evidence changed: ${path}`);
      }
    }

    if (isStale) {
      topic.status = "stale";
      topic.staleReasons = staleReasons;
      result.invalidated += 1;
      result.staleTopics.push(topic);
    } else {
      result.unchanged += 1;
    }
  }

  return result;
}
