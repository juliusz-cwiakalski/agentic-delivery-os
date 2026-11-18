/**
 * TC-ENGINE-001 / TC-ENGINE-002 — clean accrual is one derivation and the
 * streak is the trailing run.
 *
 * `cleanDispatches` is asserted identical to `corroboration.satisfied` (a
 * dispatch count or a second counting rule fails), and `consecutiveCleanDispatches`
 * is asserted as the trailing run over an explicitly ordered ledger (a
 * longest-run metric fails the broken-streak fixture, an all-time-success one
 * fails the breaking-tail fixture). The pure fold is asserted beside the command
 * projection so the number is proven over the producer, not only the serializer.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  appendDispatchDivergence,
} from "../../packages/core/src/app/dispatch-ledger";
import { DELIVERY_RESULT_TOKENS } from "../../packages/core/src/contracts/index";
import type { DispatchSummaryData } from "../../packages/core/src/contracts/index";
import {
  conditionStatuses,
  evaluateHandoverGate,
  foldEvidenceWindow,
  toSummaryData,
} from "../../packages/core/src/domain/dispatch-gate";
import {
  buildAttempts,
  dayAt,
  eligibleSpecs,
  type AttemptSpec,
} from "../fixtures/dispatch/evidence-windows";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { makeDivergence, REPOSITORY } from "../fixtures/dispatch/ledger";

const WINDOW_END = dayAt(20);

type Seeded = {
  readonly summary: DispatchSummaryData;
  readonly dispose: () => void;
};

/** Seed one ledger through the delivered append path and read the summary. */
const seedAndSummarize = async (specs: readonly AttemptSpec[]): Promise<Seeded> => {
  const scenario = createCommandScenario({ gate: {} });
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
  const data = run.envelope?.data;
  if (data === undefined) throw new Error(`no summary data: ${run.stdout}${run.stderr}`);
  return { summary: data as DispatchSummaryData, dispose: () => scenario.dispose() };
};

/** The same specs through the pure fold, for the producer-level assertion. */
const foldSpecs = (specs: readonly AttemptSpec[]) => {
  const window = foldEvidenceWindow({
    repository: REPOSITORY,
    scope: "production",
    attempts: buildAttempts(specs),
    divergences: [],
    windowEnd: WINDOW_END,
  });
  return { window, evaluation: evaluateHandoverGate(window) };
};

describe("TC-ENGINE-001 clean accrual and the trailing streak", () => {
  test("cleanDispatches equals corroboration.satisfied and cannot be a dispatch count", async () => {
    const seeded = await seedAndSummarize(eligibleSpecs());
    try {
      expect(seeded.summary.cleanDispatches).toBe(seeded.summary.corroboration.satisfied);
      expect(seeded.summary.cleanDispatches).toBeLessThan(seeded.summary.countedDeliveries);
      expect(seeded.summary.countedDeliveries).toBe(20);
      expect(seeded.summary.cleanDispatches).toBe(15);
    } finally {
      seeded.dispose();
    }
  });

  test("the streak is the trailing run, not the longest run", async () => {
    // 18 eligible specs, one `failed` token, then one clean tail: the earlier
    // clean prefix must not be counted.
    const specs: AttemptSpec[] = [
      ...eligibleSpecs().slice(0, 18),
      { token: "failed", id: "break-1", day: 18 },
      { token: "pr-open", id: "tail-1", day: 19 },
    ];
    const seeded = await seedAndSummarize(specs);
    try {
      expect(seeded.summary.consecutiveCleanDispatches).toBe(1);
    } finally {
      seeded.dispose();
    }
  });

  test("a non-clean counted attempt as the tail breaks the streak but not the accrual", async () => {
    const withTail: AttemptSpec[] = [
      ...eligibleSpecs().slice(0, 18),
      { token: "failed", id: "break-1", day: 18 },
      { token: "pr-open", id: "tail-1", day: 19 },
    ];
    const broken: AttemptSpec[] = [
      ...eligibleSpecs().slice(0, 18),
      { token: "failed", id: "break-1", day: 18 },
      { token: "failed", id: "break-2", day: 19 },
    ];
    const clean = await seedAndSummarize(withTail);
    try {
      const unclean = await seedAndSummarize(broken);
      try {
        expect(clean.summary.consecutiveCleanDispatches).toBe(1);
        expect(unclean.summary.consecutiveCleanDispatches).toBe(0);
        // The accrual is the corroborated counted attempts, never the streak:
        // breaking the trailing run moves the streak only.
        expect(clean.summary.cleanDispatches).toBe(clean.summary.corroboration.satisfied);
        expect(unclean.summary.cleanDispatches).toBe(unclean.summary.corroboration.satisfied);
        expect(unclean.summary.cleanDispatches).toBe(clean.summary.cleanDispatches - 1);
      } finally {
        unclean.dispose();
      }
    } finally {
      clean.dispose();
    }
  });

  test("an uncorroborated success claim is counted but not clean", async () => {
    const specs = eligibleSpecs();
    const last = specs[specs.length - 1];
    if (last === undefined) throw new Error("empty fixture");
    const tailUncorroborated: AttemptSpec[] = [
      ...specs.slice(0, -1),
      { ...last, corroboration: { pmNotes: "unsatisfied", tracker: "unsatisfied", ci: "unsatisfied" } },
    ];
    const seeded = await seedAndSummarize(tailUncorroborated);
    try {
      expect(seeded.summary.cleanDispatches).toBe(seeded.summary.corroboration.satisfied);
      expect(seeded.summary.consecutiveCleanDispatches).toBe(0);
      expect(seeded.summary.corroboration.unsatisfied).toBe(1);
    } finally {
      seeded.dispose();
    }
  });

  test("an empty window reports zeros and the declared empty-window statuses", async () => {
    const seeded = await seedAndSummarize([]);
    try {
      expect(seeded.summary.countedDeliveries).toBe(0);
      expect(seeded.summary.cleanDispatches).toBe(0);
      expect(seeded.summary.consecutiveCleanDispatches).toBe(0);
      expect(seeded.summary.conditions).toEqual([
        { condition: "truth", status: "met" },
        { condition: "coverage", status: "open" },
        { condition: "floor", status: "open" },
        { condition: "corroboration", status: "met" },
      ]);
      expect(Object.hasOwn(seeded.summary, "coverageCount")).toBe(false);
      expect(Object.hasOwn(seeded.summary, "coverageDispatches")).toBe(false);
      expect(Object.hasOwn(seeded.summary, "coverageProgress")).toBe(false);
    } finally {
      seeded.dispose();
    }
  });

  test("the pure fold produces the same three numbers", () => {
    const { window, evaluation } = foldSpecs(eligibleSpecs());
    expect(window.cleanDispatches).toBe(window.corroboration.satisfied);
    expect(window.consecutiveCleanDispatches).toBe(10);
    expect(toSummaryData(window, evaluation).cleanDispatches).toBe(window.cleanDispatches);
    expect(toSummaryData(window, evaluation).consecutiveCleanDispatches).toBe(
      window.consecutiveCleanDispatches,
    );
    expect(toSummaryData(window, evaluation).conditions).toEqual(
      conditionStatuses(evaluation),
    );
  });
});

describe("TC-ENGINE-002 accrual walk", () => {
  test("each dispatch advances counted, clean, coverage-first-appearance, and the streak", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      const read = async (): Promise<DispatchSummaryData> => {
        const run = await scenario.invoke([
          "dispatch",
          "dual-run",
          "summary",
          "--repo",
          REPOSITORY,
          "--json",
        ]);
        const data = run.envelope?.data;
        if (data === undefined) throw new Error(`no summary data: ${run.stdout}`);
        return data as DispatchSummaryData;
      };
      const append = (spec: AttemptSpec): void => {
        const [attempt] = buildAttempts([spec]);
        if (attempt === undefined) throw new Error("empty spec");
        const appended = appendDispatchAttempt(
          scenario.state.store,
          scenario.state.fenceToken,
          attempt,
        );
        if (!appended.ok) throw new Error(`append failed: ${appended.code}`);
      };

      const baseline = await read();
      expect(baseline.countedDeliveries).toBe(0);
      expect(baseline.cleanDispatches).toBe(0);
      expect(baseline.consecutiveCleanDispatches).toBe(0);
      expect(baseline.coverage.present).toEqual([]);

      const first = DELIVERY_RESULT_TOKENS[0];
      const second = DELIVERY_RESULT_TOKENS[1];
      const third = DELIVERY_RESULT_TOKENS[2];

      append({ token: first, id: "walk-1", day: 0 });
      const one = await read();
      expect(one.countedDeliveries).toBe(1);
      expect(one.cleanDispatches).toBe(1);
      expect(one.consecutiveCleanDispatches).toBe(1);
      expect(one.coverage.present).toHaveLength(1);

      append({ token: first, id: "walk-2", day: 0, hour: 11 });
      const two = await read();
      expect(two.countedDeliveries).toBe(2);
      expect(two.cleanDispatches).toBe(2);
      expect(two.consecutiveCleanDispatches).toBe(2);
      expect(two.coverage.present).toHaveLength(1);

      append({ token: second, id: "walk-3", day: 0, hour: 12 });
      const three = await read();
      expect(three.coverage.present).toHaveLength(2);
      expect(three.cleanDispatches).toBe(3);

      append({ token: third, id: "walk-4", day: 0, hour: 13 });
      append({
        token: first,
        id: "walk-5",
        day: 0,
        hour: 14,
        corroboration: { pmNotes: "unsatisfied", tracker: "satisfied", ci: "satisfied" },
      });
      const broken = await read();
      expect(broken.countedDeliveries).toBe(5);
      expect(broken.cleanDispatches).toBe(4);
      expect(broken.consecutiveCleanDispatches).toBe(0);
      expect(broken.corroboration.unsatisfied).toBe(1);

      append({ token: first, id: "walk-6", day: 0, hour: 15 });
      const restarted = await read();
      expect(restarted.consecutiveCleanDispatches).toBe(1);
      expect(restarted.cleanDispatches).toBe(5);
      expect(restarted.coverage.present.length).toBeLessThanOrEqual(11);
    } finally {
      scenario.dispose();
    }
  });

  test("a resolved divergence does not change the accrual numbers", async () => {
    const scenario = createCommandScenario({ gate: {} });
    try {
      for (const attempt of buildAttempts(eligibleSpecs())) {
        const appended = appendDispatchAttempt(
          scenario.state.store,
          scenario.state.fenceToken,
          attempt,
        );
        if (!appended.ok) throw new Error(`seed failed: ${appended.code}`);
      }
      appendDispatchDivergence(
        scenario.state.store,
        scenario.state.fenceToken,
        makeDivergence({ divergenceId: "DIV-1", state: "resolved", attemptId: "all11-0" }),
      );
      const run = await scenario.invoke([
        "dispatch",
        "dual-run",
        "summary",
        "--repo",
        REPOSITORY,
        "--json",
      ]);
      const data = run.envelope?.data as DispatchSummaryData | undefined;
      expect(data?.cleanDispatches).toBe(15);
      expect(data?.consecutiveCleanDispatches).toBe(10);
    } finally {
      scenario.dispose();
    }
  });
});
