/**
 * TC-F1-014 — the delivered merge-suite split, asserted in both directions.
 *
 * The delivered population is sixteen `tests/behaviour/merge-*.test.ts` files.
 * NINE change with this delivery and each carries its declared post-change
 * obligation; the other SEVEN stay green unedited with their delivered assertion
 * inventories. Three token-absence scans prove no changed suite still asserts the
 * removed mechanism, and each suite's obligation is paired with a control that
 * fails by name.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** The sixteen delivered merge suites, by name (the population is closed). */
const DELIVERED = [
  "merge-bounds",
  "merge-classification",
  "merge-convergence",
  "merge-coordinator-boundary",
  "merge-determinism",
  "merge-dry-run",
  "merge-freshness",
  "merge-gate-set",
  "merge-landing",
  "merge-privacy",
  "merge-probe",
  "merge-production-composition",
  "merge-rebase",
  "merge-refusal-surface",
  "merge-verification-record",
  "merge-waivers",
] as const;

const CHANGED = [
  "merge-rebase",
  "merge-coordinator-boundary",
  "merge-waivers",
  "merge-landing",
  "merge-convergence",
  "merge-refusal-surface",
  "merge-bounds",
  "merge-determinism",
  "merge-probe",
] as const;

const GREEN = [
  "merge-classification",
  "merge-dry-run",
  "merge-freshness",
  "merge-gate-set",
  "merge-privacy",
  "merge-production-composition",
  "merge-verification-record",
] as const;

/** Each changed suite's declared post-change obligation, as source markers. */
const OBLIGATIONS: Record<(typeof CHANGED)[number], readonly string[]> = {
  // Inverted: no refresh attempt + the typed sync refusal.
  "merge-rebase": ["merge.sync-required", "behind-unconfirmed", "git-rebase-refresh"],
  // Inverted: zero composed local landing + the declared-gap refusal.
  "merge-coordinator-boundary": ["landingGap", "merge.transaction-aborted", "squashLand"],
  // Inverted: the provider landing identity and its records.
  "merge-waivers": ["provider-land", "MERGE_LANDING_SHA", "landing.requestState"],
  // Re-pointed: the provider landing call count replaces a local-landing count.
  "merge-landing": ["counts.landing", "landings", "expectedHeadSha"],
  // Re-pointed: the provider's truth decides the replay.
  "merge-convergence": ["counts.landing", "merge.landing-unverified", "reviewState"],
  // Re-pointed: the sync-required row replaces the rebase-conflict matrix row.
  "merge-refusal-surface": ["merge.sync-required", "merge.mergeability-unknown"],
  // Mechanically edited: a bounded-evidence case replaces the lost producer.
  "merge-bounds": ["new-red-jobs=", "MERGE_MAX_HUMAN_BYTES"],
  // Mechanically edited: the retired scenario name is gone.
  "merge-determinism": ["refusal-stale", "refusal-waiver"],
  // Inverted: an undeclared red job is not evidence and the merge proceeds (AC-F3-3).
  "merge-probe": [
    "TC-MERGE-016",
    "a red job the gate set does not declare is not gate evidence and the merge proceeds",
    "AC-F3-3",
    "expect(errorOf(result)).toBeUndefined()",
  ],
};

/** The seven green suites' delivered assertion inventories. */
const GREEN_INVENTORY: Record<(typeof GREEN)[number], readonly string[]> = {
  "merge-classification": ["TC-MERGE-017"],
  "merge-dry-run": ["TC-MERGE-028"],
  "merge-freshness": ["TC-MERGE-007"],
  "merge-gate-set": ["TC-MERGE-002", "TC-MERGE-003", "TC-MERGE-004"],
  "merge-privacy": ["TC-MERGE-034"],
  "merge-production-composition": ["TC-ENGINE-050", "TC-ENGINE-051", "TC-ENGINE-052"],
  "merge-verification-record": ["TC-MERGE-005", "TC-MERGE-006"],
};

const sourceOf = (suite: string): string =>
  readFileSync(join(ROOT, "tests/behaviour", `${suite}.test.ts`), "utf8");

/** A `git-squash-land` COUNT (an absence assertion is not a count). */
const squashLandCountLines = (text: string): string[] =>
  text
    .split("\n")
    .filter((line) => line.includes("git-squash-land"))
    .filter((line) => /toHaveLength|\.length|filter|count/u.test(line));

/** The retired scenario name / the reserved row's producer claim. */
const absentTokens = (suite: (typeof CHANGED)[number]): string[] => {
  const text = sourceOf(suite);
  const found: string[] = [];
  if (text.includes("refusal-rebase")) found.push(`${suite}: refusal-rebase scenario name`);
  if (suite !== "merge-rebase" && text.includes("merge.rebase-conflict")) {
    found.push(`${suite}: merge.rebase-conflict producer claim`);
  }
  if (squashLandCountLines(text).length > 0) found.push(`${suite}: git-squash-land count`);
  return found;
};

describe("TC-F1-014 the delivered population is sixteen suites", () => {
  test("every delivered suite exists and the changed and green sets partition it", () => {
    for (const suite of DELIVERED) {
      expect(existsSync(join(ROOT, "tests/behaviour", `${suite}.test.ts`)), suite).toBe(true);
    }
    expect([...CHANGED, ...GREEN].sort()).toEqual([...DELIVERED].sort());
    expect(new Set([...CHANGED, ...GREEN]).size).toBe(16);
    expect(CHANGED).toHaveLength(9);
    expect(GREEN).toHaveLength(7);
  });
});

describe("TC-F1-014 the nine changed suites carry their post-change obligation", () => {
  for (const suite of CHANGED) {
    test(`${suite}: carries its declared obligation`, () => {
      const text = sourceOf(suite);
      for (const marker of OBLIGATIONS[suite]) {
        expect(text, `${suite} must carry ${marker}`).toContain(marker);
      }
    });
  }

  test("no changed suite asserts the removed mechanism", () => {
    const findings = CHANGED.flatMap(absentTokens);
    expect(findings).toEqual([]);
  });

  test("the controls: a planted count, producer claim, or scenario name each fail by name", () => {
    const plantedCount = "expect(events.filter((e) => e === 'git-squash-land')).toHaveLength(1);";
    expect(squashLandCountLines(plantedCount)).toHaveLength(1);
    const plantedProducer = 'code: "merge.rebase-conflict"';
    expect(plantedProducer.includes("merge.rebase-conflict")).toBe(true);
    const plantedScenario = 'goldenScenarios()["refusal-rebase"]';
    expect(plantedScenario.includes("refusal-rebase")).toBe(true);
    // An absence assertion is not a count and must not be flagged.
    const absence = 'expect(harness.events).not.toContain("git-squash-land");';
    expect(squashLandCountLines(absence)).toEqual([]);
  });

  test("the reserved identity is still declared in the error table, not in a suite", () => {
    const table = readFileSync(join(ROOT, "packages/core/src/contracts/error-table.ts"), "utf8");
    expect(table).toContain("merge.rebase-conflict");
    expect(sourceOf("merge-rebase")).not.toContain("merge.rebase-conflict");
  });
});

describe("TC-F1-014 the seven green suites stay green unedited", () => {
  for (const suite of GREEN) {
    test(`${suite}: keeps its delivered assertion inventory`, () => {
      const text = sourceOf(suite);
      for (const caseId of GREEN_INVENTORY[suite]) {
        expect(text, `${suite} must keep ${caseId}`).toContain(caseId);
      }
    });
  }

  test("no green suite asserts the new path, so the obligation is bidirectional", () => {
    for (const suite of GREEN) {
      const text = sourceOf(suite);
      expect(text, `${suite} must not assert merge.sync-required`).not.toContain(
        "merge.sync-required",
      );
      expect(text, `${suite} must not assert merge.mergeability-unknown`).not.toContain(
        "merge.mergeability-unknown",
      );
      expect(text, `${suite} must not compose a landing`).not.toContain("counts.landing");
    }
  });

  test("a suite renamed or dropped from the population fails naming the missing file", () => {
    const missing = "merge-absent-suite";
    expect(existsSync(join(ROOT, "tests/behaviour", `${missing}.test.ts`))).toBe(false);
    expect(DELIVERED).not.toContain(missing as (typeof DELIVERED)[number]);
  });
});
