import { createHash } from "node:crypto";

function canonicalPart(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value !== "object") return `${typeof value}:${String(value)}`;
  if (Array.isArray(value)) return `[${value.map(canonicalPart).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalPart(value[key])}`)
    .join(",")}}`;
}

export function stableId(prefix, ...parts) {
  const canonical = canonicalPart({ prefix, parts });
  const digest = createHash("sha256").update(canonical).digest("hex");
  return `${prefix}:sha256:${digest}`;
}

export function createIdentityRegistry(hash = stableId) {
  const canonicalById = new Map();
  return {
    id(prefix, ...parts) {
      const canonical = canonicalPart({ prefix, parts });
      const id = hash(prefix, ...parts);
      const prior = canonicalById.get(id);
      if (prior !== undefined && prior !== canonical)
        throw new Error(`Identity collision detected for ${id}`);
      canonicalById.set(id, canonical);
      return id;
    },
    size() {
      return canonicalById.size;
    },
  };
}
