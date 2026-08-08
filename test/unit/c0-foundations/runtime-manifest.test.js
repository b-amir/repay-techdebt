// @category C0
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import { selectRuntimeManifest } from "../../../src/foundations/runtime-manifest.js";

test("selectRuntimeManifest converts bootstrap metadata into a standard package-manager pin", () => {
  const source = {
    name: "example",
    dependencies: { zod: "4.4.3" },
    devEngines: {
      packageManager: { name: "pnpm", version: "11.18.0", onFail: "download" },
    },
  };

  const runtime = selectRuntimeManifest(source);
  assert.equal(runtime.packageManager, "pnpm@11.18.0");
  assert.equal(runtime.devEngines, undefined);
  assert.deepEqual(runtime.dependencies, source.dependencies);
  assert.equal(source.devEngines.packageManager.version, "11.18.0");
});
