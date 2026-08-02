# Evaluation Contract

This document defines how to represent machine-readable expectations for the Repay Tech Debt skill. By formalizing these expectations in a fixture, we can automatically evaluate regressions across different test repositories (fixtures).

## Schemas

Every evaluation fixture is stored as a JSON object (or analogous data structure) matching the `EvaluationFixtureSchema`.

### `EvaluationFixture`

- `version` (number): Schema version (currently `1`).
- `name` (string): Human-readable name of the fixture.
- `description` (string): Description of the program archetype and test scenario.
- `topics` (Array of `TopicExpectation`): List of topics expected to be evaluated.
- `workflows` (Array of `WorkflowExpectation`): List of workflows expected in the graph.
- `lessons` (Object mapping lesson ID to `LessonRubric`): Expected baseline rubrics for generated lessons.
- `allowedSideEffects` (Array of strings): Allowed side-effect behaviors if any.

### `TopicExpectation`

Describes how a specific topic ID should be ranked or treated by the skill.
- `id` (string): The stable identifier of the expected topic.
- `intent` (string): One of `must-find`, `useful`, `irrelevant`, or `forbidden`.
- `description` (string): Context for why this topic has this intent.

### `WorkflowExpectation`

Describes an end-to-end trace or workflow.
- `id` (string): Workflow identifier.
- `mustIncludeNodes` (Array of strings): Node IDs that must appear in the workflow.
- `mustIncludeEdges` (Array of objects with `from` and `to` strings): Directed edges that must be resolved.

### `LessonRubric`

An editorial rubric measuring lesson quality from 1 to 5.
- `correctness`: Factual accuracy based on the code.
- `importance`: The necessity of the lesson for the target profile.
- `focus`: Whether the lesson stays on a single independent outcome.
- `clarity`: Prose clarity and readability.
- `pedagogy`: Quality of teaching (mental model, transfer task).
- `actionability`: How well the user can act on the lesson.
- `notes`: Optional string containing reviewer comments.

## Creating a Fixture

1. Identify a small target codebase (CLI, frontend, API, etc.) that illustrates specific semantic patterns or edge cases.
2. Provide a `.json` file containing the `EvaluationFixture` data alongside the fixture source code.
3. Validate your fixture against `scripts/lib/evaluation-schema.js`.
