/**
 * The daemon command composition root (GH-238 F-1, F-3, F-15).
 *
 * Composes the resident runtime over the injected state store, the daemon lock,
 * the clock, the local transport, the process supervisor, the recovery
 * persistence, and the platform supervisor. It imports no merge execution.
 */

import {
  createLaneExecutor,
  createNodeClock,
  createNodeProcessPort,
  createSupervisorAdapter,
} from "@delivery-os/adapters/daemon";
import {
  createControlServer,
  createDaemonRuntime,
  createLaneLaunchPlanner,
  type DispatchTruthReads,
  daemonScopeDigest,
  decodeControlLine,
  detectDaemonEffects,
  encodeControlFrame,
  evaluateRestartBudget,
  installSupervisor,
  readDaemonHeartbeat,
  readDaemonInstance,
  readDaemonLanes,
  readDaemonStatus,
  readQueueEntries,
  recordDaemonDispatchResult,
  recordResumeIntent,
  runSupervisionCycle,
  uninstallSupervisor,
} from "@delivery-os/core";
import {
  CONTROL_PROTOCOL_CURRENT,
  type ControlTopic,
  type ControlTransport,
  DAEMON_HEARTBEAT_STATES,
  DAEMON_MAX_FRAME_BYTES,
  DAEMON_MAX_STATUS_LANES,
  DAEMON_SUPERVISOR_COMMAND_FORMS,
  DAEMON_SUPERVISOR_RESTART_POLICIES,
  DAEMON_SUPERVISOR_SERVICE_TYPES,
  type DaemonClockPort,
  type DaemonInstanceRecord,
  type DaemonLaneRecord,
  type DaemonLockPort,
  type DaemonProcessPort,
  type DaemonRecoveryPort,
  type DaemonSettings,
  type DaemonStartData,
  type DaemonStartMode,
  type DaemonSupervisorDescriptor,
  type DaemonSupervisorKind,
  type DaemonWakePort,
  DISPATCH_DEFAULT_EVIDENCE_CLASS,
  type DispatchEvidenceClass,
  type DispatchHandoverState,
  ECONOMICS_EXHAUSTION_OPTIONS,
  type HarnessEvidence,
  type HarnessExecutionEnvironmentDescriptor,
  type HarnessKind,
  type HarnessSessionPort,
  type LaneExecutorPort,
  type LaneHandle,
  type LaneLaunchRequest,
  LOCAL_CALLER_PRINCIPAL,
  QUEUE_MAX_ENTRIES,
  type StateStorePort,
  type SupervisorPort,
} from "@delivery-os/core/contracts";
import {
  appendBlockerQuestion,
  appendEconomicsRestartEvent,
  ensureEconomicsExhaustionRecord,
  readBlockerLedger,
  readEconomicsRecords,
} from "@delivery-os/core/state";
import type { DaemonCommandRuntime as CommandRuntime } from "./commands/daemon.js";

export type DaemonComposition = {
  readonly store: StateStorePort;
  readonly lock: DaemonLockPort;
  readonly settings: DaemonSettings;
  readonly restartBound: number;
  readonly stateDirectory: string;
  readonly unit: string;
  readonly binary: string;
  readonly environmentName: string;
  readonly supervisorKind?: DaemonSupervisorKind;
  readonly clock?: DaemonClockPort;
  readonly processPort?: DaemonProcessPort;
  readonly transport?: ControlTransport;
  readonly socketPath?: string;
  readonly daemonEntry?: string;
  /** The composing process id; a positive integer is forwarded to the runtime. */
  readonly pid?: number;
  /** The process signal subscription seam the foreground lifetime owns. */
  readonly signalHost?: {
    readonly once: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
    readonly removeListener: (event: "SIGINT" | "SIGTERM", listener: () => void) => void;
  };
  /**
   * The additional variables the detached child receives. Merged beneath the
   * authoritative `<PREFIX>_STATE_DIR` binding, which is written last; omitting
   * the input keeps the delivered single-variable spawn.
   */
  readonly reentryEnvironment?: Readonly<Record<string, string>>;
  readonly newFenceToken: () => string;
  readonly newLockToken: () => string;
  readonly newInstanceId: () => string;
  readonly nowIso?: () => string;
  readonly mergeCodePath?: "absent" | "present";
  readonly runtime?: ReturnType<typeof createDaemonRuntime>;
  /** The platform supervisor adapter; absent composes the real systemd adapter on Linux. */
  readonly supervisor?: SupervisorPort;
  /** Injected platform for the real supervisor adapter; defaults to the host. */
  readonly platform?: "linux" | "darwin" | "win32";
  /** The user config directory the real supervisor adapter writes under. */
  readonly supervisorConfigDirectory?: string;
  /** The injected wake source for the resident loop. */
  readonly wake?: DaemonWakePort;
  /** The injected lane executor; absence is the declared supervise-only mode. */
  readonly executor?: LaneExecutorPort;
  /** The delivered scheduling seam the supervision cycle consumes. */
  readonly supervision?: {
    readonly nextAction: Parameters<typeof runSupervisionCycle>[0]["ports"]["nextAction"];
    readonly claim: Parameters<typeof runSupervisionCycle>[0]["ports"]["claim"];
    readonly release: Parameters<typeof runSupervisionCycle>[0]["ports"]["release"];
  };
  /** The daemon's effect-detection duty (one bounded query per unresolved effect). */
  readonly detectEffects?: () => Promise<unknown>;
  /** The effect ports composed into `detectDaemonEffects` when no override is given. */
  readonly effects?: {
    readonly list: () => readonly import("@delivery-os/core/contracts").OutboxEffectRecord[];
    readonly logSince: (
      baselineHead: string,
    ) => Promise<import("@delivery-os/core/contracts").CommitLogRead>;
    readonly record: (request: {
      readonly effectId: string;
      readonly baselineHead?: string;
      readonly queryVerdict: "found" | "not-found" | "unreadable";
      readonly discoveredSha?: string;
    }) => { readonly ok: true } | { readonly ok: false; readonly code: string };
  };
  /** The lane-liveness cadence; defaults to the heartbeat interval. */
  readonly livenessIntervalMs?: number;
  /**
   * The dispatch lane composition (GH-239 F-10): the harness session port, the
   * execution-environment descriptor, and the declared environment names. When
   * present, the production planner and executor become available and the
   * daemon path records one attempt per classified lane.
   */
  readonly lane?: {
    readonly session: HarnessSessionPort;
    readonly descriptor: HarnessExecutionEnvironmentDescriptor;
    readonly declaredEnvironment: readonly string[];
    readonly lifecyclePrompt: (request: LaneLaunchRequest) => string;
    readonly repository: string;
    readonly handoverState: DispatchHandoverState;
    readonly evidenceClass?: DispatchEvidenceClass;
    readonly readTruth: () => Promise<DispatchTruthReads>;
    readonly collectEvidence: (handle: LaneHandle) => Promise<HarnessEvidence | undefined>;
  };
};

const supervisorDescriptor = (input: {
  readonly kind: DaemonSupervisorKind;
  readonly unit: string;
  readonly scope: string;
  readonly installed: boolean;
  readonly linger: boolean;
  readonly environmentName?: string;
  readonly stateDirectory?: string;
}): DaemonSupervisorDescriptor => ({
  kind: input.kind,
  installed: input.installed,
  unit: input.unit,
  scope: input.scope,
  linger: input.linger,
  commandForm: DAEMON_SUPERVISOR_COMMAND_FORMS[0],
  serviceType: DAEMON_SUPERVISOR_SERVICE_TYPES[0],
  restartPolicy: DAEMON_SUPERVISOR_RESTART_POLICIES[0],
  ...(input.environmentName === undefined || input.stateDirectory === undefined
    ? {}
    : {
        environment: {
          name: input.environmentName,
          value: input.stateDirectory,
        },
      }),
});

const failure = (code: string, summary?: string) => ({
  error: {
    kind: code.split(".")[0] ?? "fallback",
    code,
    ...(summary === undefined ? {} : { summary }),
  },
});

/** One bounded watch snapshot: the closed topic plus its projected content. */
type WatchSnapshot = { readonly topic: ControlTopic; readonly snapshot: unknown };

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

/** A composing pid is forwarded only when it is a positive integer. */
const positivePid = (pid: number | undefined): number | undefined =>
  pid !== undefined && Number.isInteger(pid) && pid > 0 ? pid : undefined;

/** Sort object keys recursively so equal content serializes identically. */
const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalValue(record[key])]),
    );
  }
  return value;
};

const stableSerialized = (value: unknown): string => JSON.stringify(canonicalValue(value));

/**
 * Bound a projected list by a declared count cap and the frame byte bound.
 * Every dropped row sets `truncated` and names the bound that dropped it.
 */
const boundedProjection = <T>(
  items: readonly T[],
  cap: number,
  build: (visible: readonly T[], truncated: boolean, reason?: string) => unknown,
): unknown => {
  let visible = items.slice(0, cap);
  let truncated = items.length > visible.length;
  let reason = truncated ? "watch-count-bound" : undefined;
  let snapshot = build(visible, truncated, reason);
  while (byteLength(stableSerialized(snapshot)) > DAEMON_MAX_FRAME_BYTES && visible.length > 0) {
    visible = visible.slice(0, Math.floor(visible.length / 2));
    truncated = true;
    reason = "frame-max-bytes";
    snapshot = build(visible, truncated, reason);
  }
  return snapshot;
};

/** The bounded `queue` projection: refs, repositories, and priorities only. */
const queueWatchSnapshot = (store: StateStorePort): unknown | undefined => {
  const read = readQueueEntries(store);
  if (!read.ok) return undefined;
  const entries = read.latest.map((entry) => ({
    ref: entry.ref,
    ...(entry.repository === undefined ? {} : { repository: entry.repository }),
    priority: entry.priority,
  }));
  return boundedProjection(entries, QUEUE_MAX_ENTRIES, (visible, truncated, reason) => ({
    entries: visible,
    counts: { entries: visible.length },
    truncated,
    ...(reason === undefined ? {} : { truncationReason: reason }),
  }));
};

/** The bounded `lanes` projection: the latest execution record per ref. */
const lanesWatchSnapshot = (store: StateStorePort): unknown | undefined => {
  const read = readDaemonLanes(store);
  if (!read.ok) return undefined;
  const latest = new Map<string, DaemonLaneRecord>();
  for (const lane of read.records) latest.set(lane.ref, lane);
  const lanes = [...latest.values()]
    .sort((left, right) => left.ref.localeCompare(right.ref, "en"))
    .map((lane) => ({
      ref: lane.ref,
      state: lane.state,
      ...(lane.harnessKind === undefined ? {} : { harnessKind: lane.harnessKind }),
      ...(lane.sessionId === undefined ? {} : { sessionId: lane.sessionId }),
      ...(lane.classification === undefined ? {} : { classification: lane.classification }),
    }));
  return boundedProjection(lanes, DAEMON_MAX_STATUS_LANES, (visible, truncated, reason) => ({
    lanes: visible,
    counts: { lanes: visible.length },
    truncated,
    ...(reason === undefined ? {} : { truncationReason: reason }),
  }));
};

/**
 * The single bounded watch projection shared by the initial subscribe snapshot
 * and the live `stateChanges` source. A topic publishes only when its stable
 * serialized content changes; the first observation is a baseline, not an event.
 */
const createWatchState = (store: StateStorePort) => {
  const last = new Map<ControlTopic, string>();
  const baselined = new Set<ControlTopic>();
  const snapshotOf = (topic: ControlTopic): unknown | undefined =>
    topic === "queue" ? queueWatchSnapshot(store) : lanesWatchSnapshot(store);
  return {
    snapshot: snapshotOf,
    prime: (topic: ControlTopic): void => {
      const snapshot = snapshotOf(topic);
      if (snapshot === undefined) return;
      last.set(topic, stableSerialized(snapshot));
      baselined.add(topic);
    },
    changes: (): readonly WatchSnapshot[] => {
      const changes: WatchSnapshot[] = [];
      for (const topic of ["queue", "lanes"] as const) {
        const snapshot = snapshotOf(topic);
        if (snapshot === undefined) continue;
        const serialized = stableSerialized(snapshot);
        if (!baselined.has(topic)) {
          baselined.add(topic);
          last.set(topic, serialized);
          continue;
        }
        if (last.get(topic) === serialized) continue;
        last.set(topic, serialized);
        changes.push({ topic, snapshot });
      }
      return changes;
    },
  };
};

type WatchState = ReturnType<typeof createWatchState>;

export type BlockerAnswerConsumerResult =
  | { readonly ok: true; readonly recorded: number }
  | { readonly ok: false; readonly code: string };

/**
 * The blocker-answer resume-intent consumer (F-3; DEC-16; AC-F3-1).
 *
 * Reads durable answers and their questions, and records `resumeIntent` on the
 * lane execution record only when the question's lane has an active session.
 * The answer record itself is never rewritten and stays `applied: false`.
 */
export const createBlockerAnswerConsumer = (composition: {
  readonly store: StateStorePort;
  readonly newFenceToken: () => string;
  readonly nowIso: () => string;
}): (() => BlockerAnswerConsumerResult) => {
  return () => {
    const ledger = readBlockerLedger(composition.store);
    if (!ledger.ok) return { ok: false, code: ledger.error.code };
    const lanes = readDaemonLanes(composition.store);
    if (!lanes.ok) return { ok: false, code: "daemon.state-recovery-failed" };
    const latest = new Map<string, DaemonLaneRecord>();
    for (const lane of lanes.records) latest.set(lane.ref, lane);
    const questionById = new Map(ledger.value.questions.map((question) => [question.id, question]));
    let recorded = 0;
    for (const answer of ledger.value.answers) {
      const question = questionById.get(answer.questionId);
      if (question === undefined) continue;
      const lane = latest.get(question.lane);
      if (lane === undefined || lane.state !== "delivering" || lane.sessionId === undefined) {
        continue;
      }
      if (lane.resumeIntent?.questionId === answer.questionId) continue;
      const updated = recordResumeIntent(
        {
          store: composition.store,
          fenceToken: composition.newFenceToken(),
          nowIso: composition.nowIso,
        },
        lane,
        { questionId: answer.questionId, mode: answer.laneResume.mode },
      );
      if (updated !== undefined) {
        recorded += 1;
        latest.set(lane.ref, updated);
      }
    }
    return { ok: true, recorded };
  };
};

export const createDaemonCommandRuntime = (composition: DaemonComposition): CommandRuntime => {
  const clock = composition.clock ?? createNodeClock();
  const nowIso = composition.nowIso ?? clock.nowIso;
  const composingPid = positivePid(composition.pid);
  const processPort = composition.processPort ?? createNodeProcessPort();
  const platform =
    composition.platform ??
    (process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "win32" : "linux");
  const supervisorKind =
    composition.supervisorKind ??
    (platform === "linux" ? "systemd-user" : platform === "darwin" ? "launchd" : "windows-service");
  const scope = daemonScopeDigest(composition.stateDirectory);
  const composedSupervisor = (): SupervisorPort =>
    composition.supervisor ??
    createSupervisorAdapter({
      platform,
      configDirectory: composition.supervisorConfigDirectory ?? composition.stateDirectory,
      unit: composition.unit,
      scope,
      environmentName: composition.environmentName,
      stateDirectory: composition.stateDirectory,
    });
  const runtimeHolder: { current?: ReturnType<typeof createDaemonRuntime> } = {};
  const recovery = createRecovery(composition);
  const blockerAnswers = createBlockerAnswerConsumer({
    store: composition.store,
    newFenceToken: composition.newFenceToken,
    nowIso,
  });
  const watchState = createWatchState(composition.store);
  const laneExecutor =
    composition.executor ??
    (composition.lane === undefined
      ? undefined
      : createLaneExecutor({
          session: composition.lane.session,
          planner: createLaneLaunchPlanner({
            declaredEnvironment: composition.lane.declaredEnvironment,
            lifecyclePrompt: composition.lane.lifecyclePrompt,
          }),
          descriptor: composition.lane.descriptor,
        }));
  const supervise =
    laneExecutor === undefined
      ? undefined
      : async () =>
          runSupervisionCycle({
            store: composition.store,
            fenceToken: composition.newFenceToken(),
            ports: {
              executor: laneExecutor,
              nextAction: composition.supervision?.nextAction ?? (() => undefined),
              claim:
                composition.supervision?.claim ??
                (() => ({ ok: false as const, code: "queue.precondition.unmet" })),
              release: composition.supervision?.release ?? (() => false),
              nowIso,
              ...(composition.lane === undefined
                ? {}
                : {
                    onCollected: async ({ action, lane, handle, collected }) => {
                      const laneComposition = composition.lane;
                      if (laneComposition === undefined) return;
                      const evidence = await laneComposition.collectEvidence(handle);
                      if (evidence === undefined) return;
                      const reads = await laneComposition.readTruth();
                      recordDaemonDispatchResult({
                        store: composition.store,
                        fenceToken: composition.newFenceToken(),
                        ref: action.ref,
                        repository: laneComposition.repository,
                        sessionId: handle.sessionId,
                        spawnOrdinal: lane.spawnOrdinal,
                        harnessKind: handle.harnessKind as HarnessKind,
                        evidenceClass:
                          laneComposition.evidenceClass ?? DISPATCH_DEFAULT_EVIDENCE_CLASS,
                        handoverState: laneComposition.handoverState,
                        evidence,
                        collected,
                        reads,
                        nowIso: nowIso(),
                        newDivergenceId: () => `DIV-${action.ref}-${handle.sessionId}`,
                      });
                    },
                  }),
              admitRestart: ({ action, lane }) => {
                const read = recovery.readRestarts(action.ref);
                if (!read.ok) return { outcome: "unevaluable" as const, code: read.code };
                const verdict = evaluateRestartBudget({
                  workItemRef: action.ref,
                  bound: composition.restartBound,
                  records: read.records,
                });
                if (verdict.outcome === "admit") {
                  const appended = recovery.appendRestart({
                    schemaId: "delivery.economics.restart.v1",
                    workItemRef: action.ref,
                    runId: lane.sessionId ?? "daemon-liveness",
                    sessionId: lane.sessionId ?? action.ref,
                    ordinal: verdict.nextOrdinal,
                    reason: "watchdog.liveness-stalled",
                    recordedAt: nowIso(),
                  });
                  return appended.ok
                    ? { outcome: "admitted" as const, ordinal: verdict.nextOrdinal }
                    : { outcome: "unevaluable" as const, code: appended.code };
                }
                if (verdict.outcome === "refuse-budget") {
                  recovery.ensureExhaustion({
                    schemaId: "delivery.economics.exhaustion.v1",
                    workItemRef: action.ref,
                    runId: lane.sessionId ?? "daemon-liveness",
                    reason: "dispatch.restart-budget-exceeded",
                    restarts: verdict.count,
                    historyRef: `economics/${action.ref}`,
                    terminal: true,
                    options: [...ECONOMICS_EXHAUSTION_OPTIONS],
                    recordedAt: nowIso(),
                  });
                  recovery.raiseQuestion({
                    ref: action.ref,
                    reason: "restart-budget-exhausted",
                    restarts: verdict.count,
                  });
                  return { outcome: "refused" as const, code: verdict.code };
                }
                return { outcome: "unevaluable" as const, code: verdict.code };
              },
            },
          });
  const runtime =
    composition.runtime ??
    createDaemonRuntime({
      store: composition.store,
      lock: composition.lock,
      clock,
      settings: composition.settings,
      restartBound: composition.restartBound,
      recover: recovery,
      newFenceToken: composition.newFenceToken,
      newLockToken: composition.newLockToken,
      newInstanceId: composition.newInstanceId,
      ...(composingPid === undefined ? {} : { pid: composingPid }),
      ...(composition.wake === undefined ? {} : { wake: composition.wake }),
      ...(composition.executor === undefined ? {} : { executor: composition.executor }),
      ...(supervise === undefined ? {} : { supervision: supervise }),
      ...(composition.livenessIntervalMs === undefined
        ? {}
        : { livenessIntervalMs: composition.livenessIntervalMs }),
      processBlockerAnswers: blockerAnswers,
      ...(composition.detectEffects === undefined
        ? composition.effects === undefined
          ? {}
          : {
              detectEffects: () =>
                detectDaemonEffects({ ...composition.effects!, nowIso: nowIso() }),
            }
        : { detectEffects: composition.detectEffects }),
      openServer: async () => {
        if (composition.transport === undefined) {
          throw new Error("transport-not-composed");
        }
        const server = createControlServer({
          transport: composition.transport,
          clock,
          handlers: controlHandlers(composition, clock, runtimeHolder, watchState),
          subscriptionBuffer: composition.settings.subscriptionBuffer,
          responseTimeoutMs: composition.settings.responseTimeoutMs,
          stateChanges: watchState.changes,
        });
        await server.start();
        return server;
      },
    });
  runtimeHolder.current = runtime;

  const socket = (reachable: boolean) => ({
    path: composition.socketPath ?? composition.settings.socketPath,
    transport: composition.settings.transport,
    reachable,
  });

  let probeOrdinal = 0;
  const probe = async (): Promise<{ readonly reachable: boolean; readonly code?: string }> => {
    if (composition.transport === undefined) return { reachable: false };
    let connection: Awaited<ReturnType<ControlTransport["connect"]>>;
    try {
      connection = await composition.transport.connect();
    } catch {
      return { reachable: false };
    }
    try {
      probeOrdinal += 1;
      const id = `probe-${probeOrdinal}`;
      let response: unknown;
      let failureCode: string | undefined;
      let settle: (() => void) | undefined;
      const received = new Promise<void>((resolve) => {
        settle = resolve;
        connection.onLine((line) => {
          const decoded = decodeControlLine(line);
          if (!decoded.ok) {
            failureCode = decoded.code;
            resolve();
            return;
          }
          const frame = decoded.frame;
          if (!("id" in frame) || frame.id !== id) return;
          if (frame.kind === "response") {
            response = frame.data;
            resolve();
          } else if (frame.kind === "error") {
            failureCode = frame.error.code;
            resolve();
          }
        });
        connection.onClose(() => resolve());
      });
      const sendFrame = connection.write;
      sendFrame(
        encodeControlFrame({
          v: CONTROL_PROTOCOL_CURRENT,
          kind: "request",
          type: "status",
          id,
          payload: {},
          callerPrincipal: LOCAL_CALLER_PRINCIPAL,
        } as never),
      );
      const timedOut = await Promise.race([
        received.then(() => false),
        clock.sleep(composition.settings.responseTimeoutMs).then(() => true),
      ]);
      if (timedOut) {
        settle?.();
        return { reachable: false, code: "daemon.socket-unreachable" };
      }
      if (response !== undefined) return { reachable: true };
      return {
        reachable: false,
        ...(failureCode === undefined ? {} : { code: failureCode }),
      };
    } finally {
      connection.close();
    }
  };

  const currentMode = (): DaemonStartMode => {
    const active = runtime.state();
    if (active !== undefined) return active.mode;
    return composition.executor?.availability().available === true ? "resident" : "supervise-only";
  };

  const startData = (state: NonNullable<ReturnType<typeof runtime.state>>): DaemonStartData => {
    const { instance } = state;
    return {
      instance: {
        instanceId: instance.instanceId,
        pid: instance.pid,
        scope: instance.scope,
        acquiredAt: instance.acquiredAt,
        mode: state.mode,
      },
      reconciliation: state.reconciliation,
      socket: socket(state.socketReachable),
      heartbeat: { intervalMs: composition.settings.heartbeatIntervalMs, ageMs: 0 },
      supervisor: supervisorDescriptor({
        kind: supervisorKind,
        unit: composition.unit,
        scope,
        installed: false,
        linger: false,
      }),
      degraded: [...state.degraded],
    };
  };

  const statusOf = async ({ live }: { readonly live: boolean }) => {
    const probed = await probe();
    const read = readDaemonStatus({
      store: composition.store,
      nowMs: clock.nowMs(),
      heartbeatIntervalMs: composition.settings.heartbeatIntervalMs,
      lockStalenessMs: composition.settings.lockStalenessMs,
      socket: socket(probed.reachable),
      supervisor: supervisorDescriptor({
        kind: supervisorKind,
        unit: composition.unit,
        scope,
        installed: false,
        linger: false,
      }),
      mergeCodePath: composition.mergeCodePath ?? "absent",
      degraded: runtime.state()?.degraded ?? [],
      mode: currentMode(),
    });
    if (!read.ok) return failure("daemon.state-recovery-failed", read.path);
    if (!live) return { data: { ...read.data, live: false } };
    if (!probed.reachable) return failure("daemon.socket-unreachable");
    if (read.data.heartbeat.state !== DAEMON_HEARTBEAT_STATES[0]) {
      return failure("daemon.heartbeat-stale");
    }
    return { data: { ...read.data, live: true } };
  };

  return {
    start: async ({ foreground }) => {
      if (!foreground && composition.daemonEntry !== undefined) {
        // The state binding is written last and stays authoritative: a forwarded
        // look-alike of the same variable can never win. An absent re-entry input
        // keeps the delivered single-variable spawn byte-identical.
        const spawnEnvironment =
          composition.reentryEnvironment === undefined
            ? { [composition.environmentName]: composition.stateDirectory }
            : {
                ...composition.reentryEnvironment,
                [composition.environmentName]: composition.stateDirectory,
              };
        const spawned = processPort.spawnDetached({
          entry: composition.daemonEntry,
          args: ["daemon", "start", "--foreground"],
          environment: spawnEnvironment,
        });
        if (spawned.pid === undefined) return failure("daemon.state-recovery-failed");
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await clock.sleep(50, { cancelled: () => false });
          const instance = readDaemonInstance(composition.store);
          if (instance.ok && instance.latest?.operation === "acquired") {
            const state = runtime.state();
            if (state !== undefined) return { data: startData(state) };
            const heartbeat = readDaemonHeartbeat(composition.store);
            const reports = readDaemonStatus({
              store: composition.store,
              nowMs: clock.nowMs(),
              socket: socket(true),
              supervisor: supervisorDescriptor({
                kind: supervisorKind,
                unit: composition.unit,
                scope,
                installed: false,
                linger: false,
              }),
              mergeCodePath: composition.mergeCodePath ?? "absent",
              degraded: [],
            });
            if (reports.ok && reports.data.instance !== null) {
              const mode = currentMode();
              return {
                data: {
                  instance: { ...reports.data.instance, mode },
                  reconciliation: reports.data.reconciliation ?? {
                    schema: "delivery.daemon.reconciliation.v1",
                    instanceId: instance.latest.instanceId,
                    queue: { entries: 0, edges: 0, parks: 0 },
                    lanes: [],
                    duplicates: 0,
                    questions: [],
                    startedAt:
                      heartbeat.ok && heartbeat.latest !== undefined
                        ? heartbeat.latest.beatAt
                        : nowIso(),
                    completedAt: nowIso(),
                    truncated: false,
                    recordedAt: nowIso(),
                  },
                  socket: socket(true),
                  heartbeat: {
                    intervalMs: composition.settings.heartbeatIntervalMs,
                    ageMs: reports.data.heartbeat.ageMs,
                  },
                  supervisor: reports.data.supervisor,
                  degraded: reports.data.degraded,
                },
              };
            }
          }
        }
        return failure("daemon.state-recovery-failed", "resident-readiness-timeout");
      }
      const started = await runtime.start({ foreground });
      if (!started.ok) return failure(started.code, started.detail);
      return { data: startData(started.state) };
    },
    stop: async ({ mode }) => {
      const active = runtime.state();
      if (active !== undefined) {
        const stopped = await runtime.stop(mode);
        if (!stopped.ok) return failure(stopped.code, stopped.detail);
        const status = await statusOf({ live: false });
        const statusData = "data" in status ? status.data : undefined;
        return {
          data: {
            result: stopped.result === "draining" ? "draining" : "stopped",
            instance: statusData?.instance ?? null,
            detachedLanes: stopped.detachedLanes,
            degraded: [],
          },
        };
      }
      const instance = readDaemonInstance(composition.store);
      if (!instance.ok) return failure("daemon.state-recovery-failed");
      const latest: DaemonInstanceRecord | undefined = instance.latest;
      if (
        latest === undefined ||
        latest.operation === "released" ||
        latest.operation === "immediate-stop"
      ) {
        return { data: { result: "noop", instance: null, detachedLanes: [], degraded: [] } };
      }
      const signalled = processPort.signal(latest.pid, mode === "drain" ? "SIGTERM" : "SIGINT");
      if (!signalled.ok) return failure("daemon.state-recovery-failed", signalled.detail);
      return {
        data: {
          result: mode === "drain" ? "draining" : "stopped",
          instance: {
            instanceId: latest.instanceId,
            pid: latest.pid,
            scope: latest.scope,
            acquiredAt: latest.acquiredAt,
            mode: currentMode(),
          },
          detachedLanes: [],
          degraded: [],
        },
      };
    },
    status: statusOf,
    loop: () => runtime.loop(),
    install: async () => {
      const installed = installSupervisor(composedSupervisor(), {
        unit: composition.unit,
        scope,
        stateDirectory: composition.stateDirectory,
        binary: composition.binary,
        environmentName: composition.environmentName,
        enableLinger: true,
      });
      if (installed.ok) return { data: installed.data };
      const summary = [installed.platform, installed.detail]
        .filter((part) => part !== undefined)
        .join(" ");
      return failure(installed.code, summary.length === 0 ? undefined : summary);
    },
    uninstall: async () => {
      const removed = uninstallSupervisor(composedSupervisor(), composition.unit);
      return removed.ok ? { data: removed.data } : failure(removed.code, removed.detail);
    },
  };
};

const createRecovery = (composition: DaemonComposition): DaemonRecoveryPort => ({
  readRestarts: (workItemRef) => {
    const read = readEconomicsRecords(composition.store, workItemRef);
    if (!read.ok) return { ok: false, code: read.code };
    return { ok: true, records: read.restarts };
  },
  appendRestart: (record) => {
    const appended = appendEconomicsRestartEvent(
      composition.store,
      composition.newFenceToken(),
      record,
    );
    return appended.ok
      ? { ok: true, appended: appended.appended, record: appended.record }
      : { ok: false, code: appended.code };
  },
  ensureExhaustion: (record) => {
    const ensured = ensureEconomicsExhaustionRecord(
      composition.store,
      composition.newFenceToken(),
      record,
    );
    return ensured.ok
      ? { ok: true, appended: ensured.appended, record: ensured.record }
      : { ok: false, code: ensured.code };
  },
  raiseQuestion: (input) => {
    const questionId = `daemon-restart-${input.ref}`;
    const appended = appendBlockerQuestion(composition.store, {
      fenceToken: composition.newFenceToken(),
      record: {
        schemaId: "delivery.blocker.question.v1",
        id: questionId,
        type: "decision-needed",
        audience: "owner",
        lane: input.ref,
        ref: input.ref,
        question: `Restart budget exhausted for ${input.ref}; choose a recovery option.`,
        options: [...ECONOMICS_EXHAUSTION_OPTIONS],
        askedAt: (composition.nowIso ?? (() => new Date(0).toISOString()))(),
        callerPrincipal: LOCAL_CALLER_PRINCIPAL,
      },
    });
    return appended.ok ? { ok: true, questionId } : { ok: false, code: appended.error.code };
  },
});

const controlHandlers = (
  composition: DaemonComposition,
  clock: DaemonClockPort,
  holder: { current?: ReturnType<typeof createDaemonRuntime> },
  watchState: WatchState,
) => ({
  poke: () => {
    void holder.current?.tick();
    return { ok: true as const, data: { applied: true as const } };
  },
  status: () => {
    const read = readDaemonStatus({
      store: composition.store,
      nowMs: clock.nowMs(),
      socket: {
        path: composition.socketPath ?? composition.settings.socketPath,
        transport: composition.settings.transport,
        reachable: true,
      },
      supervisor: supervisorDescriptor({
        kind: composition.supervisorKind ?? "systemd-user",
        unit: composition.unit,
        scope: "",
        installed: false,
        linger: false,
      }),
      mergeCodePath: composition.mergeCodePath ?? "absent",
      degraded: [],
    });
    if (!read.ok) return { ok: false as const, code: read.code };
    return {
      ok: true as const,
      data: {
        live: true as const,
        instance: read.data.instance,
        queueDepth: read.data.queueDepth,
        lanes: read.data.lanes,
      },
    };
  },
  lane: (payload: { readonly ref: string }) => {
    const lanes = readDaemonLanes(composition.store);
    if (!lanes.ok) return { ok: false as const, code: "daemon.state-recovery-failed" };
    const latest = new Map<string, DaemonLaneRecord>();
    for (const lane of lanes.records) latest.set(lane.ref, lane);
    const lane = latest.get(payload.ref);
    return lane === undefined
      ? { ok: false as const, code: "queue.entry.unobserved" }
      : { ok: true as const, data: { live: true as const, lane } };
  },
  subscribe: (payload: { readonly topic: "queue" | "lanes" }) => {
    const snapshot = watchState.snapshot(payload.topic);
    if (snapshot === undefined) {
      return { ok: false as const, code: "daemon.state-recovery-failed" };
    }
    watchState.prime(payload.topic);
    return { ok: true as const, data: { topic: payload.topic, snapshot, cursor: 0 } };
  },
  drain: (payload: { readonly lockToken: string }) => {
    const active = holder.current?.state();
    if (active === undefined) return { ok: false as const, code: "daemon.socket-unreachable" };
    const lock = composition.lock.read();
    if (lock.state === "held" && lock.record.lockToken !== payload.lockToken) {
      return { ok: false as const, code: "fallback.invocation" };
    }
    void holder.current?.stop("drain");
    return { ok: true as const, data: { draining: true as const, lanes: [] } };
  },
  stop: (payload: { readonly lockToken: string }) => {
    const active = holder.current?.state();
    if (active === undefined) return { ok: false as const, code: "daemon.socket-unreachable" };
    const lock = composition.lock.read();
    if (lock.state === "held" && lock.record.lockToken !== payload.lockToken) {
      return { ok: false as const, code: "fallback.invocation" };
    }
    void holder.current?.stop("immediate");
    return { ok: true as const, data: { stopping: true as const } };
  },
  takeover: () => ({ ok: false as const, code: "daemon.takeover-refused" }),
});
