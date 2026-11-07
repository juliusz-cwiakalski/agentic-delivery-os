/**
 * Committed economics matrices (GH-235 test plan §6, §7).
 *
 * Data, not prose: adding or changing a row is a reviewed change. Every row
 * carries its expected outcome, identity, exit, and (where applicable) the
 * seed-scenario reference so the suites and the plan cannot drift apart.
 */
import {
  type EconomicsRestartRecord,
  type EconomicsSessionEvidence,
  type EconomicsSourcedSignalKind,
  WATCHDOG_STALL_HEARTBEAT_MS,
} from "../../../packages/core/src/contracts/index";

/** One liveness source shape in the prefill matrix (SC-M1-14). */
export const PREFILL_SOURCE_SHAPES = [
  "rising-token-delta",
  "traffic-only",
  "rising-both",
  "rising-both-beyond-bound",
] as const;

export type PrefillSourceShape = (typeof PREFILL_SOURCE_SHAPES)[number];

export const PREFILL_SIZES = ["small", "large", "huge"] as const;

export type PrefillSize = (typeof PREFILL_SIZES)[number];

export const PREFILL_DURATIONS = ["short", "long", "beyond-bound"] as const;

export type PrefillDuration = (typeof PREFILL_DURATIONS)[number];

export type PrefillSignals = {
  readonly heartbeatAgeMs: number;
  readonly tokenDelta?: number;
  readonly traffic?: number;
};

/** One committed prefill case: a large resuming session must classify progressing. */
export type PrefillCase = {
  readonly id: string;
  readonly size: PrefillSize;
  readonly duration: PrefillDuration;
  readonly sourceShape: PrefillSourceShape;
  readonly signals: PrefillSignals;
  readonly expectedVerdict: "progressing";
  readonly expectedExit: 0;
  readonly scenario: "SC-M1-14";
};

const BOUND = WATCHDOG_STALL_HEARTBEAT_MS;

const sizeTokens: Readonly<Record<PrefillSize, number>> = {
  small: 64,
  large: 4_096,
  huge: 32_768,
};

const durationHeartbeat: Readonly<Record<PrefillDuration, number>> = {
  short: 1_000,
  long: BOUND - 1_000,
  "beyond-bound": BOUND + 60_000,
};

const signalsFor = (
  shape: PrefillSourceShape,
  size: PrefillSize,
  duration: PrefillDuration,
): PrefillSignals => {
  const tokens = sizeTokens[size];
  const heartbeatAgeMs = durationHeartbeat[duration];
  switch (shape) {
    case "rising-token-delta":
      return { heartbeatAgeMs, tokenDelta: tokens, traffic: 0 };
    case "traffic-only":
      return { heartbeatAgeMs, tokenDelta: 0, traffic: Math.max(1, sizeTokens[size] / 64) };
    case "rising-both":
      return { heartbeatAgeMs, tokenDelta: tokens, traffic: Math.max(1, sizeTokens[size] / 128) };
    case "rising-both-beyond-bound":
      return {
        heartbeatAgeMs: Math.max(heartbeatAgeMs, BOUND + 1),
        tokenDelta: tokens,
        traffic: Math.max(1, sizeTokens[size] / 256),
      };
  }
};

/** The 3 sizes x 3 durations x 4 source shapes prefill/excellent matrix. */
export const PREFILL_CASES: readonly PrefillCase[] = PREFILL_SIZES.flatMap((size) =>
  PREFILL_DURATIONS.flatMap((duration) =>
    PREFILL_SOURCE_SHAPES.map((sourceShape) => ({
      id: `prefill-${size}-${duration}-${sourceShape}`,
      size,
      duration,
      sourceShape,
      signals: signalsFor(sourceShape, size, duration),
      expectedVerdict: "progressing" as const,
      expectedExit: 0 as const,
      scenario: "SC-M1-14" as const,
    })),
  ),
);

/** One corroboration-matrix row: the present signals and the expected verdict. */
export type CorroborationCase = {
  readonly id: string;
  readonly heartbeatAgeMs?: number;
  readonly tokenDelta?: number;
  readonly traffic?: number;
  readonly expected: "stalled" | "progressing" | "absent";
};

export type CorroborationHeartbeat = "absent" | "below" | "at" | "above";
export type CorroborationCount = "absent" | "positive" | "zero";

const heartbeatValue = (state: CorroborationHeartbeat): number | undefined => {
  if (state === "absent") return undefined;
  if (state === "below") return BOUND - 1;
  if (state === "at") return BOUND;
  return BOUND + 1;
};

const countValue = (state: CorroborationCount): number | undefined => {
  if (state === "absent") return undefined;
  return state === "positive" ? 3 : 0;
};

/** The full present-signal combination matrix plus the bound-1/bound/bound+1 rows. */
export const CORROBORATION_CASES: readonly CorroborationCase[] = [
  ...(["absent", "below", "at", "above"] as const).flatMap((heartbeat) =>
    (["absent", "positive", "zero"] as const).flatMap((delta) =>
      (["absent", "positive", "zero"] as const).map((traffic) => {
        const heartbeatAgeMs = heartbeatValue(heartbeat);
        const tokenDelta = countValue(delta);
        const trafficValue = countValue(traffic);
        const present = [heartbeatAgeMs, tokenDelta, trafficValue].filter(
          (value) => typeof value === "number",
        ).length;
        const stalled =
          typeof heartbeatAgeMs === "number" &&
          heartbeatAgeMs >= BOUND &&
          tokenDelta === 0 &&
          trafficValue === 0;
        return {
          id: `corroboration-${heartbeat}-${delta}-${traffic}`,
          ...(heartbeatAgeMs === undefined ? {} : { heartbeatAgeMs }),
          ...(tokenDelta === undefined ? {} : { tokenDelta }),
          ...(trafficValue === undefined ? {} : { traffic: trafficValue }),
          expected:
            present === 0
              ? ("absent" as const)
              : stalled
                ? ("stalled" as const)
                : ("progressing" as const),
        };
      }),
    ),
  ),
  {
    id: "corroboration-bound-minus-one",
    heartbeatAgeMs: BOUND - 1,
    tokenDelta: 0,
    traffic: 0,
    expected: "progressing",
  },
  {
    id: "corroboration-bound-exact",
    heartbeatAgeMs: BOUND,
    tokenDelta: 0,
    traffic: 0,
    expected: "stalled",
  },
  {
    id: "corroboration-bound-plus-one",
    heartbeatAgeMs: BOUND + 1,
    tokenDelta: 0,
    traffic: 0,
    expected: "stalled",
  },
];

/** The four precedence cells: budget state x economics classification. */
export type ResumePrecedenceCell =
  | "within-economical"
  | "within-uneconomical"
  | "past-economical"
  | "past-uneconomical";

export type ResumePrecedenceCase = {
  readonly cell: ResumePrecedenceCell;
  readonly restartCount: number;
  readonly bound: number;
  readonly repayTokens: number;
  readonly uniqueProgressTokens: number;
  readonly expectedOutcome: "admit-restart" | "refuse";
  readonly expectedIdentity: string | null;
  readonly expectedExit: number;
  readonly expectedAppends: number;
};

export const RESUME_PRECEDENCE_CASES: readonly ResumePrecedenceCase[] = [
  {
    cell: "within-economical",
    restartCount: 1,
    bound: 3,
    repayTokens: 100,
    uniqueProgressTokens: 400,
    expectedOutcome: "admit-restart",
    expectedIdentity: null,
    expectedExit: 0,
    expectedAppends: 1,
  },
  {
    cell: "within-uneconomical",
    restartCount: 1,
    bound: 3,
    repayTokens: 900,
    uniqueProgressTokens: 100,
    expectedOutcome: "refuse",
    expectedIdentity: "dispatch.resume-uneconomical",
    expectedExit: 1,
    expectedAppends: 0,
  },
  {
    cell: "past-economical",
    restartCount: 3,
    bound: 3,
    repayTokens: 100,
    uniqueProgressTokens: 400,
    expectedOutcome: "refuse",
    expectedIdentity: "dispatch.restart-budget-exceeded",
    expectedExit: 1,
    expectedAppends: 0,
  },
  {
    cell: "past-uneconomical",
    restartCount: 3,
    bound: 3,
    repayTokens: 900,
    uniqueProgressTokens: 100,
    expectedOutcome: "refuse",
    expectedIdentity: "dispatch.restart-budget-exceeded",
    expectedExit: 1,
    expectedAppends: 0,
  },
];

/** One committed restart record; ordinals and figures are fixed per case. */
export const restartRecord = (
  overrides: Partial<EconomicsRestartRecord> & { readonly ordinal: number },
): EconomicsRestartRecord => ({
  schemaId: "delivery.economics.restart.v1",
  workItemRef: "GH-235",
  runId: "run-fixture",
  sessionId: `ses_fixture_${overrides.ordinal}`,
  reason: "session-interrupted",
  repayTokens: { inputTokens: 100, outputTokens: 0 },
  observedUniqueProgressTokens: 400,
  recordedAt: `2026-11-07T00:00:0${Math.min(overrides.ordinal, 9)}Z`,
  ...overrides,
});

/** Amplification fixtures: zero re-pay, one re-pay, three ascending, and a loop. */
export const AMPLIFICATION_FIXTURES = {
  zeroRepay: [
    restartRecord({
      ordinal: 1,
      repayTokens: { inputTokens: 0, outputTokens: 0 },
      observedUniqueProgressTokens: 400,
    }),
  ],
  oneRepay: [
    restartRecord({
      ordinal: 1,
      repayTokens: { inputTokens: 100, outputTokens: 0 },
      observedUniqueProgressTokens: 400,
    }),
  ],
  threeAscending: [
    restartRecord({
      ordinal: 1,
      repayTokens: { inputTokens: 100, outputTokens: 0 },
      observedUniqueProgressTokens: 400,
    }),
    restartRecord({
      ordinal: 2,
      repayTokens: { inputTokens: 200, outputTokens: 0 },
      observedUniqueProgressTokens: 400,
    }),
    restartRecord({
      ordinal: 3,
      repayTokens: { inputTokens: 300, outputTokens: 0 },
      observedUniqueProgressTokens: 400,
    }),
  ],
  loop: [
    restartRecord({
      ordinal: 1,
      repayTokens: { inputTokens: 300, outputTokens: 0 },
      observedUniqueProgressTokens: 100,
    }),
    restartRecord({
      ordinal: 2,
      repayTokens: { inputTokens: 300, outputTokens: 0 },
      observedUniqueProgressTokens: 100,
    }),
    restartRecord({
      ordinal: 3,
      repayTokens: { inputTokens: 300, outputTokens: 0 },
      observedUniqueProgressTokens: 100,
    }),
  ],
} as const;

/** Degraded fixtures: absent re-pay, absent unique progress, and both absent. */
export const DEGRADED_FIXTURES = {
  absentRepay: [
    {
      schemaId: "delivery.economics.restart.v1" as const,
      workItemRef: "GH-235",
      runId: "run-fixture",
      sessionId: "ses_fixture_1",
      ordinal: 1,
      reason: "session-interrupted" as const,
      observedUniqueProgressTokens: 400,
      recordedAt: "2026-11-07T00:00:01Z",
    },
  ],
  absentUniqueProgress: [restartRecord({ ordinal: 1, observedUniqueProgressTokens: null })],
  absentBoth: [
    {
      schemaId: "delivery.economics.restart.v1" as const,
      workItemRef: "GH-235",
      runId: "run-fixture",
      sessionId: "ses_fixture_1",
      ordinal: 1,
      reason: "session-interrupted" as const,
      recordedAt: "2026-11-07T00:00:01Z",
    },
  ],
} as const;

/** One complete session-evidence fixture for the resume compositions. */
export const sessionEvidence = (
  overrides: Partial<EconomicsSessionEvidence> = {},
): EconomicsSessionEvidence => ({
  sessionId: "ses_fixture_1",
  treeRoot: "ses_fixture_1",
  repayTokens: { inputTokens: 100, outputTokens: 0 },
  observedUniqueProgressTokens: 400,
  tokensReadable: true,
  costReadable: true,
  ...overrides,
});

/** The sourced-signal kind a prefill row injects (Phase 4 wiring basis). */
export const sourcedKindsForShape = (
  shape: PrefillSourceShape,
): readonly EconomicsSourcedSignalKind[] =>
  shape === "traffic-only" ? ["token-delta"] : ["heartbeat-age", "token-delta"];

/** A recording in-memory resume store over the data-only port (no I/O). */
export type MemoryResumeStore = {
  readonly port: import("../../../packages/core/src/contracts/index").EconomicsResumeStorePort;
  readonly state: {
    readonly restarts: EconomicsRestartRecord[];
    terminal?: import("../../../packages/core/src/contracts/index").EconomicsExhaustionRecord;
    reads: number;
    appends: number;
    exhaustionAppends: number;
  };
};

export const createMemoryResumeStore = (
  options: {
    readonly restarts?: readonly EconomicsRestartRecord[];
    readonly read?: import("../../../packages/core/src/contracts/index").EconomicsRecordsRead;
    readonly terminal?: import("../../../packages/core/src/contracts/index").EconomicsExhaustionRecord;
  } = {},
): MemoryResumeStore => {
  const state = {
    restarts: [...(options.restarts ?? [])],
    ...(options.terminal === undefined ? {} : { terminal: options.terminal }),
    reads: 0,
    appends: 0,
    exhaustionAppends: 0,
  };
  const port: import("../../../packages/core/src/contracts/index").EconomicsResumeStorePort = {
    readDeliveryRecords: (workItemRef) => {
      state.reads += 1;
      if (options.read !== undefined) return options.read;
      return {
        ok: true,
        workItemRef,
        restarts: [...state.restarts],
        ...(state.terminal === undefined ? {} : { terminal: state.terminal }),
        verifiedEmpty: state.restarts.length === 0,
      };
    },
    appendRestartEvent: (record) => {
      const replay = state.restarts.some(
        (candidate) => candidate.runId === record.runId && candidate.ordinal === record.ordinal,
      );
      if (replay) return { ok: true, appended: false, record };
      state.restarts.push(record);
      state.appends += 1;
      return { ok: true, appended: true, record, sequence: state.restarts.length };
    },
    ensureExhaustionRecord: (record) => {
      if (state.terminal !== undefined) {
        return { ok: true, appended: false, record: state.terminal };
      }
      state.terminal = record;
      state.exhaustionAppends += 1;
      return { ok: true, appended: true, record, sequence: state.restarts.length + 1 };
    },
  };
  return { port, state };
};
