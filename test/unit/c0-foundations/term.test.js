// @category C0
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  colorEnabled,
  createSpinner,
  formatKvPanel,
  paint,
} from "../../../src/foundations/term.js";
import { PassThrough } from "node:stream";

test("colorEnabled respects NO_COLOR", () => {
  const prev = process.env.NO_COLOR;
  process.env.NO_COLOR = "1";
  try {
    const stream = new PassThrough();
    // @ts-expect-error test double
    stream.isTTY = true;
    assert.equal(colorEnabled(stream), false);
    assert.equal(paint("red", "x", stream), "x");
  } finally {
    if (prev === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prev;
  }
});

test("formatKvPanel plain when non-TTY", () => {
  const stream = new PassThrough();
  // @ts-expect-error test double
  stream.isTTY = false;
  const prev = process.env.NO_COLOR;
  process.env.NO_COLOR = "1";
  try {
    const out = formatKvPanel(
      "repay status",
      [
        ["status", "ready"],
        ["target", "/tmp/app"],
      ],
      { stream },
    );
    assert.match(out, /repay status/);
    assert.match(out, /status/);
    assert.match(out, /ready/);
    assert.doesNotMatch(out, /\[/);
  } finally {
    if (prev === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prev;
  }
});

test("createSpinner succeed writes check on non-TTY", async () => {
  const chunks = [];
  const stream = new PassThrough();
  stream.on("data", (c) => chunks.push(String(c)));
  // @ts-expect-error test double
  stream.isTTY = false;
  const prev = process.env.NO_COLOR;
  process.env.NO_COLOR = "1";
  try {
    const spin = createSpinner("loading", { stream });
    spin.succeed("done");
    await new Promise((r) => setImmediate(r));
    const text = chunks.join("");
    assert.match(text, /loading/);
    assert.match(text, /done/);
    assert.match(text, /✓/);
  } finally {
    if (prev === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prev;
  }
});
