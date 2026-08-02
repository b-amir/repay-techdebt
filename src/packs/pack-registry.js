import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

const languagePackSchema = z.object({
  id: z.string(),
  kind: z.literal("language"),
  detect: z.object({
    extensions: z.array(z.string()),
    manifests: z.array(z.string()),
  }),
  capabilities: z.array(z.string()),
  lenses: z.array(z.string()),
  investigations: z.array(z.string()),
});

const frameworkPackSchema = z.object({
  id: z.string(),
  kind: z.literal("framework"),
  packages: z.array(z.string()),
  signals: z.array(z.string()),
  lenses: z.array(z.string()),
  investigations: z.array(z.string()),
});

const packCollectionSchema = z.object({
  schemaVersion: z.literal(1),
  packs: z.array(z.union([languagePackSchema, frameworkPackSchema])),
});

export async function loadProgramPacks(packsDir) {
  const file = resolve(packsDir, "program-packs.json");
  const content = await readFile(file, "utf8");
  return packCollectionSchema.parse(JSON.parse(content));
}

export async function loadFrameworkPacks(packsDir) {
  const file = resolve(packsDir, "framework-packs.json");
  const content = await readFile(file, "utf8");
  return packCollectionSchema.parse(JSON.parse(content));
}

export async function detectPacks(targetRoot, packsDir) {
  // In a full implementation, this would scan targetRoot for matching extensions,
  // parse manifests for package matches, and return a set of matched packs.
  // For now, this serves as the contract validation boundary.
  const programPacks = await loadProgramPacks(packsDir);
  const frameworkPacks = await loadFrameworkPacks(packsDir);
  return {
    matched: [],
    available: {
      program: programPacks.packs,
      framework: frameworkPacks.packs,
    },
  };
}
