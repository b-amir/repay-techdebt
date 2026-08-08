import { JSDOM } from "jsdom";
import { extractMermaidBlocksWithLocations } from "./diagram-gate.js";

let mermaidPromise;

async function mermaidParser() {
  if (!mermaidPromise) {
    // Mermaid's parser sanitizes node labels while parsing. Give its pinned runtime a private DOM
    // so the same parser used by the viewer can run deterministically in Node before persistence.
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
      pretendToBeVisual: true,
    });
    for (const key of [
      "window",
      "document",
      "Element",
      "HTMLElement",
      "SVGElement",
      "CSSStyleSheet",
      "navigator",
      "Node",
    ]) {
      Object.defineProperty(globalThis, key, {
        value: dom.window[key],
        configurable: true,
        writable: true,
      });
    }
    dom.window.SVGElement.prototype.getBBox = function getBBox() {
      const text = this.textContent ?? "";
      return { x: 0, y: 0, width: Math.max(1, text.length * 8), height: 16 };
    };
    dom.window.SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
      return (this.textContent ?? "").length * 8;
    };
    mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        deterministicIds: true,
        deterministicIDSeed: "repay-techdebt",
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

function parserSource(code) {
  // Mermaid's Node parser routes accessibility text through browser-only sanitization. The lesson
  // contract validates those fields separately, so syntax-check the graph without those two lines.
  return String(code)
    .split("\n")
    .filter((line) => !/^\s*acc(?:Title|Descr):/.test(line))
    .join("\n");
}

function compactParserMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").slice(0, 4).join(" ").replace(/\s+/g, " ").trim();
}

/** Parse every Mermaid fence with the pinned Mermaid runtime. */
export async function validateMermaidSyntax(markdown) {
  const blocks = extractMermaidBlocksWithLocations(markdown);
  const errors = [];
  const mermaid = blocks.length > 0 ? await mermaidParser() : null;
  for (const [index, block] of blocks.entries()) {
    try {
      const source = parserSource(block.code);
      const parsed = await mermaid.parse(source, { suppressErrors: false });
      if (!parsed) {
        errors.push(
          `Mermaid diagram ${index + 1} at line ${block.fenceLine} did not produce a parsed diagram.`,
        );
      }
      if (parsed) {
        const rendered = await mermaid.render(`repay-diagram-${index + 1}`, source);
        if (!rendered?.svg?.startsWith("<svg")) {
          errors.push(
            `Mermaid diagram ${index + 1} at line ${block.fenceLine} parsed but did not render an SVG.`,
          );
        }
      }
    } catch (error) {
      errors.push(
        `Mermaid diagram ${index + 1} at line ${block.fenceLine} has invalid syntax or cannot render: ${compactParserMessage(error)}`,
      );
    }
  }
  return { ok: errors.length === 0, blockCount: blocks.length, errors };
}
