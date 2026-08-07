// Minimal TTY helpers — stdlib only (Node 22+ styleText). No chalk/ora.
// Colors off when non-TTY, NO_COLOR set, or FORCE_COLOR=0.

import { env, stderr, stdout } from "node:process";
import { styleText } from "node:util";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** @typedef {import("node:stream").Writable} WritableStream */

/**
 * @param {WritableStream} [stream]
 */
export function colorEnabled(stream = stdout) {
  if (env.NO_COLOR != null && env.NO_COLOR !== "") return false;
  if (env.FORCE_COLOR === "0") return false;
  if (env.FORCE_COLOR) return true;
  // @ts-expect-error isTTY exists on process streams
  return Boolean(stream?.isTTY);
}

/**
 * @typedef {Parameters<typeof styleText>[0]} StyleTextStyles
 * @param {StyleTextStyles} styles
 * @param {string} text
 * @param {WritableStream} [stream]
 */
export function paint(styles, text, stream = stdout) {
  if (!colorEnabled(stream)) return text;
  try {
    return styleText(styles, text);
  } catch {
    return text;
  }
}

/** @param {string} t @param {WritableStream} [s] */
export const dim = (t, s = stdout) => paint("dim", t, s);
/** @param {string} t @param {WritableStream} [s] */
export const bold = (t, s = stdout) => paint("bold", t, s);
/** @param {string} t @param {WritableStream} [s] */
export const cyan = (t, s = stdout) => paint("cyan", t, s);
/** @param {string} t @param {WritableStream} [s] */
export const green = (t, s = stdout) => paint("green", t, s);
/** @param {string} t @param {WritableStream} [s] */
export const yellow = (t, s = stdout) => paint("yellow", t, s);
/** @param {string} t @param {WritableStream} [s] */
export const red = (t, s = stdout) => paint("red", t, s);
/** @param {string} t @param {WritableStream} [s] */
export const magenta = (t, s = stdout) => paint("magenta", t, s);

/**
 * Key/value block with box-drawing. Plain lines when non-pretty.
 * @param {string} title
 * @param {Array<[string, string]>} rows
 * @param {{ stream?: WritableStream }} [opts]
 */
export function formatKvPanel(title, rows, opts = {}) {
  const stream = opts.stream ?? stdout;
  const pretty = colorEnabled(stream);
  const keys = rows.map(([k]) => k);
  const keyW = Math.min(28, Math.max(4, ...keys.map((k) => k.length)));
  const lines = [];

  if (pretty) {
    lines.push(`${paint("bold", "╭", stream)} ${bold(title, stream)}`);
  } else {
    lines.push(title);
  }

  for (const [key, value] of rows) {
    const k = key.padEnd(keyW);
    if (pretty) {
      lines.push(`${dim("│", stream)} ${dim(k, stream)}  ${value}`);
    } else {
      lines.push(`  ${k}  ${value}`);
    }
  }

  if (pretty) lines.push(dim("╰", stream));
  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} message
 * @param {{ stream?: WritableStream, ok?: boolean }} [opts]
 */
export function formatBanner(message, opts = {}) {
  const stream = opts.stream ?? stderr;
  const ok = opts.ok !== false;
  if (!colorEnabled(stream)) return `${message}\n`;
  const mark = ok ? green("●", stream) : yellow("●", stream);
  return `${mark} ${bold(message, stream)}\n`;
}

/**
 * Braille spinner on a stream (default stderr).
 * Non-TTY: prints "label…" then succeed/fail lines only.
 * @param {string} label
 * @param {{ stream?: WritableStream }} [opts]
 */
export function createSpinner(label, opts = {}) {
  const stream = opts.stream ?? stderr;
  // @ts-expect-error isTTY
  const animate = colorEnabled(stream) && Boolean(stream.isTTY);
  let text = label;
  let i = 0;
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null;

  const clearLine = () => {
    if (animate) stream.write("\r\x1b[K");
  };

  if (animate) {
    timer = setInterval(() => {
      const frame = SPINNER_FRAMES[i++ % SPINNER_FRAMES.length];
      stream.write(`\r${cyan(frame, stream)} ${dim(text, stream)}`);
    }, 80);
    if (typeof timer.unref === "function") timer.unref();
  } else {
    stream.write(`${text}…\n`);
  }

  return {
    /** @param {string} next */
    update(next) {
      text = next;
    },
    /** @param {string} [msg] */
    succeed(msg) {
      if (timer) clearInterval(timer);
      timer = null;
      clearLine();
      stream.write(`${green("✓", stream)} ${msg ?? text}\n`);
    },
    /** @param {string} [msg] */
    fail(msg) {
      if (timer) clearInterval(timer);
      timer = null;
      clearLine();
      stream.write(`${red("✗", stream)} ${msg ?? text}\n`);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      clearLine();
    },
  };
}
