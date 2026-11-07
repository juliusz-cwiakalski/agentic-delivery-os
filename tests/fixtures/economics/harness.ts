/**
 * The economics recording runtime (GH-235 GAP-T3 observation basis).
 *
 * A real temp state store, the production resume compositions bound to the
 * state-backed port, and deterministic injected clock/run-id/fence facts.
 * Execution doubles (spawn/kill/steer) are recording fakes the compositions do
 * NOT accept: any invocation by a mutant is observable, so "no execution" is a
 * proof rather than a claim. No live worktree, no real user state directory.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  EconomicsExhaustionRecord,
  EconomicsRecordsRead,
  EconomicsRestartRecord,
  EconomicsResumeCapabilityDeclaration,
  EconomicsResumeComposition,
  EconomicsResumeDecision,
  EconomicsResumeInput,
  EconomicsSessionEvidence,
  EconomicsSourcedSignalReading,
  StateStoreIdentity,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  createOneShotResumeComposition,
  createSupervisedResumeComposition,
  deriveEconomicsView,
} from "../../../packages/core/src/domain/index";
import type { EconomicsView } from "../../../packages/core/src/contracts/index";
import {
  createEconomicsResumeStorePort,
  createStateStore,
  readEconomicsRecords as readEconomicsViewRecords,
} from "../../../packages/core/src/state/index";
import { createTestEdge, makeIdentity, type TestEdge } from "../state/harness";

/** The execution double counter set: every invocation is a violation. */
export type ExecutionCounters = {
  spawns: number;
  kills: number;
  steers: number;
  restarts: number;
  supervisions: number;
  queueMutations: number;
  harnessQueries: number;
  stateAppends: number;
  stateReads: number;
};

export type ExecutionDouble = {
  readonly counters: ExecutionCounters;
  readonly spawn: (label?: string) => void;
  readonly kill: (label?: string) => void;
  readonly steer: (label?: string) => void;
  readonly restart: (label?: string) => void;
  readonly supervise: (label?: string) => void;
  readonly mutateQueue: (label?: string) => void;
  readonly queryHarness: (label?: string) => void;
  readonly calls: readonly string[];
};

/** A recording execution double: no return value, no side effect beyond the log. */
export const createExecutionDouble = (): ExecutionDouble => {
  const counters: ExecutionCounters = {
    spawns: 0,
    kills: 0,
    steers: 0,
    restarts: 0,
    supervisions: 0,
    queueMutations: 0,
    harnessQueries: 0,
    stateAppends: 0,
    stateReads: 0,
  };
  const calls: string[] = [];
  const record = (kind: keyof ExecutionCounters, label?: string): void => {
    counters[kind] += 1;
    calls.push(label === undefined ? kind : `${kind}:${label}`);
  };
  return {
    counters,
    calls,
    spawn: (label) => record("spawns", label),
    kill: (label) => record("kills", label),
    steer: (label) => record("steers", label),
    restart: (label) => record("restarts", label),
    supervise: (label) => record("supervisions", label),
    mutateQueue: (label) => record("queueMutations", label),
    queryHarness: (label) => record("harnessQueries", label),
  };
};

export type EconomicsRuntimeOptions = {
  readonly label?: string;
  readonly bound?: number;
  readonly capability?: EconomicsResumeCapabilityDeclaration;
  readonly runId?: string;
  readonly now?: () => string;
  readonly newFenceToken?: () => string;
  readonly sourcedSignals?: readonly EconomicsSourcedSignalReading[];
};

export type EconomicsRuntime = {
  readonly root: string;
  readonly identity: StateStoreIdentity;
  readonly edge: TestEdge;
  readonly store: StateStorePort;
  readonly port: ReturnType<typeof createEconomicsResumeStorePort>;
  readonly supervised: EconomicsResumeComposition;
  readonly oneShot: EconomicsResumeComposition;
  readonly execution: ExecutionDouble;
  readonly options: Required<Pick<EconomicsRuntimeOptions, "bound" | "runId">> &
    EconomicsRuntimeOptions;
  attempt(mode: "supervised" | "one-shot", input: EconomicsResumeInput): EconomicsResumeDecision;
  read(workItemRef: string): EconomicsRecordsRead;
  view(workItemRef: string): EconomicsView;
  close(): void;
};

let fenceCounter = 0;
let seedCounter = 0;

/** Open one recording runtime over a fresh temp store root (`gh235-` label). */
export const createEconomicsRuntime = (options: EconomicsRuntimeOptions = {}): EconomicsRuntime => {
  const root = mkdtempSync(join(tmpdir(), `gh235-${options.label ?? "economics"}-`));
  const identity = makeIdentity(root);
  const edge = createTestEdge();
  const store = createStateStore(identity, { driver: "jsonl", edge });
  const execution = createExecutionDouble();
  const bound = options.bound ?? 3;
  const runId = options.runId ?? "run-economics-fixture";
  const now = options.now ?? (() => "2026-11-07T12:00:00Z");
  const newFenceToken =
    options.newFenceToken ??
    (() => {
      fenceCounter += 1;
      return `econ-fence-${fenceCounter}`;
    });
  const port = createEconomicsResumeStorePort({ store, newFenceToken });
  const deps = {
    store: port,
    budget: { readRestartBudget: () => bound },
    capability: options.capability ?? ({ modes: ["prompt-reentry"] } as const),
    now,
    runId,
  };
  const read = (workItemRef: string): EconomicsRecordsRead => {
    execution.counters.stateReads += 1;
    return readEconomicsViewRecords(store, workItemRef);
  };
  const view = (workItemRef: string): EconomicsView => {
    const records = readEconomicsViewRecords(store, workItemRef);
    if (!records.ok) throw new Error(`economics read failed: ${records.code}`);
    return deriveEconomicsView({
      records: records.restarts,
      ...(records.terminal === undefined ? {} : { terminal: records.terminal }),
    });
  };
  const supervised = createSupervisedResumeComposition(deps);
  const oneShot = createOneShotResumeComposition(deps);
  return {
    root,
    identity,
    edge,
    store,
    port,
    supervised,
    oneShot,
    execution,
    options: { ...options, bound, runId },
    attempt: (mode, input) =>
      mode === "supervised" ? supervised.attempt(input) : oneShot.attempt(input),
    read,
    view,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** One terminal record fixture built from a refusal decision (D-8, D-10). */
export const terminalRecord = (input: {
  readonly workItemRef: string;
  readonly runId: string;
  readonly restarts: number;
  readonly recordedAt?: string;
}): EconomicsExhaustionRecord => ({
  schemaId: "delivery.economics.exhaustion.v1",
  workItemRef: input.workItemRef,
  runId: input.runId,
  reason: "dispatch.restart-budget-exceeded",
  restarts: input.restarts,
  historyRef: `economics/${input.workItemRef}`,
  terminal: true,
  options: ["requeue-fresh-budget", "park-owner-review"],
  recordedAt: input.recordedAt ?? "2026-11-07T12:00:00Z",
});

/** Seed `count` admitted restarts straight into the store (fixture seeding). */
export const seedRestarts = (
  store: StateStorePort,
  count: number,
  overrides: Partial<EconomicsRestartRecord> = {},
): readonly EconomicsRestartRecord[] => {
  const records: EconomicsRestartRecord[] = [];
  for (let ordinal = 1; ordinal <= count; ordinal += 1) {
    records.push({
      schemaId: "delivery.economics.restart.v1",
      workItemRef: "GH-235",
      runId: "run-seed",
      sessionId: `ses_fixture_${ordinal}`,
      reason: "session-interrupted",
      repayTokens: { inputTokens: 100, outputTokens: 0 },
      observedUniqueProgressTokens: 400,
      recordedAt: `2026-11-07T00:00:0${ordinal}Z`,
      ...overrides,
      ordinal,
    });
  }
  seedCounter += 1;
  const acquired = store.acquireFence(`seed-fence-${seedCounter}`);
  if (!acquired.ok) throw new Error(`seed fence failed: ${acquired.error.code}`);
  try {
    for (const record of records) {
      const appended = store.append(acquired.value.handle, {
        kind: "economics.restart",
        recordKey: `economics/${record.workItemRef}`,
        payload: {
          schemaId: record.schemaId,
          workItemRef: record.workItemRef,
          runId: record.runId,
          sessionId: record.sessionId,
          ordinal: record.ordinal,
          reason: record.reason,
          ...(record.repayTokens === undefined ? {} : { repayTokens: record.repayTokens }),
          ...(record.observedUniqueProgressTokens === undefined
            ? {}
            : { observedUniqueProgressTokens: record.observedUniqueProgressTokens }),
          recordedAt: record.recordedAt,
        },
      });
      if (!appended.ok) throw new Error(`seed append failed: ${appended.error.code}`);
    }
  } finally {
    store.releaseFence(acquired.value.handle);
  }
  return records;
};

/** A complete session-evidence fixture with deterministic numeric facts. */
export const runtimeEvidence = (
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
