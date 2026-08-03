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
  if (!targetRel) targetRel = ".";
  const targetDisplay = targetRel.startsWith("..") || targetRel === "." ? targetRel : targetRoot;

  return `${WORKBOOK_README_MARKER}
# ${name} workbook

Short lessons about this project, written from the real source. You do **not** need an AI agent
to read them.

## Open in the browser

Needs **Node.js 22+** and the \`repay-techdebt\` skill installed on this machine (once).

1. Find the skill folder (common locations):

\`\`\`text
~/.agents/skills/repay-techdebt
~/.claude/skills/repay-techdebt
\`\`\`

2. Point the viewer at the **project** this workbook teaches (not this workbook folder):

\`\`\`bash
# From anywhere — replace SKILL_ROOT if yours differs
export SKILL_ROOT="$HOME/.agents/skills/repay-techdebt"
node "$SKILL_ROOT/scripts/view-lessons.js" "${targetDisplay}" --open
\`\`\`

Same thing via project-memory:

\`\`\`bash
node "$SKILL_ROOT/scripts/project-memory.js" open-viewer "${targetDisplay}"
\`\`\`

The first run may install packages **inside the skill folder only** — never into this project.

No chat agent is required. An internet connection is only needed the first time the browser
fetches fonts/diagram scripts; lesson text and code highlighting work offline after that.

## Read as Markdown

| File | What it is |
| ---- | ---------- |
| [\`INDEX.md\`](./INDEX.md) | Curriculum index |
| [\`lessons/\`](./lessons/) | Lesson files |
| \`progress.json\` | Mark-done state (created when you use the viewer) |

Open \`INDEX.md\` or any file under \`lessons/\` in your editor if you prefer not to run the viewer.

## Create more lessons

That part uses an AI agent with the \`/repay-techdebt\` skill. Reading what is already here does not.
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
  await writeFile(
    readmePath,
    renderWorkbookReadme({
      targetRoot: meta.targetRoot,
      workbookRoot,
      projectName: meta.projectName,
    }),
    "utf8",
  );
  return mode;
}
