/**
 * Supervision record fixtures (GH-295 test plan §6, GAP-T4).
 *
 * Every record is written through a delivered append/state seam; a fixture that
 * cannot resolve a seam fails loudly instead of hand-building a literal into
 * the ledger. Instants are derived from the injected clock only.
 */

import { appendDispatchAttempt } from "../../../packages/core/src/app/dispatch-ledger";
import { appendOutboxEffect } from "../../../packages/core/src/app/effects";
import type { SupervisionScopeSnapshot } from "../../../packages/core/src/app/index";
import {
  appendDaemonHeartbeat,
  appendDaemonInstance,
  appendDaemonLane,
  appendDaemonPreemption,
  appendDaemonReconciliation,
  claimQueueLease,
  declareQueueEntry,
  releaseQueueLease,
} from "../../../packages/core/src/app/index";
import {
  COORDINATOR_FENCE_RECORD_KIND,
  COORDINATOR_ITERATION_RECORD_KIND,
  type CoordinatorFenceRecord,
  type CoordinatorIterationRecord,
  DAEMON_HEARTBEAT_RECORD_KIND,
  DAEMON_INSTANCE_RECORD_KIND,
  DAEMON_LANE_RECORD_KIND,
  DAEMON_RECONCILIATION_RECORD_KIND,
  type DaemonHeartbeatRecord,
  type DaemonInstanceRecord,
  type DaemonLaneRecord,
  type DaemonPreemptionRecord,
  type DaemonReconciliationRecord,
  DISPATCH_ATTEMPT_RECORD_KIND,
  type DispatchAttemptRecord,
  ECONOMICS_RESTART_RECORD_KIND,
  type EconomicsRestartRecord,
  OUTBOX_EFFECT_RECORD_KIND,
  type OutboxEffectRecord,
  type QueueLeaseRecord,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { appendEconomicsRestartEvent } from "../../../packages/core/src/state/economics";
import {
  appendCoordinatorFence,
  appendCoordinatorIteration,
} from "../../../packages/core/src/state/index";

/** The minimal seed target every record helper needs. */
export type SupervisionSeedTarget = {
  readonly store: StateStorePort;
  readonly nowMs: number;
  readonly nowIso: string;
  readonly repository: string;
  readonly root: string;
  readonly fence: (label: string) => string;
};

export const isoAt = (target: SupervisionSeedTarget, offsetMs: number): string =>
  new Date(target.nowMs + offsetMs).toISOString();

const expectOk = (label: string, outcome: { readonly ok: boolean }): void => {
  if (!outcome.ok) throw new Error(`supervision fixture seam failed: ${label}`);
};

export const LANE_REF = "GH-295";
export const DAEMON_INSTANCE = "instance-a";
export const COORDINATOR_ID = "coordinator-a";

/** Declare the lane's queue entry (the scope's record) through the delivered seam. */
export const seedLane = (target: SupervisionSeedTarget, ref = LANE_REF): void => {
  const declared = declareQueueEntry(target.store, {
    ref,
    repository: target.repository,
    repositoryRoot: target.root,
    priority: 1,
    recordedAt: target.nowIso,
    fenceToken: target.fence(`entry-${ref}`),
  });
  expectOk(`entry ${ref}`, declared);
};

export const seedForeignLane = (
  target: SupervisionSeedTarget,
  input: { readonly ref: string; readonly repository: string },
): void => {
  const declared = declareQueueEntry(target.store, {
    ref: input.ref,
    repository: input.repository,
    repositoryRoot: target.root,
    priority: 2,
    recordedAt: target.nowIso,
    fenceToken: target.fence(`foreign-entry-${input.ref}`),
  });
  expectOk(`foreign entry ${input.ref}`, declared);
};

/** The daemon instance claim record (acquired). */
export const seedDaemonInstance = (
  target: SupervisionSeedTarget,
  input: { readonly instanceId?: string; readonly heartbeatAt?: string } = {},
): DaemonInstanceRecord => {
  const instanceId = input.instanceId ?? DAEMON_INSTANCE;
  const record: DaemonInstanceRecord = {
    schema: "delivery.daemon.instance.v1",
    instanceId,
    pid: 4242,
    scope: target.repository,
    lockToken: `lock-${instanceId}`,
    operation: "acquired",
    acquiredAt: target.nowIso,
    heartbeatAt: input.heartbeatAt ?? target.nowIso,
    recordedAt: target.nowIso,
  };
  expectOk(
    `daemon instance ${instanceId}`,
    appendDaemonInstance(target.store, target.fence("instance"), record),
  );
  return record;
};

/** One daemon heartbeat at the given offset (ordinals ascend per instance). */
export const seedHeartbeat = (
  target: SupervisionSeedTarget,
  input: { readonly ordinal: number; readonly offsetMs: number; readonly instanceId?: string },
): DaemonHeartbeatRecord => {
  const instanceId = input.instanceId ?? DAEMON_INSTANCE;
  const record: DaemonHeartbeatRecord = {
    schema: "delivery.daemon.heartbeat.v1",
    instanceId,
    ordinal: input.ordinal,
    beatAt: isoAt(target, input.offsetMs),
    uptimeMs: 1_000,
    queueDepth: 1,
    laneCounts: { delivering: 0, idle: 1, parked: 0, failed: 0 },
    cursor: input.ordinal,
    recordedAt: isoAt(target, input.offsetMs),
  };
  expectOk(
    `heartbeat ${instanceId}#${input.ordinal}`,
    appendDaemonHeartbeat(target.store, target.fence(`beat-${input.ordinal}`), record),
  );
  return record;
};

/** One daemon lane record for the ref at the given offset. */
export const seedLaneRecord = (
  target: SupervisionSeedTarget,
  input: {
    readonly ref?: string;
    readonly offsetMs?: number;
    readonly lastCompletedPhase?: string;
    readonly state?: DaemonLaneRecord["state"];
  } = {},
): DaemonLaneRecord => {
  const ref = input.ref ?? LANE_REF;
  const at = isoAt(target, input.offsetMs ?? 0);
  const record: DaemonLaneRecord = {
    schema: "delivery.daemon.lane.v1",
    ref,
    state: input.state ?? "delivering",
    spawnOrdinal: 1,
    ...(input.lastCompletedPhase === undefined
      ? {}
      : { ledgerPosition: { lastCompletedPhase: input.lastCompletedPhase } }),
    liveness: { classification: "progressing", observedAt: at },
    recordedAt: at,
  };
  expectOk(
    `lane record ${ref}`,
    appendDaemonLane(target.store, target.fence(`lane-${ref}-${at}`), record),
  );
  return record;
};

/** One daemon reconciliation record (the daemon claim's artifact trail). */
export const seedReconciliation = (
  target: SupervisionSeedTarget,
  input: { readonly offsetMs?: number; readonly instanceId?: string } = {},
): DaemonReconciliationRecord => {
  const at = isoAt(target, input.offsetMs ?? 0);
  const record: DaemonReconciliationRecord = {
    schema: "delivery.daemon.reconciliation.v1",
    instanceId: input.instanceId ?? DAEMON_INSTANCE,
    queue: { entries: 1, edges: 0, parks: 0 },
    lanes: [],
    duplicates: 0,
    questions: [],
    startedAt: at,
    completedAt: at,
    truncated: false,
    recordedAt: at,
  };
  expectOk(
    "reconciliation",
    appendDaemonReconciliation(target.store, target.fence("reconcile"), record),
  );
  return record;
};

/** A live per-ref lease naming its holder, exactly as recorded. */
export const seedLiveLease = (
  target: SupervisionSeedTarget,
  input: { readonly ref?: string; readonly holder: string; readonly offsetMs?: number },
): QueueLeaseRecord => {
  const claimed = claimQueueLease(target.store, {
    ref: input.ref ?? LANE_REF,
    holder: input.holder,
    runner: "runner-a",
    weightClass: "standard",
    nowIso: isoAt(target, input.offsetMs ?? 0),
    nowMs: target.nowMs + (input.offsetMs ?? 0),
    fenceToken: target.fence(`claim-${input.holder}`),
  });
  expectOk(`lease ${input.holder}`, claimed);
  return claimed.ok ? claimed.lease : (undefined as unknown as QueueLeaseRecord);
};

/** One dispatch attempt record (the attempt-progress artifact class). */
export const seedDispatchAttempt = (
  target: SupervisionSeedTarget,
  input: { readonly ref?: string; readonly offsetMs?: number; readonly attemptId?: string } = {},
): DispatchAttemptRecord => {
  const ref = input.ref ?? LANE_REF;
  const at = isoAt(target, input.offsetMs ?? 0);
  const attemptId = input.attemptId ?? `attempt-${ref}-${at}`;
  const record: DispatchAttemptRecord = {
    schema: "delivery.dispatch.attempt.v1",
    attemptId,
    repository: target.repository,
    ref,
    harness: "opencode",
    evidenceClass: "fixture",
    startedAt: at,
    finishedAt: at,
    handoverState: "authoritative",
    outcome: "completed",
    token: "finished",
    comparison: { class: "not-applicable", token: null, outcome: "not-applicable" },
    falseSuccess: false,
    corroboration: { pmNotes: "satisfied", tracker: "not-applicable", ci: "not-applicable" },
    evidenceRefs: ["fixture"],
    recordedAt: at,
  };
  expectOk(
    `dispatch attempt ${attemptId}`,
    appendDispatchAttempt(target.store, target.fence(`attempt-${attemptId}`), record),
  );
  return record;
};

/** One applied commit effect record (the recorded-commit artifact class). */
export const seedCommitEffect = (
  target: SupervisionSeedTarget,
  input: { readonly ref?: string; readonly offsetMs?: number; readonly effectId?: string } = {},
): OutboxEffectRecord => {
  const ref = input.ref ?? LANE_REF;
  const at = isoAt(target, input.offsetMs ?? 0);
  const effectId = input.effectId ?? `effect-${ref}-${at}`;
  const record: OutboxEffectRecord = {
    schema: "delivery.outbox.effect.v1",
    effectId,
    intentId: `intent-${effectId}`,
    ref,
    effectKind: "commit",
    target: `commit:${ref}`,
    payloadDigest: "digest-fixture",
    idempotencyKey: `key-${effectId}`,
    state: "applied",
    attempts: 1,
    checkStrategy: "query-by-log-since",
    recordedAt: at,
  };
  expectOk(
    `effect ${effectId}`,
    appendOutboxEffect(target.store, target.fence(`effect-${effectId}`), record),
  );
  return record;
};

/** One delivered restart record (the restart-record artifact class). */
export const seedRestart = (
  target: SupervisionSeedTarget,
  input: {
    readonly ref?: string;
    readonly offsetMs?: number;
    readonly ordinal?: number;
    readonly runId?: string;
  } = {},
): EconomicsRestartRecord => {
  const ref = input.ref ?? LANE_REF;
  const record: EconomicsRestartRecord = {
    schemaId: "delivery.economics.restart.v1",
    workItemRef: ref,
    runId: input.runId ?? "run-fixture",
    sessionId: "session-fixture",
    ordinal: input.ordinal ?? 1,
    reason: "session-interrupted",
    recordedAt: isoAt(target, input.offsetMs ?? 0),
  };
  const appended = appendEconomicsRestartEvent(
    target.store,
    target.fence(`restart-${ref}-${record.ordinal}`),
    record,
  );
  expectOk(`restart ${ref}#${record.ordinal}`, appended);
  return record;
};

/* ------------------------------ claim cells ------------------------------ */

/**
 * A daemon instance claim whose heartbeat lives inside (`live`) or outside the
 * delivered claim-staleness bound.
 */
export const daemonClaim = (
  target: SupervisionSeedTarget,
  input: { readonly live: boolean; readonly heartbeatOffsetsMs?: readonly number[] } = {
    live: true,
  },
): void => {
  const offsets =
    input.heartbeatOffsetsMs ?? (input.live ? [-20_000, -5_000] : [-130_000, -120_000]);
  seedDaemonInstance(target, { heartbeatAt: isoAt(target, offsets.at(-1) ?? 0) });
  offsets.forEach((offset, index) => {
    seedHeartbeat(target, { ordinal: index + 1, offsetMs: offset });
  });
};

/** A coordinator ledger-lease claim with a moving (`live`) or flat ledger. */
export const coordinatorClaim = (
  target: SupervisionSeedTarget,
  input: { readonly live: boolean; readonly iterationOffsetsMs?: readonly number[] } = {
    live: true,
  },
): void => {
  const fenceRecord: CoordinatorFenceRecord = {
    schemaId: "delivery.coordinator.fence.v1",
    fenceId: "fence-1",
    instanceId: "coordinator-instance-1",
    coordinatorId: COORDINATOR_ID,
    action: "acquired",
    holder: "coordinator-holder",
    pid: 5252,
    processStartTimeMs: 1,
    supervisorMode: "foreground",
    externalUnit: "absent",
    previousHolder: null,
    fenceAgeMs: null,
    budgetEpochId: "epoch-1",
    recordedAt: isoAt(target, -400_000),
  };
  expectOk(
    "coordinator fence",
    appendCoordinatorFence(target.store, target.fence("coordinator-fence"), fenceRecord),
  );
  const offsets =
    input.iterationOffsetsMs ?? (input.live ? [-240_000, -60_000] : [-400_000, -330_000]);
  offsets.forEach((offset, index) => {
    const iteration: CoordinatorIterationRecord = {
      schemaId: "delivery.coordinator.iteration.v1",
      iterationId: `iteration-${index + 1}`,
      coordinatorId: COORDINATOR_ID,
      trigger: "wake",
      decision: "none",
      reason: "clean-iteration-end",
      sessionId: null,
      contextTokens: null,
      digestFingerprint: `fingerprint-${index + 1}`,
      expectationWindowMs: 60_000,
      recordedAt: isoAt(target, offset),
    };
    expectOk(
      `coordinator iteration ${iteration.iterationId}`,
      appendCoordinatorIteration(target.store, target.fence(`iteration-${index}`), iteration),
    );
  });
};

/** Seed one active liveness-stall park for the ref through the delivered park path. */
export const seedLivenessPark = (
  target: SupervisionSeedTarget,
  input: { readonly ref?: string; readonly holder?: string; readonly untilOffsetMs?: number } = {},
): void => {
  const ref = input.ref ?? LANE_REF;
  const holder = input.holder ?? "holder-park";
  seedLiveLease(target, { ref, holder });
  const released = releaseQueueLease(target.store, {
    ref,
    holder,
    park: {
      cause: "liveness-stall",
      condition: {
        type: "provider-window",
        expiresAt: isoAt(target, input.untilOffsetMs ?? 60_000),
      },
    },
    nowIso: target.nowIso,
    nowMs: target.nowMs,
    fenceToken: target.fence(`release-${ref}`),
  });
  expectOk(`liveness park ${ref}`, released);
};

/** Record kinds the fixtures seed (asserted by the additivity case). */
export const SUPERVISION_SEEDED_RECORD_KINDS = [
  DAEMON_INSTANCE_RECORD_KIND,
  DAEMON_HEARTBEAT_RECORD_KIND,
  DAEMON_LANE_RECORD_KIND,
  DAEMON_RECONCILIATION_RECORD_KIND,
  COORDINATOR_FENCE_RECORD_KIND,
  COORDINATOR_ITERATION_RECORD_KIND,
  DISPATCH_ATTEMPT_RECORD_KIND,
  OUTBOX_EFFECT_RECORD_KIND,
  ECONOMICS_RESTART_RECORD_KIND,
] as const;

/** The seed-02 fixture: a lane parked by the supervised-stall cause. */
export const stalledAndParked = (
  target: SupervisionSeedTarget,
  input: { readonly ref?: string; readonly holder?: string; readonly untilOffsetMs?: number } = {},
): void => {
  const ref = input.ref ?? LANE_REF;
  seedLane(target, ref);
  seedHeartbeat(target, { ordinal: 1, offsetMs: -(300_000 + 1) });
  seedLivenessPark(target, {
    ref,
    ...(input.holder === undefined ? {} : { holder: input.holder }),
    ...(input.untilOffsetMs === undefined ? {} : { untilOffsetMs: input.untilOffsetMs }),
  });
};

/** One durable acting record from another supervision authority (DEC-8a). */
export const actingAuthority = (
  target: SupervisionSeedTarget,
  input: {
    readonly objectRef?: string;
    readonly authorityHolder?: string;
    readonly offsetMs?: number;
  } = {},
): void => {
  const ref = input.objectRef ?? LANE_REF;
  const at = isoAt(target, input.offsetMs ?? 0);
  const record: DaemonPreemptionRecord = {
    schema: "delivery.daemon.preemption.v1",
    ref,
    repository: target.repository,
    closeRef: "GH-999",
    parkCause: "preempted-for-close-item",
    conditionType: "preemption",
    holder: input.authorityHolder ?? "authority-holder",
    state: "pending",
    requestedAt: at,
    evidence: ["acting-authority-fixture"],
    recordedAt: at,
  };
  expectOk(
    `acting authority ${ref}`,
    appendDaemonPreemption(target.store, target.fence(`acting-${ref}`), record),
  );
};

/** Claim records only (no acting authority), for the paired exit-0 control. */
export const claimsOnly = (
  target: SupervisionSeedTarget,
  input: { readonly daemonLive?: boolean; readonly coordinatorLive?: boolean } = {},
): void => {
  daemonClaim(target, { live: input.daemonLive ?? true });
  coordinatorClaim(target, { live: input.coordinatorLive ?? true });
};

/** A deterministic capped scope snapshot: `n` lanes, alternating advancing/flat. */
export const cappedScope = (n: number): SupervisionScopeSnapshot => ({
  repository: "github.com/example/supervision-repo",
  lanes: Array.from({ length: n }, (_, index) => ({
    ref: `GH-${String(1_000 + index)}`,
    repository: "github.com/example/supervision-repo",
    firstHeartbeatAt: "2026-11-16T23:55:00.000Z",
    lastHeartbeatAt: "2026-11-16T23:58:00.000Z",
    heartbeatOrdinal: 1,
    artifacts:
      index % 2 === 0
        ? { classes: ["commit-record"] as const, instants: ["2026-11-16T23:59:00.000Z"] }
        : { classes: [] as const, instants: [] as const },
  })),
  leases: [],
  acting: [],
  restarts: {},
  degraded: [],
});

/**
 * A mixed scope: one progressing lane, one stalled lane, and one unknown daemon
 * claim, for the evidence-totality walk and the failure goldens.
 */
export const mixedScope = (): SupervisionScopeSnapshot => ({
  repository: "github.com/example/supervision-repo",
  lanes: [
    {
      ref: "GH-295",
      repository: "github.com/example/supervision-repo",
      firstHeartbeatAt: "2026-11-16T23:55:00.000Z",
      lastHeartbeatAt: "2026-11-16T23:58:00.000Z",
      heartbeatOrdinal: 1,
      artifacts: { classes: ["commit-record"], instants: ["2026-11-16T23:59:00.000Z"] },
    },
    {
      ref: "GH-296",
      repository: "github.com/example/supervision-repo",
      firstHeartbeatAt: "2026-11-16T23:50:00.000Z",
      lastHeartbeatAt: "2026-11-16T23:50:00.000Z",
      heartbeatOrdinal: 1,
      artifacts: { classes: [], instants: [] },
    },
  ],
  leases: [],
  daemonClaim: {
    claimKind: "daemon-instance",
    identity: "instance-unknown",
    live: false,
    artifacts: { classes: [], instants: [] },
  },
  acting: [],
  restarts: {},
  degraded: ["artifact-source-absent"],
});
