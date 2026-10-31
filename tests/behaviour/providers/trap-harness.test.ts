/**
 * TC-TRAP-002 meta-check — catalog↔assertion coverage is bidirectional for every
 * provider, so a catalog that looks complete cannot silently skip a quirk and an
 * assertion cannot outlive its catalog entry.
 */
import { describe, expect, test } from "bun:test";
import {
  loadTrapCatalog,
  runTrapCatalog,
  type TrapAssertions,
  trapCoverageFailures,
} from "./trap-harness";

const TRAPS = "tests/fixtures/providers/traps";
const PROVIDERS = ["jira", "gitlab", "github"] as const;

const assertionsFor = (names: readonly string[]): TrapAssertions =>
  Object.fromEntries(names.map((name) => [name, () => undefined]));

describe("TC-TRAP-002 catalogue coverage", () => {
  test("every catalog entry has exactly one assertion", () => {
    for (const provider of PROVIDERS) {
      const catalog = loadTrapCatalog(TRAPS, provider);
      expect(catalog.provider).toBe(provider);
      expect(catalog.entries.length).toBeGreaterThan(0);
      const names = catalog.entries.map((entry) => entry.trapName);
      expect(trapCoverageFailures(catalog, assertionsFor(names))).toEqual([]);
    }
  });

  test("a catalog entry without an assertion fails by name", () => {
    const catalog = loadTrapCatalog(TRAPS, "jira");
    const names = catalog.entries.map((entry) => entry.trapName);
    const first = names[0];
    if (first === undefined) throw new Error("jira catalog is empty");
    const failures = trapCoverageFailures(catalog, assertionsFor(names.slice(1)));
    expect(failures.some((message) => message.startsWith(first))).toBe(true);
  });

  test("an assertion without a catalog entry fails by name", () => {
    const catalog = loadTrapCatalog(TRAPS, "github");
    const names = catalog.entries.map((entry) => entry.trapName);
    const failures = trapCoverageFailures(catalog, {
      ...assertionsFor(names),
      "GH-ORPHAN-ASSERTION": () => undefined,
    });
    expect(failures.some((message) => message.includes("GH-ORPHAN-ASSERTION"))).toBe(true);
  });

  test("running a catalog with no assertions fails every entry, never silently passing", async () => {
    for (const provider of PROVIDERS) {
      const run = await runTrapCatalog({ catalogRoot: TRAPS, provider, assertions: {} });
      expect(run.results.length).toBeGreaterThan(0);
      expect(run.failures.some((message) => message.includes("no assertion registered"))).toBe(
        true,
      );
      for (const result of run.results) expect(result.passed).toBe(false);
    }
  });
});
