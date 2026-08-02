import { formatTargetError, resolveTargetRoot } from "../src/foundations/targeting.js";
import { planLesson } from "../src/lessons/lesson-composition.js";
import { buildProgramModel } from "../src/program/program-intelligence.js";

const kinds = [
  "auto",
  "architecture-orientation",
  "end-to-end-flow",
  "code-mechanics",
  "change-impact",
  "debugging-failure",
  "security-boundary",
  "performance-scale",
  "data-state",
  "dependency-ecosystem",
  "operations-deployment",
  "testing-verification",
  "ui-interaction",
];

function help() {
  process.stdout.write(`Usage:
  node plan-lesson.js <target-root> [--focus <path-question-or-concept>] [--kind <kind>] [--depth concise|balanced|deep] [--scope <relative-path>] [--format json|markdown] [--max-files <count>] [--max-manifest-files <count>] [--max-relation-files <count>] [--max-relation-bytes <count>]

Compose a compact lesson plan from cross-application evidence. The JSON includes transparent signal
scores and omissions; Markdown intentionally shows only the simple reader-facing plan. No target
file is created. Kinds: ${kinds.join(", ")}.
`);
}

function parse(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    help();
    process.exit(0);
  }
  const positional = [];
  const options = { kind: "auto", depth: "balanced", format: "json", focus: null };
  const allowed = new Set([
    "focus",
    "kind",
    "depth",
    "scope",
    "format",
    "max-files",
    "max-manifest-files",
    "max-relation-files",
    "max-relation-bytes",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) positional.push(argument);
    else {
      const name = argument.slice(2);
      if (!allowed.has(name)) throw new Error(`Unknown option: ${argument}`);
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
      options[name] = value;
      index += 1;
    }
  }
  if (positional.length > 1) throw new Error("Expected exactly one target root");
  if (!kinds.includes(options.kind)) throw new Error(`--kind must be one of: ${kinds.join(", ")}`);
  if (!["concise", "balanced", "deep"].includes(options.depth))
    throw new Error("--depth must be concise, balanced, or deep");
  if (!["json", "markdown"].includes(options.format))
    throw new Error("--format must be json or markdown");
  for (const name of [
    "max-files",
    "max-manifest-files",
    "max-relation-files",
    "max-relation-bytes",
  ]) {
    if (options[name] === undefined) continue;
    const value = Number(options[name]);
    const maximum = name === "max-relation-bytes" ? 2_000_000_000 : 1_000_000;
    if (!Number.isInteger(value) || value < 1 || value > maximum)
      throw new Error(`--${name} must be an integer from 1 to ${maximum}`);
    options[name] = value;
  }
  return { targetInput: positional[0], options };
}

function markdown(plan) {
  const lines = [
    "# Lesson Plan",
    "",
    `**Shape:** ${plan.lessonShape.label}`,
    `**Focus:** ${plan.request.focus ?? plan.focusAnchors[0]?.path ?? "Confirm with the learner"}`,
    `**Suggested title:** ${plan.titleHint}`,
    "",
    ...plan.simplePlan.flatMap((section, index) => [
      `${index + 1}. **${section.title}** — ${section.purpose}`,
      ...(section.evidencePaths.length > 0
        ? [
            `   Evidence to verify: ${section.evidencePaths.map((path) => `\`${path}\``).join(", ")}.`,
          ]
        : []),
    ]),
    "",
    "## Evidence gaps",
    "",
    ...plan.evidenceGaps.map((item) => `- ${item}`),
  ];
  return `${lines.join("\n")}\n`;
}

try {
  const { targetInput, options } = parse(process.argv.slice(2));
  const target = await resolveTargetRoot(targetInput);
  const model = await buildProgramModel(target, {
    scope: options.scope,
    maxFiles: options["max-files"],
    maxManifestFiles: options["max-manifest-files"],
    maxRelationFiles: options["max-relation-files"],
    maxRelationBytes: options["max-relation-bytes"],
  });
  const plan = planLesson(model, options);
  process.stdout.write(
    options.format === "markdown" ? markdown(plan) : `${JSON.stringify(plan, null, 2)}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${formatTargetError(error) ?? JSON.stringify({ type: "lesson-planning-failure", reason: error.message })}\n`,
  );
  process.exitCode = 1;
}
