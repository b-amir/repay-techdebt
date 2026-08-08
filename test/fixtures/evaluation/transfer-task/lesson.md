---
subject: state-lifecycle
primaryPaths:
  - app/state/request-registry.ts
  - app/entry/submit.ts
sectionRoles:
  workedPath: Number the request states
  pitfall: Conversation isolation
  check: Exercise cancellation
---

## Number the request states

1. `app/entry/submit.ts:12` allocates a request for one scope.
2. Next the registry records pending state in `app/state/request-registry.ts:31`.
3. The completion handler removes only that request after the response settles.

## Conversation isolation

When cancellation clears every pending request, then another scope loses its pending state, so cleanup must use the scope key.

## Exercise cancellation

Modify `app/state/request-registry.ts` to cancel one scope. In the next sentence, run the request-registry unit test. Verify the chosen request disappears and assert that the other scope remains pending.
