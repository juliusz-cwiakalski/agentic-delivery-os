/**
 * Shared telemetry v2 fixtures (GH-291 test plan §4.1, §6).
 *
 * Every case seeds a per-test temp state store through the delivered append
 * path, so the fold only ever reads records the production writers could have
 * produced. Time, ids, attribution identity, and the harness version are
 * injected literals; no suite reads the ambient clock, environment, network,
 * or the live tree.
 */
import { createOpencodeSession } from "../../../packages/adapters/src/harness/index";
import { createTelemetryIngestSink } from "../../../packages/cli/src/edge";
import {
  ECONOMICS_RESTART_SCHEMA_ID,
  type EconomicsRestartRecord,
  HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
  HARNESS_TOKEN_CLASSES,
  type HarnessCaptureOutcomeRecord,
  type HarnessKind,
  type HarnessTelemetryRecord,
  type HarnessTokenClass,
  type HarnessTokenCounts,
  type StateJsonValue,
  type StateResult,
  type StateStoreIdentity,
  type StateStorePort,
  TELEMETRY_BASELINE_KEY_PREFIX,
  TELEMETRY_BASELINE_RECORD_KIND,
  TELEMETRY_BASELINE_SCHEMA_ID,
  TELEMETRY_STEP_KEY_PREFIX,
  TELEMETRY_STEP_RECORD_KIND,
  TELEMETRY_STEP_SCHEMA_ID,
  TELEMETRY_STORAGE_SCHEMA_VERSION,
  type TelemetryBaselineRecord,
  type TelemetryClaimedIdentity,
  type TelemetryFamiliesRead,
  type TelemetryIngestTally,
  type TelemetrySessionIdentity,
  type TelemetryStepRecord,
  type TelemetryWarning,
  type TelemetryWarningReason,
} from "../../../packages/core/src/contracts/index";
import { computeSpendReport } from "../../../packages/core/src/domain/spend";
import type { TelemetryAttributionSubstrates } from "../../../packages/core/src/domain/telemetry-attribution";
import {
  decodeTelemetryStepFrame,
  emptyIngestTally,
  type TelemetryFrameContext,
  tallyFrame,
} from "../../../packages/core/src/domain/telemetry-ingest";
import {
  appendEconomicsRestartEvent,
  appendHarnessCaptureOutcome,
  appendHarnessTelemetry,
  appendPhaseTransition,
  appendTelemetryBaseline,
  appendTelemetryStep,
  readSpendLedger,
  readTelemetryBaselines,
  readTelemetryFamilies,
  readTelemetrySteps,
  STATE_SCHEMA_VERSION,
  telemetryBaselineKey,
  telemetryStepKey,
} from "../../../packages/core/src/state/index";
import {
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createFakeStreamStarter,
  declaredBuildEnvironment,
  FIXED_NOW,
  HARNESS_COMMAND,
  LIST_ARGS,
  RESUME_ARGS,
  SPAWN_ARGS,
  SPAWN_ENV_DESCRIPTOR,
  type StreamScript,
} from "../harness/harness-io";
import { makeIdentity, makeTempRoot, openStore, removeRoot, withinFence } from "../state/harness";

export { makeIdentity, makeTempRoot, openStore, removeRoot } from "../state/harness";

/** The canonical ref under test and an unrelated control ref. */
export const TELEMETRY_REF = "GH-291";
export const OTHER_REF = "GH-999";

/** The fixed injected clock (2026-11-12T08:00:00Z). */
export const TELEMETRY_NOW_MS = Date.UTC(2026, 10, 12, 8, 0, 0);
export const TELEMETRY_NOW_ISO = "2026-11-12T08:00:00.000Z";

/** Literal transition stamps, deliberately non-sortable as plain numbers. */
export const T0 = "2026-11-12T08:00:00.000Z";
export const T1 = "2026-11-12T08:10:00.000Z";
export const T2 = "2026-11-12T08:25:00.000Z";
export const T3 = "2026-11-12T08:40:00.000Z";
export const T4 = "2026-11-12T09:00:00.000Z";

/** The seeded session and run identities. */
export const SESSION_A = "ses_telemetry_a";
export const SESSION_B = "ses_telemetry_b";
export const RUN_A = "run-telemetry-a";
export const RUN_B = "run-telemetry-b";

/** The claimed attribution identity and the checkout reference. */
export const REPOSITORY = "/work/checkout-a";
export const LANE = "lane-alpha";
export const AGENT_ROLE = "coder";
export const MODEL_A = "model-alpha";
export const MODEL_B = "model-beta";

/** The complete-frame tally of the committed token-bearing capture (I-01). */
export const COMPLETE_TOKENS: HarnessTokenCounts = {
  input: 10,
  output: 20,
  reasoning: 3,
  cacheRead: 40,
  cacheWrite: 5,
};

/** A neutral five-class token set. */
export const ZERO_TOKENS: HarnessTokenCounts = {
  input: 0,
  output: 0,
  reasoning: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

/** Build a five-class token set from a sparse override. */
export const tokens = (
  override: Partial<Record<HarnessTokenClass, number | null>> = {},
): HarnessTokenCounts => ({
  input: override.input === undefined ? 0 : override.input,
  output: override.output === undefined ? 0 : override.output,
  reasoning: override.reasoning === undefined ? 0 : override.reasoning,
  cacheRead: override.cacheRead === undefined ? 0 : override.cacheRead,
  cacheWrite: override.cacheWrite === undefined ? 0 : override.cacheWrite,
});

/** The five-class sum of a token set, excluding null classes (the test oracle). */
export const sumTokens = (counts: HarnessTokenCounts): number =>
  (HARNESS_TOKEN_CLASSES as readonly HarnessTokenClass[]).reduce(
    (sum, key) => sum + (counts[key] ?? 0),
    0,
  );

/** The all-null token set (every class absent at capture). */
export const NULL_TOKENS: HarnessTokenCounts = {
  input: null,
  output: null,
  reasoning: null,
  cacheRead: null,
  cacheWrite: null,
};

export const claimedIdentity = (
  override: Partial<TelemetryClaimedIdentity> = {},
): TelemetryClaimedIdentity => ({
  agentRole: override.agentRole === undefined ? AGENT_ROLE : override.agentRole,
  lane: override.lane === undefined ? LANE : override.lane,
});

/** One step-record input with a deterministic default shape. */
export type StepRecordInput = {
  readonly ref?: string;
  readonly runId?: string;
  readonly sessionId?: string;
  readonly harnessKind?: HarnessKind;
  readonly harnessVersion?: string | null;
  readonly treeRoot?: string | null;
  readonly model?: string | null;
  readonly ticket?: string | null;
  readonly repository?: string | null;
  readonly lane?: string | null;
  readonly agentRole?: string | null;
  readonly tokens?: HarnessTokenCounts;
  readonly calls?: number | null;
  readonly cost?: number | null;
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
  readonly warnings?: readonly TelemetryWarning[];
  readonly capturedAt?: string;
};

/** One step record with deterministic defaults. */
export const makeStepRecord = (input: StepRecordInput = {}): TelemetryStepRecord => ({
  schemaId: TELEMETRY_STEP_SCHEMA_ID,
  storageVersion: TELEMETRY_STORAGE_SCHEMA_VERSION,
  workItemRef: input.ref ?? TELEMETRY_REF,
  runId: input.runId ?? RUN_A,
  sessionId: input.sessionId ?? SESSION_A,
  harnessKind: input.harnessKind ?? "opencode",
  harnessVersion: input.harnessVersion === undefined ? "2.2.5" : input.harnessVersion,
  treeRoot: input.treeRoot === undefined ? "/work/checkout-a" : input.treeRoot,
  model: input.model === undefined ? MODEL_A : input.model,
  ticket: input.ticket === undefined ? (input.ref ?? TELEMETRY_REF) : input.ticket,
  repository: input.repository === undefined ? REPOSITORY : input.repository,
  lane: input.lane === undefined ? LANE : input.lane,
  agentRole: input.agentRole === undefined ? AGENT_ROLE : input.agentRole,
  tokens: input.tokens ?? tokens(),
  calls: input.calls === undefined ? 1 : input.calls,
  cost: input.cost === undefined ? 0.01 : input.cost,
  startedAt: input.startedAt === undefined ? null : input.startedAt,
  finishedAt: input.finishedAt === undefined ? T1 : input.finishedAt,
  warnings: input.warnings ?? [],
  capturedAt: input.capturedAt ?? TELEMETRY_NOW_ISO,
});

/** One baseline-record input with a deterministic default shape. */
export type BaselineRecordInput = {
  readonly ref?: string;
  readonly runId?: string;
  readonly sessionId?: string;
  readonly tokens?: HarnessTokenCounts;
  readonly calls?: number | null;
  readonly cost?: number | null;
  readonly capturedAt?: string;
};

/** One session baseline record with deterministic defaults. */
export const makeBaselineRecord = (input: BaselineRecordInput = {}): TelemetryBaselineRecord => ({
  schemaId: TELEMETRY_BASELINE_SCHEMA_ID,
  storageVersion: TELEMETRY_STORAGE_SCHEMA_VERSION,
  workItemRef: input.ref ?? TELEMETRY_REF,
  runId: input.runId ?? RUN_A,
  sessionId: input.sessionId ?? SESSION_A,
  tokens: input.tokens ?? tokens(),
  calls: input.calls === undefined ? 1 : input.calls,
  cost: input.cost === undefined ? 0.01 : input.cost,
  capturedAt: input.capturedAt ?? TELEMETRY_NOW_ISO,
  warnings: [],
});

/** Seed step records through the delivered append path; failures throw. */
export const seedSteps = (store: StateStorePort, records: readonly TelemetryStepRecord[]): void => {
  for (const [index, record] of records.entries()) {
    const appended = appendTelemetryStep(store, `telemetry-step-${String(index)}`, record);
    if (!appended.ok) throw new Error(`step seed failed: ${appended.error.code}`);
  }
};

/** Seed baseline records through the delivered append path; failures throw. */
export const seedBaselines = (
  store: StateStorePort,
  records: readonly TelemetryBaselineRecord[],
): void => {
  for (const [index, record] of records.entries()) {
    const appended = appendTelemetryBaseline(store, `telemetry-baseline-${String(index)}`, record);
    if (!appended.ok) throw new Error(`baseline seed failed: ${appended.error.code}`);
  }
};

/** Seed delivered v1 closeout-captured session records (the pre-v2 world). */
export const seedV1Records = (
  store: StateStorePort,
  records: readonly HarnessTelemetryRecord[],
): void => {
  for (const [index, record] of records.entries()) {
    const appended = appendHarnessTelemetry(store, `telemetry-v1-${String(index)}`, record);
    if (!appended.ok) throw new Error(`v1 seed failed: ${appended.error.code}`);
  }
};

/** One delivered v1 session-group record with a deterministic default shape. */
export const makeV1Record = (input: {
  readonly ref?: string;
  readonly runId?: string;
  readonly sessionId?: string;
  readonly harnessKind?: HarnessKind;
  readonly agent?: string;
  readonly model?: string;
  readonly tokens?: HarnessTokenCounts;
  readonly calls?: number;
  readonly cost?: number | null;
  readonly capturedAt?: string;
}): HarnessTelemetryRecord => ({
  schemaId: "delivery.harness.telemetry.v1",
  workItemRef: input.ref ?? TELEMETRY_REF,
  runId: input.runId ?? RUN_A,
  sessionId: input.sessionId ?? SESSION_A,
  harnessKind: input.harnessKind ?? "opencode",
  harnessVersion: "2.2.5",
  agent: input.agent ?? AGENT_ROLE,
  model: input.model ?? MODEL_A,
  treeRoot: REPOSITORY,
  parentChain: [],
  tokens: input.tokens ?? tokens(),
  calls: input.calls ?? 1,
  toolCounts: [],
  cost: input.cost === undefined ? null : input.cost,
  capturedAt: input.capturedAt ?? TELEMETRY_NOW_ISO,
  warnings: [],
});

/** One restart record with a deterministic default shape. */
export const makeRestartRecord = (
  input: Partial<EconomicsRestartRecord> & { readonly ordinal: number },
): EconomicsRestartRecord => ({
  schemaId: ECONOMICS_RESTART_SCHEMA_ID,
  workItemRef: input.workItemRef ?? TELEMETRY_REF,
  runId: input.runId ?? RUN_B,
  sessionId: input.sessionId ?? SESSION_B,
  ordinal: input.ordinal,
  reason: input.reason ?? "session-interrupted",
  recordedAt: input.recordedAt ?? T2,
  ...(input.repayTokens === undefined ? {} : { repayTokens: input.repayTokens }),
  ...(input.observedUniqueProgressTokens === undefined
    ? {}
    : { observedUniqueProgressTokens: input.observedUniqueProgressTokens }),
});

/** Seed economics restart events through the delivered append path. */
export const seedRestarts = (
  store: StateStorePort,
  records: readonly EconomicsRestartRecord[],
): void => {
  for (const [index, record] of records.entries()) {
    const appended = appendEconomicsRestartEvent(
      store,
      `telemetry-restart-${String(index)}`,
      record,
    );
    if (!appended.ok) throw new Error(`restart seed failed: ${appended.code}`);
  }
};

/** Seed `phase.transition` history through the delivered registry path. */
export const seedTransitions = (
  store: StateStorePort,
  transitions: readonly {
    readonly phaseId: string;
    readonly operation: "complete" | "reopen";
    readonly timestamp: string;
  }[],
  ref: string = TELEMETRY_REF,
): void => {
  for (const [index, transition] of transitions.entries()) {
    const appended = appendPhaseTransition(store, {
      changeRef: ref,
      phaseId: transition.phaseId,
      operation: transition.operation,
      timestamp: transition.timestamp,
      fenceToken: `telemetry-transition-${String(index)}`,
    });
    if (!appended.ok) throw new Error(`transition seed failed: ${appended.error.code}`);
  }
};

/** One seeded telemetry store: temp root, identity, and store. */
export type TelemetryStoreFixture = {
  readonly root: string;
  readonly store: StateStorePort;
};

/** Open a fresh temp telemetry store under a per-test temp root. */
export const makeTelemetryStore = (label = "telemetry"): TelemetryStoreFixture => {
  const root = makeTempRoot(`gh291-${label}`);
  const identity = makeIdentity(root, { schemaVersion: STATE_SCHEMA_VERSION });
  return { root, store: openStore(identity).store };
};

/** The frame context a decode needs (matches the composed sink's context). */
export const frameContext = (
  override: Partial<TelemetryFrameContext> = {},
): TelemetryFrameContext => ({
  workItemRef: TELEMETRY_REF,
  runId: RUN_A,
  sessionId: SESSION_A,
  harnessKind: "opencode",
  harnessVersion: "2.2.5",
  treeRoot: REPOSITORY,
  repository: REPOSITORY,
  model: MODEL_A,
  claimed: claimedIdentity(),
  capturedAt: TELEMETRY_NOW_ISO,
  ...override,
});

/** Decode + tally one line sequence without touching storage (pure accounting). */
export const tallyLines = (
  lines: readonly string[],
  context: TelemetryFrameContext = frameContext(),
): TelemetryIngestTally => {
  let tally = emptyIngestTally();
  for (const line of lines) {
    const parsed: unknown = JSON.parse(line);
    tally = tallyFrame(tally, decodeTelemetryStepFrame(parsed, context));
  }
  return tally;
};

/** The per-reason count of one tally entry. */
export const reasonCount = (tally: TelemetryIngestTally, reason: TelemetryWarningReason): number =>
  tally.byReason[reason];

/** A recording attribution-substrate pair (the recorded-argument probe). */
export type RecordingSubstrates = {
  readonly substrates: TelemetryAttributionSubstrates;
  readonly calls: readonly string[];
};

/** Build recording substrates answering one session and one claimed identity. */
export const recordingSubstrates = (
  input: {
    readonly session?: TelemetrySessionIdentity;
    readonly claimed?: TelemetryClaimedIdentity;
  } = {},
): RecordingSubstrates => {
  const calls: string[] = [];
  return {
    calls,
    substrates: {
      readSessionIdentity: (sessionId) => {
        calls.push(`session:${sessionId}`);
        return input.session ?? { sessionId, runId: RUN_A };
      },
      readClaimedIdentity: (runId) => {
        calls.push(`claimed:${runId}`);
        return input.claimed ?? claimedIdentity();
      },
    },
  };
};

/** The composed ingest sink over a temp store (the production composition). */
export const ingestSinkOver = (
  store: StateStorePort,
  override: {
    readonly workItemRef?: string;
    readonly runId?: string;
    readonly claimed?: TelemetryClaimedIdentity;
    readonly model?: string | null;
    readonly sessionTotals?: (sessionId: string) =>
      | {
          readonly tokens: HarnessTokenCounts;
          readonly calls: number | null;
          readonly cost: number | null;
        }
      | undefined;
  } = {},
): ReturnType<typeof createTelemetryIngestSink> =>
  createTelemetryIngestSink({
    store,
    workItemRef: override.workItemRef ?? TELEMETRY_REF,
    runId: override.runId ?? RUN_A,
    harnessKind: "opencode",
    harnessVersion: "2.2.5",
    treeRoot: REPOSITORY,
    repository: REPOSITORY,
    claimed: override.claimed ?? claimedIdentity(),
    model: override.model ?? MODEL_A,
    nowIso: () => TELEMETRY_NOW_ISO,
    newFenceToken: () => "telemetry-ingest-fence",
    ...(override.sessionTotals === undefined ? {} : { sessionTotals: override.sessionTotals }),
  });

/** One live ingest run over the delivered streaming seam. */
export type IngestRun = {
  readonly records: readonly TelemetryStepRecord[];
  readonly baselines: readonly TelemetryBaselineRecord[];
  readonly evidence: { readonly completionMarker: boolean; readonly exitStatus: number | null };
};

/** Run the real adapter drain with the composed ingest sink attached. */
export const runIngest = async (
  script: StreamScript,
  store: StateStorePort,
  override: Parameters<typeof ingestSinkOver>[1] = {},
): Promise<IngestRun> => {
  const fake = createFakeStreamStarter(script);
  const port = createOpencodeSession({
    command: HARNESS_COMMAND,
    runner: async () => ({ stdout: "", stderr: "", status: 0, timedOut: false }),
    starter: fake.starter,
    buildEnvironment: declaredBuildEnvironment(createFakeCredentialPort()),
    classify: classifier,
    assembleLiveness,
    now: () => FIXED_NOW,
    spawnArgs: SPAWN_ARGS,
    resumeArgs: RESUME_ARGS,
    listArgs: LIST_ARGS,
    telemetrySinkFor: () => ingestSinkOver(store, override),
  });
  const spawned = await port.spawn({
    workItemRef: TELEMETRY_REF,
    prompt: "Deliver change GH-291.",
    descriptor: SPAWN_ENV_DESCRIPTOR,
  });
  if (!spawned.ok) throw new Error(`spawn failed: ${spawned.error.code}`);
  const collected = await port.collect({ handle: spawned.value });
  if (!collected.ok) throw new Error(`collect failed: ${collected.error.code}`);
  const steps = readTelemetrySteps(store, override.workItemRef ?? TELEMETRY_REF);
  const baselines = readTelemetryBaselines(store, override.workItemRef ?? TELEMETRY_REF);
  if (!steps.ok) throw new Error(`step read failed: ${steps.error.code}`);
  if (!baselines.ok) throw new Error(`baseline read failed: ${baselines.error.code}`);
  return {
    records: steps.value.records,
    baselines: baselines.value.records,
    evidence: {
      completionMarker: collected.value.completionMarker,
      exitStatus: collected.value.exitStatus,
    },
  };
};

/** One seeded and folded telemetry case (the v2 read side). */
export type TelemetryFoldSeed = {
  readonly steps?: readonly TelemetryStepRecord[];
  readonly baselines?: readonly TelemetryBaselineRecord[];
  readonly v1?: readonly HarnessTelemetryRecord[];
  readonly transitions?: readonly {
    readonly phaseId: string;
    readonly operation: "complete" | "reopen";
    readonly timestamp: string;
  }[];
  readonly restarts?: readonly EconomicsRestartRecord[];
  readonly ref?: string;
};

/** Seed a fresh temp store through the delivered paths, then read and fold. */
export const foldTelemetryStore = (seed: TelemetryFoldSeed, label = "fold") => {
  const fixture = makeTelemetryStore(label);
  seedSteps(fixture.store, seed.steps ?? []);
  seedBaselines(fixture.store, seed.baselines ?? []);
  seedV1Records(fixture.store, seed.v1 ?? []);
  seedTransitions(fixture.store, seed.transitions ?? [], seed.ref ?? TELEMETRY_REF);
  seedRestarts(fixture.store, seed.restarts ?? []);
  const ref = seed.ref ?? TELEMETRY_REF;
  const read = readSpendLedger(fixture.store, ref);
  const fold = read.ok ? computeSpendReport(read.value, { workItemRef: ref }) : undefined;
  return { root: fixture.root, store: fixture.store, read, fold };
};

// ---------------------------------------------------------------------------
// GH-381 multi-ref fixtures (TC-TELEMETRY-040..047; fixture inventory FX-1..FX-7)
//
// Every healthy record is one the production writers could have produced: the
// seeded shapes are the delivered builders' shapes, and every raw batch append
// below emits exactly the delivered writer's payload, kind, and key inside one
// fence — the delivered scale-batch technique
// (tests/fixtures/supervise/records.ts seedLaneBatch). Only the deliberately
// broken shapes (bare prefixes, cross-family kinds, garbage payloads) are raw
// appended, with valid framing and checksums so the verified read admits them
// and the projection's classification is what is under test.
// ---------------------------------------------------------------------------

/** The requested ref of the GH-381 fixtures: the ref every read answers. */
export const GH381_REF = "GH-381";
/** The foreign ref of the GH-381 fixtures: the earlier change whose valid step record tore the observed read. */
export const GH381_FOREIGN_REF = "GH-365";
/** A ref absent from every GH-381 fixture: the verified-empty and any-ref arms. */
export const GH381_ABSENT_REF = "GH-000";

const gh381RunId = (ref: string): string => `run-gh381-${ref}`;

/** One distinct healthy step record of a GH-381 fixture ref (1-based index). */
const gh381Step = (ref: string, index: number): TelemetryStepRecord =>
  makeStepRecord({
    ref,
    runId: gh381RunId(ref),
    sessionId: `ses-gh381-${ref}-s${String(index)}`,
    tokens: tokens({ input: 10 * index, output: 5 * index }),
    calls: index,
    cost: 0.25 * index,
    capturedAt: T1,
  });

/** The one healthy baseline record of a GH-381 fixture ref. */
const gh381Baseline = (ref: string): TelemetryBaselineRecord =>
  makeBaselineRecord({
    ref,
    runId: gh381RunId(ref),
    sessionId: `ses-gh381-${ref}-baseline`,
    tokens: tokens({ input: 100, output: 50 }),
    calls: 2,
    cost: 1.5,
    capturedAt: T2,
  });

/** The one healthy v1 session record of a GH-381 fixture ref. */
const gh381V1 = (ref: string): HarnessTelemetryRecord =>
  makeV1Record({
    ref,
    runId: gh381RunId(ref),
    sessionId: `ses-gh381-${ref}-v1`,
    tokens: tokens({ input: 40, output: 20 }),
    calls: 2,
    cost: 1,
  });

/** The one healthy capture-outcome record of a GH-381 fixture ref. */
const gh381Outcome = (ref: string): HarnessCaptureOutcomeRecord => ({
  schemaId: HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
  workItemRef: ref,
  runId: gh381RunId(ref),
  captured: 1,
  degraded: 0,
  failed: 0,
  warnings: [],
  capturedAt: T3,
});

/** The delivered step payload shape: field-for-field what the delivered writer emits. */
const gh381StepPayload = (record: TelemetryStepRecord) =>
  ({
    schemaId: record.schemaId,
    storageVersion: record.storageVersion,
    workItemRef: record.workItemRef,
    runId: record.runId,
    sessionId: record.sessionId,
    harnessKind: record.harnessKind,
    harnessVersion: record.harnessVersion,
    treeRoot: record.treeRoot,
    model: record.model,
    ticket: record.ticket,
    repository: record.repository,
    lane: record.lane,
    agentRole: record.agentRole,
    tokens: {
      input: record.tokens.input,
      output: record.tokens.output,
      reasoning: record.tokens.reasoning,
      cacheRead: record.tokens.cacheRead,
      cacheWrite: record.tokens.cacheWrite,
    },
    calls: record.calls,
    cost: record.cost,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    warnings: record.warnings.map((warning) => ({ reason: warning.reason, field: warning.field })),
    capturedAt: record.capturedAt,
  }) satisfies StateJsonValue;

/** The delivered baseline payload shape: field-for-field what the delivered writer emits. */
const gh381BaselinePayload = (record: TelemetryBaselineRecord) =>
  ({
    schemaId: record.schemaId,
    storageVersion: record.storageVersion,
    workItemRef: record.workItemRef,
    runId: record.runId,
    sessionId: record.sessionId,
    tokens: {
      input: record.tokens.input,
      output: record.tokens.output,
      reasoning: record.tokens.reasoning,
      cacheRead: record.tokens.cacheRead,
      cacheWrite: record.tokens.cacheWrite,
    },
    calls: record.calls,
    cost: record.cost,
    capturedAt: record.capturedAt,
    warnings: record.warnings.map((warning) => ({ reason: warning.reason, field: warning.field })),
  }) satisfies StateJsonValue;

/**
 * Batch-append step records in one fence through the delivered record seam.
 *
 * `appendTelemetryStep` is itself correct here, but the observed-scale fixture
 * seeds thousands of records and one fence keeps the fixture to a single fence
 * cycle at the delivered record shape (the delivered batch technique).
 */
export const seedStepBatch = (
  store: StateStorePort,
  records: readonly TelemetryStepRecord[],
): void => {
  withinFence(store, "gh381-step-batch", (handle) => {
    for (const record of records) {
      const appended = store.append(handle, {
        kind: TELEMETRY_STEP_RECORD_KIND,
        recordKey: telemetryStepKey(record.workItemRef),
        payload: gh381StepPayload(record),
      });
      if (!appended.ok) throw new Error(`gh381 step batch seed failed: ${appended.error.code}`);
    }
  });
};

/**
 * Batch-append baseline records in one fence through the delivered record seam.
 *
 * The delivered `appendTelemetryBaseline` cannot seed a second ref's baseline
 * into a multi-ref ledger: its idempotency pre-read is one of the same-family
 * reads that tear on a foreign baseline key, and that read stays exactly as
 * delivered (out of scope, spec DEC-3). The raw append emits the delivered
 * writer's exact payload, kind, and key, so the stored record is byte-identical
 * to what the delivered helper would have written — only the pre-read is
 * bypassed, and only where two refs must share one ledger.
 */
export const seedBaselineBatch = (
  store: StateStorePort,
  records: readonly TelemetryBaselineRecord[],
): void => {
  withinFence(store, "gh381-baseline-batch", (handle) => {
    for (const record of records) {
      const appended = store.append(handle, {
        kind: TELEMETRY_BASELINE_RECORD_KIND,
        recordKey: telemetryBaselineKey(record.workItemRef),
        payload: gh381BaselinePayload(record),
      });
      if (!appended.ok) throw new Error(`gh381 baseline batch seed failed: ${appended.error.code}`);
    }
  });
};

/** Seed capture-outcome records through the delivered append path; failures throw. */
export const seedCaptureOutcomes = (
  store: StateStorePort,
  records: readonly HarnessCaptureOutcomeRecord[],
): void => {
  for (const [index, record] of records.entries()) {
    const appended = appendHarnessCaptureOutcome(store, `gh381-outcome-${String(index)}`, record);
    if (!appended.ok) throw new Error(`gh381 outcome seed failed: ${appended.error.code}`);
  }
};

/** Seed one ref's full telemetry family set: two steps, one baseline, one v1 session, one outcome. */
export const seedRefFamilies = (store: StateStorePort, ref: string): void => {
  seedSteps(store, [gh381Step(ref, 1), gh381Step(ref, 2)]);
  seedBaselineBatch(store, [gh381Baseline(ref)]);
  seedV1Records(store, [gh381V1(ref)]);
  seedCaptureOutcomes(store, [gh381Outcome(ref)]);
};

/**
 * FX-1: two refs' full family sets interleaved in ledger order, `first` leading.
 *
 * Ledger order: first.s1, second.s1, first.s2, second.s2, first.baseline,
 * second.baseline, first.v1, second.v1, first.outcome, second.outcome — ten
 * records, every family of every ref present, both read directions covered by
 * swapping the arguments.
 */
export const seedInterleavedFamilies = (
  store: StateStorePort,
  first: string,
  second: string,
): void => {
  seedSteps(store, [gh381Step(first, 1), gh381Step(second, 1)]);
  seedSteps(store, [gh381Step(first, 2), gh381Step(second, 2)]);
  seedBaselineBatch(store, [gh381Baseline(first), gh381Baseline(second)]);
  seedV1Records(store, [gh381V1(first), gh381V1(second)]);
  seedCaptureOutcomes(store, [gh381Outcome(first), gh381Outcome(second)]);
};

/**
 * FX-2: the observed record-3786 shape — the ledger's first telemetry-family
 * records are valid steps of the earlier foreign ref, appearing before the
 * requested ref's first record, followed by the requested ref's families.
 */
export const seedForeignFirstRegression = (
  store: StateStorePort,
  requested: string,
  foreign: string,
): void => {
  seedSteps(store, [
    gh381Step(foreign, 1),
    gh381Step(foreign, 2),
    gh381Step(foreign, 3),
    gh381Step(requested, 1),
  ]);
  seedBaselineBatch(store, [gh381Baseline(requested)]);
  seedV1Records(store, [gh381V1(requested)]);
  seedCaptureOutcomes(store, [gh381Outcome(requested)]);
};

/** The observed-scale fixture's requested-ref step count. */
export const GH381_SCALE_REQUESTED_STEPS = 800;
/** The observed-scale fixture's foreign steps per requested step (incident-like proportions). */
export const GH381_SCALE_FOREIGN_PER_REQUESTED = 5;
/** The observed-scale ledger's total record count (steps interleaved plus both refs' families). */
export const GH381_SCALE_TOTAL_RECORDS =
  GH381_SCALE_REQUESTED_STEPS * (1 + GH381_SCALE_FOREIGN_PER_REQUESTED) + 6;

/**
 * FX-6: the observed ledger scale — ≥ 4,800 records, two refs mixed throughout
 * in incident-like proportions (a long earlier change's steps interleaved with
 * the requested ref's records), plus both refs' remaining families.
 */
export const seedObservedScaleLedger = (
  store: StateStorePort,
  requested: string,
  foreign: string,
): void => {
  const interleaved: TelemetryStepRecord[] = [];
  for (let index = 1; index <= GH381_SCALE_REQUESTED_STEPS; index += 1) {
    for (
      let foreignIndex = 0;
      foreignIndex < GH381_SCALE_FOREIGN_PER_REQUESTED;
      foreignIndex += 1
    ) {
      interleaved.push(
        gh381Step(foreign, index * GH381_SCALE_FOREIGN_PER_REQUESTED + foreignIndex),
      );
    }
    interleaved.push(gh381Step(requested, index));
  }
  seedStepBatch(store, interleaved);
  seedBaselineBatch(store, [gh381Baseline(requested), gh381Baseline(foreign)]);
  seedV1Records(store, [gh381V1(requested), gh381V1(foreign)]);
  seedCaptureOutcomes(store, [gh381Outcome(requested), gh381Outcome(foreign)]);
};

/** The telemetry family whose key grammar an arm exercises. */
export type Gh381FamilyName = "step" | "baseline";

/** The 1-based ledger sequence the next append will land at. */
const gh381NextSequence = (store: StateStorePort): number => {
  const read = store.readRecords();
  if (!read.ok) throw new Error(`gh381 sequence probe failed: ${read.error.code}`);
  return read.value.records.length + 1;
};

const gh381AppendRaw = (
  store: StateStorePort,
  token: string,
  request: {
    readonly kind: string;
    readonly recordKey: string;
    readonly payload: StateJsonValue;
  },
): void => {
  withinFence(store, token, (handle) => {
    const appended = store.append(handle, request);
    if (!appended.ok) throw new Error(`gh381 raw seed failed: ${appended.error.code}`);
  });
};

/**
 * FX-3: append the bare family prefix — the family prefix with an empty ref
 * remainder — carrying the family's own record kind (the realistic writer-bug
 * shape) with valid framing and checksums. Returns the record's 1-based ledger
 * sequence, the position the delivered tear must name.
 */
export const seedBarePrefixRecord = (store: StateStorePort, family: Gh381FamilyName): number => {
  const sequence = gh381NextSequence(store);
  gh381AppendRaw(
    store,
    `gh381-bare-${family}`,
    family === "step"
      ? {
          kind: TELEMETRY_STEP_RECORD_KIND,
          recordKey: TELEMETRY_STEP_KEY_PREFIX,
          payload: gh381StepPayload(gh381Step(GH381_REF, 1)),
        }
      : {
          kind: TELEMETRY_BASELINE_RECORD_KIND,
          recordKey: TELEMETRY_BASELINE_KEY_PREFIX,
          payload: gh381BaselinePayload(gh381Baseline(GH381_REF)),
        },
  );
  return sequence;
};

/** The requested-ref damage arms of FX-4. */
export type Gh381RequestedDamageArm =
  | "stepKindMismatch"
  | "baselineKindMismatch"
  | "stepMalformedPayload";

/**
 * FX-4: append one requested-ref damage arm under the ref's own key with valid
 * framing and checksums, at a known sequence. The malformed-payload arm is the
 * delivered malformed precedent — a schema-valid frame with a non-integer token
 * class. Returns the record's 1-based ledger sequence.
 */
export const seedRequestedRefDamage = (
  store: StateStorePort,
  ref: string,
  arm: Gh381RequestedDamageArm,
): number => {
  const sequence = gh381NextSequence(store);
  gh381AppendRaw(
    store,
    `gh381-damage-${arm}`,
    arm === "stepKindMismatch"
      ? {
          kind: "harness.telemetry.unknown",
          recordKey: telemetryStepKey(ref),
          payload: { schemaId: TELEMETRY_STEP_SCHEMA_ID, marker: "canary" },
        }
      : arm === "baselineKindMismatch"
        ? {
            kind: TELEMETRY_STEP_RECORD_KIND,
            recordKey: telemetryBaselineKey(ref),
            payload: { schemaId: TELEMETRY_BASELINE_SCHEMA_ID },
          }
        : {
            kind: TELEMETRY_STEP_RECORD_KIND,
            recordKey: telemetryStepKey(ref),
            payload: {
              ...gh381StepPayload(gh381Step(ref, 1)),
              tokens: { input: 1.5, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
            },
          },
  );
  return sequence;
};

/**
 * TC-TELEMETRY-044: append a foreign family record that deliberately carries
 * the wrong kind for its family and a garbage payload no family schema would
 * validate. The ledger stays verifier-clean — framing, sequence, and checksum
 * are valid — so reading the owning ref tears at the kind inspection while
 * reading any other ref must skip the record without any inspection.
 * Returns the record's 1-based ledger sequence.
 */
export const seedForeignFamilyDamage = (
  store: StateStorePort,
  foreign: string,
  family: Gh381FamilyName,
): number => {
  const sequence = gh381NextSequence(store);
  gh381AppendRaw(
    store,
    `gh381-foreign-damage-${family}`,
    family === "step"
      ? {
          kind: TELEMETRY_BASELINE_RECORD_KIND,
          recordKey: telemetryStepKey(foreign),
          payload: { schemaId: TELEMETRY_BASELINE_SCHEMA_ID, garbage: "not-a-valid-payload" },
        }
      : {
          kind: TELEMETRY_STEP_RECORD_KIND,
          recordKey: telemetryBaselineKey(foreign),
          payload: { schemaId: TELEMETRY_STEP_SCHEMA_ID, garbage: "not-a-valid-payload" },
        },
  );
  return sequence;
};

/** One FX-5 golden arm: the store identity plus the families read over it. */
export type Gh381GoldenCase = {
  readonly identity: StateStoreIdentity;
  readonly read: StateResult<TelemetryFamiliesRead>;
};

export type Gh381GoldenCases = {
  readonly healthy: Gh381GoldenCase;
  readonly emptyLedger: Gh381GoldenCase;
  readonly tears: {
    readonly bareStepPrefix: Gh381GoldenCase;
    readonly bareBaselinePrefix: Gh381GoldenCase;
    readonly stepKindMismatch: Gh381GoldenCase;
    readonly baselineKindMismatch: Gh381GoldenCase;
    readonly stepMalformedPayload: Gh381GoldenCase;
  };
  /** Remove every temp root the cases created. */
  readonly dispose: () => void;
};

/**
 * Build every FX-5 golden arm: the healthy single-ref ledger, the verified-empty
 * ledger, and each delivered tear case, each in its own per-test temp root
 * through the shared builders, so the capture entry and the TC-TELEMETRY-046
 * comparison build byte-identical fixtures.
 *
 * The verified-empty arm is the truly empty ledger: delivered behavior for a
 * ref with no telemetry is identical pre- and post-fix only there. An absent
 * ref over a ledger holding another ref's families tears pre-fix — that shape
 * is the defect itself, so it belongs to the multi-ref matrix (TC-TELEMETRY-040),
 * never to this golden.
 */
export const buildGh381GoldenCases = (): Gh381GoldenCases => {
  const roots: string[] = [];
  const caseOf = (
    label: string,
    build: (store: StateStorePort) => void,
    ref: string,
  ): Gh381GoldenCase => {
    const root = makeTempRoot(`gh381-golden-${label}`);
    roots.push(root);
    const identity = makeIdentity(root);
    const { store } = openStore(identity);
    build(store);
    return { identity, read: readTelemetryFamilies(store, ref) };
  };
  const seeded = (store: StateStorePort): void => {
    seedRefFamilies(store, GH381_REF);
  };
  return {
    healthy: caseOf("healthy", seeded, GH381_REF),
    emptyLedger: caseOf("empty-ledger", () => undefined, GH381_REF),
    tears: {
      bareStepPrefix: caseOf(
        "bare-step",
        (store) => {
          seeded(store);
          seedBarePrefixRecord(store, "step");
        },
        GH381_REF,
      ),
      bareBaselinePrefix: caseOf(
        "bare-baseline",
        (store) => {
          seeded(store);
          seedBarePrefixRecord(store, "baseline");
        },
        GH381_REF,
      ),
      stepKindMismatch: caseOf(
        "step-kind",
        (store) => {
          seeded(store);
          seedRequestedRefDamage(store, GH381_REF, "stepKindMismatch");
        },
        GH381_REF,
      ),
      baselineKindMismatch: caseOf(
        "baseline-kind",
        (store) => {
          seeded(store);
          seedRequestedRefDamage(store, GH381_REF, "baselineKindMismatch");
        },
        GH381_REF,
      ),
      stepMalformedPayload: caseOf(
        "step-payload",
        (store) => {
          seeded(store);
          seedRequestedRefDamage(store, GH381_REF, "stepMalformedPayload");
        },
        GH381_REF,
      ),
    },
    dispose: () => {
      for (const root of roots.splice(0)) removeRoot(root);
    },
  };
};

/** Replace the per-run temp state directory with a stable placeholder (golden normalization). */
export const normalizeGh381StorePath = (identity: StateStoreIdentity, storePath: string): string =>
  storePath.split(identity.stateDirectory).join("<stateDirectory>");

/** The normalized single-ref read result the golden pins (no absolute paths). */
export type Gh381NormalizedRead = {
  readonly steps: readonly TelemetryStepRecord[];
  readonly baselines: readonly TelemetryBaselineRecord[];
  readonly records: readonly HarnessTelemetryRecord[];
  readonly outcomes: readonly HarnessCaptureOutcomeRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string; readonly recordCount: number };
};

/** The normalized tear identity and location the golden pins (no absolute paths). */
export type Gh381NormalizedTear = {
  readonly kind: "state";
  readonly code: "state.store.torn";
  readonly consequence: "not_landed";
  readonly location: { readonly path: string; readonly record: number };
};

/** Normalize a successful families read for golden comparison; throws when it failed. */
export const normalizeGh381Read = (
  identity: StateStoreIdentity,
  read: StateResult<TelemetryFamiliesRead>,
): Gh381NormalizedRead => {
  if (!read.ok) throw new Error(`golden read arm failed: ${read.error.code}`);
  return {
    steps: read.value.steps,
    baselines: read.value.baselines,
    records: read.value.records,
    outcomes: read.value.outcomes,
    verifiedEmpty: read.value.verifiedEmpty,
    evidence: {
      storePath: normalizeGh381StorePath(identity, read.value.evidence.storePath),
      recordCount: read.value.evidence.recordCount,
    },
  };
};

/** Normalize a torn families read for golden comparison; throws when it succeeded. */
export const normalizeGh381Tear = (
  identity: StateStoreIdentity,
  read: StateResult<TelemetryFamiliesRead>,
): Gh381NormalizedTear => {
  if (read.ok) throw new Error("golden tear arm unexpectedly succeeded");
  if (read.error.location.record === undefined) {
    throw new Error("golden tear arm carries no record location");
  }
  return {
    kind: read.error.kind,
    code: read.error.code,
    consequence: read.error.consequence,
    location: {
      path: normalizeGh381StorePath(identity, read.error.location.path),
      record: read.error.location.record,
    },
  };
};
