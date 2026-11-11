/**
 * The resident lifecycle over injected ports (GH-238 F-1, F-2, F-3, F-7, F-12;
 * EVT-1, EVT-2; AC-F1-1, AC-F3-2, AC-F5-1, AC-F12-2).
 *
 * Acquire/take over the daemon lock, reconcile, append the instance acquisition,
 * open the transport, begin the heartbeat, and serve. A lock the staleness
 * evaluation has proved dead (contract conformance to DEC-6/RSK-11) is removed
 * by a compare-and-delete on the observed token immediately before the
 * exclusive re-acquire, so a crash never wedges a restart and a concurrent
 * winner's fresh lock is never removed. Drain releases cleanly and records live
 * lanes detached; immediate stops without signalling any lane. An unclean exit
 * appends nothing and leaves a stale lock for the next start to take over.
 */
import {
  DAEMON_INSTANCE_PAYLOAD_SCHEMA,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type DaemonClockPort,
  type DaemonDegradationMarker,
  type DaemonHeartbeatRecord,
  type DaemonInstanceRecord,
  type DaemonLaneCounts,
  type DaemonLaneRecord,
  type DaemonLockPort,
  type DaemonReconciliationRecord,
  type DaemonRecoveryPort,
  type DaemonSettings,
  type DaemonStartMode,
  type DaemonStopMode,
  type DaemonWakePort,
  type LaneExecutorPort,
  type StateStorePort,
} from "#contracts";
import { buildHeartbeat } from "../domain/daemon-heartbeat.js";
import { daemonScopeDigest, evaluateDaemonLock, takeoverEvidence } from "../domain/daemon-lock.js";
import type { ControlServer } from "./control-server.js";
import {
  appendDaemonHeartbeat,
  appendDaemonInstance,
  appendDaemonLane,
  readDaemonHeartbeat,
  readDaemonInstance,
  readDaemonLanes,
} from "./daemon.js";
import { type DaemonEvidenceProvider, reconcileDaemon } from "./daemon-reconcile.js";
import { readQueueEntries } from "./queue.js";

export type DaemonRuntimePorts = {
  readonly store: StateStorePort;
  readonly lock: DaemonLockPort;
  readonly clock: DaemonClockPort;
  readonly settings: DaemonSettings;
  readonly recover: DaemonRecoveryPort;
  readonly restartBound: number;
  readonly newFenceToken: () => string;
  readonly newLockToken: () => string;
  readonly newInstanceId: () => string;
  readonly evidence?: DaemonEvidenceProvider;
  /** Opens the control plane; a rejected open is a declared degradation. */
  readonly openServer?: () => Promise<ControlServer>;
  readonly pid?: number;
  /** The wake source: poke, event-log tail, or the bounded poll fallback. */
  readonly wake?: DaemonWakePort;
  /** The injected lane executor; its absence is the declared supervise-only mode. */
  readonly executor?: LaneExecutorPort;
  /** One supervision pass; called on the lane-liveness cadence. */
  readonly supervision?: () => Promise<unknown>;
  /** The daemon's effect-detection duty; called on the heartbeat-cycle cadence. */
  readonly detectEffects?: () => Promise<unknown>;
  /** The blocker-answer resume-intent consumer; called on the heartbeat cadence. */
  readonly processBlockerAnswers?: () =>
    | { readonly ok: true; readonly recorded: number }
    | { readonly ok: false; readonly code: string };
  /** The lane-liveness cadence; defaults to the heartbeat interval. */
  readonly livenessIntervalMs?: number;
  /** Whether the invoking command stays attached (foreground) or returned at readiness. */
  readonly foreground?: boolean;
  /** Auto-run the wake loop when a wake source is injected; tests may disable it. */
  readonly autoRun?: boolean;
};

export type DaemonRuntimeFailure = {
  readonly ok: false;
  readonly code: string;
  readonly detail?: string;
};

export type DaemonRuntimeState = {
  readonly instance: DaemonInstanceRecord;
  readonly reconciliation: DaemonReconciliationRecord;
  readonly heartbeat: DaemonHeartbeatRecord;
  readonly degraded: readonly DaemonDegradationMarker[];
  readonly socketReachable: boolean;
  readonly mode: DaemonStartMode;
};

export type DaemonTickResult =
  | {
      readonly ok: true;
      readonly heartbeat?: DaemonHeartbeatRecord;
      readonly supervision?: unknown;
      readonly effects?: unknown;
      readonly blockerAnswers?: unknown;
    }
  | DaemonRuntimeFailure;

export type DaemonRuntime = {
  readonly start: (options?: {
    readonly foreground?: boolean;
  }) => Promise<{ readonly ok: true; readonly state: DaemonRuntimeState } | DaemonRuntimeFailure>;
  readonly heartbeat: () => DaemonHeartbeatRecord | undefined;
  /** One bounded cadence pass over the injected clock; never sleeps. */
  readonly tick: () => Promise<DaemonTickResult>;
  /** Run the wake-driven loop until `stop`; only starts when a wake source exists. */
  readonly loop: () => Promise<void>;
  readonly stop: (mode: DaemonStopMode) => Promise<
    | {
        readonly ok: true;
        readonly result: "stopped" | "draining";
        readonly detachedLanes: readonly string[];
      }
    | DaemonRuntimeFailure
  >;
  readonly state: () => DaemonRuntimeState | undefined;
  readonly server: () => ControlServer | undefined;
};

const laneCounts = (lanes: readonly DaemonLaneRecord[]): DaemonLaneCounts => {
  const latest = new Map<string, DaemonLaneRecord>();
  for (const lane of lanes) latest.set(lane.ref, lane);
  const counts = { delivering: 0, idle: 0, parked: 0, failed: 0 };
  for (const lane of latest.values()) {
    if (lane.state === "delivering") counts.delivering += 1;
    else if (lane.state === "failed") counts.failed += 1;
    else if (lane.state === "detached") counts.parked += 1;
    else counts.idle += 1;
  }
  return counts;
};

export const createDaemonRuntime = (ports: DaemonRuntimePorts): DaemonRuntime => {
  let state: DaemonRuntimeState | undefined;
  let server: ControlServer | undefined;
  let lockToken: string | undefined;
  let heartbeatOrdinal = 0;
  let lastHeartbeatAtMs = 0;
  let lastSupervisionAtMs = 0;
  let lastEffectsAtMs = 0;
  let lastBlockerAnswersAtMs = 0;
  let loopRunning = false;
  let loopCancelled = false;

  const nowIso = (): string => ports.clock.nowIso();

  const releaseFailedStart = (instance: DaemonInstanceRecord | undefined): void => {
    if (lockToken !== undefined) {
      ports.lock.remove(lockToken);
      lockToken = undefined;
    }
    if (instance !== undefined) {
      const at = nowIso();
      appendDaemonInstance(ports.store, ports.newFenceToken(), {
        ...instance,
        operation: "released",
        releaseReason: "shutdown",
        heartbeatAt: at,
        recordedAt: at,
      });
    }
    state = undefined;
  };

  const writeHeartbeat = (): DaemonHeartbeatRecord | undefined => {
    if (state === undefined) return undefined;
    const entries = readQueueEntries(ports.store);
    const lanes = readDaemonLanes(ports.store);
    const latest = [...(lanes.ok ? lanes.records : [])]
      .reverse()
      .find((lane) => lane.state === "delivering");
    const at = nowIso();
    heartbeatOrdinal += 1;
    const beat = buildHeartbeat({
      instanceId: state.instance.instanceId,
      ordinal: heartbeatOrdinal,
      beatAt: at,
      uptimeMs: ports.clock.nowMs() - Date.parse(state.instance.acquiredAt),
      queueDepth: entries.ok ? entries.records.length : 0,
      laneCounts: lanes.ok
        ? laneCounts(lanes.records)
        : { delivering: 0, idle: 0, parked: 0, failed: 0 },
      ...(latest?.sessionId === undefined || latest.ref === undefined
        ? {}
        : { currentSpawn: { ref: latest.ref, sessionId: latest.sessionId } }),
      cursor: 0,
      recordedAt: at,
    });
    const appended = appendDaemonHeartbeat(ports.store, ports.newFenceToken(), beat);
    if (!appended.ok) return undefined;
    if (lockToken !== undefined) ports.lock.heartbeat(lockToken, at);
    state = { ...state, heartbeat: beat };
    return beat;
  };

  const tick = async (): Promise<DaemonTickResult> => {
    if (state === undefined) {
      return { ok: false, code: "daemon.state-recovery-failed", detail: "not-running" };
    }
    const now = ports.clock.nowMs();
    const heartbeatIntervalMs = Math.max(1, ports.settings.heartbeatIntervalMs);
    let heartbeat: DaemonHeartbeatRecord | undefined;
    if (now - lastHeartbeatAtMs >= heartbeatIntervalMs) {
      heartbeat = writeHeartbeat();
      if (heartbeat === undefined) {
        return { ok: false, code: "daemon.state-recovery-failed", detail: "heartbeat" };
      }
      lastHeartbeatAtMs = now;
    }
    server?.expire();
    let blockerAnswers: unknown;
    if (
      ports.processBlockerAnswers !== undefined &&
      now - lastBlockerAnswersAtMs >= heartbeatIntervalMs
    ) {
      blockerAnswers = ports.processBlockerAnswers();
      lastBlockerAnswersAtMs = now;
    }
    const livenessIntervalMs = Math.max(1, ports.livenessIntervalMs ?? heartbeatIntervalMs);
    let supervision: unknown;
    if (ports.supervision !== undefined && now - lastSupervisionAtMs >= livenessIntervalMs) {
      supervision = await ports.supervision();
      lastSupervisionAtMs = now;
    }
    let effects: unknown;
    if (
      ports.detectEffects !== undefined &&
      now - lastEffectsAtMs >= Math.max(1, ports.settings.heartbeatCycleMs)
    ) {
      effects = await ports.detectEffects();
      lastEffectsAtMs = now;
    }
    // Live subscribers see only changed bounded snapshots; a no-change tick
    // publishes nothing. Bounded buffers and overflow degradation stay in the
    // session layer, and the never-awaited writes cannot block the loop.
    server?.publishState();
    return {
      ok: true,
      ...(heartbeat === undefined ? {} : { heartbeat }),
      ...(supervision === undefined ? {} : { supervision }),
      ...(effects === undefined ? {} : { effects }),
      ...(blockerAnswers === undefined ? {} : { blockerAnswers }),
    };
  };

  const runLoop = async (): Promise<void> => {
    if (loopRunning) return;
    loopRunning = true;
    loopCancelled = false;
    try {
      while (!loopCancelled && state !== undefined) {
        const timeoutMs = Math.max(1, ports.settings.heartbeatIntervalMs);
        if (ports.wake !== undefined) {
          await ports.wake.next(timeoutMs);
        } else {
          await ports.clock.sleep(timeoutMs, { cancelled: () => loopCancelled });
        }
        if (loopCancelled || state === undefined) break;
        await tick();
      }
    } finally {
      loopRunning = false;
    }
  };

  return {
    start: async (options) => {
      if (state !== undefined) {
        return { ok: false, code: "daemon.already-running" };
      }
      const read = ports.lock.read();
      const decision = evaluateDaemonLock({
        lock: read,
        nowMs: ports.clock.nowMs(),
        stalenessMs: ports.settings.lockStalenessMs,
      });
      if (decision.kind === "already-running") {
        return {
          ok: false,
          code: "daemon.already-running",
          detail: `instance=${decision.holder.instanceId} pid=${decision.holder.pid} acquired_at=${decision.holder.acquiredAt} heartbeat_at=${decision.holder.heartbeatAt} heartbeat_age_ms=${decision.heartbeatAgeMs} takeover_at=${nowIso()}`,
        };
      }
      if (decision.kind === "unreadable") {
        return { ok: false, code: "daemon.state-recovery-failed", detail: decision.path };
      }
      if (decision.kind === "takeover") {
        // Contract conformance (GH-286 NF-1; DEC-6, RSK-11): the staleness
        // evaluation PROVED the observed lock dead, so the record it observed is
        // removed before the exclusive re-acquire. The removal is a
        // compare-and-delete keyed on that observed `lockToken`: a lock a
        // concurrent starter replaced in the meantime answers
        // `state.lock.busy` and is left in place, so that one outcome falls
        // through to the delivered busy mapping below. Any other refusal — a
        // write failure, a permission denial, or an unreadable record — is that
        // failure's own identity and is surfaced instead of being reported as a
        // bare `daemon.already-running` (NF3-5).
        const reaped = ports.lock.remove(decision.previous.lockToken);
        if (!reaped.ok && reaped.code !== "state.lock.busy") {
          return { ok: false, code: reaped.code, detail: reaped.path };
        }
      }
      const at = nowIso();
      const newToken = ports.newLockToken();
      const instanceId = ports.newInstanceId();
      const acquired = ports.lock.acquire({
        lockToken: newToken,
        instanceId,
        pid: ports.pid ?? 0,
        scope: daemonScopeDigest(ports.store.identity.stateDirectory),
        acquiredAt: at,
        heartbeatAt: at,
      });
      if (!acquired.ok) {
        return {
          ok: false,
          code: acquired.code === "state.lock.busy" ? "daemon.already-running" : acquired.code,
          detail: acquired.path,
        };
      }
      lockToken = newToken;
      const instance: DaemonInstanceRecord = {
        schema: DAEMON_INSTANCE_PAYLOAD_SCHEMA,
        instanceId,
        pid: ports.pid ?? 0,
        scope: daemonScopeDigest(ports.store.identity.stateDirectory),
        lockToken: newToken,
        operation: decision.kind === "takeover" ? "taken-over" : "acquired",
        acquiredAt: at,
        heartbeatAt: at,
        ...(decision.kind === "takeover"
          ? { takeover: takeoverEvidence(decision.previous, decision.heartbeatAgeMs, at) }
          : {}),
        recordedAt: at,
      };
      const instanceAppend = appendDaemonInstance(ports.store, ports.newFenceToken(), instance);
      if (!instanceAppend.ok) {
        ports.lock.remove(newToken);
        lockToken = undefined;
        return { ok: false, code: "daemon.state-recovery-failed", detail: instanceAppend.path };
      }
      const reconciled = reconcileDaemon({
        store: ports.store,
        fenceToken: ports.newFenceToken(),
        instanceId,
        nowIso: at,
        restartBound: ports.restartBound,
        reconcileMaxLanes: ports.settings.reconcileMaxLanes,
        recover: ports.recover,
        ...(ports.evidence === undefined ? {} : { evidence: ports.evidence }),
      });
      if (!reconciled.ok) {
        releaseFailedStart(instance);
        return { ok: false, code: "daemon.state-recovery-failed", detail: reconciled.path };
      }
      const degraded: DaemonDegradationMarker[] = [];
      const executorAvailable =
        ports.executor !== undefined && ports.executor.availability().available;
      if (!executorAvailable) degraded.push("lane-executor-unavailable");
      if (ports.openServer !== undefined) {
        try {
          server = await ports.openServer();
        } catch {
          degraded.push("daemon-socket-unreachable");
          server = undefined;
        }
      }
      const entries = readQueueEntries(ports.store);
      const lanes = readDaemonLanes(ports.store);
      const beat = buildHeartbeat({
        instanceId,
        ordinal: 1,
        beatAt: at,
        uptimeMs: 0,
        queueDepth: entries.ok ? entries.records.length : 0,
        laneCounts: lanes.ok
          ? laneCounts(lanes.records)
          : { delivering: 0, idle: 0, parked: 0, failed: 0 },
        cursor: 0,
        recordedAt: at,
      });
      heartbeatOrdinal = 1;
      const beatAppend = appendDaemonHeartbeat(ports.store, ports.newFenceToken(), beat);
      if (!beatAppend.ok) {
        await server?.stop();
        server = undefined;
        releaseFailedStart(instance);
        return { ok: false, code: "daemon.state-recovery-failed", detail: beatAppend.path };
      }
      const mode: DaemonStartMode = !executorAvailable
        ? "supervise-only"
        : (options?.foreground ?? ports.foreground) === true
          ? "foreground"
          : "resident";
      state = {
        instance,
        reconciliation: reconciled.record,
        heartbeat: beat,
        degraded,
        socketReachable: server !== undefined,
        mode,
      };
      const startedAtMs = Date.parse(at);
      lastHeartbeatAtMs = startedAtMs;
      lastSupervisionAtMs = startedAtMs;
      lastEffectsAtMs = startedAtMs;
      lastBlockerAnswersAtMs = startedAtMs;
      if (ports.processBlockerAnswers !== undefined) ports.processBlockerAnswers();
      if (ports.wake !== undefined && ports.autoRun !== false) void runLoop();
      return { ok: true, state };
    },
    heartbeat: writeHeartbeat,
    tick,
    loop: runLoop,
    stop: async (mode) => {
      if (state === undefined || lockToken === undefined) {
        return { ok: false, code: "daemon.state-recovery-failed" };
      }
      loopCancelled = true;
      const at = nowIso();
      const detachedLanes: string[] = [];
      if (mode === "drain") {
        const lanes = readDaemonLanes(ports.store);
        if (lanes.ok) {
          for (const lane of lanes.records) {
            if (lane.state !== "delivering") continue;
            detachedLanes.push(lane.ref);
            appendDaemonLane(ports.store, ports.newFenceToken(), {
              ...lane,
              schema: DAEMON_LANE_PAYLOAD_SCHEMA,
              state: "detached",
              detachedAt: at,
              recordedAt: at,
            });
          }
        }
      }
      const release: DaemonInstanceRecord = {
        ...state.instance,
        operation: mode === "drain" ? "released" : "immediate-stop",
        releaseReason: mode === "drain" ? "drain" : "immediate",
        heartbeatAt: at,
        recordedAt: at,
      };
      const appended = appendDaemonInstance(ports.store, ports.newFenceToken(), release);
      if (!appended.ok) return { ok: false, code: appended.code, detail: appended.path };
      await server?.stop();
      server = undefined;
      ports.lock.remove(lockToken);
      lockToken = undefined;
      state = undefined;
      return { ok: true, result: mode === "drain" ? "draining" : "stopped", detachedLanes };
    },
    state: () => state,
    server: () => server,
  };
};

/** The latest heartbeat is available for readiness evidence after a start. */
export const readRuntimeHeartbeat = (store: StateStorePort): DaemonHeartbeatRecord | undefined => {
  const read = readDaemonHeartbeat(store);
  return read.ok ? read.latest : undefined;
};

/** The latest instance is available for stop-idempotence checks. */
export const readRuntimeInstance = (store: StateStorePort): DaemonInstanceRecord | undefined => {
  const read = readDaemonInstance(store);
  return read.ok ? read.latest : undefined;
};
