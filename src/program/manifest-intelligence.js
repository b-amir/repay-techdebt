import { basename } from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { parse as parseToml } from "smol-toml";
import { parseDocument } from "yaml";

const MAX_DEPENDENCY_NAME = 240;

function normalizeName(value) {
  const candidate = String(value ?? "").trim();
  if (
    !candidate ||
    candidate.length > MAX_DEPENDENCY_NAME ||
    /^https?:/i.test(candidate) ||
    candidate.startsWith("$")
  )
    return null;
  return candidate.toLowerCase();
}

function dependency(name, scope, parser, line = undefined, options = {}) {
  const normalized = normalizeName(name);
  return normalized
    ? {
        name: normalized,
        scope,
        parser,
        direct: options.direct ?? true,
        ...(options.version ? { version: String(options.version) } : {}),
        ...(line ? { line } : {}),
      }
    : null;
}

function lineFor(content, value) {
  const index = content.toLowerCase().indexOf(String(value).toLowerCase());
  return index < 0 ? undefined : content.slice(0, index).split(/\r?\n/).length;
}

function fromObjectKeys(content, object, scope, parser) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return [];
  return Object.keys(object)
    .map((name) =>
      dependency(name, scope, parser, lineFor(content, name), {
        version: typeof object[name] === "string" ? object[name] : object[name]?.version,
      }),
    )
    .filter(Boolean);
}

function parseJsonManifest(name, content) {
  const parsed = JSON.parse(content);
  const records = [];
  if (name === "package.json") {
    for (const [section, scope] of [
      ["dependencies", "runtime"],
      ["devDependencies", "development"],
      ["peerDependencies", "peer"],
      ["optionalDependencies", "optional"],
    ])
      records.push(...fromObjectKeys(content, parsed[section], scope, "json"));
    const workspaces = Array.isArray(parsed.workspaces)
      ? parsed.workspaces
      : Array.isArray(parsed.workspaces?.packages)
        ? parsed.workspaces.packages
        : [];
    return { records, workspaces };
  }
  if (name === "package-lock.json") {
    for (const [path, value] of Object.entries(parsed.packages ?? {})) {
      if (!path) {
        for (const section of ["dependencies", "devDependencies", "optionalDependencies"])
          records.push(
            ...fromObjectKeys(
              content,
              value?.[section],
              section === "dependencies"
                ? "runtime"
                : section === "devDependencies"
                  ? "development"
                  : "optional",
              "package-lock",
            ),
          );
        continue;
      }
      const packageName = path.split("node_modules/").at(-1);
      const record = dependency(
        packageName,
        "transitive-lock",
        "package-lock",
        lineFor(content, `"${path}"`),
        {
          direct: false,
          version: value?.version,
        },
      );
      if (record) records.push(record);
    }
    return { records, workspaces: [] };
  }
  if (name === "composer.json") {
    records.push(...fromObjectKeys(content, parsed.require, "runtime", "json"));
    records.push(...fromObjectKeys(content, parsed["require-dev"], "development", "json"));
  } else if (name === "composer.lock") {
    for (const item of [...(parsed.packages ?? []), ...(parsed["packages-dev"] ?? [])]) {
      const record = dependency(
        item.name,
        "transitive-lock",
        "composer-lock",
        lineFor(content, item.name),
        { direct: false, version: item.version },
      );
      if (record) records.push(record);
    }
  } else if (name === "vcpkg.json") {
    for (const item of parsed.dependencies ?? []) {
      const value = typeof item === "string" ? item : item?.name;
      const record = dependency(value, "runtime", "json", lineFor(content, value));
      if (record) records.push(record);
    }
  }
  return { records, workspaces: [] };
}

function parseTomlManifest(name, content) {
  const parsed = parseToml(content);
  const records = [];
  if (name === "pyproject.toml") {
    for (const value of parsed.project?.dependencies ?? []) {
      const packageName = String(value).match(/^\s*([A-Za-z0-9_.-]+)/)?.[1];
      const record = dependency(packageName, "runtime", "toml", lineFor(content, value));
      if (record) records.push(record);
    }
    for (const values of Object.values(parsed.project?.["optional-dependencies"] ?? {}))
      for (const value of Array.isArray(values) ? values : []) {
        const packageName = String(value).match(/^\s*([A-Za-z0-9_.-]+)/)?.[1];
        const record = dependency(packageName, "optional", "toml", lineFor(content, value));
        if (record) records.push(record);
      }
    records.push(...fromObjectKeys(content, parsed.tool?.poetry?.dependencies, "runtime", "toml"));
    records.push(
      ...fromObjectKeys(content, parsed.tool?.poetry?.["dev-dependencies"], "development", "toml"),
    );
    for (const group of Object.values(parsed.tool?.poetry?.group ?? {}))
      records.push(...fromObjectKeys(content, group?.dependencies, "development", "toml"));
  } else if (name === "Cargo.toml") {
    for (const [section, scope] of [
      ["dependencies", "runtime"],
      ["dev-dependencies", "development"],
      ["build-dependencies", "build"],
    ]) {
      records.push(...fromObjectKeys(content, parsed[section], scope, "toml"));
      records.push(...fromObjectKeys(content, parsed.workspace?.[section], scope, "toml"));
      for (const target of Object.values(parsed.target ?? {}))
        records.push(...fromObjectKeys(content, target?.[section], scope, "toml"));
    }
    return { records, workspaces: parsed.workspace?.members ?? [] };
  } else if (name === "gleam.toml") {
    records.push(...fromObjectKeys(content, parsed.dependencies, "runtime", "toml"));
    records.push(...fromObjectKeys(content, parsed["dev-dependencies"], "development", "toml"));
  } else if (name === "Cargo.lock" || name === "poetry.lock" || name === "uv.lock") {
    for (const item of parsed.package ?? []) {
      const record = dependency(
        item.name,
        "transitive-lock",
        "toml-lock",
        lineFor(content, item.name),
        {
          direct: false,
          version: item.version,
        },
      );
      if (record) records.push(record);
    }
  }
  return { records, workspaces: [] };
}

function parseYamlManifest(name, content) {
  const document = parseDocument(content, { prettyErrors: true, strict: true });
  if (document.errors.length > 0)
    throw new Error(document.errors.map((item) => item.message).join("; "));
  const parsed = document.toJS();
  const records = [];
  if (name === "pubspec.yaml") {
    records.push(...fromObjectKeys(content, parsed?.dependencies, "runtime", "yaml"));
    records.push(...fromObjectKeys(content, parsed?.dev_dependencies, "development", "yaml"));
  } else if (name === "pnpm-lock.yaml") {
    for (const importer of Object.values(parsed?.importers ?? {}))
      for (const [section, scope] of [
        ["dependencies", "runtime"],
        ["devDependencies", "development"],
        ["optionalDependencies", "optional"],
      ])
        records.push(...fromObjectKeys(content, importer?.[section], scope, "pnpm-lock"));
    for (const [key, value] of Object.entries(parsed?.packages ?? {})) {
      const raw = key.replace(/^\//, "");
      const scoped = raw.startsWith("@");
      const separator = scoped ? raw.indexOf("@", 1) : raw.lastIndexOf("@");
      const packageName = separator > 0 ? raw.slice(0, separator) : raw;
      const record = dependency(
        packageName,
        "transitive-lock",
        "pnpm-lock",
        lineFor(content, key),
        {
          direct: false,
          version: value?.version ?? (separator > 0 ? raw.slice(separator + 1) : undefined),
        },
      );
      if (record) records.push(record);
    }
  }
  return { records, workspaces: [] };
}

function objects(value) {
  if (Array.isArray(value)) return value.flatMap(objects);
  return value && typeof value === "object"
    ? [value, ...Object.values(value).flatMap(objects)]
    : [];
}

function parseXmlManifest(name, content) {
  const validation = XMLValidator.validate(content);
  if (validation !== true) throw new Error(validation.err?.msg ?? "invalid XML");
  const parsed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(content);
  const records = [];
  if (name === "pom.xml") {
    for (const value of objects(parsed)) {
      const dependencies = value.dependencies?.dependency;
      for (const item of Array.isArray(dependencies)
        ? dependencies
        : dependencies
          ? [dependencies]
          : []) {
        const record = dependency(
          item.artifactId,
          "runtime",
          "xml",
          lineFor(content, item.artifactId),
        );
        if (record) records.push(record);
      }
    }
  }
  return { records, workspaces: [] };
}

function parseRequirements(content) {
  const records = [];
  const diagnostics = [];
  for (const [index, raw] of content.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("-") || /^(?:git\+|https?:|\.\.?\/)/i.test(line)) {
      diagnostics.push({
        severity: "notice",
        code: "requirements-indirect-entry",
        line: index + 1,
        message: "Dependency entry requires ecosystem resolution.",
      });
      continue;
    }
    const name = line.match(/^([A-Za-z0-9_.-]+)/)?.[1];
    const record = dependency(name, "runtime", "requirements", index + 1);
    if (record) records.push(record);
  }
  return { records, workspaces: [], diagnostics };
}

function parseGoManifest(name, content) {
  const records = [];
  const pattern =
    name === "go.mod"
      ? /^\s*([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+)\s+(v[^\s]+)(?:\s+\/\/\s+indirect)?/gm
      : /^([^\s]+)\s+(v[^\s/]+(?:\/go\.mod)?)/gm;
  for (const match of content.matchAll(pattern)) {
    const indirect = name === "go.sum" || /\/\/\s+indirect/.test(match[0]);
    const record = dependency(
      match[1],
      indirect ? "transitive-lock" : "runtime",
      name,
      lineFor(content, match[0]),
      {
        direct: !indirect,
        version: match[2].replace(/\/go\.mod$/, ""),
      },
    );
    if (record) records.push(record);
  }
  return { records, workspaces: [] };
}

function parseSyntaxManifest(name, content) {
  const records = [];
  if (name === "Gemfile")
    for (const match of content.matchAll(/^\s*gem\s+["']([^"']+)["']/gm))
      records.push(dependency(match[1], "runtime", "ruby-syntax", lineFor(content, match[0])));
  if (name === "mix.exs")
    for (const match of content.matchAll(/\{:\s*([A-Za-z0-9_-]+)\s*,/g))
      records.push(dependency(match[1], "runtime", "elixir-syntax", lineFor(content, match[0])));
  return { records: records.filter(Boolean), workspaces: [] };
}

export function parseManifest(path, content) {
  const name = basename(path);
  const diagnostics = [];
  let result;
  let parser = "unsupported";
  try {
    if (
      [
        "package.json",
        "package-lock.json",
        "composer.json",
        "composer.lock",
        "vcpkg.json",
      ].includes(name)
    ) {
      parser = "json";
      result = parseJsonManifest(name, content);
    } else if (
      [
        "pyproject.toml",
        "Cargo.toml",
        "Cargo.lock",
        "gleam.toml",
        "poetry.lock",
        "uv.lock",
      ].includes(name)
    ) {
      parser = "toml";
      result = parseTomlManifest(name, content);
    } else if (["pubspec.yaml", "pnpm-lock.yaml"].includes(name)) {
      parser = "yaml";
      result = parseYamlManifest(name, content);
    } else if (name === "pom.xml") {
      parser = "xml";
      result = parseXmlManifest(name, content);
    } else if (/^requirements.*\.txt$/i.test(name)) {
      parser = "requirements";
      result = parseRequirements(content);
    } else if (["go.mod", "go.sum"].includes(name)) {
      parser = "go-module";
      result = parseGoManifest(name, content);
    } else if (["Gemfile", "mix.exs"].includes(name)) {
      parser = "syntax-heuristic";
      result = parseSyntaxManifest(name, content);
      diagnostics.push({
        severity: "notice",
        code: "heuristic-parser",
        message: `${name} uses a conservative syntax adapter; native ecosystem metadata is preferred.`,
      });
    } else {
      result = { records: [], workspaces: [] };
      diagnostics.push({
        severity: "notice",
        code: "unsupported-manifest",
        message: `No dependency parser is registered for ${name}.`,
      });
    }
  } catch (error) {
    result = { records: [], workspaces: [] };
    diagnostics.push({ severity: "error", code: "manifest-parse-failed", message: error.message });
  }
  const deduplicated = [
    ...new Map(
      result.records.map((item) => [
        `${item.name}:${item.scope}:${item.version ?? ""}:${item.direct}`,
        item,
      ]),
    ).values(),
  ];
  return {
    path,
    parser,
    dependencies: deduplicated,
    workspaces: result.workspaces ?? [],
    diagnostics: [...diagnostics, ...(result.diagnostics ?? [])],
  };
}
