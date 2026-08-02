/** dependency-cruiser config.
 *
 *  Run with: pnpm lint:orphans  (or `npx depcruise src scripts test`)
 *
 *  Currently scopes to orphan/deadwood detection — flags any library module nothing
 *  depends on. Complements test/hygiene/orphan-files.test.js (which enforces the same
 *  invariant in CI); depcruise is the on-demand investigator that also walks the full
 *  import graph (circular deps, reachability) when needed.
 */
module.exports = {
  forbidden: [
    {
      name: "no-orphans",
      severity: "error",
      comment:
        "A library module that no other module imports is dead code, or a stale copy left by a move.",
      from: {
        orphan: true,
        pathNot: [
          "node_modules/",
          "\\.(test|spec)\\.[cm]?js$",
          "^src/[^/]+/index\\.js$", // category barrels = public surface
          "^scripts/[^/]+\\.js$", // CLI entrypoints = roots, never imported
          "^test/fixtures/", // fixtures are analyzer input data, not library code
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: "node_modules/",
  },
};
