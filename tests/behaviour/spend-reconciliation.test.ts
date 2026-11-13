/**
 * TC-TELEMETRY-019..024 — the reconciliation disclosure (F-6, DEC-2, DEC-5,
 * OQ-T2, OQ-T4, RSK-2, RSK-4).
 *
 * Matrix R-01..R-08: the pinned within case, the declared outside case, the
 * summed multi-session baseline with one verdict, the excluded-gap warning with
 * its named count, classified unavailability when no baseline exists at all,
 * the declared combination arithmetic, and cost sparsity that is disclosed
 * rather than repaired. Every expectation is hand-summed from the fixture.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  TELEMETRY_RECONCILIATION_TOLERANCE,
  TELEMETRY_SESSION_COMBINATION_RULE,
  TELEMETRY_VERDICT_OUTSIDE,
  TELEMETRY_VERDICT_UNAVAILABLE,
  TELEMETRY_VERDICT_WITHIN,
} from "../../packages/core/src/contracts/index";
import { runSpendCli, spendRuntimeOver } from "../fixtures/spend/harness";
import {
  foldTelemetryStore,
  makeBaselineRecord,
  makeStepRecord,
  makeV1Record,
  removeRoot,
  RUN_A,
  RUN_B,
  SESSION_A,
  SESSION_B,
  T1,
  T2,
  TELEMETRY_REF,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const folded = (seed: Parameters<typeof foldTelemetryStore>[0], label: string) => {
  const seeded = foldTelemetryStore(seed, label);
  roots.push(seeded.root);
  if (seeded.fold === undefined || !seeded.fold.ok) throw new Error(`fold failed: ${label}`);
  return { ...seeded, fold: seeded.fold };
};

const sessionStep = (input: {
  readonly sessionId: string;
  readonly runId: string;
  readonly input: number;
  readonly stamp: string;
  readonly cost?: number | null;
}) =>
  makeStepRecord({
    sessionId: input.sessionId,
    runId: input.runId,
    tokens: tokens({ input: input.input }),
    calls: 1,
    cost: input.cost === undefined ? 0.01 : input.cost,
    finishedAt: input.stamp,
  });

const baseline = (input: {
  readonly sessionId: string;
  readonly runId: string;
  readonly input: number;
}) =>
  makeBaselineRecord({
    sessionId: input.sessionId,
    runId: input.runId,
    tokens: tokens({ input: input.input }),
    calls: 1,
    cost: 0.01,
  });

describe("TC-TELEMETRY-019 SC-M2-S14-01 within-tolerance reconciliation", () => {
  test("the pinned scenario states verdict within and tolerance <= 0.02", async () => {
    const seeded = folded(
      {
        steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 100, stamp: T1 })],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 100 })],
      },
      "r01",
    );
    const run = await runSpendCli(
      ["--json", "spend", "--ref", TELEMETRY_REF],
      spendRuntimeOver(seeded.store),
    );
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as {
      readonly data?: { readonly reconciliation?: Record<string, unknown> };
    };
    const reconciliation = envelope.data?.reconciliation;
    expect(reconciliation).toBeDefined();
    if (reconciliation === undefined) return;
    // SC-M2-S14-01 verbatim.
    expect(reconciliation.verdict).toBe("within");
    expect(Number(reconciliation.tolerance)).toBeLessThanOrEqual(0.02);
    expect(reconciliation.tolerance).toBe(TELEMETRY_RECONCILIATION_TOLERANCE);
    expect(reconciliation.basis).toBe("stream-ingest");
    expect(reconciliation.observedTotals).toEqual({
      input: 100,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
    expect(reconciliation.harnessTotals).toEqual(reconciliation.observedTotals);
    expect(reconciliation.excludedBaselineSessions).toBe(0);
  });

  test("a 1% deviation is still within tolerance (R-02)", () => {
    const seeded = folded(
      {
        steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 101, stamp: T1 })],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 100 })],
      },
      "r02",
    );
    expect(seeded.fold.data.reconciliation.verdict).toBe("within");
    expect(seeded.fold.data.reconciliation.tolerance).toBe(0.02);
  });
});

describe("TC-TELEMETRY-020 over-tolerance deviation renders the outside verdict", () => {
  test("a 5% deviation is the declared outside verdict with both figures", () => {
    const seeded = folded(
      {
        steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 105, stamp: T1 })],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 100 })],
      },
      "r03",
    );
    const reconciliation = seeded.fold.data.reconciliation;
    expect(reconciliation.verdict).toBe(TELEMETRY_VERDICT_OUTSIDE);
    expect(reconciliation.tolerance).toBe(0.02);
    expect(reconciliation.observedTotals.input).toBe(105);
    expect(reconciliation.harnessTotals?.input).toBe(100);
  });

  test("the outside verdict is a stated outcome at exit 0, never a hidden error", async () => {
    const seeded = folded(
      {
        steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 140, stamp: T1 })],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 100 })],
      },
      "r03-cli",
    );
    const run = await runSpendCli(
      ["--json", "spend", "--ref", TELEMETRY_REF],
      spendRuntimeOver(seeded.store),
    );
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as {
      readonly data?: { readonly reconciliation?: { readonly verdict?: string } };
    };
    expect(envelope.data?.reconciliation?.verdict).toBe(TELEMETRY_VERDICT_OUTSIDE);
  });

  test("the paired control still renders within (non-vacuity)", () => {
    const control = folded(
      {
        steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 100, stamp: T1 })],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 100 })],
      },
      "r03-control",
    );
    expect(control.fold.data.reconciliation.verdict).toBe(TELEMETRY_VERDICT_WITHIN);
  });
});

describe("TC-TELEMETRY-021 multi-session summed baseline, one verdict", () => {
  test("one verdict over the summed baseline with per-session figures only as diagnostics", () => {
    const seeded = folded(
      {
        steps: [
          sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 60, stamp: T1 }),
          sessionStep({ sessionId: SESSION_B, runId: RUN_B, input: 40, stamp: T2 }),
        ],
        baselines: [
          baseline({ sessionId: SESSION_A, runId: RUN_A, input: 60 }),
          baseline({ sessionId: SESSION_B, runId: RUN_B, input: 40 }),
        ],
      },
      "r04",
    );
    const reconciliation = seeded.fold.data.reconciliation;
    expect(reconciliation.verdict).toBe(TELEMETRY_VERDICT_WITHIN);
    expect(reconciliation.harnessTotals?.input).toBe(100);
    expect(reconciliation.observedTotals.input).toBe(100);
    // The block carries exactly the declared fields: no per-session verdict fork.
    expect(Object.keys(reconciliation).sort()).toEqual([
      "basis",
      "excludedBaselineSessions",
      "harnessTotals",
      "observedTotals",
      "tolerance",
      "verdict",
    ]);
  });

  test("a shuffled seeding order renders byte-identically", () => {
    const forward = folded(
      {
        steps: [
          sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 60, stamp: T1 }),
          sessionStep({ sessionId: SESSION_B, runId: RUN_B, input: 40, stamp: T2 }),
        ],
        baselines: [
          baseline({ sessionId: SESSION_A, runId: RUN_A, input: 60 }),
          baseline({ sessionId: SESSION_B, runId: RUN_B, input: 40 }),
        ],
      },
      "r04-forward",
    );
    const shuffled = folded(
      {
        steps: [
          sessionStep({ sessionId: SESSION_B, runId: RUN_B, input: 40, stamp: T2 }),
          sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 60, stamp: T1 }),
        ],
        baselines: [
          baseline({ sessionId: SESSION_B, runId: RUN_B, input: 40 }),
          baseline({ sessionId: SESSION_A, runId: RUN_A, input: 60 }),
        ],
      },
      "r04-shuffled",
    );
    expect(JSON.stringify(shuffled.fold.data)).toBe(JSON.stringify(forward.fold.data));
  });
});

describe("TC-TELEMETRY-022 a baseline gap is excluded with its named count", () => {
  test("the missing session is excluded, warned, counted, and never zero-filled", () => {
    const seeded = folded(
      {
        steps: [
          sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 60, stamp: T1 }),
          // Session B observed, but with no harness total anywhere: excluded.
          makeStepRecord({
            sessionId: SESSION_B,
            runId: RUN_B,
            tokens: tokens({
              input: null,
              output: null,
              reasoning: null,
              cacheRead: null,
              cacheWrite: null,
            }),
            calls: null,
            cost: null,
            finishedAt: T2,
          }),
        ],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 60 })],
      },
      "r05",
    );
    const reconciliation = seeded.fold.data.reconciliation;
    expect(reconciliation.excludedBaselineSessions).toBe(1);
    expect(reconciliation.verdict).toBe(TELEMETRY_VERDICT_WITHIN);
    expect(reconciliation.harnessTotals?.input).toBe(60);
    expect(
      seeded.fold.warnings.some((warning) => warning.startsWith("baseline-session-excluded")),
    ).toBe(true);
  });

  test("the excluded session never contributes a fabricated zero to the baseline", () => {
    const seeded = folded(
      {
        steps: [
          sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 50, stamp: T1 }),
          sessionStep({ sessionId: SESSION_B, runId: RUN_B, input: 50, stamp: T2 }),
        ],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 50 })],
      },
      "r05-divergent",
    );
    // Observed 100 against the remaining baseline 50: outside, never silent.
    expect(seeded.fold.data.reconciliation.verdict).toBe(TELEMETRY_VERDICT_OUTSIDE);
    expect(seeded.fold.data.reconciliation.excludedBaselineSessions).toBe(1);
    expect(seeded.fold.data.reconciliation.harnessTotals?.input).toBe(50);
  });
});

describe("TC-TELEMETRY-023 no baseline is classified unavailability", () => {
  test("the block declares unavailability and never the within verdict", () => {
    const seeded = folded(
      { steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 30, stamp: T1 })] },
      "r06",
    );
    const reconciliation = seeded.fold.data.reconciliation;
    expect(reconciliation.verdict).toBe(TELEMETRY_VERDICT_UNAVAILABLE);
    expect(reconciliation.verdict).not.toBe(TELEMETRY_VERDICT_WITHIN);
    expect(reconciliation.harnessTotals).toBeNull();
    expect(reconciliation.observedTotals.input).toBe(30);
    expect(reconciliation.tolerance).toBe(0.02);
    expect(reconciliation.excludedBaselineSessions).toBe(1);
  });

  test("the report still renders at exit 0 with the disclosure present", async () => {
    const seeded = folded(
      { steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 30, stamp: T1 })] },
      "r06-cli",
    );
    const run = await runSpendCli(
      ["--json", "spend", "--ref", TELEMETRY_REF],
      spendRuntimeOver(seeded.store),
    );
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as {
      readonly data?: { readonly reconciliation?: Record<string, unknown> };
    };
    expect(envelope.data?.reconciliation?.verdict).toBe(TELEMETRY_VERDICT_UNAVAILABLE);
    expect(envelope.data?.reconciliation?.tolerance).toBe(0.02);
  });
});

describe("TC-TELEMETRY-024 double counting across planes is exposed", () => {
  test("the declared combination arithmetic is a contract constant", () => {
    expect(TELEMETRY_SESSION_COMBINATION_RULE).toContain("dedupe-by-sessionId");
    expect(TELEMETRY_SESSION_COMBINATION_RULE).toContain("observed takes stream step sums");
  });

  test("the same session in both planes contributes its figures once", () => {
    const seeded = folded(
      {
        steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 100, stamp: T1 })],
        v1: [
          makeV1Record({
            sessionId: SESSION_A,
            runId: RUN_A,
            tokens: tokens({ input: 50 }),
            calls: 1,
          }),
        ],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 100 })],
      },
      "r07",
    );
    const reconciliation = seeded.fold.data.reconciliation;
    expect(reconciliation.basis).toBe("combined");
    expect(reconciliation.observedTotals.input).toBe(100);
    expect(reconciliation.verdict).toBe(TELEMETRY_VERDICT_WITHIN);
  });

  test("inflation beyond tolerance surfaces the outside verdict, never a silent within", () => {
    const seeded = folded(
      {
        steps: [sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 150, stamp: T1 })],
        v1: [makeV1Record({ sessionId: SESSION_A, runId: RUN_A, tokens: tokens({ input: 150 }) })],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 100 })],
      },
      "r07-inflated",
    );
    expect(seeded.fold.data.reconciliation.verdict).toBe(TELEMETRY_VERDICT_OUTSIDE);
    expect(seeded.fold.data.reconciliation.basis).toBe("combined");
    expect(seeded.fold.data.reconciliation.observedTotals.input).toBe(150);
  });
});

describe("TC-TELEMETRY-019/020 R-08 cost sparsity is disclosed, never repaired", () => {
  test("token reconciliation is computed while cost sparsity is stated", () => {
    const seeded = folded(
      {
        steps: [
          sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 40, stamp: T1, cost: null }),
          sessionStep({ sessionId: SESSION_A, runId: RUN_A, input: 60, stamp: T2, cost: null }),
        ],
        baselines: [baseline({ sessionId: SESSION_A, runId: RUN_A, input: 100 })],
      },
      "r08",
    );
    const report = seeded.fold.data;
    expect(report.reconciliation.verdict).toBe(TELEMETRY_VERDICT_WITHIN);
    expect(report.costTotals.sparse).toBe(true);
    expect(report.costTotals.total).toBeNull();
    expect(report.costTotals.models.every((entry) => entry.cost === null)).toBe(true);
    // No cost figure was fabricated to make a cost reconciliation pass.
    expect(JSON.stringify(report.costTotals)).not.toContain('"total":0');
  });
});
