/**
 * The status use case (GH-238 F-1, F-7, F-12; DM-13, DM-14).
 *
 * Reads the latest durable instance, heartbeat, daemon lanes, and reconciliation
 * record, then folds the pure status projection. No process introspection.
 */
import {
  DAEMON_DEFAULT_HEARTBEAT_INTERVAL_MS,
  DAEMON_DEFAULT_LOCK_STALENESS_MS,
  type DaemonDegradationMarker,
  type DaemonMergeCodePath,
  type DaemonStartMode,
  type DaemonStatusData,
  type DaemonStatusSocket,
  type DaemonSupervisorDescriptor,
  ECONOMICS_RESTART_RECORD_KIND,
  type StateStorePort,
} from "#contracts";
import { foldDaemonStatus } from "../domain/daemon-status.js";
import {
  readDaemonHeartbeat,
  readDaemonInstance,
  readDaemonLanes,
  readDaemonReconciliations,
} from "./daemon.js";
import { readQueueEntries } from "./queue.js";

export type DaemonStatusInput = {
  readonly store: StateStorePort;
  readonly nowMs: number;
  readonly heartbeatIntervalMs?: number;
  readonly lockStalenessMs?: number;
  readonly socket: DaemonStatusSocket;
  readonly supervisor: DaemonSupervisorDescriptor;
  readonly mergeCodePath: DaemonMergeCodePath;
  readonly degraded: readonly DaemonDegradationMarker[];
  readonly restartCounts?: Readonly<
    Record<string, { readonly count: number; readonly reason?: string }>
  >;
  /** The truthfully projected runtime mode; resident when omitted. */
  readonly mode?: DaemonStartMode;
};

export type DaemonRestartCountsRead =
  | {
      readonly ok: true;
      readonly counts: Readonly<
        Record<string, { readonly count: number; readonly reason?: string }>
      >;
    }
  | { readonly ok: false; readonly code: string; readonly path: string };

/**
 * Fold every delivered economics restart record into the status restart
 * counters. A malformed record fails closed; a count is never fabricated from
 * an unreadable corpus.
 */
const readDaemonRestartCounts = (store: StateStorePort): DaemonRestartCountsRead => {
  const read = store.readRecords();
  if (!read.ok) return { ok: false, code: read.error.code, path: read.error.location.path };
  const counters: Record<string, { count: number; reason?: string }> = {};
  for (const record of read.value.records) {
    if (record.kind !== ECONOMICS_RESTART_RECORD_KIND) continue;
    const payload = record.payload;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
      return { ok: false, code: "state.store.torn", path: read.value.evidence.storePath };
    }
    const source = payload as Record<string, unknown>;
    const workItemRef = source.workItemRef;
    const ordinal = source.ordinal;
    const reason = source.reason;
    if (
      typeof workItemRef !== "string" ||
      typeof ordinal !== "number" ||
      !Number.isInteger(ordinal) ||
      typeof reason !== "string"
    ) {
      return { ok: false, code: "state.store.torn", path: read.value.evidence.storePath };
    }
    const current = counters[workItemRef] ?? { count: 0 };
    counters[workItemRef] = { count: current.count + 1, reason };
  }
  return { ok: true, counts: counters };
};

const mergeMarkers = (
  base: readonly DaemonDegradationMarker[],
  derived: readonly DaemonDegradationMarker[],
): readonly DaemonDegradationMarker[] => {
  const merged: DaemonDegradationMarker[] = [];
  for (const marker of [...base, ...derived]) {
    if (!merged.includes(marker)) merged.push(marker);
  }
  return merged;
};

export type DaemonStatusRead =
  | { readonly ok: true; readonly data: DaemonStatusData }
  | { readonly ok: false; readonly code: string; readonly path: string };

export const readDaemonStatus = (input: DaemonStatusInput): DaemonStatusRead => {
  const instance = readDaemonInstance(input.store);
  if (!instance.ok) return { ok: false, code: "daemon.state-recovery-failed", path: instance.path };
  const heartbeat = readDaemonHeartbeat(input.store);
  if (!heartbeat.ok) {
    return { ok: false, code: "daemon.state-recovery-failed", path: heartbeat.path };
  }
  const lanes = readDaemonLanes(input.store);
  if (!lanes.ok) return { ok: false, code: "daemon.state-recovery-failed", path: lanes.path };
  const reports = readDaemonReconciliations(input.store);
  if (!reports.ok) return { ok: false, code: "daemon.state-recovery-failed", path: reports.path };
  const entries = readQueueEntries(input.store);
  if (!entries.ok) return { ok: false, code: "daemon.state-recovery-failed", path: "queue" };
  const restartCounts = (() => {
    if (input.restartCounts !== undefined) return input.restartCounts;
    const derived = readDaemonRestartCounts(input.store);
    return derived.ok ? derived.counts : undefined;
  })();
  if (restartCounts === undefined) {
    const derived = readDaemonRestartCounts(input.store);
    return {
      ok: false,
      code: "daemon.state-recovery-failed",
      path: derived.ok ? "economics" : derived.path,
    };
  }
  const reconciliation = [...reports.records]
    .reverse()
    .find((record) => record.instanceId === instance.latest?.instanceId);
  const data = foldDaemonStatus({
    ...(instance.latest === undefined ? {} : { instance: instance.latest }),
    ...(heartbeat.latest === undefined ? {} : { heartbeat: heartbeat.latest }),
    lanes: lanes.records,
    restarts: restartCounts,
    ...(reconciliation === undefined ? {} : { reconciliation }),
    queueDepth: entries.records.length,
    heartbeatIntervalMs: input.heartbeatIntervalMs ?? DAEMON_DEFAULT_HEARTBEAT_INTERVAL_MS,
    lockStalenessMs: input.lockStalenessMs ?? DAEMON_DEFAULT_LOCK_STALENESS_MS,
    nowMs: input.nowMs,
    socket: input.socket,
    supervisor: input.supervisor,
    mergeCodePath: input.mergeCodePath,
    degraded: input.degraded,
    ...(input.mode === undefined ? {} : { mode: input.mode }),
  });
  return {
    ok: true,
    data: {
      ...data,
      degraded: mergeMarkers(data.degraded, [
        ...(data.heartbeat.state === "running" ? [] : ["daemon-heartbeat-stale" as const]),
        ...(data.socket.reachable ? [] : ["daemon-unreachable" as const]),
      ]),
    },
  };
};
