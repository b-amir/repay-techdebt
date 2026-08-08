/**
 * Diagram gate: mermaid nodes must resolve to inventory paths; max one structure map;
 * graph must answer one teaching question (accTitle/accDescr or mapAnswers / What this shows).
 */

const MERMAID_RE = /```mermaid\n([\s\S]*?)\n```/g;

/** Labels that look like file/module paths (not pure conceptual boxes). */
const PATHISH =
  /(?:^|[\s([`"])((?:[\w.-]+\/)+[\w.-]+(?:\.\w+)?)|(?:^|[\s([`"])([\w.-]+\.(?:js|ts|tsx|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|cs|vue|svelte))\b/g;

/**
 * @param {string} markdown
 * @returns {string[]}
 */
export function extractMermaidBlocks(markdown) {
  return [...String(markdown ?? "").matchAll(MERMAID_RE)].map((m) => m[1]);
}

/** Mermaid sources with their one-based fence and source start lines. */
export function extractMermaidBlocksWithLocations(markdown) {
  const source = String(markdown ?? "");
  return [...source.matchAll(MERMAID_RE)].map((match) => {
    const fenceLine = source.slice(0, match.index).split("\n").length;
    return { code: match[1], fenceLine, sourceLine: fenceLine + 1 };
  });
}

/**
 * Pull path-like tokens from mermaid source (node labels / edge text).
 * @param {string} code
 * @returns {string[]}
 */
export function extractPathishNodes(code) {
  const found = new Set();
  const text = String(code ?? "");
  // Explicit path-looking tokens in labels
  for (const m of text.matchAll(PATHISH)) {
    const token = (m[1] || m[2] || "").replace(/^[`"'([]+|[`"'\])]+$/g, "");
    if (token) found.add(token);
  }
  // Node definitions: id[label] id(label) id{label}
  for (const m of text.matchAll(/\b([A-Za-z][\w-]*)\s*[[({]([^\])}]+)[\])}]/g)) {
    const label = m[2];
    for (const pm of label.matchAll(
      /([\w.-]+\/[\w./-]+|[\w.-]+\.(?:js|ts|tsx|jsx|mjs|cjs|py|go|rs))/g,
    )) {
      found.add(pm[1]);
    }
  }
  return [...found];
}

/**
 * Normalize inventory path list from program model or explicit paths.
 * @param {object | string[] | null | undefined} inventory
 * @returns {Set<string>}
 */
export function inventoryPathSet(inventory) {
  const set = new Set();
  if (!inventory) return set;
  if (Array.isArray(inventory)) {
    for (const p of inventory) if (typeof p === "string" && p) set.add(normalizePath(p));
    return set;
  }
  const files = inventory.files ?? inventory.nodes ?? inventory.paths ?? [];
  for (const f of files) {
    const p = typeof f === "string" ? f : (f?.path ?? f?.id ?? null);
    if (typeof p === "string" && p) set.add(normalizePath(p));
  }
  return set;
}

function normalizePath(p) {
  return String(p).replace(/^\.\//, "").replaceAll("\\", "/");
}

function pathInInventory(path, inventory) {
  const n = normalizePath(path);
  if (inventory.has(n)) return true;
  // allow inventory file that ends with node path or vice versa
  for (const item of inventory) {
    if (item === n || item.endsWith(`/${n}`) || n.endsWith(`/${item}`)) return true;
    if (item.endsWith(n) || n.endsWith(item)) return true;
  }
  return false;
}

/**
 * @param {string} markdown
 * @param {{ inventory?: object | string[], mapAnswers?: string | null, maxMaps?: number }} [opts]
 */
export function checkDiagramGate(markdown, opts = {}) {
  const blocks = extractMermaidBlocks(markdown);
  const errors = [];
  const maxMaps = opts.maxMaps ?? 1;
  if (blocks.length > maxMaps) {
    errors.push(
      `Default-path lessons allow at most ${maxMaps} structure map(s); found ${blocks.length}.`,
    );
  }

  const inventory = inventoryPathSet(opts.inventory);
  const unknown = [];
  const accepted = [];

  for (const code of blocks) {
    if (!/^\s*accTitle:/m.test(code)) {
      errors.push("Mermaid diagram is missing accTitle (the teaching question).");
    }
    if (!/^\s*accDescr:/m.test(code)) {
      errors.push("Mermaid diagram is missing accDescr.");
    }
    const nodes = extractPathishNodes(code);
    if (inventory.size > 0) {
      for (const node of nodes) {
        if (pathInInventory(node, inventory)) accepted.push(node);
        else unknown.push(node);
      }
    } else {
      // No inventory supplied: still reject clearly invented absolute-ish junk later via tests
      accepted.push(...nodes);
    }
  }

  if (unknown.length > 0) {
    errors.push(
      `Diagram names paths not in the project inventory: ${[...new Set(unknown)].join(", ")}.`,
    );
  }

  if (blocks.length > 0) {
    const hasWhatShows = /\*\*What this shows:\*\*/i.test(markdown);
    const hasMapAnswers = typeof opts.mapAnswers === "string" && opts.mapAnswers.trim().length > 0;
    const hasAccTitle = blocks.some((c) => /^\s*accTitle:\s*\S+/m.test(c));
    if (!hasWhatShows && !hasMapAnswers && !hasAccTitle) {
      errors.push(
        "Structure map must answer one lesson question (accTitle, mapAnswers, or **What this shows:**).",
      );
    } else if (!hasWhatShows) {
      // quality.js already requires What this shows — keep soft here if accTitle present
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    blockCount: blocks.length,
    pathishNodes: accepted,
    unknownNodes: [...new Set(unknown)],
  };
}
