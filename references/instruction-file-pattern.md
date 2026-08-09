# Instruction File Pattern

This repository separates mechanical verification (owned by scripts) from semantic judgment (owned by the agent). When the agent must apply judgment, it does so by reading an **instruction file** at runtime.

This ensures the skill's intelligence is not frozen in script regexes or hardcoded heuristics. As models improve, the skill gets smarter without requiring code changes.

## Structure of an Instruction File

Every instruction file (like `lesson-reviewer.md` or `topic-shortlister.md`) must contain four parts:

### 1. Frame

The role and the task in plain language.
_Example: "You are a skeptical editor reviewing a lesson. Score each dimension 1–5."_

### 2. Placeholders

Variables like `{{draft}}`, `{{evidence}}`, `{{topic.outcome}}`, or `{{anchors}}`. The orchestrating script replaces these with concrete content before the agent evaluates the prompt. The agent never sees the literal `{{}}` syntax.

### 3. Examples

One passing and one failing example per dimension (or for the overall task), paired with a short sentence explaining _why_.
_Why it matters:_ The agent learns the true bar from examples, not from arbitrary numeric rubrics. This is where the actual intelligence lives.

### 4. Output Shape

The exact structured JSON object the agent must emit.
_Example:_

```json
{
  "insight": 4,
  "accuracy": 5,
  "mustFix": [],
  "reasoning": "Clear explanation."
}
```

The invoking script validates this shape and persists it.

## When to use this pattern

| Write a **script** when                                                         | Write an **instruction file** when                                                                          |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| The check is verifiable by regex/AST (e.g., citation format or path existence). | The check requires understanding meaning (e.g., insight, accuracy, fit, or whether length suits the topic). |
| The operation requires atomic persistence or schema enforcement.                | The operation involves selection (what to teach, what's important).                                         |
