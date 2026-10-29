/**
 * TC-SCAFFOLD-035 / TC-SCAFFOLD-036 — license registry audit, fail-closed.
 *
 * Scope is the committed manifest/lockfile dependency set (A-T5): every direct
 * external dev dependency must be registered with an approved verdict. SPDX
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
  source: string;
  verdict: string;
};
export type Registry = {
  schema_version: number;
  scope: string;
  entries: RegistryEntry[];
  allow_list?: string[];
};
export type Dependency = { name: string; version: string; source: string };

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
  for (const { manifest } of manifests) {
    for (const field of DEPENDENCY_FIELDS) {
      for (const [name, version] of Object.entries(manifest[field] ?? {})) {
        if (version.startsWith("workspace:")) continue;
        dependencies.push({ name, version, source: field });
      }
    }
  }
  return dependencies.sort((left, right) => left.name.localeCompare(right.name));
};

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
      .filter((entry) => entry.verdict === "approved")
      .map((entry) => String(entry.license ?? "")),
  );

export const auditRegistry = (registry: Registry, dependencies: Dependency[]): string[] => {
  const failures: string[] = [];
  if (!Array.isArray(registry.entries)) {
    return ["registry has no entries array"];
  }
  const byName = new Map(registry.entries.map((entry) => [entry.package, entry]));
  const allowed = deriveAllowedIdentifiers(registry);

  for (const dependency of dependencies) {
    const entry = byName.get(dependency.name);
    if (!entry) {
      failures.push(`${dependency.name}: missing registry entry (${dependency.source})`);
      continue;
    }
    if (entry.source !== "dev-dependency") {
      failures.push(`${dependency.name}: source must be dev-dependency; got ${entry.source}`);
    }
    if (entry.version !== dependency.version) {
      failures.push(
        `${dependency.name}: registry version ${entry.version} does not match manifest version ${dependency.version}`,
      );
    }
    if (entry.verdict !== "approved") {
      failures.push(`${dependency.name}: verdict ${entry.verdict} is not approved`);
    }
    const license = typeof entry.license === "string" ? entry.license.trim() : "";
    if (license.length === 0) {
      failures.push(`${dependency.name}: empty license field`);
      continue;
    }
    const parsed = parseSpdxExpression(license);
    if (!parsed.ok) {
      failures.push(
        `${dependency.name}: ${license} is not a valid SPDX expression (${parsed.reason})`,
      );
      continue;
    }
    for (const identifier of parsed.identifiers) {
      if (identifier.startsWith("LicenseRef-")) {
        failures.push(`${dependency.name}: ${license}: unknown license reference ${identifier}`);
      } else if (!allowed.has(identifier)) {
        failures.push(
          `${dependency.name}: ${license}: license ${identifier} is not allow-listed (disallowed branch fails closed)`,
        );
      }
    }
  }
  return failures;
};

export const loadRegistry = (root: string): Registry =>
  parseYaml(readFileSync(join(root, "doc/legal/dependency-licenses.yaml"), "utf8")) as Registry;

export const validate = (root: string, registry: Registry = loadRegistry(root)): string[] => {
  const failures = auditRegistry(registry, directExternalDependencies(root));
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
    `OK license-audit: ${directExternalDependencies(process.cwd()).length} direct dev dependencies registered and allow-listed`,
  );
}
