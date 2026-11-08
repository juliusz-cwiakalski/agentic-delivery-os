/**
 * Heartbeat and liveness policy (GH-238 F-7; DM-2; AC-F7-1).
 *
 * Pure builders and a three-state fold. A gap is stale evidence; a reader never
 * synthesizes a beat.
 */
import type {
  DaemonHeartbeatRecord,
  DaemonHeartbeatState,
  DaemonInstanceRecord,
  DaemonLaneCounts,
} from "#contracts";

export type DaemonHeartbeatInput = {
  readonly instanceId: string;
  readonly ordinal: number;
  readonly beatAt: string;
  readonly uptimeMs: number;
  readonly queueDepth: number;
  readonly laneCounts: DaemonLaneCounts;
  readonly currentSpawn?: { readonly ref: string; readonly sessionId: string };
  readonly cursor: number;
  readonly recordedAt: string;
};

export const buildHeartbeat = (input: DaemonHeartbeatInput): DaemonHeartbeatRecord => ({
  schema: "delivery.daemon.heartbeat.v1",
  instanceId: input.instanceId,
  ordinal: input.ordinal,
  beatAt: input.beatAt,
  uptimeMs: Math.max(0, Math.trunc(input.uptimeMs)),
  queueDepth: Math.max(0, Math.trunc(input.queueDepth)),
  laneCounts: { ...input.laneCounts },
  ...(input.currentSpawn === undefined ? {} : { currentSpawn: input.currentSpawn }),
  cursor: Math.max(0, Math.trunc(input.cursor)),
  recordedAt: input.recordedAt,
});

export type DaemonLiveness = {
  readonly state: DaemonHeartbeatState;
  readonly ageMs: number | null;
};

/**
 * Fold liveness from the latest instance and heartbeat. `stopped` wins when the
 * latest instance recorded a release or immediate stop; otherwise an absent beat
 * is `stale` with a null age, and an age at or beyond the bound is `stale`.
 */
export const foldDaemonLiveness = (input: {
  readonly instance: DaemonInstanceRecord | undefined;
  readonly heartbeat: DaemonHeartbeatRecord | undefined;
  readonly nowMs: number;
  readonly stalenessMs: number;
}): DaemonLiveness => {
  if (
    input.instance !== undefined &&
    (input.instance.operation === "released" || input.instance.operation === "immediate-stop")
  ) {
    return { state: "stopped", ageMs: null };
  }
  if (input.heartbeat === undefined) return { state: "stale", ageMs: null };
  const ageMs = Math.max(0, input.nowMs - Date.parse(input.heartbeat.beatAt));
  return { state: ageMs >= input.stalenessMs ? "stale" : "running", ageMs };
};
