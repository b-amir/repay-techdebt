---
subject: architecture
mapAnswers: The entry gate establishes reachability and the operation gate controls mutation.
primaryPaths:
  - app/entry/control.ts
  - app/security/policy.ts
sectionRoles:
  workedPath: Trace both gates
  pitfall: Gate mismatch
  check: Test direct entry
---

## Trace both gates

1. `app/entry/control.ts:4` asks the entry gate before rendering.
2. Then `app/security/policy.ts:17` checks the operation policy before mutation.

## Gate mismatch

If navigation hides the link but the loader stays open, then direct URL entry bypasses the visible gate. The rule is: protect reachability and the action independently.

## Test direct entry

Change `app/entry/control.ts` to use the restricted fixture. Run the entry test in isolation. Assert that direct entry redirects and expect the mutation not to run.
