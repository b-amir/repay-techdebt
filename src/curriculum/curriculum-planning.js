import { createHash } from "node:crypto";
import { basename, dirname } from "node:path";
import { buildDialogueEnvelope, topicSignalClass } from "../dialogue/dialogue-envelope.js";
import { rankCandidate } from "./curriculum-ranking.js";
import { deduplicateAndSplitTopics } from "./topic-decomposition.js";
import { buildStudyOrder } from "./curriculum-graph.js";
import { applyLearnerProfile } from "./learner-profile.js";
import { findOmnibusTopics } from "./curriculum-policy.js";
import { repoSize } from "./repo-scale.js";

const NON_PRODUCT =
  /(^|\/)(?:test|tests|__tests__|spec|specs|fixtures|mocks|scripts|tools|docs?|examples?|generated|dist|build|coverage|vendor|node_modules|storybook-static|\.storybook|\.react-router|e2e)(\/|$)/i;
const PRODUCT_SIGNAL =
  /(^|\/)(?:app|apps|src|routes?|pages?|features?|domains?|modules?|services?|controllers?|handlers?|api|auth|billing|payments?|users?|admin|chat|data|state|store|jobs?|workers?|commands?)(\/|$)/i;
const TRUST_SIGNAL = /auth|permission|session|security|credential|token|policy|guard/i;
const DATA_SIGNAL = /api|data|query|mutation|cache|state|store|repository|schema|database|model/i;
const OPERATIONS_SIGNAL =
  /deploy|docker|kubernetes|helm|terraform|config|startup|server|worker|queue|job/i;
const UI_SIGNAL = /component|screen|page|route|view|form|modal|dialog|table|ui/i;

function words(value) {
  return String(value)
    .replace(/\.[^./]+$/, "")
    .replace(/(?:^|[-_./])([a-z0-9])/gi, (_, letter) => ` ${letter.toUpperCase()}`)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Path roots that add no product meaning in titles. */
const PATH_NOISE =
  /^(?:app|apps|src|lib|packages?|pkg|client|server|www|web|frontend|backend|internal|shared|common|core)$/i;

/**
 * Layout folders that group code but rarely belong in a scannable title
 * (keep the product noun: Auth, Chat, Users).
 */
const PATH_STRUCTURAL =
  /^(?:domains?|features?|modules?|components?|containers?|pages?|routes?|views?|screens?|ui|utils?|helpers?|hooks?|store|api|data|types?|lib)$/i;

/** Basename alone is useless in an index (collides everywhere). */
const GENERIC_BASENAME =
  /^(?:index|types?|keys?|utils?|helpers?|hooks?|components?|styles?|constants?|config|server|client|api|mod|module)$/i;

function stem(path) {
  return basename(path === "." ? "application" : path).replace(/\.[^./]+$/, "");
}

/**
 * Meaningful path segments as Title Case words (no extension, no noise roots).
 * Structural layout folders stay only when needed to disambiguate generics.
 * @param {string} path
 * @param {{ keepStructural?: boolean }} [opts]
 * @returns {string[]}
 */
function meaningfulSegments(path, { keepStructural = false } = {}) {
  return String(path === "." ? "application" : path)
    .replace(/\.[^./]+$/, "")
    .split(/[/\\]+/)
    .filter((part) => {
      if (!part || part === ".") return false;
      if (PATH_NOISE.test(part)) return false;
      if (!keepStructural && PATH_STRUCTURAL.test(part)) return false;
      return true;
    })
    .map((part) => words(part));
}

/**
 * Human label for a focus path. Prefers basename when distinctive; pulls parent
 * context when basename is generic (Types, Index, Keys) so the index stays scannable.
 * @param {string} path
 * @returns {string}
 */
export function displayName(path) {
  if (!path || path === ".") return "the application";
  const raw = stem(path);
  const product = meaningfulSegments(path);
  const withLayout = meaningfulSegments(path, { keepStructural: true });

  if (/^index$/i.test(raw)) {
    // Drop the trailing "Index" segment — title the barrel by its folder.
    const productParents = product.filter((seg) => !/^index$/i.test(seg));
    const layoutParents = withLayout.filter((seg) => !/^index$/i.test(seg));
    const base = productParents.length > 0 ? productParents : layoutParents;
    return (base.slice(-2).join(" ") || "Index").trim();
  }

  if (GENERIC_BASENAME.test(raw) || (product.length === 0 && PATH_STRUCTURAL.test(raw))) {
    // Prefer product nouns + the generic role: "Chat Types", "Users Keys".
    if (product.length > 0) {
      const role = words(raw);
      const head = product.slice(-2).join(" ");
      return head.toLowerCase().endsWith(role.toLowerCase()) ? head : `${head} ${role}`.trim();
    }
    // Bare structural path (app/core/api, app/ui) — keep noise-ish parents that
    // withLayout dropped via PATH_NOISE so we never ship a one-word "Api".
    const full = String(path === "." ? "application" : path)
      .replace(/\.[^./]+$/, "")
      .split(/[/\\]+/)
      .filter((part) => part && part !== "." && !/^(?:app|apps|src)$/i.test(part))
      .map((part) => words(part));
    return full.slice(-3).join(" ") || words(raw);
  }

  // Distinctive multi-word basename (Permission Guard, Chat Api Hooks) — keep as-is
  // but pair with one product parent when available for disambiguation.
  const baseLabel = words(raw);
  // product includes the basename as last segment; parent is the segment before it.
  const parents = product.filter((seg) => seg.toLowerCase() !== baseLabel.toLowerCase());
  if (parents.length >= 1) {
    const parent = parents[parents.length - 1];
    // Basename already carries the product noun (Users Keys, Chat Store).
    if (baseLabel.toLowerCase().startsWith(parent.toLowerCase())) return baseLabel;
    // Single-token basename: "Sidebar" → "Chat Sidebar".
    if (baseLabel.split(" ").length === 1) return `${parent} ${baseLabel}`;
  }

  return baseLabel;
}

function stableTopicId(kind, focus) {
  return `topic-${createHash("sha256").update(`${kind}\0${focus}`).digest("hex").slice(0, 12)}`;
}

function chapterFor(path, kind) {
  if (kind === "workflow") return "Purpose and critical workflows";
  if (kind === "entry") return "Entrypoints and user journeys";
  if (kind === "dependency") return "Dependencies and ecosystem";
  if (kind === "test") return "Verification and change safety";
  if (TRUST_SIGNAL.test(path)) return "Trust, identity, and permissions";
  if (DATA_SIGNAL.test(path)) return "Data, state, and external contracts";
  if (OPERATIONS_SIGNAL.test(path)) return "Reliability and operations";
  if (UI_SIGNAL.test(path)) return "User-facing features and interactions";
  if (kind === "component" || kind === "boundary") return "Architecture and ownership";
  return "Core modules and mechanics";
}

function learningStageFor(chapter) {
  if (
    [
      "Architecture and ownership",
      "Dependencies and ecosystem",
      "Purpose and critical workflows",
    ].includes(chapter)
  )
    return "1. orientation";
  if (
    [
      "Verification and change safety",
      "Reliability and operations",
      "User-facing features and interactions",
      "Trust, identity, and permissions",
    ].includes(chapter)
  )
    return "3. applied";
  return "2. foundational";
}

/**
 * Catalog title from path only (unique + skimmable). Agent rewrites after source read.
 * @param {string} kind
 * @param {string} path
 */
export function titleFor(kind, path) {
  const name = displayName(path);
  if (kind === "workflow") return words(path);
  if (kind === "test") return `${name} (test)`;
  return name;
}

/**
 * Placeholder outcome until agent rewrites from source. Learner-facing if left as-is;
 * no meta "rewrite me" copy.
 * @param {string} kind
 * @param {string} path
 */
export function outcomeFor(kind, path) {
  const label = displayName(path);
  if (kind === "workflow")
    return `Trace ${label} end-to-end across owners, effects, and failure paths.`;
  if (kind === "entry")
    return `Follow how execution enters through ${label} and what result it produces.`;
  if (kind === "component")
    return `Name what ${label} owns and which contracts connect it to the rest.`;
  if (kind === "boundary")
    return `Change code near ${label} without crossing its ownership or trust edge.`;
  if (kind === "dependency")
    return `Know why ${label} is load-bearing and which contract an upgrade must keep.`;
  if (kind === "test")
    return `Use ${label} to see the protected behavior and the important missing case.`;
  return `Change ${label} safely: what it owns, who uses it, and the contracts that bind it.`;
}

function entryImportance(path) {
  const depth = path.split("/").length;
  if (NON_PRODUCT.test(path)) return 38;
  if (/(?:^|\/)index\.[^/]+$/i.test(path) && depth >= 3) return 62;
  if (/\.css$/i.test(path)) return 46;
  return 92;
}

/**
 * @param {{ kind: string, focus: string, paths: string[], reasons: string[], importance?: number, relationCount?: number }} candidate
 */
function makeCandidate({ kind, focus, paths, reasons, relationCount = 0 }) {
  const evidencePaths = [...new Set(paths.filter(Boolean))].slice(0, 5);

  const rankResult = rankCandidate({ kind, focus, relationCount });
  const finalImportance = Math.max(1, Math.min(100, rankResult.score));
  const finalReasons = [
    ...reasons,
    ...rankResult.features.positive.map((p) => `(+) ${p.reason}`),
    ...rankResult.features.negative.map((n) => `(-) ${n.reason}`),
  ];

  const chapter = chapterFor(focus, kind);

  return {
    id: stableTopicId(kind, focus),
    chapter,
    learningStage: learningStageFor(chapter),
    title: titleFor(kind, focus),
    focus,
    learnerOutcome: outcomeFor(kind, focus),
    importance: finalImportance,
    importanceReasons: [...new Set(finalReasons)].slice(0, 4),
    evidencePaths,
    relationCount,
    signalClass: topicSignalClass({
      kind,
      relationCount,
      reasons: finalReasons,
    }),
    status: "planned",
    lessonPath: null,
    prerequisites: [],
  };
}

function directoryCandidates(files) {
  const counts = new Map();
  for (const path of files) {
    const segments = dirname(path)
      .split("/")
      .filter((part) => part && part !== ".");
    for (let depth = 1; depth <= Math.min(4, segments.length); depth += 1) {
      const area = segments.slice(0, depth).join("/");
      counts.set(area, (counts.get(area) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([path, count]) => ({ path, count }));
}

export function planCurriculum(model) {
  const fileNodes = model.nodes.filter(
    (node) =>
      node.path &&
      !["area", "system", "technology", "capability", "dependency", "component"].includes(
        node.kind,
      ),
  );
  const runtimeFiles = fileNodes.filter((node) => !NON_PRODUCT.test(node.path));
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const degree = new Map();
  for (const edge of model.edges.filter((item) => ["imports", "tests"].includes(item.kind))) {
    degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) ?? 0) + (edge.kind === "imports" ? 2 : 1));
  }
  const candidates = [];
  const add = (candidate) => candidates.push(candidate);

  for (const workflow of model.profile.criticalWorkflows)
    add(
      makeCandidate({
        kind: "workflow",
        focus: workflow,
        paths: [],
        importance: 100,
        reasons: [
          "Marked as a critical workflow by project configuration",
          "Explains user or business value",
        ],
      }),
    );

  for (const path of model.profile.entryPoints) {
    const importance = entryImportance(path);
    if (importance < 80) continue;
    add(
      makeCandidate({
        kind: "entry",
        focus: path,
        paths: [path],
        importance,
        reasons: [
          "Conventional execution entrypoint",
          "Connects external input or startup to program behavior",
        ],
        relationCount: degree.get(fileNodes.find((node) => node.path === path)?.id) ?? 0,
      }),
    );
  }

  for (const component of model.profile.components)
    add(
      makeCandidate({
        kind: "component",
        focus: component.root,
        paths: component.manifests,
        importance:
          component.root === "." ? 88 : 82 + Math.min(10, Math.log2(component.files + 1) * 2),
        reasons: [
          "Detected ownership or workspace boundary",
          `Owns ${component.files} modeled files`,
        ],
      }),
    );

  for (const boundary of model.profile.boundaryEvidence)
    add(
      makeCandidate({
        kind: "boundary",
        focus: boundary.path,
        paths: [boundary.path],
        importance: 76 + boundary.confidence * 14,
        reasons: [
          "Detected architecture, data, or trust boundary",
          ...boundary.signals.map((signal) => `Signal: ${signal}`),
        ],
      }),
    );

  for (const { path, count } of directoryCandidates(runtimeFiles.map((node) => node.path)))
    add(
      makeCandidate({
        kind: "area",
        focus: path,
        paths: runtimeFiles
          .filter((node) => node.path.startsWith(`${path}/`))
          .slice(0, 3)
          .map((node) => node.path),
        importance:
          52 +
          Math.min(25, Math.log2(count + 1) * 6) +
          (PRODUCT_SIGNAL.test(path) ? 10 : 0) +
          (/(?:^|\/)(?:features?|domains?|routes?)(?:\/|$)/i.test(path) ? 10 : 0),
        reasons: [
          `Groups ${count} source files`,
          PRODUCT_SIGNAL.test(path)
            ? "Located on a likely product or runtime path"
            : "Provides a coherent module-level study boundary",
        ],
      }),
    );

  for (const node of [...runtimeFiles]
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, 180)) {
    const relations = degree.get(node.id) ?? 0;
    add(
      makeCandidate({
        kind: "module",
        focus: node.path,
        paths: [
          node.path,
          ...model.edges
            .filter((edge) => edge.from === node.id || edge.to === node.id)
            .slice(0, 3)
            .map((edge) => nodeById.get(edge.from === node.id ? edge.to : edge.from)?.path)
            .filter(Boolean),
        ],
        importance:
          45 +
          Math.min(38, relations * 3) +
          (PRODUCT_SIGNAL.test(node.path) ? 12 : 0) +
          (TRUST_SIGNAL.test(node.path) ? 7 : 0),
        reasons: [
          relations > 0
            ? `Connected to ${relations} modeled relationships`
            : "Concrete source module with a teachable responsibility",
          PRODUCT_SIGNAL.test(node.path)
            ? "Located on a likely product or runtime path"
            : "Adds implementation-level coverage",
        ],
        relationCount: relations,
      }),
    );
  }

  for (const node of fileNodes
    .filter((item) => item.kind === "test" || /\.(?:test|spec)\.[^.]+$/i.test(item.path))
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, 40)) {
    const related = model.edges
      .filter((edge) => edge.from === node.id || edge.to === node.id)
      .map((edge) => nodeById.get(edge.from === node.id ? edge.to : edge.from)?.path)
      .filter(Boolean);
    add(
      makeCandidate({
        kind: "test",
        focus: node.path,
        paths: [node.path, ...related],
        importance: 58 + Math.min(22, (degree.get(node.id) ?? 0) * 3),
        reasons: [
          "Executable evidence of a behavior contract",
          "Provides a safe change and debugging seam",
        ],
        relationCount: degree.get(node.id) ?? 0,
      }),
    );
  }

  for (const dependency of [...(model.dependencies ?? [])]
    .sort((a, b) => b.usedBy.length - a.usedBy.length)
    .slice(0, 25))
    add(
      makeCandidate({
        kind: "dependency",
        focus: dependency.name,
        paths: [...dependency.manifests, ...dependency.usedBy.slice(0, 3)],
        importance: 55 + Math.min(25, Math.log2(dependency.usedBy.length + 1) * 5),
        reasons: [
          `Observed in ${dependency.usedBy.length} modeled source files`,
          "Defines an external compatibility and upgrade contract",
        ],
        relationCount: dependency.usedBy.length,
      }),
    );

  const processedCandidates = deduplicateAndSplitTopics(candidates);

  const unique = new Map();
  for (const candidate of processedCandidates) {
    const key = candidate.focus.toLowerCase();
    const prior = unique.get(key);
    if (!prior || candidate.importance > prior.importance) unique.set(key, candidate);
  }

  const range = repoSize(model.coverage.modeledFiles);
  const ranked = [...unique.values()].sort(
    (a, b) =>
      b.importance - a.importance ||
      b.relationCount - a.relationCount ||
      a.focus.localeCompare(b.focus),
  );

  let selected = buildStudyOrder(ranked);
  selected = applyLearnerProfile(selected, model.profile.learnerProfile);

  selected.forEach((topic, index) => {
    topic.rank = index + 1;
    topic.tier =
      index < Math.min(12, Math.ceil(selected.length * 0.2))
        ? "start-here"
        : index < Math.ceil(selected.length * 0.6)
          ? "core"
          : "deep-dive";
  });
  const omnibus = findOmnibusTopics(selected);
  const dialogue = buildDialogueEnvelope({
    role: "propose",
    coverage: model.coverage,
    unresolved: model.profile.uncertainties,
    mode: "workbook",
    extraBlindSpots: [
      "nonstandard-package-layouts",
      "dependency-injection-and-events",
      "naming-heuristic-chapter-bias",
      ...(omnibus.length > 0 ? ["omnibus-topic-titles"] : []),
    ],
    extraMustNotClaim: ["complete-topic-inventory"],
    extraNextAsks: [
      {
        who: "agent",
        do: "approve-curriculum-shortlist",
        why: "signalClass-naming-heuristic",
        question:
          "Corroborate or demote naming-heuristic topics before save (agentApproval.corroboratedTopicIds).",
      },
      {
        who: "tool",
        do: "graphify-or-serena-retrieve",
        why: "recover-topics-regex-may-miss",
      },
      ...(omnibus.length > 0
        ? [
            {
              who: "agent",
              do: "approve-curriculum-shortlist",
              why: "b4a-one-outcome-per-topic",
              question: `Split or demote omnibus topics: ${omnibus
                .slice(0, 4)
                .map((topic) => topic.id)
                .join(", ")}`,
            },
          ]
        : []),
    ],
  });
  return {
    schemaVersion: 1,
    generatedAt: model.generatedAt,
    target: model.target,
    repositorySize: range.size,
    scale: {
      ...range,
      availableCandidates: ranked.length,
      selectedTopics: selected.length,
    },
    coverage: model.coverage,
    topics: selected,
    unresolved: model.profile.uncertainties,
    ...dialogue,
  };
}

export function renderCurriculumMarkdown(curriculum) {
  const written = curriculum.topics.filter((topic) => topic.status === "written").length;
  const lines = [
    `# ${words(basename(curriculum.target.root))} learning index`,
    "",
    `This workbook contains **${curriculum.topics.length} focused ${curriculum.topics.length === 1 ? "topic" : "topics"}**. ${written} ${written === 1 ? "lesson is" : "lessons are"} written. Start with the highest-ranked topics, or choose any topic whose outcome matches the change you need to make.`,
    "",
    "Each lesson teaches one mental model. The index is intentionally broader than the lesson set so you can choose what to learn next without regenerating the repository analysis.",
    "",
  ];
  const chapters = [...new Set(curriculum.topics.map((topic) => topic.chapter))];
  for (const chapter of chapters) {
    lines.push(`## ${chapter}`, "");
    for (const topic of curriculum.topics.filter((item) => item.chapter === chapter)) {
      const isCompleted = curriculum.learnerCompletion?.[topic.id] === true;
      const checkbox = topic.lessonPath ? (isCompleted ? "- [x] " : "- [ ] ") : "- ";
      const topicLink = topic.lessonPath ? `[${topic.title}](${topic.lessonPath})` : topic.title;

      let status = "";
      if (topic.status === "stale") {
        status = " *(Stale ⚠️)*";
      } else if (!topic.lessonPath) {
        status = " *(Planned)*";
      }

      lines.push(`${checkbox}**${topicLink}**${status} — ${topic.learnerOutcome}`);
    }
    lines.push("");
  }
  lines.push(
    "## Coverage notes",
    "",
    `Repository scale: **${curriculum.repositorySize}** (${curriculum.coverage.modeledFiles} modeled files).`,
    "",
    "This index is a **proposal** until the agent approves the shortlist. Naming-heuristic topics need corroboration before save.",
    "",
    ...curriculum.unresolved.map((item) => `- ${item}`),
    "",
  );
  return `${lines.join("\n")}\n`;
}
