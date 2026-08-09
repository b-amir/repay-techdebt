---
id: settle-return-shape
title: What settle actually returns
subject: code-mechanics
shape: code-mechanics
depth: concise
primaryPaths:
  - billing/settlement.js
skipReasons:
  map: >-
    Single helper and return object. No multi-module structure question that a
    diagram would answer better than the snippet.
sectionRoles:
  workedPath: Read the whole mechanism
  pitfall: What breaks if you “simplify” it
  check: Safely evolve the return contract
---

# What settle actually returns

`settle` looks tiny, but **its return object is the contract capture relies on**. If you change the fields or the `"settled"` string without checking callers, capture still “succeeds” while downstream code looks for missing keys. After this lesson you can predict and test the caller impact of changing that return shape.

## Why the helper is separate

Capture already proved an order id exists. Settlement only needs identifiers and amount so it can stamp a status. Keeping that stamp in one function means every path that needs a settled result goes through the same object shape.

You do not need a system map here: there is one function and one return. The map skip is intentional - the teaching target is the object, not module topology.

## Read the whole mechanism

Open `billing/settlement.js:2`. The function signature is plain:

```js
// billing/settlement.js:2-4
export function settle(orderId, amount) {
  return { orderId, amount, status: "settled" };
}
```

Three facts matter:

1. **Inputs are scalars**, not the full order object - so settle cannot re-run capture’s `order?.id` check even if it wanted to.
2. **Status is a string literal** `"settled"` at `billing/settlement.js:3`, not a computed enum from elsewhere in this fixture.
3. **No async, no side effects** in this file - the “settlement” is the returned object. Callers that expect a write to a ledger will not find it here.

Because capture does `return settle(...)` in `billing/capture.js:6`, whatever shape you invent in settle becomes capture’s public result for this path.

## What breaks if you “simplify” it

Contrast two wrong edits:

```diff
- return { orderId, amount, status: "settled" };
+ return true; // "settled enough"
```

Capture still returns successfully, but anything that reads `.status` or `.orderId` on the result breaks. Or:

```diff
- return { orderId, amount, status: "settled" };
+ return { orderId, amount, status: amount > 0 ? "settled" : "pending" };
```

That change invents a second status without updating callers or tests. The lesson is not “never evolve status” - it is “the return object _is_ the contract,” so edit it as a contract.

## Safely evolve the return contract

Suppose you must rename `status` to `state` in `billing/settlement.js`. Before editing, write the
assertion you expect a `capturePayment` caller to fail. Then name the smallest compatibility change
that lets old callers keep reading `.status` while new callers migrate to `.state`.

Private answer: first assert that capture’s result currently has `.status === "settled"`. During the
migration, return both `status: "settled"` and `state: "settled"`, update callers, then remove the old
field in a separate verified change. The helper still does not validate or persist.

**If you remember one thing:** settle’s return object is the settlement - change those fields and you change capture’s result.
