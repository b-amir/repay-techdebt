# Craft example pairs (openers + check-yourself)

Stealable good/bad pairs for agents drafting lessons. **Not a scored rubric.**  
Load with golden fixtures A and B before drafting (see [README.md](./README.md)).

Subjects below use the mini target under `target/billing/` so examples stay concrete.

---

## Openers (hook / BLUF)

### Pair 1 — concrete path vs vague overview

**Bad**

> In this lesson, we will explore the billing module and understand how payments work in a robust, scalable way.

**Why bad:** No file, no mechanism, no consequence. “Explore” + puffy adjectives. Reader cannot predict what they will *do*.

**Good**

> When money moves in this billing slice, **one function validates the order and another records settlement**. If you only read `capturePayment`, you will miss where status becomes `"settled"`.

**Why good:** Names the split, points at a real symbol, states the mistake the lesson prevents. Plain first line.

### Pair 2 — curiosity about *their* code vs textbook throat-clear

**Bad**

> Settlement is an important concept in payment systems. Industry best practice is to separate capture from settlement for compliance and scalability.

**Why bad:** Generic domain lecture. Could be any repo. No path in *this* tree.

**Good**

> `settle` looks tiny, but **its return object is the contract capture relies on**. Change the fields without checking callers and capture still “succeeds” while `.status` disappears.

**Why good:** Hook is a landmine in *this* helper; consequence is concrete.

### Pair 3 — outcome first vs restating the title

**Bad**

> This lesson covers what settle actually returns. You will learn about the settle function’s return value.

**Why bad:** Title echo. Zero mechanism, zero “so what.”

**Good**

> After this lesson you can open `billing/settlement.js` and describe the three fields on the settled object from memory — and name one thing settle does *not* do.

**Why good:** Finish line is a do-thing on a real file.

---

## Check-yourself (closing challenge)

### Pair 4 — do-thing on real symbols vs trivia quiz

**Bad**

> Quiz: What does SOLID stand for? Bonus: define idempotency in your own words.

**Why bad:** Not about this repo. No file to open. Generic CS quiz.

**Good**

> Open `billing/capture.js` and `billing/settlement.js`. Point at the line where capture refuses a missing order id, and the line where status becomes `"settled"`.

**Why good:** Physical find/trace in real paths; private answer keys to line numbers.

### Pair 5 — winnable one-step check vs essay prompt

**Bad**

> Write a full redesign of the payment domain including ledgers, retries, and PCI scope. Discuss trade-offs at length.

**Why bad:** Not finishable in one sitting; not tied to cited files; crushes the lesson’s single topic.

**Good**

> In `billing/settlement.js`, name the three properties `settle` returns, and one behavior this function does **not** perform (validate order, persist, or reject non-positive amounts).

**Why good:** Small, answerable, anchored to the snippet just taught.
