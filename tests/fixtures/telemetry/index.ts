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
  HARNESS_TOKEN_CLASSES,
  type HarnessKind,
  type HarnessTelemetryRecord,
  type HarnessTokenClass,
  type HarnessTokenCounts,
  type StateStorePort,
  TELEMETRY_BASELINE_SCHEMA_ID,
  TELEMETRY_STEP_SCHEMA_ID,
  TELEMETRY_STORAGE_SCHEMA_VERSION,
  type TelemetryBaselineRecord,
  type TelemetryClaimedIdentity,
  type TelemetryIngestTally,
  type TelemetrySessionIdentity,
  type TelemetryStepRecord,
  type TelemetryWarning,
  type TelemetryWarningReason,
} from "../../../packages/core/src/contracts/index";
import type { TelemetryAttributionSubstrates } from "../../../packages/core/src/domain/telemetry-attribution";
import {
  decodeTelemetryStepFrame,
  emptyIngestTally,
  type TelemetryFrameContext,
  tallyFrame,
} from "../../../packages/core/src/domain/telemetry-ingest";
import {
  appendEconomicsRestartEvent,
  appendHarnessTelemetry,
  appendPhaseTransition,
  appendTelemetryBaseline,
  appendTelemetryStep,
  readTelemetryBaselines,
  readTelemetrySteps,
  STATE_SCHEMA_VERSION,
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
import { makeIdentity, makeTempRoot, openStore } from "../state/harness";

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
