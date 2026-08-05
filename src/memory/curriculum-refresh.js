import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

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
