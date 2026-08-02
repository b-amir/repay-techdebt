// Detect direct CLI invocation even when argv[1] is a symlink to this module.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function isDirectCliInvocation(importMetaUrl) {
  if (!importMetaUrl?.startsWith("file:")) return false;
  const argvPath = process.argv[1];
  if (!argvPath) return false;
  const modulePath = fileURLToPath(importMetaUrl);
  try {
    return realpathSync(modulePath) === realpathSync(argvPath);
  } catch {
    return modulePath === argvPath;
  }
}
