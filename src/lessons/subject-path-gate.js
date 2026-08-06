/**
 * Subject shortlist helpers + save-time path gate + anti-clone.
 * Scripts emit candidates; agent angles; user pin wins; save refuses pathless topics.
 */

/**
 * Emit subject candidates from a program model (entrypoints, high fan-in, pins).
 * @param {object} model program model
 * @param {{ pins?: string[], limit?: number }} [opts]
 */
export function emitSubjectCandidates(model, opts = {}) {
  const limit = opts.limit ?? 12;
  const pins = Array.isArray(opts.pins) ? opts.pins.filter(Boolean) : [];
  /** @type {Map<string, { path: string, reasons: string[], score: number, pinned: boolean }>} */
  const byPath = new Map();

  const bump = (path, score, reason) => {
    if (!path || typeof path !== "string") return;
    const n = path.replace(/^\.\//, "").replaceAll("\\", "/");
    if (!n || n.includes("node_modules")) return;
    const cur = byPath.get(n) ?? { path: n, reasons: [], score: 0, pinned: false };
    cur.score += score;
    if (reason && !cur.reasons.includes(reason)) cur.reasons.push(reason);
    byPath.set(n, cur);
  };

  for (const pin of pins) {
    bump(pin, 100, "user-pin");
    const row = byPath.get(pin.replace(/^\.\//, ""));
    if (row) row.pinned = true;
  }

  const profile = model?.profile ?? {};
  const entries = profile.entryPoints ?? model?.entryPoints ?? [];
  for (const e of entries) {
    const p = typeof e === "string" ? e : e?.path;
    bump(p, 40, "entry-point");
  }

  const nodes = model?.nodes ?? [];
  const edges = model?.edges ?? model?.relations ?? [];
  /** @type {Map<string, number>} */
  const fanIn = new Map();
  for (const edge of edges) {
    const to = edge?.to ?? edge?.target;
    const toPath = typeof to === "string" ? (nodes.find((n) => n.id === to)?.path ?? to) : to?.path;
    if (toPath) fanIn.set(toPath, (fanIn.get(toPath) ?? 0) + 1);
  }
  for (const [path, count] of fanIn) {
    if (count >= 2) bump(path, Math.min(30, count * 5), `fan-in:${count}`);
  }

  for (const node of nodes) {
    if (node?.path && (node.kind === "module" || node.kind === "file" || node.kind === "entry")) {
      bump(node.path, 5, `node:${node.kind ?? "module"}`);
    }
  }

  // monorepo: prefer package-local entry when workspace packages exist
  const packages = profile.packages ?? model?.packages ?? [];
  if (Array.isArray(packages) && packages.length > 1) {
    for (const pkg of packages) {
      const root = pkg.path ?? pkg.root ?? pkg.name;
      if (!root) continue;
      for (const [path, row] of byPath) {
        if (path.startsWith(String(root).replace(/\/?$/, "/")) || path.startsWith(String(root))) {
          row.score += 8;
          if (!row.reasons.includes("monorepo-package-scope")) {
            row.reasons.push("monorepo-package-scope");
          }
        }
      }
    }
  }

  const ranked = [...byPath.values()].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.score - a.score;
  });
  return ranked.slice(0, limit);
}

/**
 * Resolve free-text or pin to an inventory path.
 * @param {string} selector
 * @param {string[]} inventoryPaths
 * @param {{ pins?: string[] }} [opts]
 */
export function resolveSubjectPath(selector, inventoryPaths, opts = {}) {
  if (!selector || typeof selector !== "string") return null;
  const needle = selector.trim().replace(/^\.\//, "").replaceAll("\\", "/");
  if (!needle) return null;
  const inventory = new Set(
    (inventoryPaths ?? []).map((p) => String(p).replace(/^\.\//, "").replaceAll("\\", "/")),
  );
  const pins = (opts.pins ?? []).map((p) => p.replace(/^\.\//, ""));
  if (pins.includes(needle) || inventory.has(needle)) return needle;

  // exact file match by suffix
  for (const p of inventory) {
    if (p === needle || p.endsWith(`/${needle}`) || p.endsWith(needle)) return p;
  }
  // basename match unique
  const base = needle.split("/").pop();
  const hits = [...inventory].filter((p) => p.split("/").pop() === base);
  if (hits.length === 1) return hits[0];
  return null;
}

/**
 * Save refuses topics with no resolved inventory path.
 * @param {{ topicPath?: string, primaryPaths?: string[], evidencePaths?: string[], inventoryPaths?: string[], pins?: string[], focus?: string }} input
 */
export function checkSubjectPathGate(input = {}) {
  const inventory = input.inventoryPaths ?? [];
  const candidates = [
    ...(input.primaryPaths ?? []),
    ...(input.evidencePaths ?? []),
    input.topicPath,
    input.focus,
  ].filter(Boolean);

  if (candidates.length === 0 && inventory.length === 0) {
    // No inventory context: require at least one explicit path on the topic/lesson
    return {
      ok: false,
      errors: ["Topic has no resolved inventory path; pin or resolve a real file before save."],
      resolvedPath: null,
    };
  }

  for (const c of candidates) {
    const resolved = resolveSubjectPath(String(c), inventory, { pins: input.pins });
    if (resolved) return { ok: true, errors: [], resolvedPath: resolved };
    // If no inventory given, accept explicit relative path shaped tokens
    if (inventory.length === 0 && /[\w.-]+\/[\w./-]+/.test(String(c))) {
      return { ok: true, errors: [], resolvedPath: String(c).replace(/^\.\//, "") };
    }
  }

  // pin always wins if present even when not yet in inventory list
  for (const pin of input.pins ?? []) {
    if (pin) return { ok: true, errors: [], resolvedPath: pin.replace(/^\.\//, "") };
  }

  return {
    ok: false,
    errors: ["Topic has no resolved inventory path; pin or resolve a real file before save."],
    resolvedPath: null,
  };
}

/**
 * Anti-clone: flag re-used primary citation set with no new path/deeper layer.
 * @param {{ citations?: string[], primaryPaths?: string[] }} nextLesson
 * @param {{ citations?: string[], primaryPaths?: string[] }[]} priorLessons
 */
export function checkAntiClone(nextLesson, priorLessons = []) {
  const nextPrimary = normalizeSet([
    ...(nextLesson.primaryPaths ?? []),
    ...(nextLesson.citations ?? []).map(stripLine),
  ]);
  if (nextPrimary.size === 0) {
    return { ok: true, clone: false, errors: [], deeperLayer: false };
  }

  for (const prior of priorLessons) {
    const priorPrimary = normalizeSet([
      ...(prior.primaryPaths ?? []),
      ...(prior.citations ?? []).map(stripLine),
    ]);
    if (priorPrimary.size === 0) continue;
    const overlap = [...nextPrimary].filter((p) => priorPrimary.has(p));
    const overlapRatio = overlap.length / nextPrimary.size;
    const newPaths = [...nextPrimary].filter((p) => !priorPrimary.has(p));
    const deeper =
      newPaths.length === 0 &&
      nextPrimary.size > 0 &&
      // deeper layer: more specific citations (more line-level or nested paths) than prior
      (nextLesson.citations?.length ?? 0) > (prior.citations?.length ?? 0) + 1;

    if (overlapRatio >= 0.8 && newPaths.length === 0 && !deeper) {
      return {
        ok: false,
        clone: true,
        deeperLayer: false,
        errors: [
          "Next lesson re-uses the same primary citation set with no new path or deeper layer.",
        ],
        overlap,
      };
    }
    if (deeper) {
      return { ok: true, clone: false, deeperLayer: true, errors: [], overlap };
    }
  }
  return { ok: true, clone: false, deeperLayer: false, errors: [] };
}

function stripLine(c) {
  return String(c).replace(/:\d+$/, "").replace(/^\.\//, "");
}

function normalizeSet(items) {
  return new Set(
    items.map((p) => String(p).replace(/^\.\//, "").replaceAll("\\", "/")).filter(Boolean),
  );
}
