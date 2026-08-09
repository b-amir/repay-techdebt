---
subject: code-mechanics
primaryPaths:
  - billing/capture.js
  - billing/settlement.js
sectionRoles:
  workedPath: Follow the call
  pitfall: Why the boundary matters
  check: Change it safely
---

## What you will learn

You will learn how `capturePayment` hands work to `settle` so money movement stays one path. This matters because a broken settle call drops funds without a clear error at the capture boundary.

## Predict the handoff

Before you open the files, predict: does capture write ledger rows itself, or does it call a settle helper? Check your guess against `billing/capture.js:4` and `billing/settlement.js:2`.

## Follow the call

`capturePayment` validates the order, then returns the result of `settle` in `billing/capture.js:6`. The settle helper records status in `billing/settlement.js:3`. Keep the lesson on this one handoff.

## Why the boundary matters

Splitting capture from settle lets you change settlement policy without rewriting every payment entry point. Therefore you can test settle failures separately from order validation.

## Change it safely

Try a modify challenge: add a guard in `billing/settlement.js` that rejects non-positive amounts,
then predict what capture returns when amount is zero. Private rubric: settle should throw before
returning settled status. Capture should surface that error.

## Recap

Capture owns entry validation. Settle owns settlement status. Cite both files when you claim the handoff.

CLAIMS:

1. "capturePayment returns the result of settle" - billing/capture.js:6 - support: yes - state: observed
2. "settle returns a settled status object" - billing/settlement.js:3 - support: yes - state: observed
