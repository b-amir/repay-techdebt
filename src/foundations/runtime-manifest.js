import { readFile, writeFile } from "node:fs/promises";

export function selectRuntimeManifest(manifest) {
  const runtimeManifest = structuredClone(manifest);
  const packageManager = runtimeManifest.devEngines?.packageManager;
  if (packageManager?.name && packageManager?.version) {
    runtimeManifest.packageManager = `${packageManager.name}@${packageManager.version}`;
    delete runtimeManifest.devEngines.packageManager;
    if (Object.keys(runtimeManifest.devEngines).length === 0) delete runtimeManifest.devEngines;
  }
  return runtimeManifest;
}

export async function materializeRuntimeManifest(sourcePath, destinationPath) {
  const manifest = JSON.parse(await readFile(sourcePath, "utf8"));
  await writeFile(
    destinationPath,
    `${JSON.stringify(selectRuntimeManifest(manifest), null, 2)}\n`,
    "utf8",
  );
}
