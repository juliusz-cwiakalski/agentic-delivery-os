/**
 * Shared telemetry v2 fixtures (GH-291 test plan §4.1, §6).
 *
 * Every case seeds a per-test temp state store through the delivered append
 * path, so the fold only ever reads records the production writers could have
 * produced. Time, ids, attribution identity, and the harness version are
 * injected literals; no suite reads the ambient clock, environment, network,
 * or the live tree.
 */

import { appendFileSync } from "node:fs";
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
  type StateAppendOutcome,
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
import { buildRecord, serializeRecord } from "../../../packages/core/src/state/ledger";
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
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../state/harness";

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
 *
 * The bulk steps land through the delivered ledger core — `buildRecord` and
 * `serializeRecord`, the exact calls the store's own `appendRecord` makes per
 * write — emitted in one pass: the delivered verified write re-verifies the
 * whole ledger on every append, so seeding thousands of records through
 * `store.append` is quadratic (minutes of wall time in every future gate run),
 * while the direct emission keeps every stored record byte-identical to a
 * delivered write. The first record and both refs' remaining families go
 * through the delivered store append, so the root, header, and ledger exist
 * through the delivered path and each later store append re-verifies the
 * direct-written records on the spot. The verified read at test time — the
 * property actually under test — parses, sequences, and checksums every record
 * in one pass regardless of which write path landed it.
 */
export const seedObservedScaleLedger = (
  store: StateStorePort,
  identity: StateStoreIdentity,
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
  // Bootstrap the root, header, and ledger through the delivered store append.
  seedSteps(store, interleaved.slice(0, 1));
  const bootstrap = store.readRecords();
  if (!bootstrap.ok) throw new Error(`gh381 scale seed failed: ${bootstrap.error.code}`);
  let sequence = bootstrap.value.records.length;
  const lines: string[] = [];
  for (const record of interleaved.slice(1)) {
    sequence += 1;
    lines.push(
      serializeRecord(
        buildRecord(
          TELEMETRY_STEP_RECORD_KIND,
          telemetryStepKey(record.workItemRef),
          sequence,
          gh381StepPayload(record),
          identity.schemaVersion,
        ),
      ),
    );
  }
  appendFileSync(ledgerPath(identity), lines.join(""));
  // Both refs' remaining families through the delivered store append; each of
  // these six verified writes also re-verifies the bulk records written above.
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

// ---------------------------------------------------------------------------
// GH-384 multi-ref read fixtures (TC-TELEMETRY-048..056, TC-SPEND-035;
// fixture inventory FX-8, FX-8-WE, FX-9, FX-10, FX-11, FX-12, FX-R1, FX-R2,
// FX-13)
//
// The delivered GH-381 builders extended with the two remaining defect-site
// shapes: the per-ref steps read and the baseline idempotency composition
// path. The seeding discipline is unchanged (spec Appendix D, DEC-3): every
// healthy record lands through the delivered append paths, healthy baselines
// specifically through the real `appendTelemetryBaseline` helper; raw appends
// stay reserved for the delivered damage builders' shapes.
//
// Branch-point guard (readiness finding minor-2, binding): the dual-ref
// healthy-baseline helper calls inside `seedMultiRefStepsFixture` and the
// ref-B captures by `seedSecondRefBaselineFixture` consumers are the defect
// execution itself — against delivered code the second ref's helper call
// tears. Those paths execute only from the read-branch fix onward (phase 2 of
// the GH-384 plan); the phase-1 capture entry (`multi-ref-reads-golden-run.ts`)
// exercises FX-R1, FX-R2, and FX-13 only — all constructible pre-fix — and
// never the dual-ref healthy-baseline seeding.
// ---------------------------------------------------------------------------

/** The requested ref of the GH-384 fixtures: the ref every read answers. */
export const GH384_REF = "GH-384";
/** The foreign ref of the GH-384 fixtures: the earlier change whose records precede the requested ref's. */
export const GH384_FOREIGN_REF = "GH-380";
/** A ref absent from every healthy GH-384 fixture: the absent-ref and third-ref arms. */
export const GH384_ABSENT_REF = "GH-000";

/** The declared zero-spend evidence window for FX-8-WE (park through window end). */
export const GH384_WINDOW_FROM = "2026-11-13T16:55:00.000Z";
/** The declared zero-spend evidence window end (inclusive). */
export const GH384_WINDOW_THROUGH = "2026-11-13T18:05:00.000Z";

const gh384RunId = (ref: string): string => `run-gh384-${ref}`;

/** One distinct healthy step record of a GH-384 fixture ref (1-based index). */
export const gh384Step = (ref: string, index: number): TelemetryStepRecord =>
  makeStepRecord({
    ref,
    runId: gh384RunId(ref),
    sessionId: `ses-gh384-${ref}-s${String(index)}`,
    tokens: tokens({ input: 10 * index, output: 5 * index }),
    calls: index,
    cost: 0.25 * index,
    capturedAt: T1,
  });

/** The one healthy baseline record of a GH-384 fixture ref. */
export const gh384Baseline = (ref: string): TelemetryBaselineRecord =>
  makeBaselineRecord({
    ref,
    runId: gh384RunId(ref),
    sessionId: `ses-gh384-${ref}-baseline`,
    tokens: tokens({ input: 100, output: 50 }),
    calls: 2,
    cost: 1.5,
    capturedAt: T2,
  });

/** The one healthy v1 session record of a GH-384 fixture ref. */
const gh384V1 = (ref: string): HarnessTelemetryRecord =>
  makeV1Record({
    ref,
    runId: gh384RunId(ref),
    sessionId: `ses-gh384-${ref}-v1`,
    tokens: tokens({ input: 40, output: 20 }),
    calls: 2,
    cost: 1,
  });

/** The one healthy capture-outcome record of a GH-384 fixture ref. */
const gh384Outcome = (ref: string): HarnessCaptureOutcomeRecord => ({
  schemaId: HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
  workItemRef: ref,
  runId: gh384RunId(ref),
  captured: 1,
  degraded: 0,
  failed: 0,
  warnings: [],
  capturedAt: T3,
});

/**
 * FX-8: interleaved two-ref steps plus one baseline per ref through the real
 * helper — the genuine multi-ref telemetry ledger (a second-ref baseline
 * seeded beside the first ref's).
 *
 * Ledger order: first.s1, second.s1, first.s2, second.s2, first.baseline,
 * second.baseline — six records; both read directions are covered by swapping
 * the arguments. Post-fix only: see the branch-point guard above.
 */
export const seedMultiRefStepsFixture = (
  store: StateStorePort,
  first: string,
  second: string,
): void => {
  seedSteps(store, [
    gh384Step(first, 1),
    gh384Step(second, 1),
    gh384Step(first, 2),
    gh384Step(second, 2),
  ]);
  seedBaselines(store, [gh384Baseline(first)]);
  seedBaselines(store, [gh384Baseline(second)]);
};

/**
 * FX-9's base: interleaved two-ref steps plus ref A's baseline seeded through
 * the real helper. Ref B's capture — the behavior under test — is the
 * caller's act (its same-identity repeat and its distinct-session append run
 * through the same helper with their own fence tokens). Ref A's seed is
 * constructible pre-fix (no other baseline exists at seed time); the
 * consumer's ref-B helper calls are post-fix only.
 */
export const seedSecondRefBaselineFixture = (
  store: StateStorePort,
  refA: string,
  refB: string,
): void => {
  seedSteps(store, [
    gh384Step(refA, 1),
    gh384Step(refB, 1),
    gh384Step(refA, 2),
    gh384Step(refB, 2),
  ]);
  seedBaselines(store, [gh384Baseline(refA)]);
};

/**
 * FX-8-WE: the attribution-complete window-evidence variant — two refs' steps
 * interleaved with the foreign ref's step record first (the observed shape),
 * every step carrying full attribution (lane equal to its ref, agent role,
 * model, billable call counts) and instants inside and outside the declared
 * window, so a per-ref reading's matched and excluded sets are both
 * populated and a seeded mid-window billable step reads non-zero.
 *
 * Ledger order: foreign.pre-park, requested.pre-park, requested.at-park,
 * foreign.mid-window, requested.mid-window, requested.at-end,
 * requested.post-window — seven step records, no baselines (the window
 * reading composes the steps read only).
 */
export const seedWindowEvidenceLedger = (
  store: StateStorePort,
  requested: string,
  foreign: string,
): void => {
  const at = (ref: string, index: number, instant: string, calls: number): TelemetryStepRecord =>
    makeStepRecord({
      ref,
      runId: gh384RunId(ref),
      sessionId: `ses-gh384-${ref}-we${String(index)}`,
      lane: ref,
      ticket: ref,
      model: MODEL_A,
      agentRole: AGENT_ROLE,
      calls,
      startedAt: instant,
      finishedAt: instant,
      capturedAt: instant,
    });
  seedSteps(store, [
    at(foreign, 1, "2026-11-13T16:50:00.000Z", 3),
    at(requested, 1, "2026-11-13T16:54:00.000Z", 1),
    at(requested, 2, GH384_WINDOW_FROM, 2),
    at(foreign, 2, "2026-11-13T17:30:00.000Z", 4),
    at(requested, 3, "2026-11-13T17:30:00.000Z", 2),
    at(requested, 4, GH384_WINDOW_THROUGH, 2),
    at(requested, 5, "2026-11-13T18:05:01.000Z", 5),
  ]);
};

/**
 * FX-R1: the steps-site regression — the observed foreign-first shape: the
 * ledger's first telemetry-family records are valid step records of the
 * earlier foreign ref, appearing before the requested ref's first record,
 * followed by the requested ref's families (the delivered
 * `seedForeignFirstRegression` builder shape, with the requested ref's
 * baseline seeded through the real helper — the only baseline on the ledger,
 * so the helper call is constructible pre-fix).
 *
 * Ledger order: foreign.s1..s3, requested.s1, requested.baseline,
 * requested.v1, requested.outcome — seven records; the delivered steps read
 * tears at sequence 1 (the first foreign step).
 */
export const seedGh384ForeignFirstRegression = (
  store: StateStorePort,
  requested: string,
  foreign: string,
): void => {
  seedSteps(store, [
    gh384Step(foreign, 1),
    gh384Step(foreign, 2),
    gh384Step(foreign, 3),
    gh384Step(requested, 1),
  ]);
  seedBaselines(store, [gh384Baseline(requested)]);
  seedV1Records(store, [gh384V1(requested)]);
  seedCaptureOutcomes(store, [gh384Outcome(requested)]);
};

/** The steps-read result shape the GH-384 golden pins (the delivered result shape). */
export type Gh384StepsRead = {
  readonly records: readonly TelemetryStepRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string };
};

/** The delivered capture-outcome shape the baseline append helper returns. */
export type Gh384CaptureOutcome = {
  readonly appended: boolean;
  readonly append?: StateAppendOutcome;
};

/** The normalized steps-read result the golden pins (no absolute paths). */
export type Gh384NormalizedStepsRead = {
  readonly records: readonly TelemetryStepRecord[];
  readonly verifiedEmpty: boolean;
  readonly evidence: { readonly storePath: string };
};

/** The normalized append outcome the golden pins (sequence, no path or checksum). */
export type Gh384NormalizedAppend = {
  readonly appended: boolean;
  readonly sequence?: number;
};

/** The corrected FX-R2 half: the first append's outcome and the repeat's no-op. */
export type Gh384CorrectedFxR2 = {
  readonly first: Gh384NormalizedAppend;
  readonly repeat: Gh384NormalizedAppend;
};

/** The full committed golden shape: both regression halves plus the FX-13 section. */
export type Gh384MultiRefReadsGolden = {
  readonly requestedRef: string;
  readonly foreignRef: string;
  readonly absentRef: string;
  readonly fxR1: {
    readonly preFix: Gh381NormalizedTear;
    readonly corrected: Gh384NormalizedStepsRead | null;
  };
  readonly fxR2: {
    readonly preFix: Gh381NormalizedTear;
    readonly corrected: Gh384CorrectedFxR2 | null;
  };
  readonly singleRef: {
    readonly healthy: {
      readonly stepsRead: Gh384NormalizedStepsRead;
      readonly first: Gh384NormalizedAppend;
      readonly repeat: Gh384NormalizedAppend;
    };
    readonly emptyLedger: { readonly stepsRead: Gh384NormalizedStepsRead };
    readonly tears: {
      readonly bareStepPrefix: Gh381NormalizedTear;
      readonly bareBaselinePrefix: Gh381NormalizedTear;
      readonly stepKindMismatch: Gh381NormalizedTear;
      readonly baselineKindMismatch: Gh381NormalizedTear;
      readonly stepMalformedPayload: Gh381NormalizedTear;
    };
  };
};

/** Normalize a successful steps read for golden comparison; throws when it failed. */
export const normalizeGh384StepsRead = (
  identity: StateStoreIdentity,
  read: StateResult<Gh384StepsRead>,
): Gh384NormalizedStepsRead => {
  if (!read.ok) throw new Error(`gh384 steps-read arm failed: ${read.error.code}`);
  return {
    records: read.value.records,
    verifiedEmpty: read.value.verifiedEmpty,
    evidence: {
      storePath: normalizeGh381StorePath(identity, read.value.evidence.storePath),
    },
  };
};

/** Normalize a torn steps read for golden comparison; throws when it succeeded. */
export const normalizeGh384StepsTear = (
  identity: StateStoreIdentity,
  read: StateResult<Gh384StepsRead>,
): Gh381NormalizedTear => {
  if (read.ok) throw new Error("gh384 steps-read tear arm unexpectedly succeeded");
  if (read.error.location.record === undefined) {
    throw new Error("gh384 steps-read tear arm carries no record location");
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

/** Normalize a successful capture outcome for golden comparison; throws when it failed. */
export const normalizeGh384AppendOutcome = (
  result: StateResult<Gh384CaptureOutcome>,
): Gh384NormalizedAppend => {
  if (!result.ok) throw new Error(`gh384 capture arm failed: ${result.error.code}`);
  if (result.value.appended && result.value.append !== undefined) {
    return { appended: true, sequence: result.value.append.sequence };
  }
  return { appended: result.value.appended };
};

/** Normalize a torn capture for golden comparison; throws when it succeeded. */
export const normalizeGh384CaptureTear = (
  identity: StateStoreIdentity,
  result: StateResult<Gh384CaptureOutcome>,
): Gh381NormalizedTear => {
  if (result.ok) throw new Error("gh384 capture tear arm unexpectedly succeeded");
  if (result.error.location.record === undefined) {
    throw new Error("gh384 capture tear arm carries no record location");
  }
  return {
    kind: result.error.kind,
    code: result.error.code,
    consequence: result.error.consequence,
    location: {
      path: normalizeGh381StorePath(identity, result.error.location.path),
      record: result.error.location.record,
    },
  };
};

/** One FX-R1/FX-R2 regression case: the store identity plus the observed read. */
export type Gh384RegressionCases = {
  readonly fxR1: {
    readonly identity: StateStoreIdentity;
    readonly read: StateResult<Gh384StepsRead>;
  };
  readonly fxR2: {
    readonly identity: StateStoreIdentity;
    readonly first: StateResult<Gh384CaptureOutcome>;
    /** The same-identity repeat, run only when the first capture succeeded. */
    readonly repeat: StateResult<Gh384CaptureOutcome> | undefined;
  };
  /** Remove every temp root the cases created. */
  readonly dispose: () => void;
};

/**
 * Build the FX-R1 and FX-R2 regression cases, each in its own per-test temp
 * root through the shared builders, so the capture entry and the
 * TC-TELEMETRY-053 comparison observe byte-identical fixtures.
 *
 * FX-R2 seeds ref A's (the earlier change's) baseline through the real helper
 * — constructible pre-fix, the only baseline on the ledger — and runs ref B's
 * capture through the same helper: against delivered code this records the
 * defect tear, from the fix onward the AC-F2-1 success shape.
 */
export const buildGh384RegressionCases = (): Gh384RegressionCases => {
  const roots: string[] = [];
  const gh384Store = (label: string): { identity: StateStoreIdentity; store: StateStorePort } => {
    const root = makeTempRoot(`gh384-golden-${label}`);
    roots.push(root);
    const identity = makeIdentity(root);
    return { identity, store: openStore(identity).store };
  };
  const fxR1 = gh384Store("fx-r1");
  seedGh384ForeignFirstRegression(fxR1.store, GH384_REF, GH384_FOREIGN_REF);
  const fxR1Read = readTelemetrySteps(fxR1.store, GH384_REF);
  const fxR2 = gh384Store("fx-r2");
  seedBaselines(fxR2.store, [gh384Baseline(GH384_FOREIGN_REF)]);
  const fxR2First = appendTelemetryBaseline(
    fxR2.store,
    "gh384-fx-r2-first",
    gh384Baseline(GH384_REF),
  );
  const fxR2Repeat =
    fxR2First.ok === true
      ? appendTelemetryBaseline(fxR2.store, "gh384-fx-r2-repeat", gh384Baseline(GH384_REF))
      : undefined;
  return {
    fxR1: { identity: fxR1.identity, read: fxR1Read },
    fxR2: { identity: fxR2.identity, first: fxR2First, repeat: fxR2Repeat },
    dispose: () => {
      for (const root of roots.splice(0)) removeRoot(root);
    },
  };
};

/** One FX-13 single-ref case: the store identity plus the observed read or capture. */
export type Gh384SingleRefCases = {
  readonly healthy: {
    readonly identity: StateStoreIdentity;
    readonly stepsRead: StateResult<Gh384StepsRead>;
    readonly first: StateResult<Gh384CaptureOutcome>;
    readonly repeat: StateResult<Gh384CaptureOutcome>;
  };
  readonly emptyLedger: {
    readonly identity: StateStoreIdentity;
    readonly stepsRead: StateResult<Gh384StepsRead>;
  };
  readonly tears: {
    readonly bareStepPrefix: {
      readonly identity: StateStoreIdentity;
      readonly stepsRead: StateResult<Gh384StepsRead>;
    };
    readonly bareBaselinePrefix: {
      readonly identity: StateStoreIdentity;
      readonly capture: StateResult<Gh384CaptureOutcome>;
    };
    readonly stepKindMismatch: {
      readonly identity: StateStoreIdentity;
      readonly stepsRead: StateResult<Gh384StepsRead>;
    };
    readonly baselineKindMismatch: {
      readonly identity: StateStoreIdentity;
      readonly capture: StateResult<Gh384CaptureOutcome>;
    };
    readonly stepMalformedPayload: {
      readonly identity: StateStoreIdentity;
      readonly stepsRead: StateResult<Gh384StepsRead>;
    };
  };
  /** Remove every temp root the cases created. */
  readonly dispose: () => void;
};

/**
 * Build every FX-13 single-ref arm: the healthy ledger (steps present, the
 * baseline arriving through the real helper's capture, then its same-identity
 * no-op repeat), the truly-empty ledger, and each delivered tear case at both
 * sites — so the capture entry and the TC-TELEMETRY-055 comparison build
 * byte-identical fixtures.
 *
 * The truly-empty arm is the only place delivered behavior for a ref with no
 * telemetry is identical pre- and post-fix by construction; the multi-ref
 * shapes belong to the matrix cases, never to this golden.
 */
export const buildGh384SingleRefCases = (): Gh384SingleRefCases => {
  const roots: string[] = [];
  const gh384Store = (label: string): { identity: StateStoreIdentity; store: StateStorePort } => {
    const root = makeTempRoot(`gh384-golden-${label}`);
    roots.push(root);
    const identity = makeIdentity(root);
    return { identity, store: openStore(identity).store };
  };
  const seededSteps = (store: StateStorePort): void => {
    seedSteps(store, [gh384Step(GH384_REF, 1), gh384Step(GH384_REF, 2)]);
  };
  const healthy = gh384Store("fx13-healthy");
  seededSteps(healthy.store);
  const healthyFirst = appendTelemetryBaseline(
    healthy.store,
    "gh384-fx13-healthy-first",
    gh384Baseline(GH384_REF),
  );
  const healthyRepeat = appendTelemetryBaseline(
    healthy.store,
    "gh384-fx13-healthy-repeat",
    gh384Baseline(GH384_REF),
  );
  const emptyLedger = gh384Store("fx13-empty");
  const bareStepPrefix = gh384Store("fx13-bare-step");
  seededSteps(bareStepPrefix.store);
  seedBarePrefixRecord(bareStepPrefix.store, "step");
  const bareBaselinePrefix = gh384Store("fx13-bare-baseline");
  seededSteps(bareBaselinePrefix.store);
  seedBarePrefixRecord(bareBaselinePrefix.store, "baseline");
  const stepKindMismatch = gh384Store("fx13-step-kind");
  seededSteps(stepKindMismatch.store);
  seedRequestedRefDamage(stepKindMismatch.store, GH384_REF, "stepKindMismatch");
  const baselineKindMismatch = gh384Store("fx13-baseline-kind");
  seededSteps(baselineKindMismatch.store);
  seedRequestedRefDamage(baselineKindMismatch.store, GH384_REF, "baselineKindMismatch");
  const stepMalformedPayload = gh384Store("fx13-step-payload");
  seededSteps(stepMalformedPayload.store);
  seedRequestedRefDamage(stepMalformedPayload.store, GH384_REF, "stepMalformedPayload");
  return {
    healthy: {
      identity: healthy.identity,
      stepsRead: readTelemetrySteps(healthy.store, GH384_REF),
      first: healthyFirst,
      repeat: healthyRepeat,
    },
    emptyLedger: {
      identity: emptyLedger.identity,
      stepsRead: readTelemetrySteps(emptyLedger.store, GH384_REF),
    },
    tears: {
      bareStepPrefix: {
        identity: bareStepPrefix.identity,
        stepsRead: readTelemetrySteps(bareStepPrefix.store, GH384_REF),
      },
      bareBaselinePrefix: {
        identity: bareBaselinePrefix.identity,
        capture: appendTelemetryBaseline(
          bareBaselinePrefix.store,
          "gh384-fx13-tear-capture",
          gh384Baseline(GH384_REF),
        ),
      },
      stepKindMismatch: {
        identity: stepKindMismatch.identity,
        stepsRead: readTelemetrySteps(stepKindMismatch.store, GH384_REF),
      },
      baselineKindMismatch: {
        identity: baselineKindMismatch.identity,
        capture: appendTelemetryBaseline(
          baselineKindMismatch.store,
          "gh384-fx13-tear-capture",
          gh384Baseline(GH384_REF),
        ),
      },
      stepMalformedPayload: {
        identity: stepMalformedPayload.identity,
        stepsRead: readTelemetrySteps(stepMalformedPayload.store, GH384_REF),
      },
    },
    dispose: () => {
      for (const root of roots.splice(0)) removeRoot(root);
    },
  };
};
