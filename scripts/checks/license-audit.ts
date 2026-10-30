/**
 * TC-SCAFFOLD-035 / TC-SCAFFOLD-036 — license registry audit, fail-closed.
 *
 * Scope is all direct external dependencies and the locked runtime closure.
 * Each use records its owner, dependency field, and resolved version. SPDX
 * expressions are parsed, never prefix/substring matched: any disallowed branch
 * of an AND or OR fails closed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export type RegistryEntry = {
  package: string;
  version: string;
  license: string;
  uses: Array<Omit<Dependency, "name">>;
  verdict: string;
};
export type Registry = {
  schema_version: number;
  scope: string;
  c2_determination: string;
  entries: RegistryEntry[];
  allow_list?: string[];
};
export type Dependency = { owner: string; field: string; name: string; version: string };

const PACKAGE_NAMES = ["core", "adapters", "cli", "mcp", "opencode", "testkit"];
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type Manifest = Record<string, Record<string, string> | undefined>;

export const directExternalDependencies = (root: string): Dependency[] => {
  const manifests: Array<{ label: string; manifest: Manifest }> = [
    {
      label: "package.json",
      manifest: JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Manifest,
    },
  ];
  for (const packageName of PACKAGE_NAMES) {
    const path = join(root, "packages", packageName, "package.json");
    if (existsSync(path)) {
      manifests.push({
        label: `packages/${packageName}/package.json`,
        manifest: JSON.parse(readFileSync(path, "utf8")) as Manifest,
      });
    }
  }
  const dependencies: Dependency[] = [];
  for (const { label, manifest } of manifests) {
    for (const field of DEPENDENCY_FIELDS) {
      for (const [name, version] of Object.entries(manifest[field] ?? {})) {
        if (version.startsWith("workspace:")) continue;
        dependencies.push({ owner: label, field, name, version });
      }
    }
  }
  return dependencies.sort((left, right) => left.name.localeCompare(right.name));
};

type LockSnapshot = {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};
type LockImporter = Record<
  string,
  Record<string, { specifier: string; version: string }> | undefined
>;
type Lock = {
  importers: Record<string, LockImporter>;
  snapshots: Record<string, LockSnapshot>;
};

/** Resolve a locked edge exactly; peer suffixes belong to the snapshot identity. */
const snapshotKey = (name: string, version: string): string => `${name}@${version}`;
const plainVersion = (version: string): string => version.split("(")[0] as string;

/** All direct uses plus every edge in the new runtime closure and shared tooling uses. */
export const lockedUses = (root: string, direct: readonly Dependency[]): Dependency[] => {
  const lock = parseYaml(readFileSync(join(root, "pnpm-lock.yaml"), "utf8")) as Lock;
  if (!lock?.importers || !lock.snapshots) throw new Error("invalid lockfile");
  const uses: Dependency[] = [];
  const runtimeNames = new Set<string>();
  const visited = new Set<string>();
  const traverse = (name: string, version: string): void => {
    const key = snapshotKey(name, version);
    if (visited.has(key)) return;
    visited.add(key);
    const snapshot = lock.snapshots[key];
    if (!snapshot) throw new Error(`missing locked snapshot ${key}`);
    for (const field of ["dependencies", "optionalDependencies"] as const) {
      for (const [child, resolved] of Object.entries(snapshot[field] ?? {})) {
        if (typeof resolved !== "string" || resolved.startsWith("link:")) {
          throw new Error(`invalid locked edge ${key} ${child}`);
        }
        uses.push({ owner: key, field, name: child, version: plainVersion(resolved) });
        runtimeNames.add(child);
        traverse(child, resolved);
      }
    }
  };
  for (const dep of direct) {
    const importerName =
      dep.owner === "package.json" ? "." : dep.owner.slice(0, -"/package.json".length);
    const edge = lock.importers[importerName]?.[dep.field]?.[dep.name];
    if (!edge || edge.specifier !== dep.version || edge.version.startsWith("link:")) {
      throw new Error(`missing or mismatched locked direct use ${dep.owner} ${dep.name}`);
    }
    if (plainVersion(edge.version) !== dep.version) {
      throw new Error(`wrong locked version for ${dep.owner} ${dep.name}`);
    }
    uses.push({ ...dep, version: plainVersion(edge.version) });
    if (dep.field === "dependencies" || dep.field === "optionalDependencies") {
      runtimeNames.add(dep.name);
      traverse(dep.name, edge.version);
    }
  }
  // Capture shared uses reached by the existing development toolchain without
  // requiring licenses for the entire historical dev-only transitive graph.
  const toolingVisited = new Set<string>();
  const traverseTooling = (name: string, version: string): void => {
    const key = snapshotKey(name, version);
    if (toolingVisited.has(key)) return;
    toolingVisited.add(key);
    const snapshot = lock.snapshots[key];
    if (!snapshot) throw new Error(`missing locked tooling snapshot ${key}`);
    for (const field of ["dependencies", "optionalDependencies"] as const) {
      for (const [child, resolved] of Object.entries(snapshot[field] ?? {})) {
        if (runtimeNames.has(child)) {
          uses.push({ owner: key, field, name: child, version: plainVersion(resolved) });
        }
        traverseTooling(child, resolved);
      }
    }
  };
  for (const dep of direct) {
    if (dep.field !== "devDependencies") continue;
    const importerName =
      dep.owner === "package.json" ? "." : dep.owner.slice(0, -"/package.json".length);
    const resolved = lock.importers[importerName]?.[dep.field]?.[dep.name]?.version;
    if (resolved) traverseTooling(dep.name, resolved);
  }
  const unique = new Map(uses.map((use) => [useKey(use), use]));
  return [...unique.values()].sort((a, b) =>
    `${a.name}|${a.owner}|${a.field}|${a.version}`.localeCompare(
      `${b.name}|${b.owner}|${b.field}|${b.version}`,
    ),
  );
};

const useKey = (use: Dependency): string => `${use.name}|${use.owner}|${use.field}|${use.version}`;

export type SpdxParseResult = { ok: true; identifiers: string[] } | { ok: false; reason: string };

const IDENTIFIER = /^[A-Za-z0-9.+-]+$/;

export const parseSpdxExpression = (expression: string): SpdxParseResult => {
  const tokens = expression
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .split(/\s+/)
    .filter((token) => token.length > 0);
  if (tokens.length === 0) return { ok: false, reason: "empty license expression" };
  const identifiers: string[] = [];
  let index = 0;

  const parseTerm = (): string | null => {
    const token = tokens[index];
    if (token === undefined) return "unexpected end of expression";
    if (token === "(") {
      index += 1;
      const failure = parseExpression();
      if (failure) return failure;
      if (tokens[index] !== ")") return "missing closing parenthesis";
      index += 1;
      return null;
    }
    if (token === ")" || token === "AND" || token === "OR" || token === "WITH") {
      return `unexpected token ${token}`;
    }
    if (!IDENTIFIER.test(token)) return `invalid license identifier ${token}`;
    identifiers.push(token);
    index += 1;
    return null;
  };

  const parseExpression = (): string | null => {
    let failure = parseTerm();
    if (failure) return failure;
    while (tokens[index] === "AND" || tokens[index] === "OR") {
      index += 1;
      failure = parseTerm();
      if (failure) return failure;
    }
    return null;
  };

  const failure = parseExpression();
  if (failure) return { ok: false, reason: failure };
  if (index !== tokens.length) return { ok: false, reason: `unexpected token ${tokens[index]}` };
  return { ok: true, identifiers };
};

const identifiersFrom = (expressions: string[]): Set<string> => {
  const identifiers = new Set<string>();
  for (const expression of expressions) {
    const parsed = parseSpdxExpression(expression);
    if (!parsed.ok) continue;
    for (const identifier of parsed.identifiers) identifiers.add(identifier);
  }
  return identifiers;
};

/** The enforced allow set is the registry's explicit allow_list. */
const deriveAllowedIdentifiers = (registry: Registry): Set<string> =>
  identifiersFrom((registry.allow_list ?? []).map((entry) => String(entry)));

/** Live consistency: the allow_list must be exactly the set of approved verdicts. */
const approvedIdentifiers = (registry: Registry): Set<string> =>
  identifiersFrom(
    registry.entries
      .filter((entry) => entry && entry.verdict === "approved")
      .map((entry) => String(entry.license ?? "")),
  );

export const auditRegistry = (registry: Registry, dependencies: Dependency[]): string[] => {
  const failures: string[] = [];
  if (!Array.isArray(registry.entries)) {
    return ["registry has no entries array"];
  }
  if (registry.schema_version !== 2 || registry.scope !== "direct-and-runtime-closure") {
    failures.push("registry schema version or scope is unsupported");
  }
  if (typeof registry.c2_determination !== "string" || !registry.c2_determination.trim()) {
    failures.push("registry lacks proposed owner determination");
  }
  if (!Array.isArray(registry.allow_list)) {
    return [...failures, "registry has no allow_list array"];
  }
  // Fail closed on malformed allow_list entries: silently skipping them would
  // shrink the enforced set without reporting anything.
  for (const raw of registry.allow_list) {
    const expression = String(raw);
    const parsed = parseSpdxExpression(expression);
    if (!parsed.ok) {
      failures.push(
        `allow_list entry ${expression} is not a valid SPDX expression (${parsed.reason})`,
      );
    }
  }
  const byName = new Map<string, RegistryEntry>();
  for (const entry of registry.entries) {
    if (!entry || typeof entry.package !== "string" || !entry.package) {
      failures.push("malformed registry package entry");
      continue;
    }
    if (byName.has(entry.package)) failures.push(`${entry.package}: duplicate registry entry`);
    byName.set(entry.package, entry);
  }
  const allowed = deriveAllowedIdentifiers(registry);
  const expected = new Map(dependencies.map((dependency) => [useKey(dependency), dependency]));
  const actual = new Set<string>();
  for (const dependency of dependencies) {
    if (!byName.has(dependency.name)) {
      failures.push(
        `${dependency.name}: missing registry entry (${dependency.owner} ${dependency.field})`,
      );
    }
  }
  for (const entry of registry.entries) {
    if (!entry || typeof entry.package !== "string") continue;
    if (typeof entry.version !== "string" || !/^\d+\.\d+\.\d+$/.test(entry.version)) {
      failures.push(`${entry.package}: malformed exact resolved version`);
    }
    if (!Array.isArray(entry.uses) || entry.uses.length === 0) {
      failures.push(`${entry.package}: missing or malformed uses`);
    } else {
      for (const use of entry.uses) {
        if (
          !use ||
          typeof use.owner !== "string" ||
          !use.owner ||
          ![...DEPENDENCY_FIELDS].includes(use.field as (typeof DEPENDENCY_FIELDS)[number]) ||
          typeof use.version !== "string" ||
          !/^\d+\.\d+\.\d+$/.test(use.version)
        ) {
          failures.push(`${entry.package}: malformed use`);
          continue;
        }
        const normalized = { ...use, name: entry.package };
        const key = useKey(normalized);
        if (actual.has(key)) {
          failures.push(`${entry.package}: duplicate use ${use.owner} ${use.field}`);
        }
        actual.add(key);
        if (!expected.has(key)) {
          failures.push(
            `${entry.package}: unverified use ${use.owner} ${use.field} ${use.version}`,
          );
        }
        if (use.version !== entry.version) {
          failures.push(`${entry.package}: conflicting version ${use.version} vs ${entry.version}`);
        }
      }
    }
    if (entry.verdict !== "approved") {
      failures.push(`${entry.package}: verdict ${entry.verdict} is not approved`);
    }
    const license = typeof entry.license === "string" ? entry.license.trim() : "";
    if (license.length === 0) {
      failures.push(`${entry.package}: empty license field`);
      continue;
    }
    const parsed = parseSpdxExpression(license);
    if (!parsed.ok) {
      failures.push(
        `${entry.package}: ${license} is not a valid SPDX expression (${parsed.reason})`,
      );
      continue;
    }
    for (const identifier of parsed.identifiers) {
      if (identifier.startsWith("LicenseRef-")) {
        failures.push(`${entry.package}: ${license}: unknown license reference ${identifier}`);
      } else if (!allowed.has(identifier)) {
        failures.push(
          `${entry.package}: ${license}: license ${identifier} is not allow-listed (disallowed branch fails closed)`,
        );
      }
    }
  }
  for (const dependency of dependencies) {
    if (!actual.has(useKey(dependency))) {
      failures.push(
        `${dependency.name}: missing registered use ${dependency.owner} ${dependency.field} ${dependency.version}`,
      );
    }
  }
  return failures;
};

export const loadRegistry = (root: string): Registry =>
  parseYaml(readFileSync(join(root, "doc/legal/dependency-licenses.yaml"), "utf8")) as Registry;

export const validate = (root: string, registry: Registry = loadRegistry(root)): string[] => {
  const failures: string[] = [];
  if (!Array.isArray(registry.entries) || !Array.isArray(registry.allow_list)) {
    return auditRegistry(registry, []);
  }
  try {
    failures.push(...auditRegistry(registry, lockedUses(root, directExternalDependencies(root))));
  } catch (error) {
    failures.push(`lockfile dependency closure invalid: ${String(error)}`);
  }
  const allowed = deriveAllowedIdentifiers(registry);
  const approved = approvedIdentifiers(registry);
  for (const identifier of approved) {
    if (!allowed.has(identifier)) {
      failures.push(`allow_list is missing ${identifier} from an approved verdict`);
    }
  }
  for (const identifier of allowed) {
    if (!approved.has(identifier)) {
      failures.push(`allow_list entry ${identifier} is not backed by an approved verdict`);
    }
  }
  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL license-audit: ${message}`);
    process.exit(1);
  }
  console.log(
    `OK license-audit: direct development/runtime dependencies and locked runtime closure registered and allow-listed`,
  );
}
