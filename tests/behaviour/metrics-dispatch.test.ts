/**
 * TC-METRICS-040/041/042 — the dispatch block is the delivered spend fold's
 * figures for the same selection (SC-M2-S6-01): deep equality, citation not
 * recomputation, preserved ordering and null semantics, and the DEC-14
 * attribution scope.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSpendCommandDefinition } from "../../packages/cli/src/commands/spend";
import { createSpendCommandRuntime } from "../../packages/cli/src/edge";
import { runCli } from "../../packages/cli/src/index";
import { fullBaseline } from "../fixtures/metrics/baseline";
import { burnRateConfig } from "../fixtures/metrics/config";
import {
  METRICS_NOW_MS,
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  reportOf,
  runMetrics,
} from "../fixtures/metrics/harness";
import {
  fullyAttributableSteps,
  nullAttributionSteps,
  seedTelemetry,
  stepOf,
  tokens,
} from "../fixtures/metrics/telemetry";
import { completeHistory, seedHistory } from "../fixtures/metrics/transitions";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const seedCase = (label: string, steps: readonly ReturnType<typeof stepOf>[]): MetricsFixture => {
  const fixture = makeMetricsFixture({ label, activeRef: METRICS_REF });
  fixtures.push(fixture);
  fixture.setConfig(burnRateConfig());
  fixture.setBaseline(fullBaseline());
  seedTelemetry(fixture.store, steps);
  seedHistory(fixture.store, METRICS_REF, completeHistory());
  return fixture;
};

/** Run the delivered spend command over the same store and clock. */
const runSpend = async (fixture: MetricsFixture): Promise<Record<string, unknown>> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const runtime = createSpendCommandRuntime({
    store: fixture.store,
    localContext: {
      path: `${fixture.root}/.ai/local/pm-context.yaml`,
      fs: {
        exists: (path) => fixture.project.files.has(path),
        readText: (path) => fixture.project.readText(path),
      },
    },
  });
  const exitCode = await runCli(
    ["spend", "--ref", METRICS_REF, "--json"],
    { stdout, stderr },
    {
      brand: SYNTHETIC_BRAND,
      clock: { now: () => 100 },
      newRunId: () => "run-spend-parity",
      secrets: [],
      program: { commands: { spend: createSpendCommandDefinition(runtime) } },
    },
  );
  expect(exitCode).toBe(0);
  const envelope = JSON.parse(stdout.value) as { data?: Record<string, unknown> };
  if (envelope.data === undefined) throw new Error("spend produced no report");
  return envelope.data;
};

const sumTokens = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((sum, value) => sum + value, 0);

describe("TC-METRICS-040 the dispatch block equals the delivered spend fold", () => {
  test("tokens, cost totals, restarts, and reconciliation are deep-equal to spend", async () => {
    const fixture = seedCase(
      "dispatch-parity",
      fullyAttributableSteps({
        ref: METRICS_REF,
        capturedAt: new Date(METRICS_NOW_MS - 2 * 86_400_000).toISOString(),
      }),
    );
    const spend = await runSpend(fixture);
    const metrics = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const dispatch = metrics.dispatch as Record<string, unknown>;
    expect(dispatch.telemetryState).toBe("present");
    expect(dispatch.tokensByClass).toEqual(spend.tokensByClass);
    expect(dispatch.costTotals).toEqual(spend.costTotals);
    expect(dispatch.restarts).toBe(spend.restarts);
    expect(dispatch.reconciliation).toEqual({
      basis: (spend.reconciliation as { basis: string }).basis,
      verdict: (spend.reconciliation as { verdict: string }).verdict,
    });
    expect(dispatch.breakdowns).toEqual({
      role: (spend.breakdowns as { role: unknown }).role,
      model: (spend.breakdowns as { model: unknown }).model,
    });
  });

  test("the seed's breakdown sums equal the delivered total and perAgent sums equal the totals", async () => {
    const fixture = seedCase(
      "dispatch-sums",
      fullyAttributableSteps({
        ref: METRICS_REF,
        capturedAt: new Date(METRICS_NOW_MS - 2 * 86_400_000).toISOString(),
      }),
    );
    const metrics = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const dispatch = metrics.dispatch as {
      tokensByClass: Record<string, number>;
      perAgent: readonly { calls: number; tokens: number }[];
      breakdowns: {
        role: readonly { tokens: number }[];
        model: readonly { tokens: number }[];
      };
    };
    const total = sumTokens(dispatch.tokensByClass);
    expect(total).toBe(1200);
    expect(dispatch.breakdowns.role.length).toBeGreaterThan(0);
    expect(dispatch.breakdowns.model.length).toBeGreaterThan(0);
    expect(dispatch.breakdowns.role.reduce((sum, row) => sum + row.tokens, 0)).toBe(total);
    expect(dispatch.breakdowns.model.reduce((sum, row) => sum + row.tokens, 0)).toBe(total);
    expect(dispatch.perAgent.reduce((sum, row) => sum + row.tokens, 0)).toBe(total);
    expect(dispatch.perAgent.reduce((sum, row) => sum + row.calls, 0)).toBe(6);
  });

  test("the dispatch block cites the reconciliation and recomputes nothing", () => {
    const domain = readFileSync(join(ROOT, "packages/core/src/domain/metrics.ts"), "utf8");
    for (const forbidden of ["priceTable", "multiplier", "currency", "recomputeCost"]) {
      expect(domain).not.toContain(forbidden);
    }
  });
});

describe("TC-METRICS-041 sparsity and reconciliation survive unchanged", () => {
  test("a sparse fixture reports sparse: true and equals spend's figures", async () => {
    const fixture = seedCase("dispatch-sparse", [
      stepOf({
        ref: METRICS_REF,
        runId: "run-sparse",
        agentRole: "coder",
        model: "model-alpha",
        tokens: tokens({ input: 100 }),
        cost: 2,
        capturedAt: new Date(METRICS_NOW_MS - 86_400_000).toISOString(),
      }),
      stepOf({
        ref: METRICS_REF,
        runId: "run-sparse",
        agentRole: "coder",
        model: "model-beta",
        tokens: tokens({ input: 50 }),
        cost: null,
        capturedAt: new Date(METRICS_NOW_MS - 86_400_000).toISOString(),
      }),
    ]);
    const spend = await runSpend(fixture);
    const metrics = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const dispatch = metrics.dispatch as { costTotals: Record<string, unknown> };
    expect(dispatch.costTotals).toEqual(spend.costTotals);
    expect(dispatch.costTotals.sparse).toBe(true);
    const models = dispatch.costTotals.models as readonly { cost: number | null }[];
    expect(models.some((row) => row.cost === null)).toBe(true);
  });
});

describe("TC-METRICS-042 ordering, null attribution, and the disclosed remainder", () => {
  test("the null-attribution fixture reconciles perAgent with the total and keeps the null row", async () => {
    const fixture = seedCase(
      "dispatch-null",
      nullAttributionSteps({
        ref: METRICS_REF,
        capturedAt: new Date(METRICS_NOW_MS - 86_400_000).toISOString(),
      }),
    );
    const spend = await runSpend(fixture);
    const metrics = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const dispatch = metrics.dispatch as {
      tokensByClass: Record<string, number>;
      perAgent: readonly { role: string; model: string; tokens: number }[];
      breakdowns: {
        role: readonly { value: string | null; tokens: number }[];
        model: readonly { value: string | null; tokens: number }[];
      };
      unattributable?: { steps: number; tokens: number };
    };
    const total = sumTokens(dispatch.tokensByClass);
    const perAgentTokens = dispatch.perAgent.reduce((sum, row) => sum + row.tokens, 0);
    expect(dispatch.unattributable?.steps).toBe(3);
    expect(perAgentTokens + (dispatch.unattributable?.tokens ?? 0)).toBe(total);
    expect(dispatch.breakdowns.role.reduce((sum, row) => sum + row.tokens, 0)).toBe(total);
    expect(dispatch.breakdowns.model.reduce((sum, row) => sum + row.tokens, 0)).toBe(total);
    expect(dispatch.breakdowns.role.some((row) => row.value === null)).toBe(true);
    expect(dispatch.perAgent.some((row) => row.role === "unknown" || row.role === "")).toBe(false);
    const spendBreakdown = (spend.breakdowns as { role: readonly { value: string | null }[] }).role;
    expect(dispatch.breakdowns.role.map((row) => row.value)).toEqual(
      spendBreakdown.map((row) => row.value),
    );
  });

  test("role breakdowns order by tokens descending, then value ascending, null last", async () => {
    const fixture = makeMetricsFixture({ label: "dispatch-order", activeRef: METRICS_REF });
    fixtures.push(fixture);
    fixture.setConfig(burnRateConfig());
    fixture.setBaseline(fullBaseline());
    seedTelemetry(fixture.store, [
      stepOf({
        ref: METRICS_REF,
        runId: "run-order",
        agentRole: "zeta",
        model: "model-alpha",
        tokens: tokens({ input: 100 }),
        cost: 1,
        capturedAt: new Date(METRICS_NOW_MS - 86_400_000).toISOString(),
      }),
      stepOf({
        ref: METRICS_REF,
        runId: "run-order",
        agentRole: "alpha",
        model: "model-alpha",
        tokens: tokens({ input: 300 }),
        cost: 1,
        capturedAt: new Date(METRICS_NOW_MS - 86_400_000).toISOString(),
      }),
      stepOf({
        ref: METRICS_REF,
        runId: "run-order",
        agentRole: "beta",
        model: "model-alpha",
        tokens: tokens({ input: 300 }),
        cost: 1,
        capturedAt: new Date(METRICS_NOW_MS - 86_400_000).toISOString(),
      }),
      stepOf({
        ref: METRICS_REF,
        runId: "run-order",
        agentRole: null,
        model: "model-alpha",
        tokens: tokens({ input: 50 }),
        cost: 1,
        capturedAt: new Date(METRICS_NOW_MS - 86_400_000).toISOString(),
      }),
    ]);
    seedHistory(fixture.store, METRICS_REF, completeHistory());
    const metrics = reportOf(await runMetrics(fixture, ["metrics", "--json"]));
    const roles = (
      metrics.dispatch as { breakdowns: { role: readonly { value: string | null }[] } }
    ).breakdowns.role;
    expect(roles.map((row) => row.value)).toEqual(["alpha", "beta", "zeta", null]);
  });
});
