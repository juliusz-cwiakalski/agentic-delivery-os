/**
 * Shared spend read-side fixtures (test plan §4.1).
 *
 * Every case seeds a per-test temp state store through the delivered append
 * path, so the fold only ever reads records the production writer could have
 * produced. Time, ids, and the brand are injected; no suite reads the ambient
 * clock, environment, network, or the live tree.
 */

import { createSpendCommandDefinition } from "../../../packages/cli/src/commands/spend";
import { createSpendCommandRuntime } from "../../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../../packages/cli/src/index";
import type { SpendCommandRuntime } from "../../../packages/core/src/contracts/index";
import {
  HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
  HARNESS_TELEMETRY_SCHEMA_ID,
  type HarnessCaptureOutcomeRecord,
  type HarnessTelemetryRecord,
  type HarnessTelemetryWarning,
  type HarnessTokenClass,
  type HarnessTokenCounts,
  type HarnessWarningReason,
  type PhaseTransitionRecord,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { computeSpendReport, type SpendFoldOutcome } from "../../../packages/core/src/domain/spend";
import {
  appendHarnessCaptureOutcome,
  appendHarnessTelemetry,
  appendPhaseTransition,
  readSpendLedger,
} from "../../../packages/core/src/state/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import { makeIdentity, makeTempRoot, openStore } from "../state/harness";

export {
  independentChecksum,
  ledgerBytes,
  ledgerDigest,
  ledgerLines,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  withinFence,
} from "../state/harness";

export { SYNTHETIC_BRAND };

/** The fixed injected clock reference (2026-11-07T09:00:00Z, literal month index). */
export const SPEND_NOW_MS = Date.UTC(2026, 10, 7, 9, 0, 0);
export const SPEND_NOW_ISO = "2026-11-07T09:00:00.000Z";

/** The canonical ref under test and the unrelated control ref. */
export const SPEND_REF = "GH-236";
export const OTHER_REF = "GH-999";

/** A neutral five-class token set. */
export const ZERO_TOKENS: HarnessTokenCounts = {
  input: 0,
  output: 0,
  reasoning: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

/** The all-null token set (every class absent at capture). */
export const NULL_TOKENS: HarnessTokenCounts = {
  input: null,
  output: null,
  reasoning: null,
  cacheRead: null,
  cacheWrite: null,
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
  (
    ["input", "output", "reasoning", "cacheRead", "cacheWrite"] as readonly HarnessTokenClass[]
  ).reduce((sum, key) => sum + (counts[key] ?? 0), 0);

export const warning = (
  reason: HarnessWarningReason,
  field = "tokens.reasoning",
): HarnessTelemetryWarning => ({ reason, field });

export type SessionRecordInput = {
  readonly ref?: string;
  readonly runId: string;
  readonly sessionId?: string;
  readonly agent?: string;
  readonly model?: string;
  readonly tokens?: HarnessTokenCounts;
  readonly calls?: number;
  readonly warnings?: readonly HarnessTelemetryWarning[];
  readonly cost?: number | null;
  readonly capturedAt?: string;
  readonly treeRoot?: string;
  readonly parentChain?: readonly string[];
};

/** One session-group telemetry record with a deterministic default shape. */
export const makeSessionRecord = (input: SessionRecordInput): HarnessTelemetryRecord => ({
  schemaId: HARNESS_TELEMETRY_SCHEMA_ID,
  workItemRef: input.ref ?? SPEND_REF,
  runId: input.runId,
  sessionId: input.sessionId ?? `ses-${input.runId}`,
  harnessKind: "opencode",
  harnessVersion: "1.0.0",
  agent: input.agent ?? "planner",
  model: input.model ?? "sonnet",
  treeRoot: input.treeRoot ?? input.sessionId ?? `ses-${input.runId}`,
  parentChain: [...(input.parentChain ?? [])],
  tokens: input.tokens ?? tokens(),
  calls: input.calls ?? 1,
  toolCounts: [],
  cost: input.cost === undefined ? null : input.cost,
  capturedAt: input.capturedAt ?? SPEND_NOW_ISO,
  warnings: input.warnings ?? [],
});

export type OutcomeRecordInput = {
  readonly ref?: string;
  readonly runId: string;
  readonly captured?: number;
  readonly degraded?: number;
  readonly failed?: number;
  readonly warnings?: readonly HarnessTelemetryWarning[];
  readonly capturedAt?: string;
};

/** One capture-outcome record with a deterministic default shape. */
export const makeOutcomeRecord = (input: OutcomeRecordInput): HarnessCaptureOutcomeRecord => ({
  schemaId: HARNESS_TELEMETRY_CAPTURE_SCHEMA_ID,
  workItemRef: input.ref ?? SPEND_REF,
  runId: input.runId,
  captured: input.captured ?? 1,
  degraded: input.degraded ?? 0,
  failed: input.failed ?? 0,
  warnings: input.warnings ?? [],
  capturedAt: input.capturedAt ?? SPEND_NOW_ISO,
});

/** Seed session records through the delivered append path; failures throw. */
export const appendRecords = (
  store: StateStorePort,
  records: readonly HarnessTelemetryRecord[],
): void => {
  for (const [index, record] of records.entries()) {
    const appended = appendHarnessTelemetry(store, `spend-seed-${index}`, record);
    if (!appended.ok) throw new Error(`session seed failed: ${appended.error.code}`);
  }
};

/** Seed capture-outcome records through the delivered append path. */
export const appendOutcomes = (
  store: StateStorePort,
  outcomes: readonly HarnessCaptureOutcomeRecord[],
): void => {
  for (const [index, outcome] of outcomes.entries()) {
    const appended = appendHarnessCaptureOutcome(store, `spend-outcome-${index}`, outcome);
    if (!appended.ok) throw new Error(`outcome seed failed: ${appended.error.code}`);
  }
};

export type TransitionSeed = {
  readonly phaseId: string;
  readonly operation: "complete" | "reopen";
  readonly timestamp: string;
  readonly reason?: string;
};

/** Seed `phase.transition` history through the delivered registry path. */
export const appendTransitions = (
  store: StateStorePort,
  changeRef: string,
  transitions: readonly TransitionSeed[],
): readonly PhaseTransitionRecord[] => {
  const records: PhaseTransitionRecord[] = [];
  for (const [index, transition] of transitions.entries()) {
    const appended = appendPhaseTransition(store, {
      changeRef,
      phaseId: transition.phaseId,
      operation: transition.operation,
      timestamp: transition.timestamp,
      fenceToken: `spend-transition-${index}`,
      ...(transition.reason === undefined ? {} : { reason: transition.reason }),
    });
    if (!appended.ok) throw new Error(`transition seed failed: ${appended.error.code}`);
    records.push(appended.value.record);
  }
  return records;
};

/** One seeded spend case: the records, outcomes and transitions a suite needs. */
export type SpendSeed = {
  readonly records?: readonly HarnessTelemetryRecord[];
  readonly outcomes?: readonly HarnessCaptureOutcomeRecord[];
  readonly transitions?: readonly TransitionSeed[];
  readonly ref?: string;
};

/** Seed one case's record families into an already-open store. */
export const seedSpend = (store: StateStorePort, seed: SpendSeed): void => {
  appendRecords(store, seed.records ?? []);
  appendOutcomes(store, seed.outcomes ?? []);
  appendTransitions(store, seed.ref ?? SPEND_REF, seed.transitions ?? []);
};

/** A wrapper that records every state-port member a suite observes. */
export const recordingStore = (store: StateStorePort, log: string[]): StateStorePort => ({
  ...store,
  readRecords: () => {
    log.push("readRecords");
    return store.readRecords();
  },
  read: (request) => {
    log.push("read");
    return store.read(request);
  },
  acquireFence: (token) => {
    log.push("acquireFence");
    return store.acquireFence(token);
  },
  releaseFence: (handle) => {
    log.push("releaseFence");
    return store.releaseFence(handle);
  },
  append: (handle, request) => {
    log.push("append");
    return store.append(handle, request);
  },
  salvage: (handle) => {
    log.push("salvage");
    return store.salvage(handle);
  },
});

/** A throwing harness-adapter / telemetry-composer spy: any call fails the test. */
export type ProbeSpy = {
  readonly calls: () => number;
  readonly probe: () => never;
};

export const createProbeSpy = (): ProbeSpy => {
  let calls = 0;
  return {
    calls: () => calls,
    probe: () => {
      calls += 1;
      throw new Error("a spend path must never reach the harness adapter");
    },
  };
};

/** Count the recorded calls of one member. */
export const countCalls = (log: readonly string[], member: string): number =>
  log.filter((entry) => entry === member).length;

/** A run of three session records sharing one run id and captured-at stamp. */
export const threeGroupRun = (input: {
  readonly runId: string;
  readonly capturedAt: string;
  readonly tokensByGroup?: readonly HarnessTokenCounts[];
  readonly calls?: readonly number[];
  readonly agents?: readonly string[];
  readonly models?: readonly string[];
  readonly ref?: string;
  readonly warnings?: readonly HarnessTelemetryWarning[];
}): readonly HarnessTelemetryRecord[] =>
  (
    input.tokensByGroup ?? [
      tokens({ input: 10, output: 5 }),
      tokens({ input: 6 }),
      tokens({ input: 4 }),
    ]
  ).map((tokenSet, index) =>
    makeSessionRecord({
      ...(input.ref === undefined ? {} : { ref: input.ref }),
      runId: input.runId,
      sessionId: `ses-${input.runId}-${String(index)}`,
      agent: input.agents?.[index] ?? (index === 1 ? "coder" : "planner"),
      model: input.models?.[index] ?? (index === 1 ? "opus" : "sonnet"),
      tokens: tokenSet,
      calls: input.calls?.[index] ?? index + 1,
      capturedAt: input.capturedAt,
      warnings: input.warnings ?? [],
    }),
  );

/** One seeded and folded case: the read outcome and the fold outcome. */
export type FoldedSeed = {
  readonly root: string;
  readonly read: ReturnType<typeof readSpendLedger>;
  readonly fold: SpendFoldOutcome | undefined;
};

/** Seed a fresh temp store, run the verified read, then the pure fold. */
export const foldSeed = (seed: SpendSeed, label = "case"): FoldedSeed => {
  const root = makeTempRoot(`gh236-${label}`);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  seedSpend(store, seed);
  const ref = seed.ref ?? SPEND_REF;
  const read = readSpendLedger(store, ref);
  const fold = read.ok ? computeSpendReport(read.value, { workItemRef: ref }) : undefined;
  return { root, read, fold };
};

/** An in-memory local PM context seam for the omitted-`--ref` path. */
export type LocalContextSeam = {
  readonly path: string;
  readonly fs: {
    readonly exists: (path: string) => boolean;
    readonly readText: (path: string) => string;
  };
};

export const makeLocalContext = (activeRef: string | null): LocalContextSeam => {
  const path = "/pm-context.yaml";
  const text =
    activeRef === null
      ? "parked_changes: []\n"
      : `active_change:\n  workItemRef: ${activeRef}\n  branch: feat/${activeRef}/spend-read-side\n  change_folder: doc/changes/x\nparked_changes: []\n`;
  return {
    path,
    fs: {
      exists: (candidate) => candidate === path,
      readText: (candidate) => {
        if (candidate !== path) throw new Error("missing local context");
        return text;
      },
    },
  };
};

/** The real composed spend runtime over the injected store and local context. */
export const spendRuntimeOver = (
  store: StateStorePort,
  activeRef: string | null = null,
): SpendCommandRuntime =>
  createSpendCommandRuntime({ store, localContext: makeLocalContext(activeRef) });

export type SpendCliOptions = {
  readonly runId?: string;
  readonly mode?: "interactive" | "scripted";
  readonly audit?: CliDependencies["audit"];
  readonly secrets?: readonly string[];
};

export type SpendCliRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Run the real spend command through the in-process CLI surface. */
export const runSpendCli = async (
  argv: readonly string[],
  runtime: SpendCommandRuntime,
  options: SpendCliOptions = {},
): Promise<SpendCliRun> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = [100, 110] as const;
  let tick = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => options.runId ?? "run-spend-fixture",
    secrets: options.secrets ?? [],
    program: { commands: { spend: createSpendCommandDefinition(runtime) } },
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.audit === undefined ? {} : { audit: options.audit }),
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};
