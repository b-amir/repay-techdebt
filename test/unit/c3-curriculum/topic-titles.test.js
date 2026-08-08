// @category C3
import assert from "node:assert/strict";
import { test } from "vite-plus/test";
import {
  displayName,
  titleFor,
  outcomeFor,
  planCurriculum,
  renderCurriculumMarkdown,
} from "../../../src/curriculum/curriculum-planning.js";

test("displayName disambiguates generic basenames with path context", () => {
  assert.equal(displayName("app/domains/chat/store/types.ts"), "Chat Types");
  assert.equal(displayName("app/features/dashboard/data/types.ts"), "Dashboard Types");
  assert.equal(displayName("app/domains/auth/index.ts"), "Auth");
  assert.equal(displayName("app/features/chat/hooks/index.ts"), "Chat");
  assert.equal(displayName("app/domains/users/api/users-keys.ts"), "Users Keys");
  assert.equal(displayName("app/core/logger.ts"), "Logger");
  assert.equal(displayName("app/domains/chat/api"), "Chat Api");
  assert.equal(displayName("app/features/chat/sidebar.tsx"), "Chat Sidebar");
});

test("titleFor is path label — unique, no chapter stamp openers", () => {
  /** @type {Array<[string, string]>} */
  const cases = [
    ["module", "app/domains/auth/permissions.ts"],
    ["module", "app/domains/auth/permission-guard.tsx"],
    ["module", "app/core/api/bff-proxy/body.server.ts"],
    ["module", "app/domains/chat/api/chat-api-hooks.ts"],
    ["module", "app/domains/chat/store/types.ts"],
    ["module", "app/domains/chat/api/chat-keys.ts"],
    ["module", "app/domains/users/api/users-api-types.ts"],
    ["module", "app/features/chat/invite-dialog.tsx"],
    ["entry", "app/core/query-client.ts"],
    ["workflow", "customer checkout"],
    ["test", "app/test/msw-handlers/index.ts"],
  ];

  const titles = cases.map(([kind, path]) => {
    const title = titleFor(kind, path);
    assert.ok(title.length > 0, path);
    // Script stays path-shaped; agent owns the teaching angle.
    assert.ok(!/^Follow the access decisions/i.test(title), title);
    assert.ok(!/^Trace the data lifecycle/i.test(title), title);
    assert.ok(!/^Understand the role of/i.test(title), title);
    assert.ok(!/^Follow the user interaction/i.test(title), title);
    return title;
  });

  assert.notEqual(
    titleFor("module", "app/domains/chat/store/types.ts"),
    titleFor("module", "app/domains/users/api/users-api-types.ts"),
  );
  assert.equal(new Set(titles).size, titles.length, `titles must be unique:\n${titles.join("\n")}`);
});

test("outcomeFor is learner-facing placeholder, not meta rewrite copy", () => {
  const a = outcomeFor("module", "app/domains/chat/store/types.ts");
  assert.ok(a.length > 20);
  assert.ok(!/Provisional/i.test(a));
  assert.ok(!/Agent:\s*rewrite/i.test(a));
  assert.match(a, /Chat Types/i);
});

test("planned curriculum index has unique labels and no stamp openers", () => {
  const nodes = [{ id: "system:root", kind: "system", name: "app", path: "." }];
  const edges = [];
  const paths = [
    "app/domains/auth/permissions.ts",
    "app/domains/auth/permission-guard.tsx",
    "app/domains/auth/use-permission.ts",
    "app/domains/auth/index.ts",
    "app/features/auth/containers/login-screen.tsx",
    "app/domains/chat/store/types.ts",
    "app/domains/chat/api/chat-api-types.ts",
    "app/domains/users/api/users-api-types.ts",
    "app/domains/roles/api/roles-api-types.ts",
    "app/domains/chat/api/chat-keys.ts",
    "app/domains/users/api/users-keys.ts",
    "app/core/api/bff-proxy/body.server.ts",
    "app/core/api/bff-proxy/headers.server.ts",
    "app/core/api/bff-proxy/origin.server.ts",
    "app/features/chat/sidebar.tsx",
    "app/features/dashboard/stat-card.tsx",
    "app/ui/button/index.ts",
  ];
  for (const [index, path] of paths.entries()) {
    nodes.push({ id: `file:${index}`, kind: "file", name: path.split("/").pop(), path });
    if (index > 0) edges.push({ kind: "imports", from: `file:${index}`, to: `file:${index - 1}` });
  }
  const curriculum = planCurriculum({
    generatedAt: "2026-08-01T00:00:00.000Z",
    target: { root: "/tmp/title-app", scope: ".", excludedSkillPath: null },
    coverage: { modeledFiles: paths.length },
    nodes,
    edges,
    profile: {
      criticalWorkflows: [],
      entryPoints: [],
      components: [],
      boundaryEvidence: [],
      uncertainties: [],
    },
  });

  const titles = curriculum.topics.map((t) => t.title);
  assert.equal(titles.filter((t) => /^Follow the access decisions/i.test(t)).length, 0);
  assert.equal(titles.filter((t) => /^Trace the data lifecycle/i.test(t)).length, 0);
  assert.equal(titles.filter((t) => /^Understand the role of/i.test(t)).length, 0);
  assert.equal(titles.filter((t) => /^Follow the user interaction/i.test(t)).length, 0);

  const bareGeneric = titles.filter((t) =>
    /^(?:Types|Index|Keys|Utils|Hooks|Components|Server|Client|Api)$/i.test(t),
  );
  assert.equal(bareGeneric.length, 0, bareGeneric.join(" | "));

  const markdown = renderCurriculumMarkdown(curriculum);
  assert.ok(!/Trace the data lifecycle through Types/i.test(markdown));
  assert.ok(!/Understand the role of Index/i.test(markdown));
  assert.ok(
    curriculum.topics.every((t) => !/Provisional|Agent:\s*rewrite/i.test(t.learnerOutcome)),
  );
});
