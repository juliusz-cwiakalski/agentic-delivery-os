/** TC-CAP-058 — the closeout half of the guard registry is present. */
import { describe, expect, test } from "bun:test";
import { CAPSULE_MUTANT_GUARDS } from "../fixtures/capsule/mutants";

describe("TC-CAP-058 closeout mutants", () => {
  test("every guard names the test suite that must fail", () => {
    expect(CAPSULE_MUTANT_GUARDS.every((guard) => guard.suite.endsWith(".test.ts"))).toBe(true);
  });
});
