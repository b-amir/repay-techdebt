// @category C0
import assert from "node:assert/strict";
import { test, vi, beforeEach } from "vite-plus/test";
import {
  runPackageInstall,
  RuntimeBootstrapError,
} from "../../../src/foundations/runtime-install.js";
import * as cp from "node:child_process";
import * as fs from "node:fs/promises";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = /** @type {Record<string, any>} */ (await importOriginal());
  return {
    ...actual,
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  };
});

vi.mock("../../../src/foundations/user-dirs.js", () => ({
  getCacheDir: vi.fn(() => "/mock/cache/dir"),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

test("runPackageInstall uses pnpm and ignores npm", async () => {
  const mockChild = {
    on: (event, cb) => {
      if (event === "close") cb(0);
    },
  };
  const spawn = /** @type {any} */ (cp.spawn);
  const mkdir = /** @type {any} */ (fs.mkdir);
  const writeFile = /** @type {any} */ (fs.writeFile);
  spawn.mockReturnValue(mockChild);

  const result = await runPackageInstall("/mock/skill");
  assert.equal(result.command.startsWith("pnpm"), true);

  assert.equal(mkdir.mock.calls.length > 0, true);
  assert.equal(writeFile.mock.calls.length > 0, true);
  assert.equal(writeFile.mock.calls[0][0].includes(".npmrc"), true);
});

test("runPackageInstall falls back to corepack and ignores npm", async () => {
  const mockChildFail = {
    on: (event, cb) => {
      if (event === "error") cb(Object.assign(new Error("not found"), { code: "ENOENT" }));
    },
  };
  const mockChildSuccess = {
    on: (event, cb) => {
      if (event === "close") cb(0);
    },
  };

  /** @type {any} */ (cp.spawn).mockImplementation((command) => {
    if (command === "pnpm") return mockChildFail;
    if (command === "corepack") return mockChildSuccess;
    return mockChildFail;
  });

  const result = await runPackageInstall("/mock/skill");
  assert.equal(result.command.startsWith("corepack"), true);
});

test("runPackageInstall throws if both fail (no npm)", async () => {
  const mockChildFail = {
    on: (event, cb) => {
      if (event === "error") cb(Object.assign(new Error("not found"), { code: "ENOENT" }));
    },
  };
  /** @type {any} */ (cp.spawn).mockReturnValue(mockChildFail);

  await assert.rejects(
    runPackageInstall("/mock/skill"),
    (err) => err instanceof RuntimeBootstrapError && err.message.includes("pnpm is required"),
  );
});
