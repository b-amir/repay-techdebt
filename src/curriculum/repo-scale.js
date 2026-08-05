export const REPO_SIZE_THRESHOLDS = {
  SMALL: 100,
  MEDIUM: 1000,
};

export function repoSize(modeledFiles) {
  if (modeledFiles < REPO_SIZE_THRESHOLDS.SMALL) return { size: "small" };
  if (modeledFiles < REPO_SIZE_THRESHOLDS.MEDIUM) return { size: "medium" };
  return { size: "large" };
}
