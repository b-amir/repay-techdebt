# Capability Pack Contract

Read this reference when adding ecosystem coverage or interpreting detected packs. Packs select
investigations. They do not declare defects.

## Purpose

A pack is declarative, portable agent guidance that connects repository signals to:

- possible executable capabilities.
- relevant analysis lenses.
- ecosystem-specific investigations.
- evidence needed before teaching a conclusion.

The engine ships language packs in `packs/program-packs.json` and framework/capability packs in
`packs/framework-packs.json`. Lens definitions live in `packs/lenses.json`. They are data files, not
vendor-specific agent configuration.

## Detection contract

Language packs may match file extensions and manifest names. Framework packs match dependency names
extracted from supported manifests. A match proves only that the artifact or declaration exists.
It does not prove runtime usage, version behavior, architecture, or quality.

Every activated pack must emit:

- pack ID and kind.
- confidence.
- evidence IDs.
- capabilities.
- possible capabilities (language applicability only. Never promote these to detected roles without
  structural, dependency, configuration, or runtime evidence).
- analysis lenses.
- investigations.

Unknown ecosystems remain valid targets. Report “no pack matched,” preserve the generic model, and
start with manual ecosystem discovery. Never silently treat unknown syntax as JavaScript or text.

## Language pack shape

```json
{
  "id": "example-language",
  "kind": "language",
  "detect": {
    "extensions": [".example"],
    "manifests": ["Example.toml"]
  },
  "capabilities": ["server", "cli"],
  "lenses": ["correctness", "reliability"],
  "investigations": ["task cancellation and resource lifetime"]
}
```

## Framework pack shape

```json
{
  "id": "example-framework",
  "kind": "framework",
  "packages": ["example-framework"],
  "signals": ["server", "api"],
  "lenses": ["security", "performance"],
  "investigations": ["middleware ordering and request trust boundaries"]
}
```

## Quality standard

Add a pack only when it changes analysis selection beyond generic model knowledge. Investigations
must describe a behavioral risk or design mechanism, not style trivia. Prefer a small group of
high-yield questions over a catalog of linter rules.

For each new pack, add fixture tests covering:

1. positive detection.
2. nearby ecosystem non-detection.
3. evidence provenance.
4. selected lenses and investigations.
5. unsupported or malformed manifest behavior.
6. no target writes.

Version-specific claims belong in current official documentation obtained during the analysis, not
inside a timeless pack. Security rules must still verify control flow and exploitability.

## Composition

Multiple packs compose by unioning capabilities and investigations, then scoring lenses with
project archetypes and focus. Composition must retain evidence by pack. Resolve conflicting advice
through actual system constraints, not pack priority. For example, a low-latency Rust service and a
data-integrity-heavy Rust migration share a language pack but should receive different lens ranks.
