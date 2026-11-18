/**
 * TC-ENGINE-003 / TC-ENGINE-004 — one condition shape, one declared order, and
 * the invariant that `open` equals `unmetConditions` in order on every window.
 *
 * The order oracle is the delivered `DISPATCH_HANDOVER_CONDITIONS` declaration,
 * never a transcribed list, and the open set is compared against the delivered
 * `unmetConditions` on six fixture families — including a truncated window that
 * still returns data at exit `0`, because unverifiability is a verdict and not a
 * third status.
 */
import { describe, expect, test } from "bun:test";
import { appendDispatchAttempt } from "../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_CONDITION_STATES,
  DISPATCH_HANDOVER_CONDITIONS,
  type DispatchSummaryData,
} from "../../packages/core/src/contracts/index";
import {
  buildAttempts,
  dayAt,
  eligibleSpecs,
  gappedDates,
  incidentSpecs,
  missingClassSpecs,
  uncorroboratedSpecs,
  type AttemptSpec,
} from "../fixtures/dispatch/evidence-windows";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { corroborationFor, REPOSITORY } from "../fixtures/dispatch/ledger";

type Family = {
  readonly name: string;
  readonly specs: readonly AttemptSpec[];
  readonly max?: number;
};

const families: readonly Family[] = [
  { name: "eligible", specs: eligibleSpecs() },
  { name: "truth-incident", specs: incidentSpecs().recovery },
  { name: "coverage-missing", specs: missingClassSpecs("merged") },
  { name: "floor-missing", specs: gappedDates() },
  {
    name: "corroboration-unsatisfied",
    specs: eligibleSpecs().map((spec, index) =>
      index === eligibleSpecs().length - 1
        ? { ...spec, corroboration: corroborationFor(spec.token, { tracker: "unsatisfied" }) }
        : spec,
    ),
  },
  { name: "truncated", specs: eligibleSpecs(), max: 5 },
];

const summaryOf = async (family: Family): Promise<DispatchSummaryData> => {
  const scenario = createCommandScenario({
    gate: family.max === undefined ? {} : { max: family.max },
  });
  try {
    for (const attempt of buildAttempts(family.specs)) {
      const appended = appendDispatchAttempt(
        scenario.state.store,
        scenario.state.fenceToken,
        attempt,
      );
      if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
    }
    const run = await scenario.invoke([
      "dispatch",
      "dual-run",
      "summary",
      "--repo",
      REPOSITORY,
      "--json",
    ]);
    expect(run.exit, `${family.name}: ${run.stderr}`).toBe(0);
    const data = run.envelope?.data;
    if (data === undefined) throw new Error(`${family.name}: no summary data`);
    return data as DispatchSummaryData;
  } finally {
    scenario.dispose();
  }
};

const unsatisfiedSpecs = (): readonly AttemptSpec[] => uncorroboratedSpecs();

describe("TC-ENGINE-003 one shape in one declared order", () => {
  test("four entries in the declared order, exactly two keys each, closed statuses", async () => {
    for (const specs of [eligibleSpecs(), missingClassSpecs("merged")]) {
      const scenario = createCommandScenario({ gate: {} });
      try {
        for (const attempt of buildAttempts(specs)) {
          const appended = appendDispatchAttempt(
            scenario.state.store,
            scenario.state.fenceToken,
            attempt,
          );
          if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
        }
        const run = await scenario.invoke([
          "dispatch",
          "dual-run",
          "summary",
          "--repo",
          REPOSITORY,
          "--json",
        ]);
        const data = run.envelope?.data as DispatchSummaryData | undefined;
        if (data === undefined) throw new Error("no summary data");
        expect(data.conditions).toHaveLength(4);
        expect(data.conditions.map((entry) => entry.condition)).toEqual([
          ...DISPATCH_HANDOVER_CONDITIONS,
        ]);
        expect([...DISPATCH_HANDOVER_CONDITIONS]).toEqual([
          "truth",
          "coverage",
          "floor",
          "corroboration",
        ]);
        for (const entry of data.conditions) {
          expect(Object.keys(entry)).toEqual(["condition", "status"]);
          expect(DISPATCH_CONDITION_STATES).toContain(entry.status);
          expect(Object.values(entry)).not.toContain("unverifiable");
        }
      } finally {
        scenario.dispose();
      }
    }
  });

  test("an eligible window reads four met and a missing class opens coverage and floor", async () => {
    const eligible = await summaryOf({ name: "eligible", specs: eligibleSpecs() });
    expect(eligible.conditions.map((entry) => entry.status)).toEqual(["met", "met", "met", "met"]);
    const ineligible = await summaryOf({
      name: "coverage-missing",
      specs: missingClassSpecs("merged"),
    });
    const byName = Object.fromEntries(
      ineligible.conditions.map((entry) => [entry.condition, entry.status]),
    );
    expect(byName).toEqual({
      truth: "met",
      coverage: "open",
      floor: "met",
      corroboration: "met",
    });
  });
});

describe("TC-ENGINE-004 the open set equals unmetConditions in order", () => {
  test("every fixture family agrees, including the truncated one", async () => {
    const openSets: string[][] = [];
    for (const family of families) {
      const summary = await summaryOf(family);
      const open = summary.conditions
        .filter((entry) => entry.status === "open")
        .map((entry) => entry.condition);
      expect(open, family.name).toEqual(summary.unmetConditions.map((entry) => entry.condition));
      // The open set is a subsequence of the declared order, never a reorder.
      const ordered = [...DISPATCH_HANDOVER_CONDITIONS].filter((condition) =>
        open.includes(condition),
      );
      expect(open, family.name).toEqual(ordered);
      for (const unmet of summary.unmetConditions) {
        expect(Object.keys(unmet).sort()).toEqual(["condition", "detail"]);
      }
      if (family.max !== undefined) {
        expect(summary.verdict).toBe("unverifiable");
        expect(summary.truncation).toBeDefined();
        expect(summary.eligibility).toBe(false);
      }
      openSets.push(open);
    }
    // Anti-vacuity: at least one family is fully met and at least one is not.
    expect(openSets.some((open) => open.length === 0)).toBe(true);
    expect(openSets.some((open) => open.length > 0)).toBe(true);
  });

  test("a tail-uncorroborated ledger opens corroboration only", async () => {
    const summary = await summaryOf({
      name: "corroboration-unsatisfied",
      specs: unsatisfiedSpecs(),
    });
    expect(summary.conditions.filter((entry) => entry.status === "open")).toEqual([
      { condition: "corroboration", status: "open" },
    ]);
  });

  test("a floor-missing window opens floor rather than fabricating a status", async () => {
    const summary = await summaryOf({ name: "floor-missing", specs: gappedDates() });
    const open = summary.conditions
      .filter((entry) => entry.status === "open")
      .map((entry) => entry.condition);
    expect(open).toContain("floor");
    expect(open).toEqual(summary.unmetConditions.map((entry) => entry.condition));
    expect(summary.windowStart).not.toBe("");
    expect(Date.parse(summary.windowEnd)).toBeGreaterThan(Date.parse(dayAt(0)));
  });
});
