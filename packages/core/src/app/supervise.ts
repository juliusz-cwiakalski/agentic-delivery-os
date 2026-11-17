/**
 * The supervision battery fold (GH-295 F-1..F-7, DM-1..DM-4).
 *
 * One whole-store read per run over the delivered record kinds, projected into
 * artifact-only facts, classified by the pure domain, and assembled into the
 * `delivery.supervision.v1` report. The fold never duplicates a delivered
 * classification: the tri-state delegates to `classifySupervision` (which calls
 * the delivered lane classification), claim liveness uses the delivered
 * staleness/TTL bounds, and parks are read through the delivered latest-park
 * fold. No process-derived value is read anywhere.
 */
import {
  COORDINATOR_FENCE_KEY_PREFIX,
  COORDINATOR_FENCE_RECORD_KIND,
  COORDINATOR_ITERATION_KEY_PREFIX,
  COORDINATOR_ITERATION_RECORD_KIND,
  COORDINATOR_LEASE_HELD_ACTIONS,
  DAEMON_HEARTBEAT_RECORD_KEY,
  DAEMON_HEARTBEAT_RECORD_KIND,
  DAEMON_INSTANCE_RECORD_KEY,
  DAEMON_INSTANCE_RECORD_KIND,
  DAEMON_LANE_RECORD_KIND,
  DAEMON_PREEMPTION_KEY_PREFIX,
  DAEMON_PREEMPTION_RECORD_KIND,
  DAEMON_RECONCILIATION_KEY_PREFIX,
  DAEMON_RECONCILIATION_RECORD_KIND,
  DISPATCH_ATTEMPT_KEY_PREFIX,
  DISPATCH_ATTEMPT_RECORD_KIND,
  ECONOMICS_RECORD_KEY_PREFIX,
  ECONOMICS_RESTART_RECORD_KIND,
  OUTBOX_EFFECT_KEY_PREFIX,
  OUTBOX_EFFECT_RECORD_KIND,
  QUEUE_ENTRY_KEY_PREFIX,
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_LEASE_KEY_PREFIX,
  QUEUE_LEASE_RECORD_KIND,
  QUEUE_PARK_KEY_PREFIX,
  QUEUE_PARK_RECORD_KIND,
  type QueueLeaseRecord,
  type QueueParkRecord,
  type StateRecord,
  type StateStorePort,
  SUPERVISION_CLAIM_LIVENESS_BOUND_MS,
  SUPERVISION_CORROBORATION_BOUND_MS,
  SUPERVISION_SCHEMA_VERSION,
  type SupervisionActionEntry,
  type SupervisionArtifactClass,
  type SupervisionClaimKind,
  type SupervisionDegradationMarker,
  type SupervisionEvidence,
  type SupervisionLaneEntry,
  type SupervisionReport,
  type SupervisionSupervisorEntry,
} from "#contracts";
import { foldActiveLeases, isLeaseStale } from "../domain/queue-lease.js";
import {
  conditionTypeForCause,
  createParkRecord,
  defaultParkRecheckMs,
  latestParkRecords,
} from "../domain/queue-park.js";
import {
  boundSupervisionLanes,
  classifySupervision,
  summarizeSupervision,
} from "../domain/supervise.js";
import { queueParkRecordKey, readQueueParks } from "./queue.js";

/** One supervision claim's artifact-only facts (no process-derived member). */
export type SupervisionClaimFact = {
  readonly claimKind: SupervisionClaimKind;
  readonly identity: string;
  readonly live: boolean;
  readonly holder?: string;
  readonly firstHeartbeatAt?: string;
  readonly lastHeartbeatAt?: string;
  readonly heartbeatOrdinal?: number;
  readonly artifacts: {
    readonly classes: readonly SupervisionArtifactClass[];
    readonly instants: readonly string[];
  };
};

/** One lane's artifact-only facts. */
export type SupervisionLaneFact = {
  readonly ref: string;
  readonly repository?: string;
  readonly firstHeartbeatAt?: string;
  readonly lastHeartbeatAt?: string;
  readonly heartbeatOrdinal?: number;
  readonly artifacts: {
    readonly classes: readonly SupervisionArtifactClass[];
    readonly instants: readonly string[];
  };
  readonly activePark?: { readonly cause: string; readonly until?: string };
};

/** One active per-ref lease fact; the holder is exactly as recorded. */
export type SupervisionLeaseFact = {
  readonly ref: string;
  readonly holder: string;
  readonly heartbeatAt: string;
  readonly live: boolean;
};

/** One durable acting-authority record naming the object it is acting on. */
export type SupervisionActingFact = {
  readonly objectRef: string;
  readonly authority: string;
  readonly holder?: string;
  readonly recordedAt: string;
};

/** One delivered restart record for a ref (the budget source, never a local counter). */
export type SupervisionRestartFact = {
  readonly ordinal: number;
  readonly recordedAt: string;
  readonly runId: string;
};

/** The delivered restart-budget admission answer for one ref. */
export type SupervisionRestartAdmission =
  | { readonly outcome: "admit"; readonly restarts: number }
  | { readonly outcome: "exhausted"; readonly restarts: number }
  | { readonly outcome: "unavailable"; readonly restarts: number; readonly code: string };

/** The delivered per-ref single-flight refusal. */
export type SupervisionClaimRefusal = {
  readonly code: "queue.single-flight";
  readonly holder?: string;
};

/** The one-read scope snapshot the fold classifies. */
export type SupervisionScopeSnapshot = {
  readonly repository: string;
  readonly lanes: readonly SupervisionLaneFact[];
  readonly leases: readonly SupervisionLeaseFact[];
  readonly daemonClaim?: SupervisionClaimFact;
  readonly coordinatorClaim?: SupervisionClaimFact;
  readonly acting: readonly SupervisionActingFact[];
  readonly restarts: Readonly<Record<string, readonly SupervisionRestartFact[]>>;
  readonly degraded: readonly SupervisionDegradationMarker[];
};

export type SupervisionReadRequest = {
  readonly repository: string;
  readonly nowMs: number;
};

export type SupervisionReadResult =
  | { readonly ok: true; readonly snapshot: SupervisionScopeSnapshot }
  | { readonly ok: false; readonly code: string };

export type SupervisionReadPort = {
  readonly read: (request: SupervisionReadRequest) => SupervisionReadResult;
};

export type SupervisionBatteryInput = {
  readonly repository: string;
  readonly nowMs: number;
  readonly nowIso: string;
  readonly read: SupervisionReadPort;
  /** The delivered park append path; absent means a read-only run. */
  readonly write?: SupervisionWritePort;
  /** The delivered restart/exhaustion/question append paths. */
  readonly economicsWrite?: SupervisionEconomicsWritePort;
  /** The delivered restart-budget admission (consulted once per parked stall). */
  readonly admitRestart?: (ref: string) => SupervisionRestartAdmission;
  /** The delivered per-ref single-flight refusal for a claiming action. */
  readonly claimRefusal?: (ref: string) => SupervisionClaimRefusal | undefined;
};

/** One supervised-stall park the battery asks the delivered park path to land. */
export type SupervisionParkAppend = {
  readonly ref: string;
  readonly repository: string;
  readonly until: string;
  readonly recheckMs: number;
  readonly nowIso: string;
};

export type SupervisionParkAppendResult =
  | { readonly ok: true; readonly appended: boolean; readonly record: QueueParkRecord }
  | { readonly ok: false; readonly code: string };

/** The injected write seam: the one delivered park path the battery appends through. */
export type SupervisionRestartAppend = {
  readonly ref: string;
  readonly ordinal: number;
  readonly runId: string;
  readonly recordedAt: string;
};

export type SupervisionExhaustionAppend = {
  readonly ref: string;
  readonly restarts: number;
  readonly recordedAt: string;
};

export type SupervisionAppendResult =
  | { readonly ok: true; readonly appended: boolean }
  | { readonly ok: false; readonly code: string };

export type SupervisionWritePort = {
  readonly appendPark: (input: SupervisionParkAppend) => SupervisionParkAppendResult;
};

/**
 * The delivered economics append paths. Composed at the edge (the state tier is
 * not reachable from the app tier): the restart record, the terminal exhaustion
 * record, and the typed question, each through its delivered fenced path.
 */
export type SupervisionEconomicsWritePort = {
  /** The delivered restart path; the budget ordinal moves exactly one step. */
  readonly appendRestart: (input: SupervisionRestartAppend) => SupervisionAppendResult;
  /** The delivered terminal exhaustion path (single record per delivery). */
  readonly ensureExhaustion: (input: SupervisionExhaustionAppend) => SupervisionAppendResult;
  /** The delivered typed-question path (idempotent by identity). */
  readonly raiseQuestion: (input: {
    readonly ref: string;
    readonly restarts: number;
    readonly askedAt: string;
  }) => SupervisionAppendResult;
};

export type SupervisionBatteryResult =
  | { readonly ok: true; readonly report: SupervisionReport }
  | {
      readonly ok: false;
      readonly kind: "state" | "supervise" | "queue";
      readonly code: string;
      readonly summary: string;
    };

/* ------------------------------ read helpers ----------------------------- */

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const positiveInt = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;

const newest = (records: readonly StateRecord[]): StateRecord | undefined => {
  let latest: StateRecord | undefined;
  for (const record of records) {
    if (latest === undefined || record.sequence >= latest.sequence) latest = record;
  }
  return latest;
};

const artifactsOf = (
  entries: readonly { readonly class: SupervisionArtifactClass; readonly instant: string }[],
): {
  readonly classes: readonly SupervisionArtifactClass[];
  readonly instants: readonly string[];
} => {
  const classes = [...new Set(entries.map((entry) => entry.class))];
  const instants = [...new Set(entries.map((entry) => entry.instant))].sort();
  return { classes, instants };
};

const sortInstants = (values: readonly string[]): readonly string[] =>
  [...values].sort((left, right) => Date.parse(left) - Date.parse(right));

/** The lease record shape the delivered active-lease fold consumes. */
const leaseOf = (payload: unknown): QueueLeaseRecord | undefined => {
  const value = asRecord(payload);
  if (value === undefined) return undefined;
  const leaseId = str(value.leaseId);
  const scope = value.scope;
  const repository = str(value.repository);
  const holder = str(value.holder);
  const ref = str(value.ref);
  const runner = str(value.runner);
  const weightClass = value.weightClass;
  const operation = value.operation;
  const acquiredAt = str(value.acquiredAt);
  const heartbeatAt = str(value.heartbeatAt);
  const ttlMs = positiveInt(value.ttlMs);
  const recordedAt = str(value.recordedAt);
  if (
    leaseId === undefined ||
    (scope !== "repo-exclusive" && scope !== "worktree") ||
    repository === undefined ||
    holder === undefined ||
    ref === undefined ||
    runner === undefined ||
    (weightClass !== "standard" && weightClass !== "heavy") ||
    (operation !== "acquired" &&
      operation !== "renewed" &&
      operation !== "released" &&
      operation !== "taken-over") ||
    acquiredAt === undefined ||
    heartbeatAt === undefined ||
    ttlMs === undefined ||
    recordedAt === undefined
  ) {
    return undefined;
  }
  return {
    schema: "delivery.queue.lease.v1",
    leaseId,
    scope,
    repository,
    holder,
    ref,
    runner,
    weightClass,
    operation,
    acquiredAt,
    heartbeatAt,
    ttlMs,
    recordedAt,
  };
};

/* --------------------------------- reader -------------------------------- */

/**
 * Project one verified ledger snapshot into the artifact-only supervision
 * facts. Exactly one `readRecords` call supplies every group.
 */
export const createStateSupervisionReadPort = (store: StateStorePort): SupervisionReadPort => ({
  read: (request: SupervisionReadRequest): SupervisionReadResult => {
    const read = store.readRecords();
    if (!read.ok) {
      return { ok: false, code: read.error.code };
    }
    const records = read.value.records;
    const partial: SupervisionDegradationMarker[] = [];

    // Scope: the invoking checkout's single managed repository key.
    const entryRecords = records.filter(
      (record) =>
        record.kind === QUEUE_ENTRY_RECORD_KIND && record.key.startsWith(QUEUE_ENTRY_KEY_PREFIX),
    );
    const scopedEntries: { readonly ref: string; readonly repository?: string }[] = [];
    for (const record of entryRecords) {
      const payload = asRecord(record.payload);
      const ref = str(payload?.ref);
      if (ref === undefined) {
        partial.push("partial-read");
        continue;
      }
      const repository = str(payload?.repository);
      if (repository !== undefined && repository !== request.repository) continue;
      scopedEntries.push({ ref, ...(repository === undefined ? {} : { repository }) });
    }
    const laneRefs = [...new Set(scopedEntries.map((entry) => entry.ref))].sort();
    const inScope = new Set(laneRefs);

    // Daemon instance claim and its heartbeat trail.
    const instanceRecords = records.filter(
      (record) =>
        record.kind === DAEMON_INSTANCE_RECORD_KIND && record.key === DAEMON_INSTANCE_RECORD_KEY,
    );
    const instancePayload = asRecord(newest(instanceRecords)?.payload);
    const instanceId = str(instancePayload?.instanceId);
    const instanceOperation = str(instancePayload?.operation);
    const daemonClaimed =
      instanceId !== undefined &&
      (instanceOperation === "acquired" || instanceOperation === "taken-over");
    const heartbeatRecords = records.filter(
      (record) =>
        record.kind === DAEMON_HEARTBEAT_RECORD_KIND && record.key === DAEMON_HEARTBEAT_RECORD_KEY,
    );
    const heartbeatTrail = heartbeatRecords
      .map((record) => {
        const payload = asRecord(record.payload);
        return {
          instanceId: str(payload?.instanceId),
          ordinal: positiveInt(payload?.ordinal),
          beatAt: str(payload?.beatAt),
        };
      })
      .filter(
        (beat): beat is { instanceId: string; ordinal: number; beatAt: string } =>
          beat.instanceId !== undefined && beat.ordinal !== undefined && beat.beatAt !== undefined,
      );
    const latestHeartbeatInstance = heartbeatTrail.at(-1)?.instanceId;
    const heartbeatOwner = daemonClaimed ? instanceId : latestHeartbeatInstance;
    const heartbeats = heartbeatTrail
      .filter((beat) => beat.instanceId === heartbeatOwner)
      .sort((left, right) => left.ordinal - right.ordinal);
    const lastHeartbeatAt = heartbeats.at(-1)?.beatAt;
    const firstHeartbeatAt = heartbeats[0]?.beatAt;
    const heartbeatOrdinal = heartbeats.at(-1)?.ordinal;
    const daemonLive =
      daemonClaimed &&
      lastHeartbeatAt !== undefined &&
      request.nowMs - Date.parse(lastHeartbeatAt) < SUPERVISION_CLAIM_LIVENESS_BOUND_MS;

    // Lane records: daemon lane progress per ref (artifact class daemon-lane).
    const laneArtifactEntries: { ref: string; class: SupervisionArtifactClass; instant: string }[] =
      [];
    for (const record of records) {
      if (record.kind === DAEMON_LANE_RECORD_KIND) {
        const payload = asRecord(record.payload);
        const ref = str(payload?.ref);
        const recordedAt = str(payload?.recordedAt);
        if (ref === undefined || recordedAt === undefined || !inScope.has(ref)) continue;
        laneArtifactEntries.push({ ref, class: "daemon-lane", instant: recordedAt });
        const ledger = asRecord(payload?.ledgerPosition);
        const lastCompletedPhase = str(ledger?.lastCompletedPhase);
        if (lastCompletedPhase !== undefined) {
          laneArtifactEntries.push({ ref, class: "ledger-position", instant: recordedAt });
        }
        const laneLiveness = asRecord(payload?.liveness);
        const observedAt = str(laneLiveness?.observedAt);
        if (observedAt !== undefined) {
          laneArtifactEntries.push({ ref, class: "daemon-lane", instant: observedAt });
        }
        continue;
      }
      if (
        record.kind === DISPATCH_ATTEMPT_RECORD_KIND &&
        record.key.startsWith(DISPATCH_ATTEMPT_KEY_PREFIX)
      ) {
        const payload = asRecord(record.payload);
        const ref = str(payload?.ref);
        const recordedAt = str(payload?.recordedAt);
        if (ref === undefined || recordedAt === undefined || !inScope.has(ref)) continue;
        laneArtifactEntries.push({ ref, class: "dispatch-attempt", instant: recordedAt });
        continue;
      }
      if (
        record.kind === OUTBOX_EFFECT_RECORD_KIND &&
        record.key.startsWith(OUTBOX_EFFECT_KEY_PREFIX)
      ) {
        const payload = asRecord(record.payload);
        const ref = str(payload?.ref);
        const recordedAt = str(payload?.recordedAt);
        if (ref === undefined || recordedAt === undefined || !inScope.has(ref)) continue;
        laneArtifactEntries.push({ ref, class: "effect-record", instant: recordedAt });
        if (payload?.effectKind === "commit" && payload.state === "applied") {
          laneArtifactEntries.push({ ref, class: "commit-record", instant: recordedAt });
        }
        continue;
      }
      if (
        record.kind === ECONOMICS_RESTART_RECORD_KIND &&
        record.key.startsWith(ECONOMICS_RECORD_KEY_PREFIX)
      ) {
        const payload = asRecord(record.payload);
        const ref = str(payload?.workItemRef);
        const recordedAt = str(payload?.recordedAt);
        if (ref === undefined || recordedAt === undefined || !inScope.has(ref)) continue;
        laneArtifactEntries.push({ ref, class: "restart-record", instant: recordedAt });
      }
    }

    // Durable acting authorities: a pending delivered preemption record means
    // the resident daemon is actively acting on that object (DEC-8a). Detection
    // reads records only.
    const acting: SupervisionActingFact[] = records
      .filter(
        (record) =>
          record.kind === DAEMON_PREEMPTION_RECORD_KIND &&
          record.key.startsWith(DAEMON_PREEMPTION_KEY_PREFIX),
      )
      .map((record) => asRecord(record.payload))
      .filter(
        (payload): payload is Readonly<Record<string, unknown>> =>
          payload !== undefined && payload.state === "pending",
      )
      .map((payload) => {
        const holder = str(payload.holder);
        return {
          objectRef: str(payload.ref) ?? "",
          authority: "daemon-preemption",
          ...(holder === undefined ? {} : { holder }),
          recordedAt: str(payload.requestedAt) ?? str(payload.recordedAt) ?? "",
        };
      })
      .filter((entry) => entry.objectRef.length > 0 && entry.recordedAt.length > 0);

    // The delivered restart records per ref (the budget source of truth).
    const restarts: Record<string, { ordinal: number; recordedAt: string; runId: string }[]> = {};
    for (const record of records) {
      if (
        record.kind !== ECONOMICS_RESTART_RECORD_KIND ||
        !record.key.startsWith(ECONOMICS_RECORD_KEY_PREFIX)
      ) {
        continue;
      }
      const payload = asRecord(record.payload);
      const ref = str(payload?.workItemRef);
      const ordinal = positiveInt(payload?.ordinal);
      const recordedAt = str(payload?.recordedAt);
      const runId = str(payload?.runId);
      if (
        ref === undefined ||
        ordinal === undefined ||
        recordedAt === undefined ||
        runId === undefined
      ) {
        continue;
      }
      restarts[ref] = [...(restarts[ref] ?? []), { ordinal, recordedAt, runId }];
    }

    // Active per-ref leases, folded through the delivered lease fold.
    const leaseRecords: QueueLeaseRecord[] = [];
    for (const record of records) {
      if (
        record.kind !== QUEUE_LEASE_RECORD_KIND ||
        !record.key.startsWith(QUEUE_LEASE_KEY_PREFIX)
      ) {
        continue;
      }
      const lease = leaseOf(record.payload);
      if (lease === undefined) {
        return { ok: false, code: "state.store.torn" };
      }
      leaseRecords.push(lease);
    }
    const activeLeases = foldActiveLeases(leaseRecords, request.nowMs);
    if (activeLeases === undefined) return { ok: false, code: "state.store.torn" };
    const leases: SupervisionLeaseFact[] = activeLeases
      .filter((lease) => lease.repository === request.repository && inScope.has(lease.ref))
      .map((lease) => ({
        ref: lease.ref,
        holder: lease.holder,
        heartbeatAt: lease.heartbeatAt,
        live: !isLeaseStale(lease.heartbeatAgeMs, lease.ttlMs),
      }));

    // Active parks per lane (the delivered latest-park semantics).
    const latestParkByRef = new Map<string, { cause: string; until?: string }>();
    for (const record of records) {
      if (record.kind !== QUEUE_PARK_RECORD_KIND || !record.key.startsWith(QUEUE_PARK_KEY_PREFIX)) {
        continue;
      }
      const payload = asRecord(record.payload);
      const ref = str(payload?.ref);
      if (ref === undefined || !inScope.has(ref)) continue;
      const condition = asRecord(payload?.condition);
      const expiresAt = str(condition?.expiresAt);
      const until = str(payload?.until) ?? expiresAt;
      latestParkByRef.set(ref, {
        cause: str(payload?.cause) ?? "provider-window",
        ...(until === undefined ? {} : { until }),
        ...(payload?.recoveryState === "parked" ? {} : { cause: "" }),
      });
    }

    // Coordinator ledger-lease claim and its ledger-position movement.
    const fenceRecords = records.filter(
      (record) =>
        record.kind === COORDINATOR_FENCE_RECORD_KIND &&
        record.key.startsWith(COORDINATOR_FENCE_KEY_PREFIX),
    );
    const latestFencePayload = asRecord(newest(fenceRecords)?.payload);
    const coordinatorId = str(latestFencePayload?.coordinatorId);
    const fenceAction = str(latestFencePayload?.action);
    const coordinatorClaimed =
      coordinatorId !== undefined &&
      fenceAction !== undefined &&
      (COORDINATOR_LEASE_HELD_ACTIONS as readonly string[]).includes(fenceAction);
    const coordinatorIterations = records
      .filter(
        (record) =>
          record.kind === COORDINATOR_ITERATION_RECORD_KIND &&
          record.key.startsWith(COORDINATOR_ITERATION_KEY_PREFIX),
      )
      .map((record) => asRecord(record.payload))
      .filter(
        (payload): payload is Readonly<Record<string, unknown>> =>
          payload !== undefined && str(payload.coordinatorId) === coordinatorId,
      );
    const iterationInstants = sortInstants(
      coordinatorIterations
        .map((payload) => str(payload.recordedAt))
        .filter((instant): instant is string => instant !== undefined),
    );

    // Reconciliation artifacts belong to the daemon claim's supervision trail.
    const reconciliationInstants = records
      .filter(
        (record) =>
          record.kind === DAEMON_RECONCILIATION_RECORD_KIND &&
          record.key.startsWith(DAEMON_RECONCILIATION_KEY_PREFIX),
      )
      .map((record) => asRecord(record.payload))
      .map((payload) => str(payload?.completedAt))
      .filter((instant): instant is string => instant !== undefined);

    const lanes: SupervisionLaneFact[] = laneRefs.map((ref) => {
      const park = latestParkByRef.get(ref);
      const artifacts = artifactsOf(laneArtifactEntries.filter((entry) => entry.ref === ref));
      return {
        ref,
        ...(scopedEntries.find((entry) => entry.ref === ref)?.repository === undefined
          ? {}
          : { repository: request.repository }),
        ...(firstHeartbeatAt === undefined ? {} : { firstHeartbeatAt }),
        ...(lastHeartbeatAt === undefined ? {} : { lastHeartbeatAt }),
        ...(heartbeatOrdinal === undefined ? {} : { heartbeatOrdinal }),
        artifacts,
        ...(park === undefined || park.cause === "" ? {} : { activePark: park }),
      };
    });

    const degraded: SupervisionDegradationMarker[] = [];
    if (!daemonClaimed) degraded.push("daemon-absent");
    if (
      lanes.some(
        (lane) => lane.artifacts.instants.length === 0 && lane.lastHeartbeatAt === undefined,
      )
    ) {
      degraded.push("artifact-source-absent");
    }
    degraded.push(...partial);
    const uniqueDegraded = [...new Set(degraded)];

    const claimArtifacts = (entries: readonly string[]): SupervisionLaneFact["artifacts"] => ({
      classes: ["daemon-lane", "reconciliation-record"],
      instants: sortInstants(entries),
    });

    const daemonClaim: SupervisionClaimFact | undefined = daemonClaimed
      ? {
          claimKind: "daemon-instance",
          identity: instanceId,
          live: daemonLive,
          ...(firstHeartbeatAt === undefined ? {} : { firstHeartbeatAt }),
          ...(lastHeartbeatAt === undefined ? {} : { lastHeartbeatAt }),
          ...(heartbeatOrdinal === undefined ? {} : { heartbeatOrdinal }),
          artifacts: claimArtifacts(
            sortInstants([
              ...laneArtifactEntries
                .filter((entry) => entry.class === "daemon-lane")
                .map((entry) => entry.instant),
              ...reconciliationInstants,
            ]),
          ),
        }
      : undefined;

    const fenceHolder = str(latestFencePayload?.holder);
    const firstIteration = iterationInstants[0];
    const lastIteration = iterationInstants.at(-1);
    const coordinatorClaim: SupervisionClaimFact | undefined = coordinatorClaimed
      ? {
          claimKind: "coordinator-lease",
          identity: coordinatorId,
          live: true,
          ...(fenceHolder === undefined ? {} : { holder: fenceHolder }),
          ...(firstIteration === undefined || lastIteration === undefined
            ? {}
            : {
                firstHeartbeatAt: firstIteration,
                lastHeartbeatAt: lastIteration,
                heartbeatOrdinal: iterationInstants.length,
              }),
          artifacts: { classes: ["ledger-position"], instants: iterationInstants },
        }
      : undefined;

    const snapshot: SupervisionScopeSnapshot = {
      repository: request.repository,
      lanes,
      leases,
      ...(daemonClaim === undefined ? {} : { daemonClaim }),
      ...(coordinatorClaim === undefined ? {} : { coordinatorClaim }),
      acting,
      restarts,
      degraded: uniqueDegraded,
    };
    return { ok: true, snapshot };
  },
});

/* ------------------------------ write seam ------------------------------- */

/**
 * The one durable write the battery performs: a supervised-stall park appended
 * through the delivered park record shape, key, and fence discipline. A landed
 * active `liveness-stall` park refuses a second identical park, so a repeated
 * run never double-parks. No lease is acquired, released, or created, and no
 * payload outside the park record is written.
 */
export const createStateSupervisionWritePort = (input: {
  readonly store: StateStorePort;
  readonly newFenceToken: () => string;
}): SupervisionWritePort => ({
  appendPark: (request: SupervisionParkAppend): SupervisionParkAppendResult => {
    const existing = readQueueParks(input.store);
    if (!existing.ok) return { ok: false, code: existing.code };
    const latest = latestParkRecords(existing.records).find((record) => record.ref === request.ref);
    if (
      latest !== undefined &&
      latest.recoveryState === "parked" &&
      latest.cause === "liveness-stall"
    ) {
      return { ok: true, appended: false, record: latest };
    }
    const record = createParkRecord({
      ref: request.ref,
      repository: request.repository,
      cause: "liveness-stall",
      condition: { type: "provider-window", expiresAt: request.until },
      recheckMs: request.recheckMs,
      evaluatedAt: request.nowIso,
      recordedAt: request.nowIso,
      until: request.until,
    });
    const acquired = input.store.acquireFence(input.newFenceToken());
    if (!acquired.ok) return { ok: false, code: acquired.error.code };
    const appended = input.store.append(acquired.value.handle, {
      kind: QUEUE_PARK_RECORD_KIND,
      recordKey: queueParkRecordKey(request.ref),
      payload: record as unknown as import("#contracts").StateJsonValue,
    });
    const released = input.store.releaseFence(acquired.value.handle);
    if (!appended.ok) return { ok: false, code: appended.error.code };
    if (!released.ok) return { ok: false, code: released.error.code };
    const verified = readQueueParks(input.store);
    if (!verified.ok) return { ok: false, code: verified.code };
    const landed = verified.records.some(
      (candidate) =>
        candidate.ref === request.ref &&
        candidate.cause === "liveness-stall" &&
        candidate.recoveryState === "parked",
    );
    if (!landed) return { ok: false, code: "state.write.failed" };
    return { ok: true, appended: true, record };
  },
});

/* -------------------------------- battery -------------------------------- */

const entryForFact = (
  fact: SupervisionLaneFact,
  liveHolder: string | undefined,
  nowMs: number,
): SupervisionLaneEntry => {
  const classification = classifySupervision(
    {
      repository: fact.repository ?? "",
      ref: fact.ref,
      claimKind: "per-ref-lease",
      identity: fact.ref,
      sourcePresent:
        fact.lastHeartbeatAt !== undefined ||
        fact.artifacts.instants.length > 0 ||
        (fact.activePark !== undefined && fact.activePark.until !== undefined),
      ...(fact.lastHeartbeatAt === undefined ? {} : { lastHeartbeatAt: fact.lastHeartbeatAt }),
      ...(fact.firstHeartbeatAt === undefined ? {} : { firstHeartbeatAt: fact.firstHeartbeatAt }),
      ...(fact.heartbeatOrdinal === undefined ? {} : { heartbeatOrdinal: fact.heartbeatOrdinal }),
      artifactClasses: fact.artifacts.classes,
      artifactInstants: fact.artifacts.instants,
      artifactAdvancing: false,
    },
    nowMs,
  );
  return {
    ref: fact.ref,
    classification: classification.state,
    ...(fact.lastHeartbeatAt === undefined ? {} : { heartbeat: fact.lastHeartbeatAt }),
    ...(liveHolder === undefined ? {} : { holder: liveHolder }),
    evidence: classification.evidence,
  };
};

const supervisorEntryFor = (
  claim: SupervisionClaimFact,
  nowMs: number,
): SupervisionSupervisorEntry => {
  const classification = classifySupervision(
    {
      repository: "",
      claimKind: claim.claimKind as SupervisionClaimKind,
      identity: claim.identity,
      sourcePresent: true,
      ...(claim.lastHeartbeatAt === undefined ? {} : { lastHeartbeatAt: claim.lastHeartbeatAt }),
      ...(claim.firstHeartbeatAt === undefined ? {} : { firstHeartbeatAt: claim.firstHeartbeatAt }),
      ...(claim.heartbeatOrdinal === undefined ? {} : { heartbeatOrdinal: claim.heartbeatOrdinal }),
      artifactClasses: claim.artifacts.classes,
      artifactInstants: claim.artifacts.instants,
      artifactAdvancing: false,
    },
    nowMs,
  );
  const liveEvidence: SupervisionEvidence[] = claim.live
    ? [
        {
          code: "claim-live",
          recordKind: claim.claimKind,
          ...(claim.holder === undefined ? {} : { ref: claim.holder }),
        },
      ]
    : [
        {
          code: "claim-not-live",
          recordKind: claim.claimKind,
          ...(claim.holder === undefined ? {} : { ref: claim.holder }),
        },
      ];
  return {
    claimKind: claim.claimKind as SupervisionClaimKind,
    identity: claim.identity,
    classification: classification.state,
    ...(claim.lastHeartbeatAt === undefined ? {} : { heartbeat: claim.lastHeartbeatAt }),
    ...(claim.holder === undefined ? {} : { holder: claim.holder }),
    evidence: [...classification.evidence, ...liveEvidence],
  };
};

const leaseClaimEntry = (
  snapshot: SupervisionScopeSnapshot,
  lease: SupervisionLeaseFact,
  nowMs: number,
): SupervisionSupervisorEntry => {
  const lane = snapshot.lanes.find((candidate) => candidate.ref === lease.ref);
  const classification = classifySupervision(
    {
      repository: snapshot.repository,
      ref: lease.ref,
      claimKind: "per-ref-lease",
      identity: lease.holder,
      sourcePresent: true,
      lastHeartbeatAt: lease.heartbeatAt,
      artifactClasses: lane?.artifacts.classes ?? [],
      artifactInstants: lane?.artifacts.instants ?? [],
      artifactAdvancing: false,
    },
    nowMs,
  );
  return {
    claimKind: "per-ref-lease",
    identity: lease.holder,
    classification: classification.state,
    heartbeat: lease.heartbeatAt,
    holder: lease.holder,
    evidence: [
      ...classification.evidence,
      {
        code: lease.live ? "claim-live" : "claim-not-live",
        ref: lease.holder,
        recordKind: "queue.lease",
      },
      { code: "holder-recorded", ref: lease.holder, recordKind: "queue.lease" },
    ],
  };
};

const evidenceAbsentSummary = (
  lanes: readonly SupervisionLaneEntry[],
  supervisors: readonly SupervisionSupervisorEntry[],
): string => {
  const missing = [
    ...lanes.map((lane) => `lane ${lane.ref} (heartbeat, artifact trail)`),
    ...supervisors.map(
      (supervisor) =>
        `${supervisor.claimKind} ${supervisor.identity} (heartbeat, supervision artifacts)`,
    ),
  ];
  return `no artifact-evidence source exists for: ${missing.join("; ")}`;
};

/**
 * Run one supervision battery pass: one read, one fold, one report. Actions are
 * empty until the action phases land; the tri-state, claims, counts,
 * degradation, and truncation are the fold's whole truth.
 */
export const runSupervisionBattery = (input: SupervisionBatteryInput): SupervisionBatteryResult => {
  const read = input.read.read({ repository: input.repository, nowMs: input.nowMs });
  if (!read.ok) {
    return {
      ok: false,
      kind: "state",
      code: read.code,
      summary: `the supervision scope state is unreadable (${read.code}); repair the store and retry`,
    };
  }
  const snapshot = read.snapshot;

  const bounded = boundSupervisionLanes(snapshot.lanes);
  const liveLeaseFor = (ref: string): SupervisionLeaseFact | undefined =>
    snapshot.leases.find((lease) => lease.ref === ref && lease.live);
  const lanes = bounded.lanes.map((fact) =>
    entryForFact(fact, liveLeaseFor(fact.ref)?.holder, input.nowMs),
  );

  const supervisors: SupervisionSupervisorEntry[] = [
    ...(snapshot.daemonClaim === undefined
      ? []
      : [supervisorEntryFor(snapshot.daemonClaim, input.nowMs)]),
    ...(snapshot.coordinatorClaim === undefined
      ? []
      : [supervisorEntryFor(snapshot.coordinatorClaim, input.nowMs)]),
    ...snapshot.leases.map((lease) => leaseClaimEntry(snapshot, lease, input.nowMs)),
  ];
  const actions: SupervisionActionEntry[] = [];
  let newlyParked = 0;
  if (input.write !== undefined) {
    const conditionType = conditionTypeForCause("liveness-stall");
    const recheckMs = defaultParkRecheckMs(conditionType);
    for (const fact of bounded.lanes) {
      const entry = lanes.find((candidate) => candidate.ref === fact.ref);
      if (entry === undefined || entry.classification !== "stalled") continue;
      const alreadyParked =
        fact.activePark !== undefined && fact.activePark.cause === "liveness-stall";
      if (alreadyParked) {
        // A parked stall that is still stale is the restart-policy cell: an
        // acting authority refuses the action (DEC-8a), a live per-ref holder
        // refuses it through the delivered single-flight identity, and the
        // delivered budget decides the rest.
        const acting = snapshot.acting.find(
          (authority) =>
            authority.objectRef === fact.ref &&
            input.nowMs - Date.parse(authority.recordedAt) <= SUPERVISION_CORROBORATION_BOUND_MS,
        );
        if (acting !== undefined) {
          return {
            ok: false,
            kind: "supervise",
            code: "supervise.duplicate-supervision",
            summary: `another supervision authority (${acting.authority}${
              acting.holder === undefined ? "" : ` holder ${acting.holder}`
            }) is actively acting on ${fact.ref}`,
          };
        }
        const refusal = input.claimRefusal?.(fact.ref);
        if (refusal !== undefined) {
          return {
            ok: false,
            kind: "queue",
            code: refusal.code,
            summary: `holder:${refusal.holder ?? "unknown"}; ref:${fact.ref}`,
          };
        }
        const admission = input.admitRestart?.(fact.ref);
        if (admission === undefined) continue;
        if (admission.outcome === "admit" && input.economicsWrite !== undefined) {
          const appended = input.economicsWrite.appendRestart({
            ref: fact.ref,
            ordinal: admission.restarts + 1,
            runId: "supervise",
            recordedAt: input.nowIso,
          });
          if (!appended.ok) {
            return {
              ok: false,
              kind: "state",
              code: appended.code,
              summary: `the restart for ${fact.ref} did not land (${appended.code})`,
            };
          }
          actions.push({
            kind: "restart-admission",
            ref: fact.ref,
            evidence: [
              ...entry.evidence,
              {
                code: "restart-admitted",
                ref: fact.ref,
                recordKind: "economics.restart",
                instant: input.nowIso,
              },
              { code: "bound-applied", ref: fact.ref, recordKind: "economics.restart" },
            ],
          });
        } else if (admission.outcome === "exhausted" && input.economicsWrite !== undefined) {
          const terminal = input.economicsWrite.ensureExhaustion({
            ref: fact.ref,
            restarts: admission.restarts,
            recordedAt: input.nowIso,
          });
          if (!terminal.ok) {
            return {
              ok: false,
              kind: "state",
              code: terminal.code,
              summary: `the terminal exhaustion for ${fact.ref} did not land (${terminal.code})`,
            };
          }
          const question = input.economicsWrite.raiseQuestion({
            ref: fact.ref,
            restarts: admission.restarts,
            askedAt: input.nowIso,
          });
          if (!question.ok) {
            return {
              ok: false,
              kind: "state",
              code: question.code,
              summary: `the typed question for ${fact.ref} did not land (${question.code})`,
            };
          }
          actions.push({
            kind: "exhaustion-record",
            ref: fact.ref,
            evidence: [
              ...entry.evidence,
              {
                code: "restart-exhausted",
                ref: fact.ref,
                recordKind: "economics.budget-exhaustion",
                instant: input.nowIso,
              },
            ],
          });
        } else if (admission.outcome === "unavailable") {
          actions.push({
            kind: "unavailable-outcome",
            ref: fact.ref,
            evidence: [
              ...entry.evidence,
              {
                code: "restart-unavailable",
                ref: fact.ref,
                recordKind: "economics.restart",
                instant: input.nowIso,
              },
            ],
          });
        }
        continue;
      }
      const held = liveLeaseFor(fact.ref);
      // The declared stall recheck horizon: the mapped condition type's
      // delivered default, never a literal (RE-ENTRY HORIZON).
      const until = new Date(input.nowMs + recheckMs).toISOString();
      const appended = input.write.appendPark({
        ref: fact.ref,
        repository: fact.repository ?? snapshot.repository,
        until,
        recheckMs,
        nowIso: input.nowIso,
      });
      if (!appended.ok) {
        return {
          ok: false,
          kind: "state",
          code: appended.code,
          summary: `the supervised-stall park for ${fact.ref} did not land (${appended.code})`,
        };
      }
      if (!appended.appended) continue;
      newlyParked += 1;
      actions.push({
        kind: held === undefined ? "supervised-stall-park" : "safe-boundary-park-intent",
        ref: fact.ref,
        evidence: [
          ...entry.evidence,
          {
            code: held === undefined ? "park-applied" : "park-intent-recorded",
            ref: fact.ref,
            recordKind: "queue.park",
            instant: until,
          },
          ...(held === undefined
            ? []
            : [{ code: "holder-recorded" as const, ref: held.holder, recordKind: "queue.lease" }]),
        ],
      });
    }
  }

  const entries = [
    ...lanes.map((lane) => lane.classification),
    ...supervisors.map((claim) => claim.classification),
  ];
  if (entries.length > 0 && entries.every((state) => state === "unknown")) {
    return {
      ok: false,
      kind: "supervise",
      code: "supervise.evidence-absent",
      summary: evidenceAbsentSummary(lanes, supervisors),
    };
  }

  const parked = bounded.lanes.filter((fact) => fact.activePark !== undefined).length + newlyParked;
  const report: SupervisionReport = {
    schemaVersion: SUPERVISION_SCHEMA_VERSION,
    repo: snapshot.repository,
    lanes,
    supervisors,
    actions,
    counts: summarizeSupervision({ lanes, supervisors, actions, parked }),
    degraded: snapshot.degraded,
    truncated: bounded.truncated,
    observedAt: input.nowIso,
    ...(bounded.truncated ? { truncationReason: "lane-cap" as const } : {}),
  };
  return { ok: true, report };
};
