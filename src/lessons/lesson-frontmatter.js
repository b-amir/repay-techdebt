/**
 * Minimal lesson frontmatter parse + craft fields.
 * No full YAML engine — only keys we gate on.
 */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * @param {string} markdown
 * @returns {{ frontmatter: Record<string, unknown>, body: string, raw: string | null }}
 */
export function parseLessonFrontmatter(markdown) {
  const text = String(markdown ?? "");
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { frontmatter: {}, body: text, raw: null };

  const raw = match[1];
  const frontmatter = parseSimpleYaml(raw);
  const body = text.slice(match[0].length);
  return { frontmatter, body, raw };
}

/**
 * Loose YAML subset: key: value, key: | / >- blocks, nested skipReasons, list under primaryPaths.
 * @param {string} raw
 */
function parseSimpleYaml(raw) {
  /** @type {Record<string, unknown>} */
  const out = {};
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i += 1;
      continue;
    }
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!m) {
      i += 1;
      continue;
    }
    const key = m[1];
    const rest = m[2];

    if (rest === "|" || rest === ">" || rest === ">-" || rest === "|-") {
      const block = [];
      i += 1;
      while (i < lines.length && (lines[i].startsWith("  ") || lines[i].trim() === "")) {
        block.push(lines[i].replace(/^  /, ""));
        i += 1;
      }
      out[key] = block.join("\n").trim();
      continue;
    }

    if (rest === "" || rest === null) {
      // nested map or list
      i += 1;
      if (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        const list = [];
        while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
          list.push(lines[i].replace(/^\s*-\s+/, "").trim());
          i += 1;
        }
        out[key] = list;
        continue;
      }
      if (i < lines.length && /^\s+\w/.test(lines[i])) {
        /** @type {Record<string, string>} */
        const nested = {};
        while (i < lines.length) {
          const nestedLine = lines[i];
          if (!/^\s+\w/.test(nestedLine)) break;
          const nm = nestedLine.match(/^\s+([A-Za-z][\w-]*)\s*:\s*(.*)$/);
          if (!nm) {
            i += 1;
            continue;
          }
          const nkey = nm[1];
          const nrest = nm[2];
          if (nrest === "|" || nrest === ">" || nrest === ">-" || nrest === "|-") {
            const block = [];
            i += 1;
            while (i < lines.length && (/^\s{4,}/.test(lines[i]) || lines[i].trim() === "")) {
              block.push(lines[i].replace(/^\s{4}/, ""));
              i += 1;
            }
            nested[nkey] = block.join("\n").trim();
            continue;
          }
          nested[nkey] = stripQuotes(nrest);
          i += 1;
        }
        out[key] = nested;
        continue;
      }
      out[key] = "";
      continue;
    }

    out[key] = stripQuotes(rest);
    i += 1;
  }
  return out;
}

function stripQuotes(value) {
  const v = String(value ?? "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * @param {Record<string, unknown>} fm
 * @returns {{ mapAnswers: string | null, skipReasons: { map?: string, purpose?: string, verify?: string }, subject: string | null, primaryPaths: string[], shape: string | null, sectionRoles: { workedPath?: string, pitfall?: string, check?: string }, diagramDecision: string | null, diagramReason: string | null }}
 */
export function craftFieldsFromFrontmatter(fm) {
  const skipRaw = fm.skipReasons && typeof fm.skipReasons === "object" ? fm.skipReasons : {};
  /** @type {{ map?: string, purpose?: string, verify?: string }} */
  const skipReasons = {};
  for (const key of ["map", "purpose", "verify"]) {
    const v = /** @type {any} */ (skipRaw)[key];
    if (typeof v === "string" && v.trim()) skipReasons[key] = v.trim();
  }
  // Also accept flat skipReasons.map style already nested only.
  const mapAnswers =
    typeof fm.mapAnswers === "string" && fm.mapAnswers.trim() ? fm.mapAnswers.trim() : null;
  const subject =
    typeof fm.subject === "string" && fm.subject.trim()
      ? fm.subject.trim().toLowerCase()
      : typeof fm.shape === "string" && fm.shape.trim()
        ? fm.shape.trim().toLowerCase()
        : null;
  const primaryPaths = Array.isArray(fm.primaryPaths)
    ? fm.primaryPaths.map(String).filter(Boolean)
    : typeof fm.primaryPaths === "string" && fm.primaryPaths
      ? [fm.primaryPaths]
      : [];
  const shape = typeof fm.shape === "string" ? fm.shape.trim() : null;
  const rolesRaw = fm.sectionRoles && typeof fm.sectionRoles === "object" ? fm.sectionRoles : {};
  const sectionRoles = {};
  for (const key of ["workedPath", "pitfall", "check"]) {
    const value = /** @type {any} */ (rolesRaw)[key];
    if (typeof value === "string" && value.trim()) sectionRoles[key] = value.trim();
  }
  const diagramDecision =
    typeof fm.diagramDecision === "string" && fm.diagramDecision.trim()
      ? fm.diagramDecision.trim().toLowerCase()
      : null;
  const diagramReason =
    typeof fm.diagramReason === "string" && fm.diagramReason.trim()
      ? fm.diagramReason.trim()
      : null;
  return {
    mapAnswers,
    skipReasons,
    subject,
    primaryPaths,
    shape,
    sectionRoles,
    diagramDecision,
    diagramReason,
  };
}
