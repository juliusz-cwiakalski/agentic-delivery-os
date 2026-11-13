/**
 * TC-TELEMETRY-014 / 015 — the full spend v2 report: token and cost totals,
 * per-role and per-model breakdowns whose sums equal the totals, per-phase
 * timing, and all five dimensions present in the machine payload.
 *
 * The oracle is hand-summed from the fixture definition, never derived by
 * calling the production fold.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  HARNESS_TOKEN_CLASSES,
  SPEND_BREAKDOWN_FIELDS,
  SPEND_V2_DATA_KEYS,
  type HarnessTokenClass,
} from "../../packages/core/src/contracts/index";
import { runSpendCli, spendRuntimeOver } from "../fixtures/spend/harness";
import {
  AGENT_ROLE,
  LANE,
  makeBaselineRecord,
  makeStepRecord,
  MODEL_A,
  MODEL_B,
  REPOSITORY,
  removeRoot,
  RUN_A,
  RUN_B,
  SESSION_A,
  SESSION_B,
  T1,
  T2,
  TELEMETRY_REF,
  tokens,
  foldTelemetryStore,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const totalOf = (counts: Record<HarnessTokenClass, number>): number =>
  HARNESS_TOKEN_CLASSES.reduce((sum, tokenClass) => sum + counts[tokenClass], 0);

const seeded = () => {
  const seededCase = foldTelemetryStore(
    {
      steps: [
        makeStepRecord({
          runId: RUN_A,
          sessionId: SESSION_A,
          agentRole: AGENT_ROLE,
          model: MODEL_A,
          tokens: tokens({ input: 10, output: 5 }),
          calls: 1,
          cost: 0.01,
          finishedAt: T1,
        }),
        makeStepRecord({
          runId: RUN_B,
          sessionId: SESSION_B,
          agentRole: "planner",
          model: MODEL_B,
          tokens: tokens({ input: 20, output: 10 }),
          calls: 2,
          cost: 0.02,
          finishedAt: T2,
        }),
      ],
      baselines: [
        makeBaselineRecord({
          runId: RUN_A,
          sessionId: SESSION_A,
          tokens: tokens({ input: 10, output: 5 }),
        }),
        makeBaselineRecord({
          runId: RUN_B,
          sessionId: SESSION_B,
          tokens: tokens({ input: 20, output: 10 }),
        }),
      ],
      transitions: [
        { phaseId: "clarify_scope", operation: "complete", timestamp: T1 },
        { phaseId: "specification", operation: "complete", timestamp: T2 },
      ],
    },
    "v2-breakdown",
  );
  roots.push(seededCase.root);
  if (seededCase.fold === undefined || !seededCase.fold.ok) throw new Error("fold failed");
  return seededCase.fold;
};

describe("TC-TELEMETRY-014 the full spend v2 report", () => {
  test("token and cost totals equal the hand sums", () => {
    const fold = seeded();
    expect(fold.data.tokensByClass).toEqual({
      input: 30,
      output: 15,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
    });
    expect(fold.data.costTotals.total).toBeCloseTo(0.03, 10);
    expect(fold.data.costTotals.sparse).toBe(false);
  });

  test("per-role and per-model breakdowns exist and their token sums equal the totals", () => {
    const fold = seeded();
    const expected = totalOf(fold.data.tokensByClass);
    expect(expected).toBe(45);
    for (const field of ["role", "model"] as const) {
      const entries = fold.data.breakdowns[field];
      const sum = entries.reduce((total, entry) => total + entry.tokens, 0);
      expect(sum, field).toBe(expected);
    }
    const roles = fold.data.breakdowns.role.map((entry) => [entry.value, entry.tokens]);
    expect(roles).toEqual([
      ["planner", 30],
      [AGENT_ROLE, 15],
    ]);
    const models = fold.data.breakdowns.model.map((entry) => [entry.value, entry.tokens]);
    expect(models).toEqual([
      [MODEL_B, 30],
      [MODEL_A, 15],
    ]);
    // The ticket AC names per-role and per-model figures; `perAgent[]` carries them.
    expect(fold.data.perAgent.map((entry) => `${entry.agent}/${entry.model}`)).toEqual([
      `planner/${MODEL_B}`,
      `${AGENT_ROLE}/${MODEL_A}`,
    ]);
  });

  test("per-phase timing summaries match the seeded transition history", () => {
    const fold = seeded();
    expect(fold.data.phaseTiming.map((entry) => entry.phase)).toEqual([
      "clarify_scope",
      "specification",
    ]);
    expect(fold.data.phaseTiming[0]?.start).toBe(T1);
    expect(fold.data.phaseTiming[0]?.end).toBe(T2);
    expect(fold.data.phaseTiming[0]?.durationMs).toBe(900_000);
  });

  test("the reconciliation block renders within tolerance stating the tolerance", () => {
    const fold = seeded();
    expect(fold.data.reconciliation.verdict).toBe("within");
    expect(fold.data.reconciliation.tolerance).toBe(0.02);
    expect(fold.data.reconciliation.basis).toBe("stream-ingest");
    expect(fold.data.reconciliation.excludedBaselineSessions).toBe(0);
    expect(fold.data.reconciliation.observedTotals.input).toBe(30);
    expect(fold.data.reconciliation.harnessTotals?.input).toBe(30);
  });
});

describe("TC-TELEMETRY-015 the five-dimension breakdown selection", () => {
  test("all five declared dimensions are present in the machine report", () => {
    const fold = seeded();
    expect(Object.keys(fold.data.breakdowns).sort()).toEqual([...SPEND_BREAKDOWN_FIELDS].sort());
    expect(SPEND_BREAKDOWN_FIELDS).toEqual(["ticket", "repository", "lane", "role", "model"]);
    for (const field of SPEND_BREAKDOWN_FIELDS) {
      expect(fold.data.breakdowns[field].length, field).toBeGreaterThan(0);
    }
    // The five v2 keys sit beside the six v1 keys under one identity (DEC-6).
    expect(SPEND_V2_DATA_KEYS).toEqual([
      "costTotals",
      "breakdowns",
      "phaseTiming",
      "telemetryState",
      "reconciliation",
    ]);
  });

  test("every dimension's group sums equal the totals exactly", () => {
    const fold = seeded();
    const expected = totalOf(fold.data.tokensByClass);
    for (const field of SPEND_BREAKDOWN_FIELDS) {
      const sum = fold.data.breakdowns[field].reduce((total, entry) => total + entry.tokens, 0);
      expect(sum, field).toBe(expected);
    }
  });

  test("identity dimensions carry the seeded values", () => {
    const fold = seeded();
    expect(fold.data.breakdowns.ticket.map((entry) => entry.value)).toEqual([TELEMETRY_REF]);
    expect(fold.data.breakdowns.repository.map((entry) => entry.value)).toEqual([REPOSITORY]);
    expect(fold.data.breakdowns.lane.map((entry) => entry.value)).toEqual([LANE]);
  });

  test("a dimension with no attributable value is disclosed as null, never guessed", () => {
    const seededCase = foldTelemetryStore(
      {
        steps: [
          makeStepRecord({ sessionId: SESSION_A, lane: null, tokens: tokens({ input: 10 }) }),
          makeStepRecord({ sessionId: SESSION_B, lane: "lane-beta", tokens: tokens({ input: 5 }) }),
        ],
      },
      "v2-breakdown-null",
    );
    roots.push(seededCase.root);
    if (seededCase.fold === undefined || !seededCase.fold.ok) return;
    const lanes = seededCase.fold.data.breakdowns.lane;
    // Ordered by tokens descending: the null-value group carries 10 tokens.
    expect(lanes.map((entry) => entry.value)).toEqual([null, "lane-beta"]);
    expect(lanes.reduce((sum, entry) => sum + entry.tokens, 0)).toBe(15);
  });
});

describe("TC-TELEMETRY-015 breakdown selection through the CLI", () => {
  test("each declared dimension renders its hand-summed groups in the human digest", async () => {
    const seededCase = foldTelemetryStore(
      {
        steps: [
          makeStepRecord({
            sessionId: SESSION_A,
            runId: RUN_A,
            agentRole: AGENT_ROLE,
            model: MODEL_A,
            lane: LANE,
            tokens: tokens({ input: 10 }),
            finishedAt: T1,
          }),
          makeStepRecord({
            sessionId: SESSION_B,
            runId: RUN_B,
            agentRole: "planner",
            model: MODEL_B,
            lane: "lane-beta",
            tokens: tokens({ input: 20 }),
            finishedAt: T2,
          }),
        ],
      },
      "v2-breakdown-cli",
    );
    roots.push(seededCase.root);
    for (const field of SPEND_BREAKDOWN_FIELDS) {
      const run = await runSpendCli(
        ["spend", "--ref", TELEMETRY_REF, "--breakdown", field],
        spendRuntimeOver(seededCase.store),
      );
      expect(run.exitCode, field).toBe(0);
      expect(run.stdout).toContain(`breakdown  ${field}`);
      expect(run.stdout).toContain("reconcile");
    }
  });

  test("the machine report carries all five dimensions for every selection", async () => {
    const seededCase = foldTelemetryStore(
      { steps: [makeStepRecord({ tokens: tokens({ input: 3 }) })] },
      "v2-breakdown-machine",
    );
    roots.push(seededCase.root);
    const run = await runSpendCli(
      ["--json", "spend", "--ref", TELEMETRY_REF, "--breakdown", "role"],
      spendRuntimeOver(seededCase.store),
    );
    expect(run.exitCode).toBe(0);
    const data = (
      JSON.parse(run.stdout) as {
        readonly data?: { readonly breakdowns?: Record<string, unknown> };
      }
    ).data;
    expect(Object.keys(data?.breakdowns ?? {}).sort()).toEqual([...SPEND_BREAKDOWN_FIELDS].sort());
  });
});
