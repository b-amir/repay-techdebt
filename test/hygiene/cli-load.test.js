// @category C9
// H3 - CLI entrypoint load. `node --check` parses every script without executing it.
// Fails when a move or edit leaves a CLI (or lib) syntactically broken, before any
// behavior test runs.
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import pLimit from "p-limit";
import { test } from "vite-plus/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptsDir = resolve(root, "scripts");
const srcDir = resolve(root, "src");

async function listJs(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listJs(full)));
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

/** All `.js` under scripts/ and (when present) src/. Missing src/ tolerated pre-move. */
async function listAllJs() {
  const dirs = [scriptsDir, ...(existsSync(srcDir) ? [srcDir] : [])];
  const lists = await Promise.all(dirs.map((d) => listJs(d)));
  return lists.flat();
}

test(
  "every script under scripts/ and src/ passes `node --check`",
  { timeout: 30_000 },
  async () => {
    const files = await listAllJs();
    assert.ok(files.length > 0, "no scripts found - directory moved?");

    // Bounded concurrency: under the full suite, other files also spawn node, so a plain
    // sequential loop can blow past the default 5s test timeout on a loaded machine.
    const limit = pLimit(8);
    const results = await Promise.all(
      files.map((file) =>
        limit(async () => {
          // reject:false so a non-zero exit (syntax error) becomes a result we inspect.
          const result = await execa(process.execPath, ["--check", file], {
            reject: false,
          });
          return {
            file,
            ok: result.exitCode === 0,
            stderr: (result.stderr || "").trim().split("\n")[0],
          };
        }),
      ),
    );

    const broken = results
      .filter((r) => !r.ok)
      .map((r) => ({ file: relative(root, r.file), stderr: r.stderr }));

    assert.deepEqual(
      broken,
      [],
      broken.length === 0
        ? ""
        : `${broken.length} script(s) failed \`node --check\`:\n` +
            broken.map((b) => `  ${b.file} - ${b.stderr}`).join("\n"),
    );
  },
);
