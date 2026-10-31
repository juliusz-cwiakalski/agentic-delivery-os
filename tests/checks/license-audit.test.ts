/**
 * TC-SCAFFOLD-036 — the license audit fails closed for unknown, non-allowlisted,
 * compound, removed, and empty license cases. Expressions are parsed, not
 * substring matched.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  auditRegistry,
  type Dependency,
  directExternalDependencies,
  loadRegistry,
  lockedUses,
  MANDATORY_DENIED_IDENTIFIERS,
  parseSpdxExpression,
  type Registry,
  type RegistryEntry,
  validate,
} from "../../scripts/checks/license-audit";

const ROOT = process.cwd();
type DeniedCompound = { license: string; denied: string; identifiers: string[] };
type AllowedCompound = { license: string; identifiers: string[] };
type LicenseCases = {
  unknownRef: string;
  nonAllowlisted: string;
  compoundOrDisallowed: string;
  compoundAndAllowed: string;
  empty: string;
  noassertion: string;
  seeLicense: string;
  none: string;
  blank: string;
  whitespace: string;
  unknownRefScancode: string;
  unparseableTrailingOr: string;
  unparseableLeadingAnd: string;
  unparseableMissingParen: string;
  unparseableEmptyParens: string;
  unparseableWith: string;
  unparseableSlash: string;
  deniedSingles: string[];
  deniedCompounds: DeniedCompound[];
  allowedCompounds: AllowedCompound[];
  unknownReferences: string[];
  nonAllowlistedGuards: string[];
};
type Baseline = {
  families: Array<{ family: string; identifiers: string[] }>;
  identifiers: string[];
};
const FIXTURES = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/license/cases.json"), "utf8"),
) as LicenseCases;
const BASELINE = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/license/deny-baseline.json"), "utf8"),
) as Baseline;

const clone = (): Registry => JSON.parse(JSON.stringify(loadRegistry(ROOT))) as Registry;
let cachedDependencies: Dependency[] | null = null;
const dependencies = (): Dependency[] => {
  if (cachedDependencies === null) {
    cachedDependencies = lockedUses(ROOT, directExternalDependencies(ROOT));
  }
  return cachedDependencies;
};

const probe = (registry: Registry): RegistryEntry => {
  const entry = registry.entries.find((candidate) => candidate.package === "typescript");
  if (!entry) throw new Error("typescript entry missing from the live registry");
  return entry;
};

const setLicense = (registry: Registry, license: string): void => {
  const entry = registry.entries.find((candidate) => candidate.package === "typescript");
  if (!entry) throw new Error("typescript entry missing from the live registry");
  entry.license = license;
};

const failuresFor = (registry: Registry, license: string): string[] => {
  setLicense(registry, license);
  return auditRegistry(registry, dependencies());
};

describe("license audit", () => {
  test("live registry is green", () => {
    expect(validate(ROOT)).toEqual([]);
  });

  test("SPDX expressions are parsed with AND/OR semantics", () => {
    expect(parseSpdxExpression("MIT OR GPL-3.0-only").ok).toBe(true);
    expect(parseSpdxExpression("(MIT AND Apache-2.0) OR ISC").ok).toBe(true);
    expect(parseSpdxExpression("MIT WITH Classpath-exception-2.0").ok).toBe(false);
  });

  test("unknown license reference fails closed", () => {
    const failures = failuresFor(clone(), FIXTURES.unknownRef as string);
    expect(failures.some((message) => message.includes("typescript"))).toBe(true);
    expect(failures.some((message) => message.includes("LicenseRef-Proprietary"))).toBe(true);
  });

  test("known but non-allowlisted license fails closed", () => {
    const failures = failuresFor(clone(), FIXTURES.nonAllowlisted as string);
    expect(failures.some((message) => message.includes("GPL-3.0-only"))).toBe(true);
    expect(failures.some((message) => message.includes("not allow-listed"))).toBe(true);
  });

  test("OR with a disallowed branch fails closed (no prefix/substring pass)", () => {
    const failures = failuresFor(clone(), FIXTURES.compoundOrDisallowed as string);
    expect(failures.some((message) => message.includes("GPL-3.0-only"))).toBe(true);
  });

  test("AND with all branches allowed passes", () => {
    expect(failuresFor(clone(), FIXTURES.compoundAndAllowed as string)).toEqual([]);
  });

  test("a removed real entry fails", () => {
    const registry = clone();
    registry.entries = registry.entries.filter((entry) => entry.package !== "typescript");
    const failures = auditRegistry(registry, dependencies());
    expect(failures.some((message) => message.includes("missing registry entry"))).toBe(true);
  });

  test("an empty license field fails", () => {
    const failures = failuresFor(clone(), FIXTURES.empty as string);
    expect(failures.some((message) => message.includes("empty license"))).toBe(true);
  });

  test("an allow_list entry not backed by an approved verdict fails", () => {
    const registry = clone();
    registry.allow_list = [...(registry.allow_list ?? []), "GPL-3.0-only"];
    const failures = validate(ROOT, registry);
    expect(failures.some((message) => message.includes("GPL-3.0-only"))).toBe(true);
  });

  test("an unparseable allow_list entry fails closed", () => {
    const registry = clone();
    registry.allow_list = [...(registry.allow_list ?? []), "MIT OR"];
    const failures = validate(ROOT, registry);
    expect(
      failures.some(
        (message) =>
          message.includes("allow_list entry MIT OR") &&
          message.includes("not a valid SPDX expression"),
      ),
    ).toBe(true);
  });

  test("runtime closure and direct/dev multi-use entries are accounted independently", () => {
    const uses = dependencies();
    expect(uses.filter((use) => use.name === "yaml").length).toBeGreaterThan(1);
    expect(uses).toContainEqual({
      owner: "ajv@8.20.0",
      field: "dependencies",
      name: "fast-uri",
      version: "3.1.9",
    });
    expect(uses).toContainEqual({
      owner: "@commitlint/config-validator@21.2.3",
      field: "dependencies",
      name: "ajv",
      version: "8.20.0",
    });
    expect(uses.some((use) => use.owner === "yaml@2.9.1")).toBe(false);
  });

  test("missing transitive, erased runtime, and duplicated or wrong-version uses fail", () => {
    const uses = dependencies();
    for (const [name, owner] of [
      ["fast-uri", "ajv@8.20.0"],
      ["ajv", "packages/core/package.json"],
    ]) {
      const registry = clone();
      const entry = registry.entries.find((item) => item.package === name);
      if (!entry) throw new Error(`missing ${name}`);
      entry.uses = entry.uses.filter((use) => use.owner !== owner);
      expect(auditRegistry(registry, uses).join("\n")).toContain("missing registered use");
    }
    const registry = clone();
    const entry = registry.entries.find((item) => item.package === "yaml");
    if (!entry) throw new Error("missing yaml");
    entry.uses.push({ ...(entry.uses[0] as Omit<Dependency, "name">) });
    expect(auditRegistry(registry, uses).join("\n")).toContain("duplicate use");
    entry.uses[0] = { ...(entry.uses[0] as Omit<Dependency, "name">), version: "2.9.0" };
    expect(auditRegistry(registry, uses).join("\n")).toContain("conflicting version");
  });

  test("disallowed SPDX branch and duplicate package rows fail closed", () => {
    const registry = clone();
    const entry = registry.entries.find((item) => item.package === "fast-uri");
    if (!entry) throw new Error("missing fast-uri");
    entry.license = "BSD-3-Clause OR GPL-3.0-only";
    registry.entries.push({ ...entry });
    const failures = auditRegistry(registry, dependencies()).join("\n");
    expect(failures).toContain("not allow-listed");
    expect(failures).toContain("duplicate registry entry");
  });
});

const denialMessages = (failures: string[]): string[] =>
  failures.filter((message) => message.includes("is denied by deny_list"));

describe("license audit hardening", () => {
  test("TC-LICREG-006 every mandated denied identifier fails with explicit denial", () => {
    expect(probe(clone()).license).toBe("Apache-2.0");
    expect(failuresFor(clone(), "Apache-2.0")).toEqual([]);
    expect([...MANDATORY_DENIED_IDENTIFIERS].sort()).toEqual([...BASELINE.identifiers].sort());

    const coveredFamilies = new Map<string, number>();
    let failing = 0;
    for (const identifier of BASELINE.identifiers) {
      const failures = failuresFor(clone(), identifier);
      expect(failures.length, identifier).toBeGreaterThan(0);
      const denials = denialMessages(failures);
      expect(
        denials.some(
          (message) =>
            message.includes("typescript") &&
            message.includes(identifier) &&
            message.includes("denied"),
        ),
        identifier,
      ).toBe(true);
      expect(
        denials.every((message) => !message.includes("not allow-listed")),
        identifier,
      ).toBe(true);
      failing += 1;
      for (const family of BASELINE.families) {
        if (!family.identifiers.includes(identifier)) continue;
        coveredFamilies.set(family.family, (coveredFamilies.get(family.family) ?? 0) + 1);
      }
    }
    expect(failing).toBe(20);
    for (const family of BASELINE.families) {
      expect(coveredFamilies.get(family.family) ?? 0, family.family).toBeGreaterThan(0);
    }
    expect(failuresFor(clone(), "MIT")).toEqual([]);
  });

  test("TC-LICREG-009 a denied branch fails in OR, AND, and nested expressions", () => {
    expect(FIXTURES.deniedCompounds.length).toBe(7);
    for (const testCase of FIXTURES.deniedCompounds) {
      const failures = failuresFor(clone(), testCase.license);
      expect(failures.length, testCase.license).toBeGreaterThan(0);
      const denials = denialMessages(failures);
      expect(denials.length, testCase.license).toBe(1);
      expect(
        denials.every(
          (message) =>
            message.includes("typescript") &&
            message.includes(testCase.denied) &&
            message.includes(testCase.license),
        ),
        testCase.license,
      ).toBe(true);
      expect(
        denials.some((message) => message.includes(`license ${testCase.denied} is denied`)),
        testCase.license,
      ).toBe(true);
      const parsed = parseSpdxExpression(testCase.license);
      expect(parsed.ok, testCase.license).toBe(true);
      if (parsed.ok) {
        expect([...parsed.identifiers].sort(), testCase.license).toEqual(
          [...testCase.identifiers].sort(),
        );
      }
    }

    expect(FIXTURES.allowedCompounds.length).toBe(2);
    for (const testCase of FIXTURES.allowedCompounds) {
      const parsed = parseSpdxExpression(testCase.license);
      expect(parsed.ok, testCase.license).toBe(true);
      if (parsed.ok) {
        expect([...parsed.identifiers].sort(), testCase.license).toEqual(
          [...testCase.identifiers].sort(),
        );
      }
      expect(failuresFor(clone(), testCase.license), testCase.license).toEqual([]);
    }
  });

  test("TC-LICREG-010 denial is attributed per branch and names only denied branches", () => {
    const one = denialMessages(failuresFor(clone(), "MIT AND BUSL-1.0"));
    expect(one.length).toBe(1);
    expect(one.every((message) => message.includes("license BUSL-1.0 is denied"))).toBe(true);
    expect(one.some((message) => message.includes("license MIT is denied"))).toBe(false);

    const two = denialMessages(failuresFor(clone(), "SSPL-1.0 AND BUSL-1.1"));
    expect(two.length).toBe(2);
    expect(two.some((message) => message.includes("license SSPL-1.0 is denied"))).toBe(true);
    expect(two.some((message) => message.includes("license BUSL-1.1 is denied"))).toBe(true);

    const none = failuresFor(clone(), "MIT OR Apache-2.0");
    expect(denialMessages(none)).toEqual([]);
    expect(none).toEqual([]);

    expect(denialMessages(failuresFor(clone(), "SSPL-1.0")).length).toBe(1);
  });

  test("TC-LICREG-014 extra deny identifiers work without a code change; no prefix matching", () => {
    const registry = clone();
    registry.deny_list = [...(registry.deny_list ?? []), "AGPL-3.0-only"];
    setLicense(registry, "AGPL-3.0-only");
    const extension = auditRegistry(registry, dependencies());
    expect(
      extension.some(
        (message) =>
          message.includes("is denied by deny_list") && message.includes("AGPL-3.0-only"),
      ),
    ).toBe(true);

    for (const license of ["SSPL-1.0.1", "BSD-3-Clause-Clear", "MIT-0"]) {
      const failures = failuresFor(clone(), license);
      expect(failures.length, license).toBeGreaterThan(0);
      expect(
        failures.some((message) => message.includes("not allow-listed")),
        license,
      ).toBe(true);
      expect(denialMessages(failures), license).toEqual([]);
      expect(
        failures.some((message) => message.includes(`license ${license} is not allow-listed`)),
        license,
      ).toBe(true);
    }
  });

  test("TC-LICREG-015 unregistered dependency and unregistered use fail closed", () => {
    const uses = dependencies();

    const missingEntry = clone();
    missingEntry.entries = missingEntry.entries.filter((entry) => entry.package !== "fast-uri");
    const entryFailures = auditRegistry(missingEntry, uses);
    expect(
      entryFailures.some(
        (message) =>
          message.includes("fast-uri") &&
          message.includes("missing registry entry") &&
          message.includes("ajv@8.20.0") &&
          message.includes("dependencies"),
      ),
    ).toBe(true);

    const missingUse = clone();
    const yamlEntry = missingUse.entries.find((entry) => entry.package === "yaml");
    if (!yamlEntry) throw new Error("yaml entry missing from the live registry");
    yamlEntry.uses = yamlEntry.uses.filter((use) => use.owner !== "@changesets/parse@1.0.0");
    const useFailures = auditRegistry(missingUse, uses);
    expect(
      useFailures.some(
        (message) =>
          message.includes("yaml") &&
          message.includes("missing registered use") &&
          message.includes("@changesets/parse@1.0.0") &&
          message.includes("dependencies") &&
          message.includes("2.9.1"),
      ),
    ).toBe(true);

    const synthetic: Dependency = {
      owner: "packages/core/package.json",
      field: "dependencies",
      name: "not-a-real-package",
      version: "9.9.9",
    };
    const syntheticFailures = auditRegistry(clone(), [...uses, synthetic]);
    expect(
      syntheticFailures.some(
        (message) =>
          message.includes("not-a-real-package") &&
          message.includes("missing registry entry") &&
          message.includes("packages/core/package.json"),
      ),
    ).toBe(true);

    const wrongVersion = clone();
    probe(wrongVersion).version = "9.9.9";
    const versionFailures = auditRegistry(wrongVersion, uses);
    expect(
      versionFailures.some(
        (message) =>
          message.includes("conflicting version") &&
          message.includes("9.9.9") &&
          message.includes("6.0.3"),
      ),
    ).toBe(true);
  });

  test("TC-LICREG-016 empty, LicenseRef-*, NOASSERTION, SEE LICENSE, unparseable fail closed", () => {
    const cases: Array<[string, string, string]> = [
      [FIXTURES.empty, "empty license", ""],
      [FIXTURES.whitespace, "empty license", ""],
      [FIXTURES.unknownRef, "unknown license reference", FIXTURES.unknownRef],
      [FIXTURES.unknownRefScancode, "unknown license reference", FIXTURES.unknownRefScancode],
      [FIXTURES.noassertion, "non-asserted", FIXTURES.noassertion],
      [FIXTURES.seeLicense, "non-asserted", FIXTURES.seeLicense],
      [
        FIXTURES.unparseableTrailingOr,
        "not a valid SPDX expression",
        FIXTURES.unparseableTrailingOr,
      ],
      [
        FIXTURES.unparseableLeadingAnd,
        "not a valid SPDX expression",
        FIXTURES.unparseableLeadingAnd,
      ],
      [
        FIXTURES.unparseableMissingParen,
        "not a valid SPDX expression",
        FIXTURES.unparseableMissingParen,
      ],
      [
        FIXTURES.unparseableEmptyParens,
        "not a valid SPDX expression",
        FIXTURES.unparseableEmptyParens,
      ],
      [FIXTURES.unparseableWith, "not a valid SPDX expression", FIXTURES.unparseableWith],
      [FIXTURES.unparseableSlash, "not a valid SPDX expression", FIXTURES.unparseableSlash],
      [FIXTURES.none, "non-asserted", FIXTURES.none],
    ];
    expect(cases.length).toBe(13);
    for (const [license, token, text] of cases) {
      const failures = failuresFor(clone(), license);
      expect(failures.length, license).toBeGreaterThan(0);
      expect(
        failures.some((message) => message.includes("typescript")),
        license,
      ).toBe(true);
      if (text.length > 0) {
        expect(
          failures.some((message) => message.includes(text)),
          license,
        ).toBe(true);
      }
      expect(
        failures.some((message) => message.includes(token)),
        `${license}: ${token}`,
      ).toBe(true);
    }
    expect(
      failuresFor(clone(), FIXTURES.empty).some((message) =>
        message.includes("typescript: empty license field"),
      ),
    ).toBe(true);
    const noneFailures = failuresFor(clone(), FIXTURES.none);
    expect(
      noneFailures.some(
        (message) => message.includes("non-asserted") || message.includes("not allow-listed"),
      ),
    ).toBe(true);
    expect(failuresFor(clone(), "MIT")).toEqual([]);
  });

  test("TC-LICREG-017 valid but non-allow-listed identifiers fail closed", () => {
    expect(FIXTURES.nonAllowlistedGuards.length).toBe(7);
    for (const license of FIXTURES.nonAllowlistedGuards) {
      const failures = failuresFor(clone(), license);
      expect(failures.length, license).toBeGreaterThan(0);
      expect(
        failures.some(
          (message) =>
            message.includes("not allow-listed") &&
            message.includes(license) &&
            message.includes("typescript"),
        ),
        license,
      ).toBe(true);
      expect(denialMessages(failures), license).toEqual([]);
    }

    for (const license of ["Apache-2.0 OR GPL-3.0-only", "MIT AND MPL-2.0"]) {
      const failures = failuresFor(clone(), license);
      expect(
        failures.some((message) => message.includes("not allow-listed")),
        license,
      ).toBe(true);
      expect(
        failures.some((message) => message.includes("license Apache-2.0 is not allow-listed")),
        license,
      ).toBe(false);
      expect(
        failures.some((message) => message.includes("license MIT is not allow-listed")),
        license,
      ).toBe(false);
    }

    const live = loadRegistry(ROOT);
    expect([...(live.allow_list ?? [])].sort()).toEqual([
      "Apache-2.0",
      "BSD-3-Clause",
      "ISC",
      "MIT",
    ]);

    const drift = clone();
    drift.allow_list = [...(drift.allow_list ?? []), "GPL-3.0-only"];
    expect(
      validate(ROOT, drift).some((message) =>
        message.includes("not backed by an approved verdict"),
      ),
    ).toBe(true);
  });

  test("TC-LICREG-018 the live @biomejs/biome MIT OR Apache-2.0 entry passes", () => {
    const registry = loadRegistry(ROOT);
    const entry = registry.entries.find((candidate) => candidate.package === "@biomejs/biome");
    if (!entry) throw new Error("@biomejs/biome entry missing from the live registry");
    expect(entry.verdict).toBe("approved");
    expect(entry.license).toBe("MIT OR Apache-2.0");
    const parsed = parseSpdxExpression(entry.license);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect([...parsed.identifiers].sort()).toEqual(["Apache-2.0", "MIT"]);
    }
    const allow = new Set(registry.allow_list ?? []);
    const deny = new Set(registry.deny_list ?? []);
    for (const identifier of ["MIT", "Apache-2.0"]) {
      expect(allow.has(identifier), identifier).toBe(true);
      expect(deny.has(identifier), identifier).toBe(false);
    }

    const biomeUses = dependencies().filter((use) => use.name === "@biomejs/biome");
    const minimal: Registry = {
      schema_version: 3,
      scope: "direct-and-runtime-closure",
      c2_determination: "probe",
      entries: [{ ...entry, uses: entry.uses }],
      allow_list: [...(registry.allow_list ?? [])],
      deny_list: [...(registry.deny_list ?? [])],
    };
    expect(auditRegistry(minimal, biomeUses)).toEqual([]);
    expect(validate(ROOT)).toEqual([]);
  });

  test("TC-LICREG-019 blanket compound rejection was not introduced", () => {
    const allowed = [
      { license: "MIT AND Apache-2.0", identifiers: ["MIT", "Apache-2.0"] },
      { license: "(MIT AND ISC) OR Apache-2.0", identifiers: ["MIT", "ISC", "Apache-2.0"] },
      {
        license: "(MIT OR Apache-2.0) AND (ISC OR BSD-3-Clause)",
        identifiers: ["MIT", "Apache-2.0", "ISC", "BSD-3-Clause"],
      },
      { license: "(((MIT)))", identifiers: ["MIT"] },
      { license: "MIT OR Apache-2.0", identifiers: ["MIT", "Apache-2.0"] },
    ];
    expect(allowed.length).toBe(5);
    for (const testCase of allowed) {
      const parsed = parseSpdxExpression(testCase.license);
      expect(parsed.ok, testCase.license).toBe(true);
      if (parsed.ok) {
        expect([...parsed.identifiers].sort(), testCase.license).toEqual(
          [...testCase.identifiers].sort(),
        );
      }
      const failures = failuresFor(clone(), testCase.license);
      expect(failures, testCase.license).toEqual([]);
      expect(
        failures.some((message) => /compound|unparseable|reject/i.test(message)),
        testCase.license,
      ).toBe(false);
    }

    const big = allowed[2];
    if (!big) throw new Error("big compound fixture missing");
    const parsedBig = parseSpdxExpression(big.license);
    expect(parsedBig.ok).toBe(true);
    if (parsedBig.ok) expect(parsedBig.identifiers.length).toBe(4);

    expect(failuresFor(clone(), "MIT OR GPL-3.0-only").length).toBeGreaterThan(0);
  });

  test("TC-LICREG-023 live registry validates with zero failures and closure preserved", () => {
    const registry = loadRegistry(ROOT);
    expect(validate(ROOT)).toEqual([]);
    for (const entry of registry.entries) {
      expect(entry.verdict, entry.package).toBe("approved");
    }

    const allow = new Set(registry.allow_list ?? []);
    const approved = new Set<string>();
    for (const entry of registry.entries) {
      const parsed = parseSpdxExpression(String(entry.license ?? ""));
      if (!parsed.ok) continue;
      for (const identifier of parsed.identifiers) approved.add(identifier);
    }
    expect([...allow].sort()).toEqual([...approved].sort());

    const deny = new Set(registry.deny_list ?? []);
    for (const entry of registry.entries) {
      const parsed = parseSpdxExpression(String(entry.license ?? ""));
      if (!parsed.ok) continue;
      for (const identifier of parsed.identifiers) {
        expect(deny.has(identifier), `${entry.package}: ${identifier}`).toBe(false);
      }
    }

    const uses = dependencies();
    expect(uses.filter((use) => use.name === "yaml").length).toBeGreaterThan(1);
    expect(uses).toContainEqual({
      owner: "ajv@8.20.0",
      field: "dependencies",
      name: "fast-uri",
      version: "3.1.9",
    });
    expect(uses).toContainEqual({
      owner: "@commitlint/config-validator@21.2.3",
      field: "dependencies",
      name: "ajv",
      version: "8.20.0",
    });
    expect(uses.some((use) => use.owner === "yaml@2.9.1")).toBe(false);
  });
});
