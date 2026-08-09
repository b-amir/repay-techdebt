# Craft example pairs (curriculum + lessons)

Stealable good/bad pairs for agents drafting lessons. **Not a scored rubric.**  
Load with golden fixtures A and B before drafting (see [README.md](./README.md)).

Subjects below use the mini target under `target/billing/` so examples stay concrete.

---

## Curriculum grain and titles

### Pair 0 - one outcome vs scanner rows

**Bad**

> `Capture exports`, `Settlement constants`, and `Billing index` become three lessons because the
> scanner returned three files.

**Why bad:** File count became curriculum. The learner still has only one job: change the
capture-to-settlement contract safely.

**Good**

> **How capture hands a validated order to settlement** - evidence:
> `billing/capture.js`, `billing/settlement.js`, and the billing entrypoint.

**Why good:** One outcome owns all evidence needed for the change. Fold the re-export/index into the
topic instead of teaching a twin lesson.

### Pair 0b - thin file demotion vs a justified exception

**Bad keep**

> **Understand the role of billing/index.js** - it exports `capturePayment`.

**Why bad:** Export existence is not a mental model or a distinct failure mode.

**Good keep exception**

> **Why the public billing entrypoint is the compatibility boundary** - changing this thin export
> breaks every package consumer even though the file has three lines.

**Why good:** Thinness is not the decision. A distinct blast radius and trust/compatibility boundary
justify the topic.

### Pair 0c - placeholder copy vs mechanism copy

**Bad**

> **Billing Capture** - Change Billing Capture safely: what it owns and what depends on it.

**Good**

> **Where capture rejects incomplete orders before settlement** - Debug whether a failed payment was
> rejected at the input guard or returned without settlement status.

**Why good:** The title names the decision. The outcome names a job.

---

## Openers (hook / BLUF)

### Pair 1 - concrete path vs vague overview

**Bad**

> In this lesson, we will explore the billing module and understand how payments work in a robust, scalable way.

**Why bad:** No file, no mechanism, no consequence. “Explore” + puffy adjectives. Reader cannot predict what they will _do_.

**Good**

> When money moves in this billing slice, **one function validates the order and another records settlement**. If you only read `capturePayment`, you will miss where status becomes `"settled"`.

**Why good:** Names the split, points at a real symbol, states the mistake the lesson prevents. Plain first line.

### Pair 2 - curiosity about _their_ code vs textbook throat-clear

**Bad**

> Settlement is an important concept in payment systems. Industry best practice is to separate capture from settlement for compliance and scalability.

**Why bad:** Generic domain lecture. Could be any repo. No path in _this_ tree.

**Good**

> `settle` looks tiny, but **its return object is the contract capture relies on**. Change the fields without checking callers and capture still “succeeds” while `.status` disappears.

**Why good:** Hook is a landmine in _this_ helper. Consequence is concrete.

### Pair 3 - outcome first vs restating the title

**Bad**

> This lesson covers what settle actually returns. You will learn about the settle function’s return value.

**Why bad:** Title echo. Zero mechanism, zero “so what.”

**Good**

> After this lesson you can open `billing/settlement.js` and describe the three fields on the settled object from memory - and name one thing settle does _not_ do.

**Why good:** Finish line is a do-thing on a real file.

---

## Closing job

### Pair 4 - do-thing on real symbols vs trivia quiz

**Bad**

> Quiz: What does SOLID stand for? Bonus: define idempotency in your own words.

**Why bad:** Not about this repo. No file to open. Generic CS quiz.

**Good**

> A valid capture returns no `status`. Open `billing/capture.js` and `billing/settlement.js`, predict
> which function can cause that symptom, and write the assertion you would add before changing it.

**Why good:** The learner uses the handoff model to debug a symptom and define proof before editing.

### Pair 5 - winnable one-step check vs essay prompt

**Bad**

> Write a full redesign of the payment domain including ledgers, retries, and PCI scope. Discuss trade-offs at length.

**Why bad:** Not finishable in one sitting. Not tied to cited files. Crushes the lesson’s single topic.

**Good**

> Rename `status` to `state` on paper in `billing/settlement.js`. Predict the caller failure, then
> propose the smallest compatibility return shape and the assertion that proves it.

**Why good:** Small, answerable, anchored to the taught contract, and ends in a safe-change job.

---

## Headings (anti-stamp)

### Pair 6 - role-label outline vs topic-specific H2s

**Bad**

```markdown
# Core Api Http Client Ts

## The Mechanism

## Pitfall

## Try It

## Invariant
```

**Why bad:** Title is a path basename. Every H2 is a teaching-role stamp. Another lesson could reuse the
same skeleton unchanged. Weak agents copy these labels from shape hints and fail the learner.

**Good**

```markdown
# Every Browser Request Enters Through /bff

## The prefix decides which server sees the call

## What breaks when a feature finds another door

## Prove the boundary before adding an endpoint
```

**Why good:** Title names the invariant. Each H2 would sound wrong on a different topic. `sectionRoles`
maps worked/pitfall/check to those specific headings.
