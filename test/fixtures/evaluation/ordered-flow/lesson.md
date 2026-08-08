---
subject: flow
mapAnswers: The entry delegates to the adapter and the adapter settles the response.
primaryPaths:
  - app/entry/request.ts
  - app/server/adapter.ts
sectionRoles:
  workedPath: Follow the boundary
  pitfall: Race to avoid
  check: Prove the handoff
---

## Follow the boundary

1. `app/entry/request.ts:8` receives the request and calls the adapter.
2. The adapter validates the response, then returns its body from `app/server/adapter.ts:24`.
3. After the caller aborts, the cleanup branch releases the pending request.

## Race to avoid

When abort wins after the upstream response, then a second settlement would write stale state, so the completion guard ignores it.

## Prove the handoff

Modify `app/server/adapter.ts` so an abort arrives immediately after the response. Run the focused adapter test. Expect one settlement assertion and verify that cleanup still executes.
