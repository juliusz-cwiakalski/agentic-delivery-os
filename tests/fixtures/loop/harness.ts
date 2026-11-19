/**
 * The in-process loop harness (GH-348 D2 driver).
 *
 * Builds one temp state root, an in-process `runCli` over the real command
 * definition, and injected ledger/clock/id/config/process/session/log/delay
 * seams. Both command families are registered — `loop` AND `coordinator` —
 * because production mounts both and the identity-isolation case drives each
 * surface on its declared harness (R-08). Every effect is recorded: spawns,
 * resumes, joins, alive probes, signals, progress reads, log lines, delays, and
 * state appends. No test writes the live tree, spawns a process, or waits.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCoordinatorCommandDefinition } from "../../../packages/cli/src/commands/coordinator";
import {
  type CoordinatorSupervisorPorts,
  createCoordinatorSupervisor,
} from "../../../packages/cli/src/commands/coordinator-loop";
import { createLoopCommandDefinition } from "../../../packages/cli/src/commands/loop";
import { runCli } from "../../../packages/cli/src/index";
import {
  absentSessionFacts,
  createLoopSupervisor,
  type LoopDelayReason,
  type LoopLedgerPort,
  type LoopLogSink,
  type LoopSessionFacts,
  type LoopSupervisor,
} from "../../../packages/core/src/app/index";
import type {
  CoordinatorConfigKey,
  CoordinatorKillFailureReason,
  CoordinatorKillOutcome,
  CoordinatorProgressState,
  DaemonProcessPort,
  LoopDeliveryReading,
  LoopLogEvent,
  LoopSessionRecord,
  LoopStopRecord,
} from "../../../packages/core/src/contracts/index";
import { renderLogLine } from "../../../packages/core/src/domain/index";
import {
  appendCoordinatorRestart,
  appendCoordinatorStuck,
  appendLoopSession,
  appendLoopStop,
  readCoordinatorRecords,
  readLoopRecords,
} from "../../../packages/core/src/state/index";
import { createTestEdge, makeIdentity, openStore } from "../state/harness";
import { createLogFs, type LogFs } from "./log-fs";
import { createScriptedSession, type ScriptedSession } from "./session";

export const LOOP_ID = "loop-main";

export const LOOP_TEST_BRAND = {
  productName: "Delivery OS",
  binaryName: "delivery-os",
  packageScope: "@delivery-os",
  environmentPrefix: "DELIVERY_OS",
  configDirectoryName: ".delivery-os",
  stateDirectoryName: ".delivery-os/state",
  mcpToolPrefix: "delivery_os",
  telemetryNamespace: "delivery-os",
  docsBaseUrl: "https://example.invalid/docs",
  repositoryUrl: "https://example.invalid/repo",
  releaseAssetPrefix: "delivery-os",
  installPath: "/usr/local/bin",
} as const;

export const LOOP_DEFAULT_SETTINGS = {
  "coordinator.stuck-window": 600_000,
  "coordinator.kill-grace": 20_000,
  "coordinator.restart-budget": 10,
  "coordinator.resume-context-limit": 100_000,
  "coordinator.collection-interval": 30_000,
  "coordinator.progress-bound": 300_000,
} as const;

export type LoopHarnessOptions = {
  readonly label?: string;
  readonly settings?: Partial<Record<CoordinatorConfigKey, number>>;
  readonly session?: Parameters<typeof createScriptedSession>[0];
  /** How many cycle iterations the injected driver runs before its declared end. */
  readonly cycles?: number;
  /** The driver's declared exit once the cycles are spent. */
  readonly exit?: "stopped" | "signal";
  /** The virtual time the injected driver advances before each cycle. */
  readonly cycleStepMs?: number;
  /** The supervisor's own recorded identity. */
  readonly own?: { readonly pid: number; readonly processStartTimeMs: number } | null;
  readonly declared?: Partial<{
    readonly alive: boolean;
    readonly killWithGrace: boolean;
    readonly startTimeIdentity: boolean;
  }>;
  /** Per-pid declared probe answers; `null` means declared but no answer. */
  readonly alive?: Readonly<Record<number, boolean | null>>;
  readonly startTimes?: Readonly<Record<number, number>>;
  /** Makes every log append fail (the bounded-attempt path). */
  readonly logFails?: boolean;
  /** The sourced progress reading; `null` is unreadable (F-5). */
  readonly progressReading?: {
    readonly state: CoordinatorProgressState;
    readonly observedAtMs: number | null;
  } | null;
  readonly delivery?: LoopDeliveryReading;
  /**
   * The artifact-advance model: `true` is a constant advance; an array is the
   * instants of seeded advance records, compared against the supervisor's
   * baseline exactly as production does (F-5).
   */
  readonly artifactAdvanced?: boolean | readonly number[];
  readonly killOutcome?: CoordinatorKillOutcome | "capability-gap";
  readonly killFailureReason?: CoordinatorKillFailureReason;
  readonly admissionState?: "admit" | "refuse" | "unevaluable";
};

export type LoopHarness = {
  readonly root: string;
  readonly store: ReturnType<typeof openStore>["store"];
  readonly clock: { value: number; nowMs(): number; nowIso(): string };
  readonly settings: Record<CoordinatorConfigKey, number>;
  readonly supervisor: LoopSupervisor;
  readonly sessionPort: ScriptedSession;
  readonly logFs: LogFs;
  readonly counters: {
    readonly appends: number;
    readonly reads: number;
    readonly spawns: number;
    readonly resumes: number;
    readonly joins: number;
    readonly readsInHandler: number;
    /** The supervisor's own verified snapshots (the evaluation reads). */
    readonly snapshots: number;
    readonly cycles: number;
  };
  readonly process: {
    readonly signals: readonly { readonly pid: number; readonly signal: string }[];
    readonly probes: number;
    /** Every probe target, in call order (F-3's "never probe with 0" control). */
    readonly probeTargets: readonly { readonly pid: number; readonly processStartTimeMs: number }[];
  };
  /** The recorded terminate calls, the admission decisions, and progress reads. */
  readonly verdicts: {
    readonly kills: readonly string[];
    readonly admissions: readonly { readonly ordinal: number; readonly budgetEpochId: string }[];
    readonly progressReads: number;
  };
  /** Every rendered log line, in append order. */
  readonly lines: readonly string[];
  /** Every recorded delay, in call order. */
  readonly delays: readonly { readonly ms: number; readonly reason: LoopDelayReason }[];
  /** The driver's recorded cycle invocations. */
  readonly cycles: number;
  run: (argv: readonly string[]) => Promise<{
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
    readonly json: Record<string, unknown> | undefined;
  }>;
  /** The loop's own record sets, read through the delivered per-identity read. */
  loopRecords: () => {
    readonly sessions: readonly LoopSessionRecord[];
    readonly stops: readonly LoopStopRecord[];
  };
  /** The coordinator record kinds the loop writes under its identity. */
  coordinatorRecords: () => ReturnType<typeof readCoordinatorRecords>;
  seedSession: (record: Partial<LoopSessionRecord>) => void;
  seedStop: (record: Partial<LoopStopRecord>) => void;
  seedFence: (input: {
    readonly action: "acquired" | "released" | "stale-takeover" | "stop-requested";
    readonly pid?: number;
    readonly processStartTimeMs?: number;
    readonly recordedAt?: string;
    readonly instanceId?: string;
    readonly budgetEpochId?: string | null;
  }) => void;
  setSessionFacts: (overrides: Partial<LoopSessionFacts>) => void;
  setLogFails: (value: boolean) => void;
  setAlive: (pid: number, answer: boolean | null) => void;
  setProgressReading: (
    value: {
      readonly state: CoordinatorProgressState;
      readonly observedAtMs: number | null;
    } | null,
  ) => void;
  setDelivery: (value: LoopDeliveryReading) => void;
  dataOf: (result: {
    readonly json: Record<string, unknown> | undefined;
  }) => Record<string, unknown>;
  errorCodeOf: (result: { readonly json: Record<string, unknown> | undefined }) => string;
};

const HOLDER_FOR = (pid: number, start: number): string => `pid:${pid}:start:${start}`;

export const createLoopHarness = (options: LoopHarnessOptions = {}): LoopHarness => {
  const root = mkdtempSync(join(tmpdir(), `gh348-loop-${options.label ?? "case"}-`));
  const identity = makeIdentity(root);
  const clock = {
    value: 1_000_000,
    nowMs: () => clock.value,
    nowIso: () => new Date(clock.value).toISOString(),
  };
  const { store } = openStore(identity, { edge: createTestEdge({ clock }) });

  const settings = { ...LOOP_DEFAULT_SETTINGS, ...options.settings } as Record<
    CoordinatorConfigKey,
    number
  >;
  const settingsView = {
    stuckWindowMs: settings["coordinator.stuck-window"],
    killGraceMs: settings["coordinator.kill-grace"],
    restartBudget: settings["coordinator.restart-budget"],
    resumeContextLimit: settings["coordinator.resume-context-limit"],
    collectionIntervalMs: settings["coordinator.collection-interval"],
    progressBoundMs: settings["coordinator.progress-bound"],
  };

  const counters = {
    appends: 0,
    reads: 0,
    snapshots: 0,
    spawns: 0,
    resumes: 0,
    joins: 0,
    readsInHandler: 0,
  };
  const signals: { pid: number; signal: string }[] = [];
  const probeTargets: { readonly pid: number; readonly processStartTimeMs: number }[] = [];
  let probes = 0;
  const aliveAnswers: Record<number, boolean | null> = { ...(options.alive ?? {}) };
  const startTimes: Record<number, number> = { ...(options.startTimes ?? {}) };
  const own = options.own === undefined ? { pid: 9001, processStartTimeMs: 1_000 } : options.own;

  const capabilities = {
    alive: options.declared?.alive ?? true,
    killWithGrace: options.declared?.killWithGrace ?? true,
    startTimeIdentity: options.declared?.startTimeIdentity ?? true,
  };

  const port: DaemonProcessPort = {
    spawnDetached: () => ({ code: "daemon.state-recovery-failed" }),
    signal: (pid, signal) => {
      signals.push({ pid, signal });
      return { ok: true };
    },
    isAlive: (pid) => aliveAnswers[pid] === true,
    ...(capabilities.startTimeIdentity ? { startTimeMs: (pid: number) => startTimes[pid] } : {}),
  };

  const sessionPort = createScriptedSession({
    ...options.session,
    ...(options.session?.facts === undefined
      ? { facts: { ...absentSessionFacts(), ...(options.session?.facts ?? {}) } }
      : {}),
  });

  let progressReading =
    options.progressReading === undefined
      ? { state: "positive" as CoordinatorProgressState, observedAtMs: 1_000_000 }
      : options.progressReading;
  let delivery: LoopDeliveryReading = options.delivery ?? "none";
  const artifactAdvances: boolean | readonly number[] = options.artifactAdvanced ?? false;
  const kills: string[] = [];
  const admissions: { ordinal: number; budgetEpochId: string }[] = [];
  let progressReads = 0;

  const logFs = createLogFs();
  const lines: string[] = [];
  const delays: { ms: number; reason: LoopDelayReason }[] = [];
  let logFails = options.logFails === true;

  const logSink: LoopLogSink = {
    append: (event: LoopLogEvent, pairs) => {
      if (logFails) throw new Error("log-unavailable");
      const line = renderLogLine({
        recordedAt: clock.nowIso(),
        event,
        ...(pairs === undefined ? {} : { pairs }),
      });
      if (line === null) return;
      lines.push(line);
      logFs.append(line);
    },
    available: () => !logFails,
    read: (lines) => logFs.readTail(lines),
  };

  let fenceCounter = 0;
  const newFenceToken = (): string => {
    fenceCounter += 1;
    return `fence-${String(fenceCounter)}`;
  };

  const guardedStore = {
    ...store,
    get identity() {
      return store.identity;
    },
    readRecords() {
      counters.reads += 1;
      return store.readRecords();
    },
    append(
      handle: Parameters<typeof store.append>[0],
      request: Parameters<typeof store.append>[1],
    ) {
      counters.appends += 1;
      return store.append(handle, request);
    },
  } as typeof store;

  const ledger: LoopLedgerPort = {
    read: () => {
      counters.snapshots += 1;
      const raw = guardedStore.readRecords();
      const cached: typeof guardedStore = { ...guardedStore, readRecords: () => raw };
      return {
        loop: readLoopRecords(cached, LOOP_ID),
        coordinator: readCoordinatorRecords(cached, LOOP_ID),
      };
    },
    acquireFence: (token) => guardedStore.acquireFence(token),
    releaseFence: (handle) => {
      guardedStore.releaseFence(handle);
    },
    fenceStatus: () => {
      const status = guardedStore.fenceStatus();
      return { held: status.held, stale: status.stale };
    },
    recoverFence: (token) => guardedStore.recoverFence(token).ok,
    appendSession: (record) => appendLoopSession(guardedStore, newFenceToken(), record),
    appendStuck: (record) => {
      const appended = appendCoordinatorStuck(guardedStore, newFenceToken(), record);
      return appended.ok
        ? { ok: true, appended: appended.appended }
        : { ok: false, code: appended.code };
    },
    appendStop: (record) => {
      const appended = appendLoopStop(guardedStore, newFenceToken(), record);
      return appended.ok
        ? { ok: true, appended: appended.appended }
        : { ok: false, code: appended.code };
    },
    appendRestart: (record) => {
      const appended = appendCoordinatorRestart(guardedStore, newFenceToken(), record);
      return appended.ok
        ? { ok: true, appended: appended.appended }
        : { ok: false, code: appended.code };
    },
    lastRestartSequence: () => {
      const read = guardedStore.readRecords();
      if (!read.ok) return null;
      for (let index = read.value.records.length - 1; index >= 0; index -= 1) {
        const entry = read.value.records[index];
        if (entry?.kind === "coordinator.restart" && entry.key.endsWith(`:${LOOP_ID}`)) {
          return entry.sequence;
        }
      }
      return null;
    },
    appendFence: (record, held) => {
      const appendWith = (handle: Parameters<typeof guardedStore.append>[0]) => {
        const result = guardedStore.append(handle, {
          kind: "coordinator.fence",
          recordKey: `coordinator.fence:${LOOP_ID}`,
          payload: record,
        });
        return result.ok ? { ok: true as const } : { ok: false as const, code: result.error.code };
      };
      if (held !== undefined) return appendWith(held);
      const appended = store.acquireFence(newFenceToken());
      if (!appended.ok) return { ok: false, code: appended.error.code };
      try {
        return appendWith(appended.value.handle);
      } finally {
        guardedStore.releaseFence(appended.value.handle);
      }
    },
  };

  let cyclesRun = 0;
  const maxCycles = options.cycles ?? 1;
  let idCounter = 0;

  const supervisor = createLoopSupervisor({
    ledger,
    clock,
    newFenceToken,
    newId: (prefix: string) => {
      idCounter += 1;
      return `${prefix}-${String(idCounter).padStart(4, "0")}`;
    },
    loopId: LOOP_ID,
    settings: settingsView,
    processPort: {
      port,
      capabilities,
      probe: (target) => {
        probes += 1;
        probeTargets.push(target);
        const answer = aliveAnswers[target.pid];
        return answer === undefined ? false : answer;
      },
      ownIdentity: () => own,
    },
    session: {
      ...sessionPort.port,
      join: async () => {
        const base = await sessionPort.port.join();
        if (!base.ok) return base;
        // A cross-process re-find joins the DURABLE newest loop.session; a fresh
        // process has no in-memory facts, which is exactly what production seeds
        // from the ledger (F-6).
        const durable = readLoopRecords(guardedStore, LOOP_ID);
        const newest = durable.ok ? durable.sessions[durable.sessions.length - 1] : undefined;
        const current = sessionPort.facts();
        const sessionId = current.sessionId ?? newest?.sessionId ?? base.sessionId;
        const pid = current.pid ?? newest?.pid ?? base.pid;
        const processStartTimeMs =
          current.processStartTimeMs ?? newest?.processStartTimeMs ?? base.processStartTimeMs;
        const harnessKind = current.harnessKind || newest?.harnessKind || base.harnessKind;
        const title = current.title ?? newest?.title ?? base.title;
        const alive = pid !== null && aliveAnswers[pid] === true;
        if (alive) {
          sessionPort.setFacts({
            sessionId,
            liveness: "alive",
            harnessKind,
            pid,
            processStartTimeMs,
            title,
          });
        }
        return { ...base, sessionId, harnessKind, pid, processStartTimeMs, title };
      },
    },
    progress: {
      read: () => {
        progressReads += 1;
        return progressReading;
      },
    },
    corroborator: { read: () => delivery },
    artifactAdvanced: (sinceMs) => {
      if (sinceMs === null) return false;
      if (typeof artifactAdvances === "boolean") return artifactAdvances;
      return artifactAdvances.some((at) => at > sinceMs);
    },
    terminate: async () => {
      const outcome = options.killOutcome ?? "terminated";
      kills.push(outcome);
      return {
        outcome,
        failureReason:
          outcome === "failed"
            ? (options.killFailureReason ?? "identity-mismatch")
            : outcome === "capability-gap"
              ? null
              : null,
      };
    },
    admission: ({ ordinal, budgetEpochId }) => {
      admissions.push({ ordinal, budgetEpochId });
      const state = options.admissionState ?? "admit";
      return { state, nextOrdinal: ordinal };
    },
    log: logSink,
    delay: async (ms, reason) => {
      delays.push({ ms, reason });
    },
    loop: {
      run: async (onCycle) => {
        const step = options.cycleStepMs ?? settings["coordinator.collection-interval"];
        for (let index = 0; index < maxCycles; index += 1) {
          clock.value += step;
          cyclesRun += 1;
          const outcome = await onCycle();
          if (outcome === "stop") return options.exit ?? "stopped";
        }
        return options.exit ?? "stopped";
      },
    },
  });

  // The coordinator family is registered over the same store so the
  // identity-isolation case can drive `coordinator start --foreground`. It is
  // the DELIVERED command definition over the delivered supervisor under the
  // coordinator identity, so the isolation proof exercises the real claim.
  const coordinatorPorts: CoordinatorSupervisorPorts = {
    store,
    clock,
    newFenceToken,
    newId: (prefix: string) => `${prefix}-coord`,
    coordinatorId: "coordinator-main",
    stateDirectory: root,
    settings: settingsView,
    processPort: {
      port,
      capabilities,
      probe: (target) => aliveAnswers[target.pid] === true,
      ownIdentity: () => own,
      wait: async () => undefined,
      progress: () => ({ newTurn: "unknown", observedAtMs: null }),
    },
    session: {
      read: () => ({
        sessionId: null,
        liveness: "absent",
        contextTokens: null,
        harnessKind: "opencode",
        completedCleanly: false,
        resumable: false,
        resumeDeclared: false,
        pid: null,
        processStartTimeMs: null,
      }),
      apply: async () => ({ ok: true }),
      wake: async () => ({ ok: true }),
    },
    loop: { run: async () => "stopped" },
  };
  const coordinatorSupervisor = createCoordinatorSupervisor(coordinatorPorts);

  const coordinatorRun = async (argv: readonly string[]) => {
    let stdout = "";
    let stderr = "";
    const code = await runCli(
      argv,
      {
        stdout: {
          write: (chunk: string) => {
            stdout += chunk;
          },
        },
        stderr: {
          write: (chunk: string) => {
            stderr += chunk;
          },
        },
      },
      {
        brand: LOOP_TEST_BRAND,
        clock: { now: () => clock.nowMs() },
        newRunId: () => "run-1",
        secrets: [],
        program: {
          commands: { coordinator: createCoordinatorCommandDefinition(coordinatorSupervisor) },
        },
        mode: "interactive",
      },
    );
    let json: Record<string, unknown> | undefined;
    if (argv.includes("--json")) {
      try {
        json = JSON.parse(stdout) as Record<string, unknown>;
      } catch {
        json = undefined;
      }
    }
    return { code, stdout, stderr, json };
  };

  const run = async (argv: readonly string[]) => {
    if (argv[0] === "coordinator") return coordinatorRun(argv);
    let stdout = "";
    let stderr = "";
    const code = await runCli(
      argv,
      {
        stdout: {
          write: (chunk: string) => {
            stdout += chunk;
          },
        },
        stderr: {
          write: (chunk: string) => {
            stderr += chunk;
          },
        },
      },
      {
        brand: LOOP_TEST_BRAND,
        clock: { now: () => clock.nowMs() },
        newRunId: () => "run-1",
        secrets: [],
        program: {
          commands: {
            loop: createLoopCommandDefinition({
              start: supervisor.start,
              status: supervisor.status,
              stop: supervisor.stop,
              reset: supervisor.reset,
              log: supervisor.log,
            }),
          },
        },
        mode: "interactive",
      },
    );
    let json: Record<string, unknown> | undefined;
    if (argv.includes("--json")) {
      try {
        json = JSON.parse(stdout) as Record<string, unknown>;
      } catch {
        json = undefined;
      }
    }
    return { code, stdout, stderr, json };
  };

  const loopRead = () => readLoopRecords(store, LOOP_ID);

  return {
    root,
    store,
    clock,
    settings,
    supervisor,
    sessionPort,
    logFs,
    counters: {
      get appends() {
        return counters.appends;
      },
      get reads() {
        return counters.reads;
      },
      get spawns() {
        return sessionPort.spawns.length;
      },
      get resumes() {
        return sessionPort.resumes.length;
      },
      get joins() {
        return sessionPort.joins;
      },
      get readsInHandler() {
        return counters.readsInHandler;
      },
      get snapshots() {
        return counters.snapshots;
      },
      get cycles() {
        return cyclesRun;
      },
    },
    process: {
      signals,
      get probes() {
        return probes;
      },
      get probeTargets() {
        return probeTargets;
      },
    },
    verdicts: {
      kills,
      admissions,
      get progressReads() {
        return progressReads;
      },
    },
    get lines() {
      return lines;
    },
    delays,
    get cycles() {
      return cyclesRun;
    },
    run,
    loopRecords: () => {
      const read = loopRead();
      return read.ok ? { sessions: read.sessions, stops: read.stops } : { sessions: [], stops: [] };
    },
    coordinatorRecords: () => readCoordinatorRecords(store, LOOP_ID),
    seedSession: (record) => {
      const appended = appendLoopSession(store, newFenceToken(), {
        schemaId: "delivery.loop.session.v1",
        sessionRecordId: record.sessionRecordId ?? "session-record-seed",
        loopId: LOOP_ID,
        sessionId: record.sessionId ?? "session-1",
        harnessKind: record.harnessKind ?? "opencode",
        pid: record.pid === undefined ? 4242 : record.pid,
        processStartTimeMs:
          record.processStartTimeMs === undefined ? 2_000 : record.processStartTimeMs,
        title: record.title === undefined ? "ceo-loop-20261119-100000" : record.title,
        state: record.state ?? "active",
        acquiredAt: record.acquiredAt ?? clock.nowIso(),
        recordedAt: record.recordedAt ?? clock.nowIso(),
      });
      if (!appended.ok) throw new Error(appended.code);
    },
    seedStop: (record) => {
      const appended = appendLoopStop(store, newFenceToken(), {
        schemaId: "delivery.loop.stop.v1",
        stopId: record.stopId ?? "stop-seed",
        loopId: LOOP_ID,
        action: record.action ?? "requested",
        mode: record.mode === undefined ? "drain" : record.mode,
        recordedAt: record.recordedAt ?? clock.nowIso(),
      });
      if (!appended.ok) throw new Error(appended.code);
    },
    seedFence: (input) => {
      const pid = input.pid ?? 4242;
      const start = input.processStartTimeMs ?? 2_000;
      const token = newFenceToken();
      const acquired = store.acquireFence(token);
      if (!acquired.ok) throw new Error(acquired.error.code);
      try {
        const appended = guardedStore.append(acquired.value.handle, {
          kind: "coordinator.fence",
          recordKey: `coordinator.fence:${LOOP_ID}`,
          payload: {
            schemaId: "delivery.coordinator.fence.v1",
            fenceId: `fence-seed-${input.action}`,
            instanceId: input.instanceId ?? "instance-seed",
            coordinatorId: LOOP_ID,
            action: input.action,
            holder: HOLDER_FOR(pid, start),
            pid,
            processStartTimeMs: start,
            supervisorMode: "foreground",
            externalUnit: "absent",
            previousHolder: null,
            fenceAgeMs: null,
            budgetEpochId: input.budgetEpochId ?? null,
            recordedAt: input.recordedAt ?? clock.nowIso(),
          },
        });
        if (!appended.ok) throw new Error(appended.error.code);
      } finally {
        guardedStore.releaseFence(acquired.value.handle);
      }
    },
    setSessionFacts: (overrides) => {
      sessionPort.setFacts(overrides);
    },
    setLogFails: (value) => {
      logFails = value;
    },
    setAlive: (pid, answer) => {
      aliveAnswers[pid] = answer;
    },
    setProgressReading: (value) => {
      progressReading = value;
    },
    setDelivery: (value) => {
      delivery = value;
    },
    dataOf: (result) => {
      const envelope = result.json;
      if (envelope === undefined) throw new Error("missing JSON envelope");
      const data = envelope["data"];
      if (typeof data !== "object" || data === null) throw new Error("missing data");
      return data as Record<string, unknown>;
    },
    errorCodeOf: (result) => {
      const envelope = result.json;
      if (envelope === undefined) throw new Error("missing JSON envelope");
      const error = envelope["error"];
      if (typeof error !== "object" || error === null) throw new Error("missing error");
      return String((error as { code?: unknown }).code);
    },
  };
};

export { LOOP_DEFAULT_SETTINGS as DEFAULT_SETTINGS };
