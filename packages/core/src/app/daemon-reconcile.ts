/**
 * Startup reconciliation orchestration (GH-238 F-8; EVT-3, EVT-4; DM-3, DM-4).
 *
 * Reads the verified world, classifies every in-flight lane once, appends one
 * `daemon.lane` decision per lane and exactly one `daemon.reconciliation` record
 * per instance. A replay of the same instance appends no second report. The
 * recovery persistence is injected so the app tier never imports the state tier.
 */
import {
  BLOCKER_QUESTION_RECORD_KIND,
  COMMAND_RECEIPT_RECORD_KIND,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  DAEMON_LANE_RECORD_KIND,
  DAEMON_RECONCILIATION_PAYLOAD_SCHEMA,
  type DaemonLaneRecord,
  type DaemonReconciliationLane,
  type DaemonReconciliationRecord,
  type DaemonRecoveryPort,
  type EconomicsExhaustionRecord,
  type EconomicsRestartRecord,
  OUTBOX_EFFECT_RECORD_KIND,
  QUEUE_DEPENDENCY_RECORD_KIND,
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_PARK_RECORD_KIND,
  type StateStorePort,
} from "#contracts";
import {
  type DaemonLaneDecision,
  type DaemonLaneEvidence,
  decideDaemonLane,
} from "../domain/daemon-reconcile.js";
import { latestParkRecords } from "../domain/queue-park.js";
import {
  appendDaemonLane,
  appendDaemonReconciliation,
  readDaemonLanes,
  readDaemonReconciliations,
} from "./daemon.js";
import { readQueueDependencies, readQueueEntries, readQueueParks } from "./queue.js";

export type DaemonEvidenceProvider = (
  lane: DaemonLaneRecord,
) => Omit<DaemonLaneEvidence, "ref" | "lane">;

export type DaemonReconcileInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly instanceId: string;
  readonly nowIso: string;
  readonly restartBound: number;
  readonly reconcileMaxLanes: number;
  readonly recover: DaemonRecoveryPort;
  readonly evidence?: DaemonEvidenceProvider;
};

export type DaemonReconcileResult =
  | {
      readonly ok: true;
      readonly record: DaemonReconciliationRecord;
      readonly decisions: readonly DaemonLaneDecision[];
    }
  | { readonly ok: false; readonly code: string; readonly path: string };

const latestByRef = (lanes: readonly DaemonLaneRecord[]): Map<string, DaemonLaneRecord> => {
  const map = new Map<string, DaemonLaneRecord>();
  for (const lane of lanes) map.set(lane.ref, lane);
  return map;
};

const DUPLICATE_IDENTITY_KINDS: ReadonlySet<string> = new Set([
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_DEPENDENCY_RECORD_KIND,
  QUEUE_PARK_RECORD_KIND,
  DAEMON_LANE_RECORD_KIND,
  BLOCKER_QUESTION_RECORD_KIND,
  OUTBOX_EFFECT_RECORD_KIND,
  COMMAND_RECEIPT_RECORD_KIND,
]);

type LedgerRecord = {
  readonly kind: string;
  readonly key: string;
  readonly payload: unknown;
};

/**
 * Count duplicate identity records in the verified ledger: a second record with
 * the same kind and key whose payload is identical to the first is a duplicate
 * append, not a legitimate update (updates carry a different payload). The count
 * is measured evidence, not a constant: it is 0 only when the read was checked.
 */
const countDuplicateIdentities = (records: readonly LedgerRecord[]): number => {
  const firstPayload = new Map<string, string>();
  let duplicates = 0;
  for (const record of records) {
    if (!DUPLICATE_IDENTITY_KINDS.has(record.kind)) continue;
    const identity = `${record.kind}\u0000${record.key}`;
    const payload = JSON.stringify(record.payload);
    const prior = firstPayload.get(identity);
    if (prior === undefined) {
      firstPayload.set(identity, payload);
      continue;
    }
    if (prior === payload) duplicates += 1;
  }
  return duplicates;
};

const readQuestionIds = (records: readonly LedgerRecord[]): readonly string[] => {
  const ids: string[] = [];
  for (const record of records) {
    if (record.kind !== BLOCKER_QUESTION_RECORD_KIND) continue;
    const payload = record.payload;
    if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
      const id = (payload as Record<string, unknown>).id;
      if (typeof id === "string") ids.push(id);
    }
  }
  return ids;
};

const laneRecordFor = (
  decision: DaemonLaneDecision,
  previous: DaemonLaneRecord,
  nowIso: string,
): DaemonLaneRecord => {
  if (decision.action === "terminal-failed") {
    return {
      ...previous,
      schema: DAEMON_LANE_PAYLOAD_SCHEMA,
      state: "failed",
      ...(decision.classification === undefined ? {} : { classification: decision.classification }),
      recordedAt: nowIso,
    };
  }
  if (decision.action === "hold") {
    return {
      ...previous,
      schema: DAEMON_LANE_PAYLOAD_SCHEMA,
      recordedAt: nowIso,
    };
  }
  return {
    ...previous,
    schema: DAEMON_LANE_PAYLOAD_SCHEMA,
    state: "delivering",
    ...(decision.classification === undefined ? {} : { classification: decision.classification }),
    ...(decision.resumeFromPhase === undefined
      ? {}
      : { ledgerPosition: { lastCompletedPhase: String(Number(decision.resumeFromPhase) - 1) } }),
    recordedAt: nowIso,
  };
};

const restartRecordFor = (
  decision: DaemonLaneDecision,
  lane: DaemonLaneRecord,
  instanceId: string,
  nowIso: string,
): EconomicsRestartRecord => ({
  schemaId: "delivery.economics.restart.v1",
  workItemRef: decision.ref,
  runId: instanceId,
  sessionId: lane.sessionId ?? `recovered-${decision.ref}`,
  ordinal: decision.nextRestartOrdinal ?? decision.restarts + 1,
  reason: "session-interrupted",
  recordedAt: nowIso,
});

const exhaustionRecordFor = (
  decision: DaemonLaneDecision,
  instanceId: string,
  nowIso: string,
): EconomicsExhaustionRecord => ({
  schemaId: "delivery.economics.exhaustion.v1",
  workItemRef: decision.ref,
  runId: instanceId,
  reason: "dispatch.restart-budget-exceeded",
  restarts: decision.restarts,
  historyRef: `economics/${decision.ref}`,
  terminal: true,
  options: ["requeue-fresh-budget", "park-owner-review"],
  recordedAt: nowIso,
});

export const reconcileDaemon = (input: DaemonReconcileInput): DaemonReconcileResult => {
  const ledger = input.store.readRecords();
  if (!ledger.ok) {
    return { ok: false, code: "daemon.state-recovery-failed", path: ledger.error.location.path };
  }
  const entries = readQueueEntries(input.store);
  if (!entries.ok) return { ok: false, code: "daemon.state-recovery-failed", path: "queue" };
  const dependencies = readQueueDependencies(input.store);
  if (!dependencies.ok) {
    return { ok: false, code: "daemon.state-recovery-failed", path: "queue" };
  }
  const lanes = readDaemonLanes(input.store);
  if (!lanes.ok) return { ok: false, code: "daemon.state-recovery-failed", path: lanes.path };
  const parks = readQueueParks(input.store);
  if (!parks.ok) return { ok: false, code: "daemon.state-recovery-failed", path: "queue" };
  const activeParkCount = latestParkRecords(parks.records).filter(
    (park) => park.recoveryState === "parked",
  ).length;
  const reports = readDaemonReconciliations(input.store);
  if (!reports.ok) return { ok: false, code: "daemon.state-recovery-failed", path: reports.path };
  const replay = reports.records.find((record) => record.instanceId === input.instanceId);
  if (replay !== undefined) {
    return {
      ok: true,
      record: replay,
      decisions: replay.lanes.map((lane) => ({
        ref: lane.ref,
        ...(lane.classification === undefined ? {} : { classification: lane.classification }),
        action:
          lane.action === "reattach" ||
          lane.action === "resume" ||
          lane.action === "hold" ||
          lane.action === "terminal-failed"
            ? lane.action
            : "hold",
        restarts: lane.restarts,
        ...(lane.reason === undefined ? {} : { reason: lane.reason }),
      })),
    };
  }

  const inFlight = [...latestByRef(lanes.records).values()].filter(
    (lane) => lane.state === "delivering" || lane.state === "detached",
  );
  const bounded = inFlight.slice(0, input.reconcileMaxLanes);
  const truncated = inFlight.length > bounded.length;
  const decisions: DaemonLaneDecision[] = [];
  const reportLanes: DaemonReconciliationLane[] = [];
  const questions: string[] = [];
  const nowIso = input.nowIso;

  for (const lane of bounded) {
    const restartRead = input.recover.readRestarts(lane.ref);
    if (!restartRead.ok) {
      return { ok: false, code: "daemon.state-recovery-failed", path: lane.ref };
    }
    const evidence = input.evidence?.(lane) ?? {};
    const decision = decideDaemonLane({
      evidence: { ref: lane.ref, lane, ...evidence },
      restarts: restartRead.records.length,
      bound: input.restartBound,
    });
    decisions.push(decision);
    const appended = appendDaemonLane(
      input.store,
      input.fenceToken,
      laneRecordFor(decision, lane, nowIso),
    );
    if (!appended.ok) {
      return { ok: false, code: "daemon.state-recovery-failed", path: appended.path };
    }
    if (decision.action === "resume") {
      const restart = input.recover.appendRestart(
        restartRecordFor(decision, lane, input.instanceId, nowIso),
      );
      if (!restart.ok) {
        return { ok: false, code: "daemon.state-recovery-failed", path: decision.ref };
      }
    }
    if (decision.action === "terminal-failed") {
      const exhausted = input.recover.ensureExhaustion(
        exhaustionRecordFor(decision, input.instanceId, nowIso),
      );
      if (!exhausted.ok) {
        return { ok: false, code: "daemon.state-recovery-failed", path: decision.ref };
      }
      const question = input.recover.raiseQuestion({
        ref: decision.ref,
        reason: "restart-budget-exhausted",
        restarts: decision.restarts,
      });
      if (question.ok) questions.push(question.questionId);
    }
    reportLanes.push({
      ref: decision.ref,
      ...(decision.classification === undefined ? {} : { classification: decision.classification }),
      action: decision.action,
      restarts: decision.restarts,
      ...(decision.reason === "evidence-insufficient" ||
      decision.reason === "restart-budget-exhausted"
        ? { reason: decision.reason }
        : {}),
    });
  }

  for (const id of readQuestionIds(ledger.value.records)) {
    if (!questions.includes(id)) questions.push(id);
  }

  const record: DaemonReconciliationRecord = {
    schema: DAEMON_RECONCILIATION_PAYLOAD_SCHEMA,
    instanceId: input.instanceId,
    queue: {
      entries: entries.records.length,
      edges: dependencies.records.reduce((total, dependency) => total + dependency.edges.length, 0),
      parks: activeParkCount,
    },
    lanes: reportLanes,
    duplicates: countDuplicateIdentities(ledger.value.records),
    questions,
    startedAt: nowIso,
    completedAt: nowIso,
    truncated,
    recordedAt: nowIso,
  };
  const appended = appendDaemonReconciliation(input.store, input.fenceToken, record);
  if (!appended.ok) {
    return { ok: false, code: "daemon.state-recovery-failed", path: appended.path };
  }
  return { ok: true, record: appended.record, decisions };
};
