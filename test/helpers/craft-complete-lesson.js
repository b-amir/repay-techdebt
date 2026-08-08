/**
 * Craft-complete concise lesson body for save-lesson integration tests.
 * Passes shape + usefulness + quality floors (depth concise) against
 * writeLessonEvidence paths: src/routes/admin.ts + src/auth/permission.ts.
 */
export function craftCompleteConciseLesson() {
  return `---
subject: code-mechanics
primaryPaths:
  - src/routes/admin.ts
  - src/auth/permission.ts
skipReasons:
  map: >-
    Single boundary between route and helper; no multi-module structure map needed.
---

You will learn how the request boundary protects a change before data reaches the service. This matters because a caller should not be able to bypass the same rule through a second entry point. The lesson stays focused on one decision and one consequence so you can reuse the same check order on the next route you touch.

## Walk the path in code

The route in \`src/routes/admin.ts:12\` receives the input and delegates the access decision. Read that call before reading implementation details, because it establishes the contract the rest of the flow must preserve. The helper in \`src/auth/permission.ts:8\` returns the decision without owning navigation or presentation state.

The separation gives you a useful debugging order. Confirm the route input, confirm the helper result, and only then inspect the data operation. That sequence keeps an authorization symptom from being mistaken for a query or rendering defect.

## The pitfall people miss

The route owns entry behavior, while the helper owns the reusable permission rule. If you place a second copy of the rule in a component, direct navigation can follow a different path. Keeping one rule means each caller receives the same answer and tests can exercise the contract independently.

## Change it safely

When you add an action, identify its route, the permission it requires, and the forbidden result. Update the shared helper only when the underlying policy changes. Then verify an allowed user, a forbidden user, and direct entry. This protects the user-visible flow and the server-side boundary together.

## Check yourself

Open \`src/routes/admin.ts\` and \`src/auth/permission.ts\`. Trace one neighboring action from its route to the permission helper. Explain which file owns the policy and which file owns the response. Then predict what would happen if a component hid the button but the route omitted its guard. Your answer should name the bypass path and the test that would expose it.
`;
}

/** Same checked lesson, but a flow subject whose map answer lives only in frontmatter. */
export function craftCompleteFlowLesson() {
  return craftCompleteConciseLesson()
    .replace("subject: code-mechanics", "subject: flow")
    .replaceAll("src/routes/admin.ts", "src/entry/control.ts")
    .replaceAll("src/auth/permission.ts", "src/security/policy.ts")
    .replace(
      /skipReasons:\n  map: >-\n    Single boundary between route and helper; no multi-module structure map needed\./,
      "mapAnswers: The entry delegates its access decision to the shared policy.",
    );
}
