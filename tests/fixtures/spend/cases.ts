/**
 * The amplification oracle matrix A-01..A-11 and the read/damage matrix
 * R-01..R-10 as committed case definitions (test plan §4.3, §4.5).
 *
 * Every expected figure is a hand-written constant derived from the case's own
 * record definition — never by calling the production fold. The suites compare
 * the engine output against these constants.
 */
import type { HarnessTokenCounts } from "../../../packages/core/src/contracts/index";
import {
  makeOutcomeRecord,
  makeSessionRecord,
  NULL_TOKENS,
  SPEND_REF,
  type SpendSeed,
  threeGroupRun,
  tokens,
} from "./harness";
import { T0 } from "./transitions";

const HOUR = 3_600_000;
const at = (offsetMs: number): string => new Date(Date.parse(T0) + offsetMs).toISOString();

/** One record-bearing run carrying all its spend in one session group. */
const runRecord = (runId: string, capturedAt: string, amount: number, ref = SPEND_REF) =>
  makeSessionRecord({
    ref,
    runId,
    capturedAt,
    tokens: tokens({ input: amount }),
    calls: 1,
  });

export type ExpectedEvent = {
  readonly cause: "restart-loop prefill re-pay";
  readonly window: { readonly start: string; readonly end: string };
  readonly tokensWasted: number;
};

export type AmplificationCase = {
  readonly id: string;
  readonly seed: SpendSeed;
  readonly paid: number;
  readonly progress: number | null;
  readonly progressRun: string | null;
  readonly restarts: number;
  readonly events: readonly ExpectedEvent[];
  readonly tokensByClass?: HarnessTokenCounts;
};

const A01_RECORDS = threeGroupRun({
  runId: "run-R1",
  capturedAt: at(HOUR),
  tokensByGroup: [
    tokens({ input: 100, output: 40, reasoning: 5, cacheRead: 2, cacheWrite: 1 }),
    tokens({ input: 20, output: 10, reasoning: 2 }),
    tokens({ input: 3, output: 2 }),
  ],
  calls: [2, 1, 1],
});

/** A-01 — one record-bearing run, five-class sum 185, calls 4. */
export const A01: AmplificationCase = {
  id: "A-01",
  seed: {
    records: A01_RECORDS,
    transitions: [{ phaseId: "clarify_scope", operation: "complete", timestamp: T0 }],
  },
  paid: 185,
  progress: 185,
  progressRun: null,
  restarts: 0,
  events: [],
  tokensByClass: tokens({ input: 123, output: 52, reasoning: 7, cacheRead: 2, cacheWrite: 1 }),
};

const A02_R1 = runRecord("R1", at(HOUR), 5_000_000);
const A02_R2 = runRecord("R2", at(2 * HOUR), 3_000_000);
const A02_R3 = runRecord("R3", at(3 * HOUR), 2_000_000);
const A02_R4 = runRecord("R4", at(4 * HOUR), 1_200_000);
const A02_RECORDS = [A02_R1, A02_R2, A02_R3, A02_R4];

/** A-02 — four record-bearing runs; paid 11.2M, progress 1.2M. */
export const A02: AmplificationCase = {
  id: "A-02",
  seed: {
    records: A02_RECORDS,
    transitions: [{ phaseId: "clarify_scope", operation: "complete", timestamp: T0 }],
  },
  paid: 11_200_000,
  progress: 1_200_000,
  progressRun: null,
  restarts: 3,
  events: [
    {
      cause: "restart-loop prefill re-pay",
      window: { start: T0, end: at(HOUR) },
      tokensWasted: 5_000_000,
    },
    {
      cause: "restart-loop prefill re-pay",
      window: { start: at(HOUR), end: at(2 * HOUR) },
      tokensWasted: 3_000_000,
    },
    {
      cause: "restart-loop prefill re-pay",
      window: { start: at(2 * HOUR), end: at(3 * HOUR) },
      tokensWasted: 2_000_000,
    },
  ],
};

const A03_ALPHA = runRecord("run-alpha", at(2 * HOUR), 100);
const A03_ZETA = runRecord("run-zeta", at(2 * HOUR), 300);

/** A-03 — identical stamps; the ascending run id wins the progress slot. */
export const A03: AmplificationCase = {
  id: "A-03",
  seed: { records: [A03_ALPHA, A03_ZETA], transitions: [] },
  paid: 400,
  progress: 100,
  progressRun: null,
  restarts: 1,
  events: [
    {
      cause: "restart-loop prefill re-pay",
      window: { start: at(2 * HOUR), end: at(2 * HOUR) },
      tokensWasted: 300,
    },
  ],
};

/** A-04 — R1 400 tokens, R2 latest with every class zero. */
export const A04: AmplificationCase = {
  id: "A-04",
  seed: {
    records: [
      runRecord("run-R1", at(HOUR), 400),
      makeSessionRecord({ runId: "run-R2", capturedAt: at(2 * HOUR), tokens: tokens(), calls: 1 }),
    ],
    transitions: [],
  },
  paid: 400,
  progress: 0,
  progressRun: "run-R2",
  restarts: 1,
  events: [
    {
      cause: "restart-loop prefill re-pay",
      window: { start: at(HOUR), end: at(2 * HOUR) },
      tokensWasted: 400,
    },
  ],
};

const A05_RECORDS = [
  makeSessionRecord({
    runId: "run-R1",
    capturedAt: at(HOUR),
    tokens: NULL_TOKENS,
    calls: 1,
    warnings: [{ reason: "optional-field-absent", field: "tokens.reasoning" }],
  }),
  makeSessionRecord({
    runId: "run-R2",
    capturedAt: at(2 * HOUR),
    tokens: NULL_TOKENS,
    calls: 1,
    warnings: [{ reason: "optional-field-absent", field: "tokens.reasoning" }],
  }),
];

/** A-05 — the degenerate all-null case: paid 0 and progress 0, records exist. */
export const A05: AmplificationCase = {
  id: "A-05",
  seed: { records: A05_RECORDS, transitions: [] },
  paid: 0,
  progress: 0,
  progressRun: "run-R2",
  restarts: 1,
  events: [],
};

/** A-06 — a capture-outcome-only run joins the restart union, adds no paid. */
export const A06: AmplificationCase = {
  id: "A-06",
  seed: {
    records: [runRecord("run-R1", at(HOUR), 500), runRecord("run-R2", at(2 * HOUR), 300)],
    outcomes: [makeOutcomeRecord({ runId: "run-R3", capturedAt: at(3 * HOUR) })],
    transitions: [],
  },
  paid: 800,
  progress: 300,
  progressRun: null,
  restarts: 2,
  events: [
    {
      cause: "restart-loop prefill re-pay",
      window: { start: at(HOUR), end: at(2 * HOUR) },
      tokensWasted: 500,
    },
  ],
};

/** A-07 — a superseded zero-spend run counts toward restarts but raises no event. */
export const A07: AmplificationCase = {
  id: "A-07",
  seed: {
    records: [
      runRecord("run-R1", at(HOUR), 500),
      makeSessionRecord({ runId: "run-R2", capturedAt: at(2 * HOUR), tokens: tokens(), calls: 1 }),
      runRecord("run-R3", at(3 * HOUR), 700),
    ],
    transitions: [],
  },
  paid: 1200,
  progress: 700,
  progressRun: null,
  restarts: 2,
  events: [
    {
      cause: "restart-loop prefill re-pay",
      window: { start: at(HOUR), end: at(2 * HOUR) },
      tokensWasted: 500,
    },
  ],
};

/** A-08 — the same run identity in both families counts once. */
export const A08: AmplificationCase = {
  id: "A-08",
  seed: {
    records: [runRecord("run-R1", at(HOUR), 250)],
    outcomes: [makeOutcomeRecord({ runId: "run-R1", capturedAt: at(HOUR) })],
    transitions: [],
  },
  paid: 250,
  progress: 250,
  progressRun: null,
  restarts: 0,
  events: [],
};

/** A-11 — a capture-outcome-only store: no record-bearing run exists. */
export const A11: AmplificationCase = {
  id: "A-11",
  seed: {
    records: [],
    outcomes: [makeOutcomeRecord({ runId: "run-only", capturedAt: at(HOUR) })],
    transitions: [],
  },
  paid: 0,
  progress: null,
  progressRun: null,
  restarts: 0,
  events: [],
};

export const AMPLIFICATION_CASES: readonly AmplificationCase[] = [
  A01,
  A02,
  A03,
  A04,
  A05,
  A06,
  A07,
  A08,
  A11,
];

/** A-10 — A-02's exact records appended in a shuffled order. */
export const A10_RECORDS = [A02_R3, A02_R1, A02_R4, A02_R2];

/** A-09 — an empty store is the classified absence, not a ratio of 1. */
export const A09: SpendSeed = { records: [], outcomes: [], transitions: [] };

export type ReadCase = {
  readonly id: string;
  readonly condition: string;
  readonly expectedCode: string;
  readonly expectedExit: 0 | 1 | 2;
};

/** R-01..R-10 (test plan §4.5): the read, absence and damage matrix. */
export const READ_CASES: readonly ReadCase[] = [
  {
    id: "R-01",
    condition: "verified-empty store",
    expectedCode: "spend.telemetry-absent",
    expectedExit: 1,
  },
  {
    id: "R-02",
    condition: "records exist but none under either telemetry key for the ref",
    expectedCode: "spend.telemetry-absent",
    expectedExit: 1,
  },
  {
    id: "R-03",
    condition: "records exist for a different ref only",
    expectedCode: "spend.telemetry-absent",
    expectedExit: 1,
  },
  {
    id: "R-04",
    condition: "framing tear",
    expectedCode: "state.store.torn",
    expectedExit: 2,
  },
  {
    id: "R-05",
    condition: "schema version mismatch",
    expectedCode: "state.schema.mismatch",
    expectedExit: 2,
  },
  {
    id: "R-06",
    condition: "unknown record kind under a telemetry key prefix",
    expectedCode: "state.store.torn",
    expectedExit: 2,
  },
  {
    id: "R-07",
    condition: "malformed telemetry payload",
    expectedCode: "state.store.torn",
    expectedExit: 2,
  },
  {
    id: "R-08",
    condition: "permission violation on the store path",
    expectedCode: "state.permission.denied",
    expectedExit: 1,
  },
  {
    id: "R-09",
    condition: "corrupt transitions payload",
    expectedCode: "state.keys.missing",
    expectedExit: 2,
  },
  {
    id: "R-10",
    condition: "harness adapter seam reachable but never called",
    expectedCode: "spend.telemetry-absent",
    expectedExit: 1,
  },
];
