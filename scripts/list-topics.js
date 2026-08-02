#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { resolveMemoryPaths } from "./project-memory.js";
import { readCurriculum } from "./lib/curriculum-store.js";

const { values, positionals } = parseArgs({
  options: {
    target: { type: "string" },
    json: { type: "boolean" },
    status: { type: "string" },
  },
  allowPositionals: true,
});

const targetRoot = values.target ? resolve(values.target) : process.cwd();

async function run() {
  const paths = await resolveMemoryPaths(targetRoot);
  const { data: curriculum } = await readCurriculum(paths.curriculumData);

  if (!curriculum || !curriculum.topics) {
    console.error("No curriculum found or curriculum is empty.");
    process.exitCode = 1;
    return;
  }

  let topics = curriculum.topics;

  if (values.status) {
    topics = topics.filter((t) => t.status === values.status);
  }

  // Also support positional arguments for search
  const query = positionals.join(" ").toLowerCase();
  if (query) {
    topics = topics.filter((t) => 
      t.title.toLowerCase().includes(query) || 
      t.learnerOutcome.toLowerCase().includes(query) ||
      t.chapter.toLowerCase().includes(query)
    );
  }

  if (values.json) {
    console.log(JSON.stringify(topics, null, 2));
    return;
  }

  const completed = (id) => curriculum.learnerCompletion?.[id] ? " (Completed)" : "";

  for (const topic of topics) {
    console.log(`[${topic.status}] ${topic.title}${completed(topic.id)}`);
    console.log(`  Chapter: ${topic.chapter} (Priority: ${topic.tier})`);
    console.log(`  Outcome: ${topic.learnerOutcome}`);
    if (topic.lessonPath) {
      console.log(`  Path: ${topic.lessonPath}`);
    }
    if (topic.status === "stale" && topic.staleReasons) {
      console.log(`  Stale Reasons: ${topic.staleReasons.join("; ")}`);
    }
    console.log("");
  }

  console.log(`Total topics shown: ${topics.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
