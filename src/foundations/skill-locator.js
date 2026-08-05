import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_NAME = "repay-techdebt";

const COMMON_SKILL_DIRS = [
  resolve(homedir(), ".agents", "skills", SKILL_NAME),
  resolve(homedir(), ".claude", "skills", SKILL_NAME),
  resolve(homedir(), ".cursor", "skills", SKILL_NAME),
];

function hasSkillMarker(root) {
  return existsSync(resolve(root, "SKILL.md"));
}

/**
 * Resolve the repay-techdebt skill root without user env vars in the happy path.
 *
 * @param {string} [fromEntryPath] Absolute path to the running bin or script.
 * @returns {string|null}
 */
export function locateSkillRoot(fromEntryPath = null) {
  if (fromEntryPath) {
    const candidates = [
      resolve(dirname(fromEntryPath)),
      resolve(dirname(fromEntryPath), ".."),
      resolve(dirname(fromEntryPath), "..", ".."),
    ];
    for (const root of candidates) {
      if (hasSkillMarker(root)) return root;
    }
  }

  for (const envName of ["REPAY_TECHDEBT_ROOT", "SKILL_ROOT"]) {
    const value = process.env[envName];
    if (!value) continue;
    const root = resolve(value);
    if (hasSkillMarker(root)) return root;
  }

  for (const root of COMMON_SKILL_DIRS) {
    if (hasSkillMarker(root)) return root;
  }

  return null;
}

/** Dev fallback: skill root relative to this module (repo checkout). */
export function defaultSkillRoot() {
  return resolve(fileURLToPath(new URL("../..", import.meta.url)));
}

/**
 * @param {string} [fromEntryPath]
 * @returns {string}
 */
export function resolveSkillRoot(fromEntryPath = null) {
  return locateSkillRoot(fromEntryPath) ?? defaultSkillRoot();
}
