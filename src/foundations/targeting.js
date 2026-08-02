import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const skillRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export class TargetRootError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "TargetRootError";
    this.code = code;
    this.details = details;
  }
}

export function isSameOrInside(candidate, parent) {
  const pathFromParent = relative(resolve(parent), resolve(candidate));
  return (
    pathFromParent === "" ||
    (pathFromParent !== ".." &&
      !pathFromParent.startsWith(`..${sep}`) &&
      !isAbsolute(pathFromParent))
  );
}

export async function resolveTargetRoot(input) {
  if (!input) {
    throw new TargetRootError(
      "An explicit target repository path is required; the current directory is never assumed.",
      "TARGET_REQUIRED",
    );
  }

  const requestedTarget = resolve(input);
  let targetRoot;
  try {
    const details = await stat(requestedTarget);
    if (!details.isDirectory()) {
      throw new TargetRootError(
        `Target repository path is not a directory: ${requestedTarget}`,
        "TARGET_NOT_DIRECTORY",
        { requestedTarget },
      );
    }
    targetRoot = await realpath(requestedTarget);
  } catch (error) {
    if (error instanceof TargetRootError) throw error;
    throw new TargetRootError(
      `Target repository path cannot be resolved: ${requestedTarget}`,
      "TARGET_UNAVAILABLE",
      { requestedTarget },
    );
  }

  const canonicalSkillRoot = await realpath(skillRoot);
  if (isSameOrInside(targetRoot, canonicalSkillRoot)) {
    throw new TargetRootError(
      "Refusing to analyze the repay-techdebt skill directory or anything inside it. Pass the repository whose technical debt should be analyzed.",
      "TARGET_IS_SKILL",
      { requestedTarget: targetRoot },
    );
  }

  const relativeSkillRoot = isSameOrInside(canonicalSkillRoot, targetRoot)
    ? relative(targetRoot, canonicalSkillRoot).replaceAll("\\", "/")
    : null;

  return { targetRoot, relativeSkillRoot };
}

export function formatTargetError(error) {
  if (!(error instanceof TargetRootError)) return null;
  const {
    requiredAction = "Provide the explicit root path of the repository to analyze.",
    fallback = "none; analyzing the skill repository is not an allowed fallback",
    ...details
  } = error.details;
  return JSON.stringify({
    type: "target-error",
    code: error.code,
    reason: error.message,
    ...details,
    requiredAction,
    fallback,
  });
}
