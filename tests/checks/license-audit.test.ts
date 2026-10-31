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
  parseSpdxExpression,
  type Registry,
  validate,
} from "../../scripts/checks/license-audit";

const ROOT = process.cwd();
const FIXTURES = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/license/cases.json"), "utf8"),
) as Record<string, string>;

const clone = (): Registry => JSON.parse(JSON.stringify(loadRegistry(ROOT))) as Registry;
const dependencies = (): Dependency[] => lockedUses(ROOT, directExternalDependencies(ROOT));

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
