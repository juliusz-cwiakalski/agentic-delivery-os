/**
 * Telemetry seeds for the metrics suites (GH-299 test plan §6).
 *
 * The delivered telemetry v2 builders are reused unchanged, so every step is a
 * record the production writer could have produced. The seed shapes cover the
 * fully attributable SC-M2-S6-01 population, a sparse-cost population, and the
 * null-attribution population the DEC-14 remainder half needs.
 */
import type {
  HarnessTokenCounts,
  StateStorePort,
  TelemetryStepRecord,
} from "../../../packages/core/src/contracts/index";
import {
  makeStepRecord,
  seedBaselines,
  seedSteps,
  seedV1Records,
  tokens,
} from "../telemetry/index";

export { makeStepRecord, seedBaselines, seedSteps, seedV1Records, tokens };

export type StepSeed = {
  readonly ref?: string;
  readonly runId: string;
  readonly agentRole: string | null;
  readonly model: string | null;
  readonly tokens: HarnessTokenCounts;
  readonly calls?: number;
  readonly cost?: number | null;
  readonly capturedAt: string;
};

/** One step record from a declared seed. */
export const stepOf = (seed: StepSeed): TelemetryStepRecord =>
  makeStepRecord({
    ...(seed.ref === undefined ? {} : { ref: seed.ref }),
    runId: seed.runId,
    agentRole: seed.agentRole,
    model: seed.model,
    tokens: seed.tokens,
    calls: seed.calls === undefined ? 1 : seed.calls,
    cost: seed.cost === undefined ? null : seed.cost,
    capturedAt: seed.capturedAt,
    ticket: seed.ref ?? "GH-299",
  });

/** The fully attributable SC-M2-S6-01 population: one run, three attributed steps. */
export const fullyAttributableSteps = (input: {
  readonly ref: string;
  readonly capturedAt: string;
  readonly cost?: number | null;
}): readonly TelemetryStepRecord[] => [
  stepOf({
    ref: input.ref,
    runId: "run-metrics-a",
    agentRole: "planner",
    model: "model-alpha",
    tokens: tokens({ input: 400, output: 100 }),
    calls: 2,
    cost: input.cost === undefined ? 1.5 : input.cost,
    capturedAt: input.capturedAt,
  }),
  stepOf({
    ref: input.ref,
    runId: "run-metrics-a",
    agentRole: "coder",
    model: "model-alpha",
    tokens: tokens({ input: 500, output: 100 }),
    calls: 3,
    cost: input.cost === undefined ? 2.5 : input.cost,
    capturedAt: input.capturedAt,
  }),
  stepOf({
    ref: input.ref,
    runId: "run-metrics-a",
    agentRole: "coder",
    model: "model-beta",
    tokens: tokens({ input: 100, output: 0 }),
    calls: 1,
    cost: input.cost === undefined ? 0.5 : input.cost,
    capturedAt: input.capturedAt,
  }),
];

/** The null-attribution population: one attributed step and three null steps. */
export const nullAttributionSteps = (input: {
  readonly ref: string;
  readonly capturedAt: string;
}): readonly TelemetryStepRecord[] => [
  stepOf({
    ref: input.ref,
    runId: "run-metrics-null",
    agentRole: "coder",
    model: "model-alpha",
    tokens: tokens({ input: 300, output: 100 }),
    calls: 2,
    cost: 1,
    capturedAt: input.capturedAt,
  }),
  stepOf({
    ref: input.ref,
    runId: "run-metrics-null",
    agentRole: null,
    model: "model-alpha",
    tokens: tokens({ input: 50 }),
    cost: 0.25,
    capturedAt: input.capturedAt,
  }),
  stepOf({
    ref: input.ref,
    runId: "run-metrics-null",
    agentRole: "coder",
    model: null,
    tokens: tokens({ input: 30 }),
    cost: 0.1,
    capturedAt: input.capturedAt,
  }),
  stepOf({
    ref: input.ref,
    runId: "run-metrics-null",
    agentRole: null,
    model: null,
    tokens: tokens({ input: 20 }),
    cost: 0.05,
    capturedAt: input.capturedAt,
  }),
];

/** Seed a step population into the fixture store. */
export const seedTelemetry = (
  store: StateStorePort,
  records: readonly TelemetryStepRecord[],
): void => {
  seedSteps(store, records);
};
