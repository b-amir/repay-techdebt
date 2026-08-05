// Discoverable workbook README — how to open lessons without an AI agent.
import { writeFile, readFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { pathExists } from "../foundations/private-storage.js";

export const WORKBOOK_README_MARKER = "<!-- repay-techdebt-workbook-readme -->";

/**
 * @param {{ targetRoot: string, workbookRoot: string, projectName?: string }} opts
 */
export function renderWorkbookReadme({ targetRoot, workbookRoot, projectName }) {
  const name = projectName || basename(targetRoot);
  let targetRel;
  try {
    targetRel = relative(workbookRoot, targetRoot).replaceAll("\\", "/");
  } catch {
    targetRel = targetRoot;
  }
  if (!targetRel || targetRel === ".") targetRel = "..";
  return `${WORKBOOK_README_MARKER}
# ${name} workbook

Short lessons about this project, from the real source. No AI agent needed
to read them.

## Open in the browser

\`\`\`bash
repay view ${targetRel} --open
\`\`\`

Needs Node.js 22+ and the \`repay-techdebt\` skill (installs \`repay\` on your
PATH the first time). Flags: \`--port\`, \`--lesson\`, \`--open\`.

## Read as Markdown

Open [\`INDEX.md\`](./INDEX.md) or any file under [\`lessons/\`](./lessons/).

## Create more lessons

That part uses an AI agent with \`/repay-techdebt\`. Reading what is here does
not.
`;
}

/**
 * Write README.md into a discoverable workbook root.
 * - Missing → create
 * - Ours (has marker) → refresh instructions/paths
 * - Other README → leave alone
 * @returns {Promise<"created"|"updated"|"skipped">}
 */
export async function ensureWorkbookReadme(workbookRoot, meta) {
  const readmePath = resolve(workbookRoot, "README.md");
  /** @type {"created"|"updated"|"skipped"} */
  let mode = "created";
  if (await pathExists(readmePath)) {
    let existing = "";
    try {
      existing = await readFile(readmePath, "utf8");
    } catch {
      return "skipped";
    }
    if (!existing.includes(WORKBOOK_README_MARKER)) return "skipped";
    mode = "updated";
  }
  await writeFile(readmePath, `${renderWorkbookReadme(meta)}\n`, "utf8");
  return mode;
}
