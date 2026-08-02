import { readFile, writeFile, mkdir, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

export class CurriculumConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "CurriculumConflictError";
  }
}

export async function readCurriculum(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    const revision = createHash("sha256").update(content).digest("hex");
    const data = JSON.parse(content);
    return { data, revision };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { data: null, revision: null };
    }
    throw error;
  }
}

export async function writeCurriculum(filePath, data, expectedRevision) {
  const dir = join(filePath, "..");
  const lockDir = join(dir, ".curriculum.lock");
  
  // Acquire lock
  let lockAcquired = false;
  const maxRetries = 50;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await mkdir(lockDir);
      lockAcquired = true;
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      // Wait before retrying (approx 100ms)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  if (!lockAcquired) {
    throw new CurriculumConflictError("Could not acquire lock to save curriculum.");
  }

  try {
    // Check revision
    if (expectedRevision !== undefined) {
      const { revision: currentRevision } = await readCurriculum(filePath);
      if (currentRevision !== expectedRevision) {
        throw new CurriculumConflictError(
          `Curriculum was modified by another process. Expected revision ${expectedRevision}, but found ${currentRevision}.`
        );
      }
    }

    // Atomic write using a temporary file
    const tmpFile = `${filePath}.tmp.${Date.now()}`;
    
    // Manage schema structure
    data.history = data.history || [];
    data.learnerCompletion = data.learnerCompletion || {};
    
    if (data.history.length > 500) {
      data.history = data.history.slice(-500); // Prevent unbounded growth
    }

    const newContent = JSON.stringify(data, null, 2) + "\n";
    await writeFile(tmpFile, newContent, "utf8");
    
    // Rename replaces the old file atomically on POSIX systems
    const { rename } = await import("node:fs/promises");
    await rename(tmpFile, filePath);

    const newRevision = createHash("sha256").update(newContent).digest("hex");
    return newRevision;
  } finally {
    // Release lock
    await rm(lockDir, { recursive: true, force: true });
  }
}
