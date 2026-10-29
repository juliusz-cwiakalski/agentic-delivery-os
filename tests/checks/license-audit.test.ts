/**
 * TC-SCAFFOLD-036 — the license audit fails closed for unknown, non-allowlisted,
 * compound, removed, and empty license cases. Expressions are parsed, not
 * substring matched.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Dependency,
  type Registry,
  auditRegistry,
  directExternalDependencies,
  loadRegistry,
  parseSpdxExpression,
  validate,
} from "../../scripts/checks/license-audit";

const ROOT = process.cwd();
const FIXTURES = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/license/cases.json"), "utf8"),
) as Record<string, string>;

const clone = (): Registry => JSON.parse(JSON.stringify(loadRegistry(ROOT))) as Registry;
const dependencies = (): Dependency[] => directExternalDependencies(ROOT);

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
});
