/**
 * TC-LICREG-001..005, 007, 008, 011, 012, 013, 024, 031 — registry policy
 * contract: schema v3, deny-list integrity, precedence, floor, and scope.
 *
 * Every mutation is applied to an in-memory clone or a minimal registry object;
 * the live tree is never written.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  auditRegistry,
  loadRegistry,
  MANDATORY_DENIED_IDENTIFIERS,
  parseSpdxExpression,
  type Registry,
  type RegistryEntry,
  validate,
  validateRegistryPolicy,
} from "../../scripts/checks/license-audit";

const ROOT = process.cwd();
const CANONICAL_SCOPE = "direct-and-runtime-closure";
const FIXTURE_ROOT = join(ROOT, "tests/fixtures/license");
const REGISTRY_PATH = join(ROOT, "doc/legal/dependency-licenses.yaml");

type BaselineFamily = { family: string; identifiers: string[] };
type Baseline = { families: BaselineFamily[]; identifiers: string[] };
type PolicyCase = {
  id: string;
  group: string;
  classToken: string;
  mutation: string;
  field?: string;
  value?: unknown;
  expectedValue?: string;
  expectedReason?: string;
  failureExpected?: boolean;
};
type PolicyCases = { classes: string[]; groups: Record<string, number>; cases: PolicyCase[] };
type LicenseCases = {
  unknownRef: string;
  unknownRefScancode: string;
  nonAllowlisted: string;
  compoundOrDisallowed: string;
  compoundAndAllowed: string;
  empty: string;
  deniedSingles: string[];
  unknownReferences: string[];
};

const baseline = JSON.parse(
  readFileSync(join(FIXTURE_ROOT, "deny-baseline.json"), "utf8"),
) as Baseline;
const policyCases = JSON.parse(
  readFileSync(join(FIXTURE_ROOT, "deny-list-cases.json"), "utf8"),
) as PolicyCases;
const licenseCases = JSON.parse(
  readFileSync(join(FIXTURE_ROOT, "cases.json"), "utf8"),
) as LicenseCases;

const loadLive = (): Registry => JSON.parse(JSON.stringify(loadRegistry(ROOT))) as Registry;

const fieldValue = (registry: Registry, field: string): unknown => Reflect.get(registry, field);
const setField = (registry: Registry, field: string, value: unknown): void => {
  Reflect.set(registry, field, value);
};
const deleteField = (registry: Registry, field: string): void => {
  Reflect.deleteProperty(registry, field);
};
const fieldList = (registry: Registry, field: string): unknown[] => {
  const value = fieldValue(registry, field);
  return Array.isArray(value) ? value : [];
};

const probeEntry = (registry: Registry): RegistryEntry => {
  const entry = registry.entries.find((candidate) => candidate.package === "typescript");
  if (!entry) throw new Error("typescript entry missing from the live registry");
  return entry;
};

const applyPolicyCase = (registry: Registry, definition: PolicyCase): Registry => {
  const field = definition.field ?? "";
  switch (definition.mutation) {
    case "set":
      setField(registry, field, definition.value);
      break;
    case "delete":
      deleteField(registry, field);
      break;
    case "set-undefined":
      setField(registry, field, undefined);
      break;
    case "append":
      setField(registry, field, [...fieldList(registry, field), definition.value]);
      break;
    case "remove":
      setField(
        registry,
        field,
        fieldList(registry, field).filter((entry) => entry !== definition.value),
      );
      break;
    case "remove-with-widened-allow":
      deleteField(registry, field);
      setField(registry, "allow_list", [...fieldList(registry, "allow_list"), definition.value]);
      break;
    case "unused-overlap":
      setField(registry, "allow_list", [...fieldList(registry, "allow_list"), definition.value]);
      setField(registry, "deny_list", [...fieldList(registry, "deny_list"), definition.value]);
      break;
    case "adversarial-remove": {
      const identifier = String(definition.value);
      setField(
        registry,
        "deny_list",
        fieldList(registry, "deny_list").filter((entry) => entry !== identifier),
      );
      setField(registry, "allow_list", [...fieldList(registry, "allow_list"), identifier]);
      probeEntry(registry).license = identifier;
      break;
    }
    case "set-license":
      probeEntry(registry).license = String(definition.value ?? "");
      break;
    case "minimal-overlap":
      throw new Error("minimal-overlap is evaluated without the live registry");
    default:
      throw new Error(`unknown policy mutation ${definition.mutation}`);
  }
  return registry;
};

const failuresForCase = (definition: PolicyCase): string[] => {
  if (definition.mutation === "minimal-overlap") {
    const minimal: Registry = {
      schema_version: 3,
      scope: CANONICAL_SCOPE,
      c2_determination: "probe",
      entries: [],
      allow_list: ["MIT"],
      deny_list: ["MIT"],
    };
    return validateRegistryPolicy(minimal);
  }
  return validate(ROOT, applyPolicyCase(loadLive(), definition));
};

const singleIdentifier = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const parsed = parseSpdxExpression(value);
  return parsed.ok && parsed.identifiers.length === 1 && parsed.identifiers[0] === value;
};

const identifiersOf = (value: string): Set<string> => {
  const parsed = parseSpdxExpression(value);
  return parsed.ok ? new Set(parsed.identifiers) : new Set<string>();
};

const approvedIdentifiers = (registry: Registry): Set<string> => {
  const identifiers = new Set<string>();
  for (const entry of registry.entries) {
    if (entry.verdict !== "approved") continue;
    for (const identifier of identifiersOf(String(entry.license ?? ""))) {
      identifiers.add(identifier);
    }
  }
  return identifiers;
};

const normalizeEntry = (entry: RegistryEntry): string =>
  JSON.stringify({
    package: entry.package,
    version: entry.version,
    license: entry.license,
    verdict: entry.verdict,
    uses: entry.uses
      .map((use) => `${use.owner}|${use.field}|${use.version}`)
      .sort((left, right) => left.localeCompare(right)),
  });

const entrySet = (registry: Registry): string[] => registry.entries.map(normalizeEntry).sort();

const baseRegistry = (): Registry => {
  let text: string;
  try {
    text = execFileSync("git", ["show", "origin/main-tools:doc/legal/dependency-licenses.yaml"], {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch {
    throw new Error(
      "origin/main-tools is unavailable; fetch the base branch with: git fetch origin main-tools",
    );
  }
  return parseYaml(text) as Registry;
};

const commentBlock = (): string => {
  const lines = readFileSync(REGISTRY_PATH, "utf8").split("\n");
  const isComment = (line: string): boolean => line.trimStart().startsWith("#");
  const firstData = lines.findIndex((line) => line.trim().length > 0 && !isComment(line));
  const leading = lines.slice(0, firstData < 0 ? lines.length : firstData);
  const trailing = lines.filter((line, index) => index > firstData && isComment(line));
  return [...leading, ...trailing].join("\n").toLowerCase();
};

const dataBlock = (): string => {
  const lines = readFileSync(REGISTRY_PATH, "utf8").split("\n");
  const isComment = (line: string): boolean => line.trimStart().startsWith("#");
  const firstData = lines.findIndex((line) => line.trim().length > 0 && !isComment(line));
  return lines
    .slice(firstData < 0 ? lines.length : firstData)
    .join("\n")
    .toLowerCase();
};

const casesIn = (group: string): PolicyCase[] =>
  policyCases.cases.filter((definition) => definition.group === group);

describe("license registry policy", () => {
  test("TC-LICREG-001 registry declares the schema-v3 policy artifact in one file", () => {
    const registry = loadRegistry(ROOT);
    const keys = Object.keys(registry);
    for (const key of [
      "schema_version",
      "scope",
      "c2_determination",
      "entries",
      "allow_list",
      "deny_list",
    ]) {
      expect(keys).toContain(key);
    }
    expect(registry.schema_version).toBe(3);
    expect(registry.scope).toBe(CANONICAL_SCOPE);
    expect(typeof registry.c2_determination).toBe("string");
    expect((registry.c2_determination ?? "").trim().length).toBeGreaterThan(0);

    const allowList = registry.allow_list ?? [];
    expect(Array.isArray(allowList)).toBe(true);
    expect(allowList.length).toBeGreaterThan(0);
    for (const identifier of allowList) {
      expect(singleIdentifier(identifier), `allow_list entry ${String(identifier)}`).toBe(true);
    }
    const allowSet = new Set(allowList.map(String));
    const approved = approvedIdentifiers(registry);
    expect([...allowSet].sort()).toEqual([...approved].sort());

    const denyList = registry.deny_list ?? [];
    expect(denyList.length).toBeGreaterThanOrEqual(20);
    for (const identifier of denyList) {
      expect(singleIdentifier(identifier), `deny_list entry ${String(identifier)}`).toBe(true);
    }
    expect(new Set(denyList).size).toBe(denyList.length);
    expect(denyList.filter((identifier) => allowSet.has(String(identifier)))).toEqual([]);

    expect(readdirSync(join(ROOT, "doc/legal"))).toEqual(["dependency-licenses.yaml"]);

    expect(registry.entries.length).toBeGreaterThan(0);
    for (const entry of registry.entries) {
      expect(typeof entry.package).toBe("string");
      expect(typeof entry.version).toBe("string");
      expect(typeof entry.license).toBe("string");
      expect(Array.isArray(entry.uses)).toBe(true);
      expect(typeof entry.verdict).toBe("string");
    }
  });

  test("TC-LICREG-002 five families and the full Appendix A baseline are denied", () => {
    const registry = loadRegistry(ROOT);
    const denyList = (registry.deny_list ?? []).map(String);
    expect(baseline.families.map((family) => family.family)).toEqual([
      "SSPL",
      "BUSL",
      "Elastic License",
      "Commons Clause",
      "CC-BY-NC",
    ]);
    expect(baseline.families.map((family) => family.identifiers.length)).toEqual([1, 2, 1, 1, 15]);
    expect(baseline.identifiers.length).toBe(20);

    for (const family of baseline.families) {
      expect(family.identifiers.length, family.family).toBeGreaterThan(0);
      for (const identifier of family.identifiers) {
        expect(
          denyList.filter((entry) => entry === identifier).length,
          `${family.family}: ${identifier} must appear exactly once`,
        ).toBe(1);
      }
    }
    for (const identifier of baseline.identifiers) {
      expect(denyList, `baseline identifier ${identifier}`).toContain(identifier);
    }

    expect([...MANDATORY_DENIED_IDENTIFIERS].sort()).toEqual([...baseline.identifiers].sort());
    for (const identifier of baseline.identifiers) {
      expect(MANDATORY_DENIED_IDENTIFIERS.has(identifier), identifier).toBe(true);
    }

    for (const identifier of denyList) {
      expect(singleIdentifier(identifier), `deny_list entry ${identifier}`).toBe(true);
      expect(identifier).not.toContain("AND");
      expect(identifier).not.toContain("OR");
      expect(identifier).not.toContain("WITH");
      expect(identifier).not.toContain("(");
      expect(identifier).not.toContain(")");
    }
  });

  test("TC-LICREG-003 existing entries, uses, verdicts, and allow list are preserved", () => {
    const base = baseRegistry();
    const delivered = loadRegistry(ROOT);
    expect(base.schema_version).toBe(2);
    expect(delivered.schema_version).toBe(3);

    expect(entrySet(delivered)).toEqual(entrySet(base));

    expect([...(base.allow_list ?? [])].sort()).toEqual([...(delivered.allow_list ?? [])].sort());
    expect(delivered.scope).toBe(base.scope);
    expect(delivered.c2_determination).toBe(base.c2_determination);

    const baseKeys = new Set(Object.keys(base));
    const deliveredKeys = new Set(Object.keys(delivered));
    const added = [...deliveredKeys].filter((key) => !baseKeys.has(key));
    const removed = [...baseKeys].filter((key) => !deliveredKeys.has(key));
    expect([...added, ...removed]).toEqual(["deny_list"]);
  });

  test("TC-LICREG-004 old, absent, and unsupported schema versions fail closed", () => {
    const schemaCases = casesIn("schema");
    expect(schemaCases.length).toBe(5);
    for (const definition of schemaCases) {
      const registry = applyPolicyCase(loadLive(), definition);
      const failures = auditRegistry(registry, []);
      expect(failures.length, definition.id).toBeGreaterThan(0);
      const observed = definition.expectedValue ?? "";
      expect(
        failures.some((message) => message.includes("schema") && message.includes(observed)),
        definition.id,
      ).toBe(true);
    }
    const restored = loadLive();
    setField(restored, "schema_version", 3);
    expect(validate(ROOT, restored)).toEqual([]);
  });

  test("TC-LICREG-005 human-readable policy notes state the five policy claims", () => {
    const comments = commentBlock();
    const data = dataBlock();
    expect(comments.length).toBeGreaterThan(0);

    expect(comments.includes("fail") && comments.includes("closed")).toBe(true);
    expect(comments.includes("unregistered") || comments.includes("unknown")).toBe(true);

    expect(comments).toContain("noassertion");
    expect(comments).toContain("see license");

    expect(comments.includes("compound") || comments.includes("branch")).toBe(true);
    expect(
      comments.includes("each") ||
        comments.includes("every") ||
        comments.includes("individually") ||
        comments.includes("per"),
    ).toBe(true);

    expect(comments).toContain("deny");
    expect(
      comments.includes("wins") ||
        comments.includes("overrides") ||
        comments.includes("takes precedence") ||
        comments.includes("before"),
    ).toBe(true);
    expect(comments).toContain("allow");

    expect(comments).toContain("approved");
    expect(comments).toContain("allow");

    expect(comments).not.toContain("apache-2.0");
    expect(data).toContain("apache-2.0");
    expect(licenseCases.empty).toBe("");
  });

  test("TC-LICREG-007 deny wins over allow for an allow-listed approved identifier", () => {
    const representatives = [
      "SSPL-1.0",
      "BUSL-1.1",
      "Elastic-2.0",
      "Commons-Clause",
      "CC-BY-NC-4.0",
    ];
    for (const identifier of representatives) {
      const registry = loadLive();
      setField(registry, "allow_list", [...(registry.allow_list ?? []), identifier]);
      probeEntry(registry).license = identifier;
      const failures = validate(ROOT, registry);
      expect(failures.length, identifier).toBeGreaterThan(0);
      const denials = failures.filter((message) => message.includes("denied"));
      expect(
        denials.some((message) => message.includes("typescript") && message.includes(identifier)),
        identifier,
      ).toBe(true);
      expect(
        denials.every((message) => !message.includes("not allow-listed")),
        identifier,
      ).toBe(true);
      expect(
        failures.some(
          (message) =>
            message.includes("deny_list") &&
            message.includes("allow_list") &&
            message.includes(identifier),
        ),
        identifier,
      ).toBe(true);
      expect(
        failures.some((message) => message.includes("OK")),
        identifier,
      ).toBe(false);

      const entryOnly = loadLive();
      probeEntry(entryOnly).license = identifier;
      expect(
        auditRegistry(entryOnly, []).some(
          (message) => message.includes("denied") && message.includes(identifier),
        ),
        identifier,
      ).toBe(true);
    }
  });

  test("TC-LICREG-008 allow/deny overlap is a registry policy failure on its own", () => {
    const minimal: Registry = {
      schema_version: 3,
      scope: CANONICAL_SCOPE,
      c2_determination: "probe",
      entries: [],
      allow_list: ["MIT"],
      deny_list: ["MIT"],
    };
    const minimalFailures = validateRegistryPolicy(minimal);
    expect(minimalFailures.length).toBeGreaterThan(0);
    expect(
      minimalFailures.some(
        (message) =>
          message.includes("deny_list") &&
          message.includes("allow_list") &&
          message.includes("MIT"),
      ),
    ).toBe(true);

    const unused = applyPolicyCase(loadLive(), {
      id: "overlap-unused",
      group: "overlap",
      classToken: "allow/deny overlap",
      mutation: "unused-overlap",
      value: "Zlib",
      expectedValue: "Zlib",
    });
    const unusedFailures = validateRegistryPolicy(unused);
    expect(
      unusedFailures.some(
        (message) =>
          message.includes("deny_list") &&
          message.includes("allow_list") &&
          message.includes("Zlib"),
      ),
    ).toBe(true);

    expect(validateRegistryPolicy(loadLive())).toEqual([]);

    const multiple = loadLive();
    setField(multiple, "allow_list", [...(multiple.allow_list ?? []), "MIT", "Zlib"]);
    setField(multiple, "deny_list", [...(multiple.deny_list ?? []), "MIT", "Zlib"]);
    const overlapMessages = validateRegistryPolicy(multiple).filter((message) =>
      message.includes("both contain"),
    );
    expect(overlapMessages.length).toBe(2);
    expect(new Set(overlapMessages).size).toBe(2);
    expect(overlapMessages.some((message) => message.includes("MIT"))).toBe(true);
    expect(overlapMessages.some((message) => message.includes("Zlib"))).toBe(true);

    const liveOverlap = loadLive();
    setField(liveOverlap, "deny_list", [...(liveOverlap.deny_list ?? []), "MIT"]);
    const liveFailures = validate(ROOT, liveOverlap);
    expect(
      liveFailures.some(
        (message) =>
          message.includes("deny_list") &&
          message.includes("allow_list") &&
          message.includes("MIT"),
      ),
    ).toBe(true);
    expect(liveFailures.some((message) => message.includes("denied"))).toBe(true);
  });

  test("TC-LICREG-011 missing, non-array, or empty deny list fails closed", () => {
    const presenceCases = casesIn("presence");
    expect(presenceCases.length).toBe(7);
    for (const definition of presenceCases) {
      const registry = applyPolicyCase(loadLive(), definition);
      const failures = validate(ROOT, registry);
      expect(failures.length, definition.id).toBeGreaterThan(0);
      const reason = definition.expectedReason ?? "";
      expect(
        failures.some((message) => message.includes("deny_list") && message.includes(reason)),
        definition.id,
      ).toBe(true);
    }
    expect(
      validateRegistryPolicy(loadLive()).filter((message) => message.includes("deny_list")),
    ).toEqual([]);
  });

  test("TC-LICREG-012 malformed, empty, duplicate, compound, and padded entries fail closed", () => {
    const malformedCases = casesIn("malformed");
    expect(malformedCases.length).toBe(18);
    const reasonCounts = new Map<string, number>();
    for (const definition of malformedCases) {
      const registry = applyPolicyCase(loadLive(), definition);
      const failures = validateRegistryPolicy(registry);
      expect(failures.length, definition.id).toBeGreaterThan(0);
      const expected = definition.expectedValue ?? "";
      const candidates = expected.length === 0 ? ['""'] : [expected, JSON.stringify(expected)];
      expect(
        failures.some(
          (message) =>
            message.includes("deny_list") &&
            candidates.some((candidate) => message.includes(candidate)),
        ),
        definition.id,
      ).toBe(true);
      const reason = definition.expectedReason ?? "";
      expect(
        failures.some((message) => message.includes(reason)),
        `${definition.id}: ${reason}`,
      ).toBe(true);
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    expect(reasonCounts.get("not a single identifier")).toBe(5 + 3 + 3 + 3);
    expect(reasonCounts.get("empty")).toBe(3);
    expect(reasonCounts.get("duplicate")).toBe(1);

    const extension = casesIn("extension").find(
      (definition) => definition.id === "extension-valid-floor",
    );
    if (!extension) throw new Error("extension-valid-floor fixture case is missing");
    expect(validateRegistryPolicy(applyPolicyCase(loadLive(), extension))).toEqual([]);
  });

  test("TC-LICREG-013 removing any Appendix A identifier fails closed", () => {
    const codeFloor = new Set(MANDATORY_DENIED_IDENTIFIERS);
    expect([...codeFloor].sort()).toEqual([...baseline.identifiers].sort());

    const floorCases = casesIn("floor");
    expect(floorCases.length).toBe(25);
    const singleRemovals = floorCases.filter((definition) => definition.mutation === "remove");
    const adversarialRemovals = floorCases.filter(
      (definition) => definition.mutation === "adversarial-remove",
    );
    expect(singleRemovals.length).toBe(20);
    expect(adversarialRemovals.length).toBe(5);
    expect(new Set(singleRemovals.map((definition) => definition.value)).size).toBe(20);

    for (const definition of singleRemovals) {
      const registry = applyPolicyCase(loadLive(), definition);
      const identifier = definition.expectedValue ?? "";
      expect(
        validate(ROOT, registry).some(
          (message) => message.includes("deny_list") && message.includes(identifier),
        ),
        definition.id,
      ).toBe(true);
      expect(
        auditRegistry(registry, []).some(
          (message) => message.includes("deny_list") && message.includes(identifier),
        ),
        `${definition.id} without dependencies`,
      ).toBe(true);
    }

    for (const definition of adversarialRemovals) {
      const registry = applyPolicyCase(loadLive(), definition);
      const identifier = definition.expectedValue ?? "";
      const failures = validate(ROOT, registry);
      expect(
        failures.some(
          (message) =>
            message.includes("deny_list") &&
            message.includes(identifier) &&
            message.includes("mandatory"),
        ),
        definition.id,
      ).toBe(true);
      expect(
        failures.some((message) => message.includes("both contain")),
        definition.id,
      ).toBe(false);
      expect(
        failures.some((message) => message.includes("is denied by deny_list")),
        definition.id,
      ).toBe(false);
    }

    const control = applyPolicyCase(loadLive(), {
      id: "floor-extension",
      group: "extension",
      classToken: "control",
      mutation: "append",
      field: "deny_list",
      value: "AGPL-3.0-only",
      failureExpected: false,
    });
    expect(
      validateRegistryPolicy(control).filter((message) => message.includes("missing mandatory")),
    ).toEqual([]);
  });

  test("TC-LICREG-024 the matrix is complete, registered, and non-vacuous", () => {
    const declaredClasses = new Set(policyCases.classes);
    for (const definition of policyCases.cases) {
      expect(declaredClasses.has(definition.classToken), definition.id).toBe(true);
    }
    expect(declaredClasses.has("made-up-class")).toBe(false);
    expect(declaredClasses.has("control")).toBe(true);

    const groupCounts = new Map<string, number>();
    for (const definition of policyCases.cases) {
      groupCounts.set(definition.group, (groupCounts.get(definition.group) ?? 0) + 1);
    }
    for (const [group, minimum] of Object.entries(policyCases.groups)) {
      expect(groupCounts.get(group) ?? 0, group).toBeGreaterThanOrEqual(minimum);
    }
    const declaredTotal = Object.values(policyCases.groups).reduce(
      (total, count) => total + count,
      0,
    );
    expect(policyCases.cases.length).toBe(declaredTotal);
    expect(new Set(policyCases.cases.map((definition) => definition.id)).size).toBe(
      policyCases.cases.length,
    );

    const removalIdentifiers = new Set(
      casesIn("floor")
        .filter((definition) => definition.mutation === "remove")
        .map((definition) => definition.value),
    );
    for (const identifier of baseline.identifiers) {
      expect(removalIdentifiers.has(identifier), identifier).toBe(true);
    }

    const auditSuite = readFileSync(join(ROOT, "tests/checks/license-audit.test.ts"), "utf8");
    for (const key of [
      "unknownRef",
      "unknownRefScancode",
      "nonAllowlisted",
      "compoundOrDisallowed",
      "compoundAndAllowed",
      "empty",
    ]) {
      expect(Object.keys(licenseCases)).toContain(key);
      expect(auditSuite).toContain(`FIXTURES.${key}`);
    }

    const executed: string[] = [];
    for (const definition of policyCases.cases) {
      const failures = failuresForCase(definition);
      if (definition.failureExpected === false) {
        expect(failures, definition.id).toEqual([]);
      } else {
        expect(failures.length, definition.id).toBeGreaterThan(0);
        const reason = definition.expectedReason;
        if (reason !== undefined) {
          expect(
            failures.some((message) => message.includes(reason)),
            `${definition.id} reports ${reason}`,
          ).toBe(true);
        }
      }
      executed.push(definition.id);
    }
    expect(executed.length).toBe(policyCases.cases.length);
    expect(new Set(executed).size).toBe(policyCases.cases.length);

    for (const identifier of licenseCases.deniedSingles) {
      expect(removalIdentifiers.has(identifier), identifier).toBe(true);
    }
    const declaredUnknownReferences = new Set([
      licenseCases.unknownRef,
      licenseCases.unknownRefScancode,
    ]);
    expect([...licenseCases.unknownReferences].sort()).toEqual(
      [...declaredUnknownReferences].sort(),
    );
  });

  test("TC-LICREG-031 schema-v3 registry with a wrong scope fails closed", () => {
    expect(validate(ROOT, loadLive())).toEqual([]);
    const scopeCases = casesIn("scope");
    expect(scopeCases.length).toBe(5);
    for (const definition of scopeCases) {
      const registry = applyPolicyCase(loadLive(), definition);
      const failures = validate(ROOT, registry);
      expect(failures.length, definition.id).toBeGreaterThan(0);
      const observed = definition.expectedValue === "" ? '""' : (definition.expectedValue ?? "");
      expect(
        failures.some(
          (message) =>
            message.includes("scope") &&
            message.includes(observed) &&
            message.includes(CANONICAL_SCOPE),
        ),
        definition.id,
      ).toBe(true);
      expect(
        auditRegistry(registry, []).some((message) => message.includes("scope")),
        `${definition.id} without dependencies`,
      ).toBe(true);
      expect((registry.deny_list ?? []).length).toBeGreaterThanOrEqual(20);
      expect(registry.entries.every((entry) => entry.verdict === "approved")).toBe(true);
    }
    const restored = loadLive();
    setField(restored, "scope", CANONICAL_SCOPE);
    expect(validate(ROOT, restored)).toEqual([]);
  });
});
