/**
 * Coordinator state fixtures (GH-241): valid record builders, the persisted
 * lease sequences, torn/gapped/unknown roots, and a spying store that counts the
 * fence protocol and can force an acquire/append failure.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CoordinatorExhaustionRecord,
  CoordinatorFenceRecord,
  CoordinatorIterationRecord,
  CoordinatorRestartRecord,
  CoordinatorStuckRecord,
  CoordinatorWakeRecord,
  StateFailureCode,
  StateFenceStatus,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import {
  COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA,
  COORDINATOR_FENCE_PAYLOAD_SCHEMA,
  COORDINATOR_ITERATION_PAYLOAD_SCHEMA,
  COORDINATOR_RESTART_PAYLOAD_SCHEMA,
  COORDINATOR_STUCK_PAYLOAD_SCHEMA,
  COORDINATOR_WAKE_PAYLOAD_SCHEMA,
} from "../../../packages/core/src/contracts/index";
import { makeIdentity, openStore, reopenStore } from "../state/harness";

export const COORDINATOR_ID = "coordinator-main";
export const EPOCH_ID = "epoch-1";
export const T0 = "2026-11-09T00:00:00.000Z";
export const T1 = "2026-11-09T00:01:00.000Z";
export const T2 = "2026-11-09T00:02:00.000Z";

export const iterationRecord = (
  overrides: Partial<CoordinatorIterationRecord> = {},
): CoordinatorIterationRecord => ({
  schemaId: COORDINATOR_ITERATION_PAYLOAD_SCHEMA,
  iterationId: "iteration-1",
  coordinatorId: COORDINATOR_ID,
  trigger: "start",
  decision: "spawn-fresh",
  reason: "initial-start",
  sessionId: "session-1",
  contextTokens: 1_000,
  digestFingerprint: "cursor=3;open=0",
  expectationWindowMs: 600_000,
  recordedAt: T0,
  ...overrides,
});

export const restartRecord = (
  overrides: Partial<CoordinatorRestartRecord> = {},
): CoordinatorRestartRecord => ({
  schemaId: COORDINATOR_RESTART_PAYLOAD_SCHEMA,
  restartId: `${COORDINATOR_ID}#${EPOCH_ID}#1`,
  coordinatorId: COORDINATOR_ID,
  budgetEpochId: EPOCH_ID,
  sessionId: "session-2",
  ordinal: 1,
  reason: "session-interrupted",
  previousSessionId: "session-1",
  recordedAt: T1,
  ...overrides,
});

export const stuckRecord = (
  overrides: Partial<CoordinatorStuckRecord> = {},
): CoordinatorStuckRecord => ({
  schemaId: COORDINATOR_STUCK_PAYLOAD_SCHEMA,
  stuckId: "iteration-1",
  coordinatorId: COORDINATOR_ID,
  iterationId: "iteration-1",
  verdict: "stuck",
  phase: "verdict",
  reason: "stuck-artifact-evidence",
  evidence: "merge=stale answer=stale",
  killOutcome: "not-attempted",
  killFailureReason: null,
  recordedAt: T1,
  ...overrides,
});

export const exhaustionRecord = (
  overrides: Partial<CoordinatorExhaustionRecord> = {},
): CoordinatorExhaustionRecord => ({
  schemaId: COORDINATOR_EXHAUSTION_PAYLOAD_SCHEMA,
  exhaustionId: `${COORDINATOR_ID}#${EPOCH_ID}`,
  coordinatorId: COORDINATOR_ID,
  budgetEpochId: EPOCH_ID,
  restarts: 10,
  historyRef: `coordinator/${COORDINATOR_ID}`,
  escalationQuestionId: "q-0001",
  options: ["restart-fresh-budget", "park-owner-review"],
  terminal: true,
  recordedAt: T2,
  ...overrides,
});

export const wakeRecord = (
  overrides: Partial<CoordinatorWakeRecord> = {},
): CoordinatorWakeRecord => ({
  schemaId: COORDINATOR_WAKE_PAYLOAD_SCHEMA,
  wakeId: "wake-1",
  coordinatorId: COORDINATOR_ID,
  questionId: "q-0002",
  questionRank: 1,
  askedAt: T0,
  outcome: "woken",
  iterationId: "iteration-1",
  recordedAt: T1,
  ...overrides,
});

export const fenceRecord = (
  overrides: Partial<CoordinatorFenceRecord> = {},
): CoordinatorFenceRecord => ({
  schemaId: COORDINATOR_FENCE_PAYLOAD_SCHEMA,
  fenceId: "fence-1",
  instanceId: "instance-1",
  coordinatorId: COORDINATOR_ID,
  action: "acquired",
  holder: "pid:100:start:1000",
  pid: 100,
  processStartTimeMs: 1_000,
  supervisorMode: "foreground",
  externalUnit: "absent",
  previousHolder: null,
  fenceAgeMs: null,
  recordedAt: T0,
  ...overrides,
});

/** One fresh temp root plus an opened store for the coordinator tests. */
export const makeCoordinatorStore = (
  label = "coordinator",
): { root: string; store: StateStorePort; identity: ReturnType<typeof makeIdentity> } => {
  const root = mkdtempSync(join(tmpdir(), `gh241-${label}-`));
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  return { root, store, identity };
};

/** Reopen the same root with a fresh store instance (crash-durability proof). */
export const reopenCoordinatorStore = (identity: ReturnType<typeof makeIdentity>) =>
  reopenStore(identity).store;

/** A spying store: counts the fence protocol and forces declared failures. */
export type SpyStore = {
  readonly store: StateStorePort;
  readonly counts: {
    acquireFence: number;
    recoverFence: number;
    fenceStatus: number;
    releaseFence: number;
    append: number;
    readRecords: number;
  };
  /** The next acquire calls fail with the queued codes (first-in-first-out). */
  queueAcquireFailures(codes: readonly StateFailureCode[]): void;
  /** Report this fence status for the next `fenceStatus()` calls. */
  setFenceStatus(status: StateFenceStatus): void;
  /** Fail the next append with the given code. */
  failNextAppend(code: StateFailureCode): void;
};

export const spyStore = (inner: StateStorePort): SpyStore => {
  const counts = {
    acquireFence: 0,
    recoverFence: 0,
    fenceStatus: 0,
    releaseFence: 0,
    append: 0,
    readRecords: 0,
  };
  let acquireFailures: StateFailureCode[] = [];
  let fenceStatusOverride: StateFenceStatus | undefined;
  let appendFailure: StateFailureCode | undefined;
  const location = { path: inner.identity.stateDirectory };
  const store: StateStorePort = {
    ...inner,
    get identity() {
      return inner.identity;
    },
    acquireFence(token: string) {
      counts.acquireFence += 1;
      const queued = acquireFailures.shift();
      if (queued !== undefined) {
        return {
          ok: false,
          error: { kind: "state", code: queued, consequence: "not_landed", location },
        };
      }
      return inner.acquireFence(token);
    },
    releaseFence(handle) {
      counts.releaseFence += 1;
      return inner.releaseFence(handle);
    },
    fenceStatus() {
      counts.fenceStatus += 1;
      return fenceStatusOverride ?? inner.fenceStatus();
    },
    recoverFence(token: string) {
      counts.recoverFence += 1;
      return inner.recoverFence(token);
    },
    append(handle, request) {
      counts.append += 1;
      if (appendFailure !== undefined) {
        const code = appendFailure;
        appendFailure = undefined;
        return { ok: false, error: { kind: "state", code, consequence: "not_landed", location } };
      }
      return inner.append(handle, request);
    },
    readRecords() {
      counts.readRecords += 1;
      return inner.readRecords();
    },
  };
  return {
    store,
    counts,
    queueAcquireFailures: (codes) => {
      acquireFailures = [...codes];
    },
    setFenceStatus: (status) => {
      fenceStatusOverride = status;
    },
    failNextAppend: (code) => {
      appendFailure = code;
    },
  };
};
