/**
 * The burn-rate threshold/spend matrices (GH-299 test plan §6).
 *
 * Each matrix is a declared configuration input plus the step population that
 * yields the measured value under it, so crossing, equality, below-threshold,
 * both bases, and the sparse-cost disclosure are all reachable from one shape.
 */
import type { TelemetryStepRecord } from "../../../packages/core/src/contracts/index";
import type { BurnRateConfigInput } from "./config";
import { fullyAttributableSteps, stepOf, tokens } from "./telemetry";

export type AlarmMatrix = {
  readonly label: string;
  readonly config: BurnRateConfigInput;
  readonly steps: readonly TelemetryStepRecord[];
  readonly expectedMeasured: number;
};

const stepPopulation = (
  ref: string,
  capturedAt: string,
  tokenTotal: number,
): readonly TelemetryStepRecord[] => [
  stepOf({
    ref,
    runId: "run-alarm-a",
    agentRole: "coder",
    model: "model-alpha",
    tokens: tokens({ input: tokenTotal }),
    cost: 1,
    capturedAt,
  }),
];

/** One matrix per declared case; the expected value is the five-class sum. */
export const alarmMatrix = (ref: string, capturedAt: string): readonly AlarmMatrix[] => [
  {
    label: "tokens-999",
    config: { threshold: 1000, basis: "tokens", window: "14d" },
    steps: stepPopulation(ref, capturedAt, 999),
    expectedMeasured: 999,
  },
  {
    label: "tokens-1000",
    config: { threshold: 1000, basis: "tokens", window: "14d" },
    steps: stepPopulation(ref, capturedAt, 1000),
    expectedMeasured: 1000,
  },
  {
    label: "tokens-1001",
    config: { threshold: 1000, basis: "tokens", window: "14d" },
    steps: stepPopulation(ref, capturedAt, 1001),
    expectedMeasured: 1001,
  },
  {
    label: "cost-12.49",
    config: { threshold: 12.5, basis: "cost", window: "7d" },
    steps: [
      stepOf({
        ref,
        runId: "run-alarm-cost",
        agentRole: "coder",
        model: "model-alpha",
        tokens: tokens({ input: 10 }),
        cost: 12.49,
        capturedAt,
      }),
    ],
    expectedMeasured: 12.49,
  },
  {
    label: "cost-12.5",
    config: { threshold: 12.5, basis: "cost", window: "7d" },
    steps: [
      stepOf({
        ref,
        runId: "run-alarm-cost",
        agentRole: "coder",
        model: "model-alpha",
        tokens: tokens({ input: 10 }),
        cost: 12.5,
        capturedAt,
      }),
    ],
    expectedMeasured: 12.5,
  },
  {
    label: "cost-sparse",
    config: { threshold: 1, basis: "cost", window: "7d" },
    steps: [
      stepOf({
        ref,
        runId: "run-alarm-sparse",
        agentRole: "coder",
        model: "model-alpha",
        tokens: tokens({ input: 10 }),
        cost: 2,
        capturedAt,
      }),
      stepOf({
        ref,
        runId: "run-alarm-sparse",
        agentRole: "coder",
        model: "model-beta",
        tokens: tokens({ input: 10 }),
        cost: null,
        capturedAt,
      }),
    ],
    expectedMeasured: 2,
  },
];

/** The SC-M2-S6-02 crossing fixture: 1 200 tokens over a declared 14-day window. */
export const crossingMatrix = (ref: string, capturedAt: string): AlarmMatrix => ({
  label: "crossing-1200",
  config: { threshold: 1000, basis: "tokens", window: "14d" },
  steps: fullyAttributableSteps({ ref, capturedAt }),
  expectedMeasured: 1200,
});

/** The below-threshold twin of the crossing fixture. */
export const belowThresholdMatrix = (ref: string, capturedAt: string): AlarmMatrix => ({
  label: "below-980",
  config: { threshold: 1000, basis: "tokens", window: "14d" },
  steps: stepPopulation(ref, capturedAt, 980),
  expectedMeasured: 980,
});
