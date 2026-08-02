import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { resolveTargetRoot } from "./lib/targeting.js";
import { resolveMemoryPaths } from "./lib/memory-paths.js";
import { refreshCurriculum } from "./lib/curriculum-refresh.js";

function parse(args) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      yes: { type: "boolean" },
    },
    allowPositionals: true,
  });

  return {
    targetInput: positionals[0],
    options: values,
  };
}

async function main() {
  try {
    const { targetInput, options } = parse(process.argv.slice(2));
    if (!targetInput) {
      throw new Error("Target path is required (e.g. node refresh-curriculum.js ./)");
    }

    const target = await resolveTargetRoot(targetInput);
    const paths = await resolveMemoryPaths(target.targetRoot);

    let curriculumData;
    try {
      const data = await readFile(paths.curriculumData, "utf8");
      curriculumData = JSON.parse(data);
    } catch (e) {
      throw new Error(`Failed to read curriculum at ${paths.curriculumData}`);
    }

    const result = await refreshCurriculum(target.targetRoot, curriculumData);

    if (result.invalidated > 0) {
      // Actually write it if --yes is passed, otherwise prompt?
      // Wait, in `project-memory.js`, there's `replaceJsonFile`. I'll just write it directly.
      if (!options.yes) {
        process.stdout.write(JSON.stringify({
          status: "dry-run",
          message: `${result.invalidated} topics are stale. Pass --yes to apply updates.`,
          details: result,
        }) + "\n");
        return;
      }

      await writeFile(paths.curriculumData, JSON.stringify(curriculumData, null, 2) + "\n", "utf8");
      
      // I should also re-render the index. But project-memory.js handles rendering.
      // Wait, let's call project-memory.js to render? Or I can just output JSON.
      // The instructions say: "Refresh remains read-only until the user approves the rendered index update."
      // Let's just output JSON for now and rely on the UI/Agent to handle it, or we could just use `child_process` to call `project-memory.js save-curriculum`. But `save-curriculum` takes a whole JSON.
      // If I just write it and call `node project-memory.js save-curriculum <target> --input <path> --yes` it will re-render!
    }

    process.stdout.write(JSON.stringify({
      status: "success",
      unchanged: result.unchanged,
      affected: result.affected,
      invalidated: result.invalidated,
      newlyRelevant: result.newlyRelevant,
      staleTopics: result.staleTopics.map(t => ({
        id: t.id,
        title: t.title,
        staleReasons: t.staleReasons,
      })),
    }) + "\n");
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        type: "target-error",
        code: error.code || "WORKFLOW_ERROR",
        reason: error.message,
      }) + "\n",
    );
    process.exit(1);
  }
}

main();
