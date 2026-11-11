/**
 * GH-289 TC-ATTEMPT-036 — test isolation for every new suite.
 *
 * Every new fixture root comes from the repository-local approved base, the
 * non-checkout cell uses the delivered guard, no new suite reaches `tmpdir()`
 * directly, no suite composes the production program with this repository as its
 * working directory, and a real read leaves the operator's state directory
 * untouched.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ATTEMPTS_REF, ledgerOf } from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import {
  brandOf,
  realStateDirectory,
  realStateFingerprint,
} from "../fixtures/projects/state-scope";

const ROOT = process.cwd();

const NEW_SUITES = [
  "tests/behaviour/dispatch-attempts-bounds.test.ts",
  "tests/behaviour/dispatch-attempts-contract.test.ts",
  "tests/behaviour/dispatch-attempts-ref.test.ts",
  "tests/behaviour/dispatch-attempts-refusals.test.ts",
  "tests/behaviour/dispatch-attempts-scope.test.ts",
  "tests/behaviour/dispatch-attempts-digest.test.ts",
  "tests/behaviour/dispatch-resolve-result.test.ts",
  "tests/behaviour/dispatch-divergence-count.test.ts",
  "tests/behaviour/dispatch-additive-stability.test.ts",
  "tests/structure/dispatch-attempts-taxonomy.test.ts",
  "tests/structure/dispatch-attempts-count-rule.test.ts",
] as const;

const NEW_FIXTURES = [
  "tests/fixtures/dispatch/attempt-records.ts",
  "tests/fixtures/dispatch/attempts-harness.ts",
  "tests/fixtures/dispatch/attempts-production.ts",
] as const;

const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

describe("TC-ATTEMPT-036 test isolation", () => {
  test("no new suite or fixture reaches the OS temp root directly", () => {
    const failures: string[] = [];
    for (const path of [...NEW_SUITES, ...NEW_FIXTURES]) {
      const text = read(path);
      if (/from "node:os"/u.test(text)) failures.push(`${path}: imports node:os`);
      if (/\btmpdir\(/u.test(text)) failures.push(`${path}: calls tmpdir()`);
      if (/\bmkdtempSync\(/u.test(text) && !text.includes("APPROVED_BASE")) {
        failures.push(`${path}: calls mkdtempSync() outside the approved base`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("every fixture root passes the approved-base guard", () => {
    const harness = read("tests/fixtures/dispatch/attempts-harness.ts");
    expect(harness).toContain("APPROVED_BASE");
    expect(harness).toContain("guardStateFixtureRoot");
    const production = read("tests/fixtures/dispatch/attempts-production.ts");
    expect(production).toContain("createProductionProjectsHarness");
  });

  test("the non-checkout cell uses the delivered guard", () => {
    const scope = read("tests/behaviour/dispatch-attempts-scope.test.ts");
    expect(scope).toContain("nonCheckoutDirectory(");
  });

  test("no new suite composes production with this repository as its cwd", () => {
    const failures: string[] = [];
    for (const path of NEW_SUITES) {
      const text = read(path);
      if (/workingDirectory:\s*process\.cwd\(\)/u.test(text)) {
        failures.push(`${path}: uses the live checkout`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("a real read leaves the operator's state directory untouched", async () => {
    const brand = brandOf();
    const before = realStateFingerprint(brand);
    const harness = createAttemptsHarness({ label: "isolation", records: ledgerOf(2) });
    try {
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(result.exit).toBe(0);
      expect(realStateFingerprint(brand)).toBe(before);
      // The fixture never wrote into the home-derived state directory either.
      expect(realStateDirectory(brand)).not.toContain("gh289-");
    } finally {
      harness.dispose();
    }
  });
});
