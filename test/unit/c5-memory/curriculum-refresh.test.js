// @category C5
import { test } from "vite-plus/test";
import * as assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import {
  computeEvidenceDigests,
  refreshCurriculum,
} from "../../../src/memory/curriculum-refresh.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

test("refreshCurriculum detects stale lessons based on evidence file changes", async () => {
  const targetRoot = await mkdtemp(resolve(tmpdir(), "refresh-"));
  try {
    // 1. Create a dummy file and get its hash
    const evidencePath = "src/example.ts";
    const absolutePath = join(targetRoot, "src", "example.ts");
    await mkdir(join(targetRoot, "src"), { recursive: true });

    // Init git repo so git hash-object works
    await exec("git", ["init"], { cwd: targetRoot });
    await writeFile(absolutePath, "const a = 1;");

    // 2. Compute initial digest
    const digests = await computeEvidenceDigests(targetRoot, [evidencePath]);

    // 3. Create a curriculum with a written topic
    const curriculum = {
      topics: [
        {
          id: "topic-1",
          status: "written",
          evidencePaths: [evidencePath],
          evidenceDigests: digests,
        },
        {
          id: "topic-2",
          status: "written",
          evidencePaths: ["src/unrelated.ts"],
          evidenceDigests: { "src/unrelated.ts": "some-old-hash" },
        },
        {
          id: "topic-3", // Planned topic should be ignored for staleness
          status: "planned",
          evidencePaths: [evidencePath],
        },
      ],
    };

    // 4. Test 1: No changes
    const result1 = await refreshCurriculum(targetRoot, curriculum);
    assert.equal(result1.unchanged, 1, "topic-1 should be unchanged initially");
    assert.equal(result1.invalidated, 1, "topic-2 should be invalidated due to missing file");
    assert.equal(curriculum.topics[0].status, "written");
    assert.equal(curriculum.topics[1].status, "stale");

    // 5. Test 2: Modify the evidence file
    await writeFile(absolutePath, "const a = 2; // modified");

    // Reset topic 2 for cleaner testing
    curriculum.topics.pop(); // remove topic-3
    curriculum.topics.pop(); // remove topic-2

    const result2 = await refreshCurriculum(targetRoot, curriculum);
    assert.equal(result2.invalidated, 1, "topic-1 should be invalidated due to modification");
    assert.equal(curriculum.topics[0].status, "stale");
    assert.deepEqual(curriculum.topics[0].staleReasons, ["Evidence changed: src/example.ts"]);

    // 6. Test 3: File deleted/renamed
    curriculum.topics[0].status = "written"; // reset
    curriculum.topics[0].evidenceDigests = await computeEvidenceDigests(targetRoot, [evidencePath]);

    await rename(absolutePath, join(targetRoot, "src", "example2.ts"));

    const result3 = await refreshCurriculum(targetRoot, curriculum);
    assert.equal(result3.invalidated, 1, "topic-1 should be invalidated due to deletion");
    assert.equal(curriculum.topics[0].status, "stale");
    assert.deepEqual(curriculum.topics[0].staleReasons, [
      "Evidence deleted or moved: src/example.ts",
    ]);
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
});
