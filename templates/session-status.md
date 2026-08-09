# Session progress (mandatory)

Paste at the **top** of every user-visible turn (after any intro block on first-run Message 1).

**Fraction lives in the header** — second column is `{current}/{total}` where **current is the 1-based
index of the 🔵 step** (not the count of ✅). Start at **1/N**, never 0. **No empty header cells.**

Always include the separator row. Leave **one blank line** before any table that follows.

## Format

```markdown
**Progress**

| Step | {current}/{total}  |
| ---- | ------------------ |
| ✅   | {done step}        |
| 🔵   | **{current step}** |
| ⬜   | {future step}      |
```

- Header col 2 = `{current}/{total}` only — never a step name, never `—`.
- **current** = position of the 🔵 row (1 = first step, N = last).
- Data rows: emoji in col 1 · step in col 2. **Bold only the 🔵 row.**
- Notes after em dash, ≤6 words. Exactly one 🔵. Before = ✅. After = ⬜.

## Emoji

| Emoji | Meaning               |
| ----- | --------------------- |
| 🔵    | Now (one per message) |
| ✅    | Done                  |
| ⬜    | Later                 |

## Choose the scenario first

Classify the user's requested operation before drawing progress. Do not infer a three-lesson batch
from Fast mode, workbook defaults, or an existing curriculum.

| User request                        | Scenario        | Count source                                          |
| ----------------------------------- | --------------- | ----------------------------------------------------- |
| Analyze the app and choose lessons  | Workbook        | Actual `delivery.sessionBatch.length` once known      |
| Create one named lesson             | Single create   | Always one                                            |
| Recreate one existing lesson        | Single recreate | Always one                                            |
| Update one existing lesson          | Single update   | Always one                                            |
| Delete one existing lesson          | Single delete   | Always one                                            |
| Create a number or range of lessons | Lesson batch    | Explicit requested count                              |
| Teach from a PR/change              | PR lesson       | Actual selected count; single unless stated otherwise |
| Open/show the workbook              | View only       | No lesson count                                       |

If the lesson count is not known yet, use **Choosing lessons** / **Writing lessons**. Never display
“3 lessons,” “lesson 1/3,” or “three most valuable” until the actual selected batch contains three
lessons. The progress header may still be `1/3` when the scenario itself has three steps.

On first run, prepend **Get ready** to the chosen scenario and keep it 🔵 until setup completes.
Do not replace a direct lesson scenario with workbook discovery merely because setup is needed.

## Workbook discovery

Before the batch count is known:

```markdown
**Progress**

| Step | 1/4                                |
| ---- | ---------------------------------- |
| 🔵   | **Reading your code**              |
| ⬜   | Choosing the most valuable lessons |
| ⬜   | Writing lessons                    |
| ⬜   | You're set                         |
```

After planning, substitute the actual values:

```text
Picking the {N} most valuable lessons
Writing lesson {i}/{N}
```

Use the exact three-lesson wording only when `N = 3`.

## Direct single-lesson operations

### Create

```markdown
**Progress**

| Step | 1/3                   |
| ---- | --------------------- |
| 🔵   | **Reading your code** |
| ⬜   | Writing the lesson    |
| ⬜   | You're set            |
```

### Recreate

```markdown
**Progress**

| Step | 1/3                            |
| ---- | ------------------------------ |
| 🔵   | **Reading the current lesson** |
| ⬜   | Recreating the lesson          |
| ⬜   | You're set                     |
```

### Update

```markdown
**Progress**

| Step | 1/3                    |
| ---- | ---------------------- |
| 🔵   | **Reading the lesson** |
| ⬜   | Updating the lesson    |
| ⬜   | You're set             |
```

### Delete

```markdown
**Progress**

| Step | 1/3                    |
| ---- | ---------------------- |
| 🔵   | **Finding the lesson** |
| ⬜   | Removing the lesson    |
| ⬜   | You're set             |
```

Do not add a shortlist step to direct operations. Investigation, checking, saving, and silent
repair stay inside the action step unless the user must make a meaningful choice.

## Explicit batch or range

```markdown
**Progress**

| Step | 1/4                   |
| ---- | --------------------- |
| 🔵   | **Reading your code** |
| ⬜   | Preparing {N} lessons |
| ⬜   | {Action} lesson 1/{N} |
| ⬜   | You're set            |
```

`N` comes from the request. While working, use the real `i/N`. `{Action}` is **Writing**,
**Recreating**, **Updating**, or **Removing**, matching the request.

## PR lesson

```markdown
**Progress**

| Step | 1/3                    |
| ---- | ---------------------- |
| 🔵   | **Reading the change** |
| ⬜   | Writing the lesson     |
| ⬜   | You're set             |
```

For multiple PR lessons, use the explicit batch template with the actual count.

## View only

```markdown
**Progress**

| Step | 1/2                      |
| ---- | ------------------------ |
| 🔵   | **Opening the workbook** |
| ⬜   | You're set               |
```

## Control mode

Insert **Open workbook** immediately before **You're set** only when Control mode genuinely needs
an open confirmation. Fast mode opens automatically without adding a separate step.

Routine: progress + ≤25 useful words. Asks: `###` heading + why-line — see `agent-experience.md`.
