/**
 * The pure status fold (GH-238 F-1, F-7, F-12, F-17; DM-13, DM-14).
 *
 * Every value derives from durable records; no process introspection. Bounds are
 * applied explicitly and every drop sets a named truncation reason.
 */
import {
  DAEMON_MAX_HUMAN_BYTES,
  DAEMON_MAX_HUMAN_LINES,
  DAEMON_MAX_STATUS_LANES,
  type DaemonDegradationMarker,
  type DaemonHeartbeatRecord,
  type DaemonInstanceRecord,
  type DaemonLaneRecord,
  type DaemonMergeCodePath,
  type DaemonReconciliationRecord,
  type DaemonStartMode,
  type DaemonStatusData,
  type DaemonStatusLane,
  type DaemonStatusRestart,
  type DaemonStatusSocket,
  type DaemonSupervisorDescriptor,
} from "#contracts";
import { foldDaemonLiveness } from "./daemon-heartbeat.js";

export type DaemonStatusFoldInput = {
  readonly instance?: DaemonInstanceRecord;
  readonly heartbeat?: DaemonHeartbeatRecord;
  readonly lanes: readonly DaemonLaneRecord[];
  readonly restarts: Readonly<Record<string, { readonly count: number; readonly reason?: string }>>;
  readonly reconciliation?: DaemonReconciliationRecord;
  readonly queueDepth: number;
  readonly heartbeatIntervalMs: number;
  readonly lockStalenessMs: number;
  readonly nowMs: number;
  readonly socket: DaemonStatusSocket;
  readonly supervisor: DaemonSupervisorDescriptor;
  readonly mergeCodePath: DaemonMergeCodePath;
  readonly degraded: readonly DaemonDegradationMarker[];
  readonly maxLanes?: number;
  /** The truthfully projected runtime mode; resident when omitted. */
  readonly mode?: DaemonStartMode;
};

const laneReason = (lane: DaemonLaneRecord): string | undefined => {
  if (lane.state === "failed") {
    return lane.liveness?.classification === "stalled"
      ? "liveness-stalled"
      : "restart-budget-exhausted";
  }
  return undefined;
};

export const foldDaemonStatus = (input: DaemonStatusFoldInput): DaemonStatusData => {
  const maxLanes = input.maxLanes ?? DAEMON_MAX_STATUS_LANES;
  const latestByRef = new Map<string, DaemonLaneRecord>();
  for (const lane of input.lanes) latestByRef.set(lane.ref, lane);
  const allLanes: DaemonStatusLane[] = [...latestByRef.values()].map((lane) => {
    const reason = laneReason(lane);
    const restarts = input.restarts[lane.ref];
    return {
      ref: lane.ref,
      state: lane.state,
      ...(reason === undefined ? {} : { reason }),
      ...(lane.harnessKind === undefined ? {} : { harnessKind: lane.harnessKind }),
      ...(lane.sessionId === undefined ? {} : { sessionId: lane.sessionId }),
      ...(restarts === undefined ? {} : { restarts: restarts.count }),
    };
  });
  const lanes = allLanes.slice(0, maxLanes);
  const truncated = allLanes.length > lanes.length;
  const liveness = foldDaemonLiveness({
    instance: input.instance,
    heartbeat: input.heartbeat,
    nowMs: input.nowMs,
    stalenessMs: input.lockStalenessMs,
  });
  const restarts: DaemonStatusRestart[] = Object.entries(input.restarts)
    .map(([ref, value]) => ({
      ref,
      count: value.count,
      ...(value.reason === undefined ? {} : { reason: value.reason }),
      classified: value.reason !== undefined,
    }))
    .sort((left, right) => left.ref.localeCompare(right.ref, "en"));
  return {
    instance:
      input.instance === undefined
        ? null
        : {
            instanceId: input.instance.instanceId,
            pid: input.instance.pid,
            scope: input.instance.scope,
            acquiredAt: input.instance.acquiredAt,
            mode: input.mode ?? "resident",
          },
    uptimeMs:
      input.instance === undefined
        ? 0
        : Math.max(0, input.nowMs - Date.parse(input.instance.acquiredAt)),
    queueDepth: input.queueDepth,
    lanes,
    restarts,
    heartbeat: {
      ageMs: liveness.ageMs,
      intervalMs: input.heartbeatIntervalMs,
      state: liveness.state,
    },
    socket: input.socket,
    supervisor: input.supervisor,
    reconciliation: input.reconciliation ?? null,
    mergeCodePath: input.mergeCodePath,
    degraded: [...input.degraded],
    truncated,
    ...(truncated ? { truncationReason: "status-lanes-bound" } : {}),
  };
};

/** A deterministic, bounded human summary; the same data always renders alike. */
export const renderDaemonStatusHuman = (data: DaemonStatusData): string => {
  const lines = [
    `result=${data.degraded.length > 0 ? "degraded" : "ok"}`,
    `instance=${data.instance?.instanceId ?? "none"}`,
    `pid=${data.instance?.pid ?? "-"}`,
    `heartbeat=${data.heartbeat.state}${data.heartbeat.ageMs === null ? "" : `:${data.heartbeat.ageMs}ms`}`,
    `queue_depth=${data.queueDepth}`,
    `lanes=${data.lanes.length}`,
    `restarts=${data.restarts.length}`,
    `socket=${data.socket.transport}:${data.socket.reachable ? "reachable" : "unreachable"}`,
    `supervisor=${data.supervisor.kind}:${data.supervisor.installed ? "installed" : "absent"}`,
    `merge_code_path=${data.mergeCodePath}`,
    `degraded=${data.degraded.length === 0 ? "none" : data.degraded.join(",")}`,
    ...data.lanes.map(
      (lane) =>
        `lane=${lane.ref}:${lane.state}${lane.reason === undefined ? "" : `:${lane.reason}`}`,
    ),
  ];
  const bounded: string[] = [];
  let bytes = 0;
  for (const line of lines) {
    const next = `${line}\n`;
    const nextBytes = new TextEncoder().encode(next).length;
    if (
      bounded.length >= DAEMON_MAX_HUMAN_LINES - 1 ||
      bytes + nextBytes > DAEMON_MAX_HUMAN_BYTES
    ) {
      break;
    }
    bounded.push(line);
    bytes += nextBytes;
  }
  if (bounded.length < lines.length) {
    bounded.push(`truncated=true reason=${data.truncationReason ?? "human-bound"}`);
  }
  return `${bounded.join("\n")}\n`;
};
