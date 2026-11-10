/**
 * The in-process coordinator harness (GH-241 TC-COORD-003..099).
 *
 * Builds one temp state root, an in-process `runCli` over the real command
 * definition, and injected clock/id/fence/config/state/process/session/blocker
 * seams. Every effect is recorded: spawn, resume, join, wake, alive probes,
 * kill signals, progress reads, and state appends. No test writes the live tree,
 * spawns a process, or uses a wall-clock timer.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCoordinatorCommandDefinition } from "../../../packages/cli/src/commands/coordinator.js";
import {
  type CoordinatorLoopExit,
  type CoordinatorSessionFacts,
  type CoordinatorSupervisor,
  type CoordinatorSupervisorPorts,
  createCoordinatorSupervisor,
} from "../../../packages/cli/src/commands/coordinator-loop.js";
import { runCli } from "../../../packages/cli/src/index.js";
import type {
  BlockerAnswerRecord,
  BlockerQuestionRecord,
  BrandIdentity,
  CoordinatorConfigKey,
  CoordinatorObservation,
  CoordinatorProcessPortCapabilities,
  CoordinatorProgressState,
  CoordinatorWakeEffect,
  DaemonProcessPort,
} from "../../../packages/core/src/contracts/index";
import {
  appendBlockerAnswer,
  appendBlockerQuestion,
  type CoordinatorRecordsRead,
  readBlockerLedger,
  readCoordinatorRecords,
} from "../../../packages/core/src/state/index";
import { createTestEdge, makeIdentity, openStore } from "../state/harness";
import { type CycleDriverOptions, createCycleDriver } from "./cycle-driver.js";
import { COORDINATOR_ID } from "./states";

export const TEST_BRAND: BrandIdentity = {
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
};

export const DEFAULT_SETTINGS = {
  stuckWindowMs: 600_000,
  killGraceMs: 20_000,
  restartBudget: 10,
  resumeContextLimit: 100_000,
  collectionIntervalMs: 30_000,
  progressBoundMs: 300_000,
} as const;

export type HarnessSessionState = {
  facts: CoordinatorSessionFacts;
  progress: { newTurn: CoordinatorProgressState; observedAtMs: number | null };
  resumeDeclared: boolean;
};

export type CoordinatorHarnessOptions = {
  readonly label?: string;
  readonly settings?: Partial<Record<CoordinatorConfigKey, number>>;
  readonly declared?: Partial<CoordinatorProcessPortCapabilities>;
  /** Per-pid declared probe answers; `null` means declared but no answer. */
  readonly alive?: Readonly<Record<number, boolean | null>>;
  readonly startTimes?: Readonly<Record<number, number>>;
  /** The session facts; defaults to an absent session with a recorded prior. */
  readonly session?: Partial<CoordinatorSessionFacts>;
  readonly progress?: { newTurn: CoordinatorProgressState; observedAtMs: number | null };
  readonly cycle?: CycleDriverOptions;
  readonly killOutcome?: "terminated" | "forced" | "failed";
  readonly signalFails?: boolean;
  /** The supervisor's own recorded identity. */
  readonly own?: { pid: number; processStartTimeMs: number } | null;
  /** Seeds blockers after the store opens. */
  readonly questions?: readonly BlockerQuestionRecord[];
  readonly answers?: readonly BlockerAnswerRecord[];
  /** Overrides `appendBlockerQuestion` behaviour (publish failure controls). */
  readonly publishFails?: boolean;
  /** Injected fence staleness window (with the harness clock). */
  readonly staleFenceMs?: number;
  /** Makes the session wake delivery fail (no durable record). */
  readonly wakeFails?: boolean;
  /**
   * Models a delivered session port whose successful resume/spawn is observed
   * as a live session on the next read (the production handle behaviour).
   */
  readonly applyMakesAlive?: boolean;
  /** Makes the session spawn resume fail with the delivered harness identity. */
  readonly spawnFails?: boolean;
  /** Makes a `released` fence append fail (the loop's release-failure path). */
  readonly releaseFails?: boolean;
  /** Makes a `released` fence append fail with the busy-fence identity. */
  readonly releaseBusy?: boolean;
};

export type CoordinatorHarness = {
  readonly root: string;
  readonly store: ReturnType<typeof openStore>["store"];
  readonly clock: { value: number; nowMs(): number; nowIso(): string };
  readonly settings: Record<CoordinatorConfigKey, number>;
  readonly supervisor: CoordinatorSupervisor;
  readonly session: HarnessSessionState & {
    joinCalls: number;
    resumeCalls: number;
    spawnCalls: number;
    wakeCalls: number;
    /** Every effect actually handed to the wake port, in order. */
    readonly wakeEffects: readonly CoordinatorWakeEffect[];
    apply(
      effect: "attach" | "resume" | "spawn",
    ): Promise<{ ok: true } | { ok: false; code: string }>;
    set(overrides: Partial<HarnessSessionState>): void;
  };
  readonly process: {
    readonly signals: { readonly pid: number; readonly signal: string }[];
    readonly aliveCalls: number;
    readonly progressReads: number;
    readonly killCalls: number;
    setAlive(pid: number, answer: boolean | null): void;
    setProgress(progress: { newTurn: CoordinatorProgressState; observedAtMs: number | null }): void;
  };
  readonly counters: {
    readonly appends: number;
    readonly reads: number;
    /** Reads performed outside a delivered post-append coverage read. */
    readonly evaluationReads: number;
    readonly acquireFence: number;
    readonly recoverFence: number;
    readonly fenceStatus: number;
    readonly spawns: number;
    readonly resumes: number;
    readonly joins: number;
    readonly wakes: number;
  };
  readonly driver: ReturnType<typeof createCycleDriver>;
  readonly run: (argv: readonly string[]) => Promise<{
    code: number;
    stdout: string;
    stderr: string;
    json: Record<string, unknown> | undefined;
  }>;
  records(): CoordinatorRecordsRead;
  appendAppOverride(fn: (() => unknown) | undefined): void;
  setSessionFacts(overrides: Partial<CoordinatorSessionFacts>): void;
  setProgress(progress: { newTurn: CoordinatorProgressState; observedAtMs: number | null }): void;
  setWakeFails(value: boolean): void;
  setPublishFails(value: boolean): void;
  seedQuestion(record: BlockerQuestionRecord): void;
  seedAnswer(record: BlockerAnswerRecord): void;
  appendRaw(request: { kind: string; recordKey: string; payload: Record<string, unknown> }): void;
  observationFromEnvelope(
    json: Record<string, unknown> | undefined,
  ): CoordinatorObservation | undefined;
};

const HOLDER_FOR = (pid: number, start: number): string => `pid:${pid}:start:${start}`;

export const createCoordinatorHarness = (
  options: CoordinatorHarnessOptions = {},
): CoordinatorHarness => {
  const root = mkdtempSync(join(tmpdir(), `gh241-harness-${options.label ?? "case"}-`));
  const identity = makeIdentity(root);
  const clock = {
    value: 1_000_000,
    nowMs: () => clock.value,
    nowIso: () => new Date(clock.value).toISOString(),
  };
  const { store } = openStore(identity, {
    edge: createTestEdge({ clock }),
    ...(options.staleFenceMs === undefined ? {} : { staleFenceMs: options.staleFenceMs }),
  });

  const settings: Record<CoordinatorConfigKey, number> = {
    "coordinator.stuck-window": DEFAULT_SETTINGS.stuckWindowMs,
    "coordinator.kill-grace": DEFAULT_SETTINGS.killGraceMs,
    "coordinator.restart-budget": DEFAULT_SETTINGS.restartBudget,
    "coordinator.resume-context-limit": DEFAULT_SETTINGS.resumeContextLimit,
    "coordinator.collection-interval": DEFAULT_SETTINGS.collectionIntervalMs,
    "coordinator.progress-bound": DEFAULT_SETTINGS.progressBoundMs,
    ...options.settings,
  };

  const capabilities: CoordinatorProcessPortCapabilities = {
    alive: options.declared?.alive ?? true,
    killWithGrace: options.declared?.killWithGrace ?? true,
    startTimeIdentity: options.declared?.startTimeIdentity ?? true,
  };

  const aliveAnswers: Record<number, boolean | null> = { ...(options.alive ?? {}) };
  const startTimes: Record<number, number> = { ...(options.startTimes ?? {}) };
  const signals: { pid: number; signal: string }[] = [];
  const counters = {
    appends: 0,
    reads: 0,
    evaluationReads: 0,
    acquireFence: 0,
    recoverFence: 0,
    fenceStatus: 0,
    spawns: 0,
    resumes: 0,
    joins: 0,
    wakes: 0,
  };
  let progressReads = 0;
  let aliveCalls = 0;
  let killCalls = 0;

  const own = options.own === undefined ? { pid: 9001, processStartTimeMs: 1_000 } : options.own;

  const port: DaemonProcessPort = {
    spawnDetached: () => ({ code: "daemon.state-recovery-failed" }),
    signal: (pid, signal) => {
      if (signal === "SIGKILL" || signal === "SIGTERM") killCalls += 1;
      if (options.signalFails === true) return { ok: false, detail: "signal-failed" };
      signals.push({ pid, signal });
      return { ok: true };
    },
    isAlive: (pid) => {
      aliveCalls += 1;
      return aliveAnswers[pid] === true;
    },
    ...(capabilities.startTimeIdentity
      ? {
          startTimeMs: (pid: number) => startTimes[pid],
        }
      : {}),
  };

  let session: HarnessSessionState = {
    facts: {
      sessionId: "session-1",
      liveness: "absent",
      contextTokens: 10_000,
      harnessKind: "opencode",
      completedCleanly: false,
      resumable: true,
      resumeDeclared: true,
      pid: 4242,
      processStartTimeMs: 2_000,
      ...options.session,
    },
    progress: options.progress ?? { newTurn: "zero", observedAtMs: null },
    resumeDeclared: options.session?.resumeDeclared ?? true,
  };
  startTimes[session.facts.pid ?? 4242] = session.facts.processStartTimeMs ?? 2_000;
  startTimes[own.pid] = own.processStartTimeMs;

  const driver = createCycleDriver(options.cycle ?? { cycles: 1 });

  let publishFails = options.publishFails === true;
  let wakeFails = options.wakeFails === true;
  let appendOverride: (() => unknown) | undefined;
  const wakeEffects: CoordinatorWakeEffect[] = [];
  const appendedHandles = new Set<Parameters<typeof store.append>[0]>();

  const guardedStore = {
    ...store,
    get identity() {
      return store.identity;
    },
    readRecords() {
      counters.reads += 1;
      // A delivered append proves its own post-write coverage with a store
      // read; that write-time invariant is not the tick's evaluation read.
      if (appendedHandles.size === 0) counters.evaluationReads += 1;
      return store.readRecords();
    },
    acquireFence(token: string) {
      counters.acquireFence += 1;
      return store.acquireFence(token);
    },
    recoverFence(token: string) {
      counters.recoverFence += 1;
      return store.recoverFence(token);
    },
    fenceStatus() {
      counters.fenceStatus += 1;
      return store.fenceStatus();
    },
    releaseFence(handle: Parameters<typeof store.releaseFence>[0]) {
      appendedHandles.delete(handle);
      return store.releaseFence(handle);
    },
    append(
      handle: Parameters<typeof store.append>[0],
      request: Parameters<typeof store.append>[1],
    ) {
      counters.appends += 1;
      if (appendOverride !== undefined) return appendOverride() as never;
      if (
        (options.releaseFails === true || options.releaseBusy === true) &&
        request.kind === "coordinator.fence" &&
        (request.payload as { action?: unknown }).action === "released"
      ) {
        return {
          ok: false,
          error: {
            kind: "state",
            code: options.releaseBusy === true ? "state.lock.busy" : "state.write.failed",
            consequence: "not_landed",
            location: { path: root },
          },
        } as never;
      }
      if (publishFails && request.kind === "blocker.question") {
        return {
          ok: false,
          error: {
            kind: "state",
            code: "state.write.failed",
            consequence: "not_landed",
            location: { path: root },
          },
        } as never;
      }
      const result = store.append(handle, request);
      if (result.ok) appendedHandles.add(handle);
      return result;
    },
  } as typeof store;

  const ports: CoordinatorSupervisorPorts = {
    store: guardedStore,
    clock,
    newFenceToken: (() => {
      let counter = 0;
      return () => {
        counter += 1;
        return `fence-${counter}`;
      };
    })(),
    newId: (() => {
      const countersById: Record<string, number> = {};
      return (prefix: string) => {
        countersById[prefix] = (countersById[prefix] ?? 0) + 1;
        return `${prefix}-${String(countersById[prefix]).padStart(4, "0")}`;
      };
    })(),
    coordinatorId: COORDINATOR_ID,
    stateDirectory: root,
    settings: {
      stuckWindowMs: settings["coordinator.stuck-window"],
      killGraceMs: settings["coordinator.kill-grace"],
      restartBudget: settings["coordinator.restart-budget"],
      resumeContextLimit: settings["coordinator.resume-context-limit"],
      collectionIntervalMs: settings["coordinator.collection-interval"],
      progressBoundMs: settings["coordinator.progress-bound"],
    },
    processPort: {
      port,
      capabilities,
      probe: (target) => {
        aliveCalls += 1;
        const answer = aliveAnswers[target.pid];
        return answer === undefined ? false : answer;
      },
      ownIdentity: () => own,
      wait: async () => undefined,
      progress: () => {
        progressReads += 1;
        return session.progress;
      },
    },
    session: {
      read: () => session.facts,
      apply: async (effect) => {
        if (effect === "attach") {
          counterJoin();
          return { ok: true as const };
        }
        const becameAlive = options.applyMakesAlive === true;
        if (effect === "resume") {
          counters.resumes += 1;
          if (becameAlive) {
            session = {
              ...session,
              facts: { ...session.facts, liveness: "alive", sessionId: "session-1" },
            };
          }
          return { ok: true as const };
        }
        counters.spawns += 1;
        if (becameAlive) {
          session = {
            ...session,
            facts: { ...session.facts, liveness: "alive", sessionId: "session-1" },
          };
        }
        return options.spawnFails === true
          ? { ok: false as const, code: "harness.spawn.refused" }
          : { ok: true as const };
      },
      wake: async (effect) => {
        counters.wakes += 1;
        wakeEffects.push(effect);
        return { ok: wakeFails !== true };
      },
    },
    loop: {
      run: (onCycle) => driver.run(onCycle) as Promise<CoordinatorLoopExit>,
    },
  };

  const counterJoin = () => {
    counters.joins += 1;
  };

  // Seed blockers after the store exists.
  for (const question of options.questions ?? []) {
    const appended = appendBlockerQuestion(store, {
      record: question,
      fenceToken: "seed-question",
    });
    if (!appended.ok) throw new Error(`seed question failed: ${appended.error.code}`);
  }
  for (const answer of options.answers ?? []) {
    const appended = appendBlockerAnswer(store, {
      record: answer,
      fenceToken: "seed-answer",
    });
    if (!appended.ok) throw new Error(`seed answer failed: ${appended.error.code}`);
  }
  void publishFails;

  const supervisor = createCoordinatorSupervisor(ports);

  const run = async (argv: readonly string[]) => {
    let stdout = "";
    let stderr = "";
    const program = {
      commands: {
        coordinator: createCoordinatorCommandDefinition(supervisor),
      },
    };
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
        brand: TEST_BRAND,
        clock: { now: () => clock.nowMs() },
        newRunId: () => "run-1",
        secrets: [],
        program,
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

  return {
    root,
    store,
    clock,
    settings,
    supervisor,
    session: {
      get facts() {
        return session.facts;
      },
      get progress() {
        return session.progress;
      },
      get resumeDeclared() {
        return session.resumeDeclared;
      },
      joinCalls: 0,
      resumeCalls: 0,
      spawnCalls: 0,
      wakeCalls: 0,
      get wakeEffects() {
        return wakeEffects;
      },
      apply: (effect) => ports.session.apply(effect),
      set: (overrides) => {
        session = { ...session, ...overrides };
      },
    },
    process: {
      signals,
      get aliveCalls() {
        return aliveCalls;
      },
      get progressReads() {
        return progressReads;
      },
      get killCalls() {
        return killCalls;
      },
      setAlive: (pid, answer) => {
        aliveAnswers[pid] = answer;
      },
      setStartTime: (pid, processStartTimeMs) => {
        startTimes[pid] = processStartTimeMs;
      },
      setProgress: (progress) => {
        session = { ...session, progress };
      },
    },
    counters,
    driver,
    run,
    records: () => readCoordinatorRecords(store, COORDINATOR_ID),
    appendAppOverride: (fn) => {
      appendOverride = fn;
    },
    setSessionFacts: (overrides) => {
      session = { ...session, facts: { ...session.facts, ...overrides } };
    },
    setProgress: (progress) => {
      session = { ...session, progress };
    },
    setWakeFails: (value) => {
      wakeFails = value;
    },
    setPublishFails: (value) => {
      publishFails = value;
    },
    seedQuestion: (record) => {
      const appended = appendBlockerQuestion(store, { record, fenceToken: "seed-question" });
      if (!appended.ok) throw new Error(appended.error.code);
    },
    seedAnswer: (record) => {
      const appended = appendBlockerAnswer(store, { record, fenceToken: "seed-answer" });
      if (!appended.ok) throw new Error(appended.error.code);
    },
    appendRaw: (request) => {
      const acquired = store.acquireFence("raw-writer");
      if (!acquired.ok) throw new Error(acquired.error.code);
      try {
        const appended = store.append(acquired.value.handle, {
          kind: request.kind,
          recordKey: request.recordKey,
          payload: request.payload,
        });
        if (!appended.ok) throw new Error(appended.error.code);
      } finally {
        store.releaseFence(acquired.value.handle);
      }
    },
    observationFromEnvelope: (json) =>
      json === undefined ? undefined : (json["data"] as CoordinatorObservation | undefined),
  };
};

/** Seed one instance-lease record directly (claim/liveness fixtures). */
export const seedLease = (
  harness: CoordinatorHarness,
  input: {
    readonly action: "acquired" | "released" | "stale-takeover" | "stop-requested";
    readonly pid?: number;
    readonly processStartTimeMs?: number;
    readonly recordedAt: string;
    readonly holder?: string;
    readonly previousHolder?: string | null;
    readonly fenceAgeMs?: number | null;
    readonly instanceId?: string;
  },
): void => {
  const pid = input.pid ?? 4242;
  const start = input.processStartTimeMs ?? 2_000;
  harness.appendRaw({
    kind: "coordinator.fence",
    recordKey: `coordinator.fence:${COORDINATOR_ID}`,
    payload: {
      schemaId: "delivery.coordinator.fence.v1",
      fenceId: `fence-seed-${input.action}`,
      instanceId: input.instanceId ?? "instance-seed",
      coordinatorId: COORDINATOR_ID,
      action: input.action,
      holder: input.holder ?? HOLDER_FOR(pid, start),
      pid,
      processStartTimeMs: start,
      supervisorMode: "foreground",
      externalUnit: "absent",
      previousHolder: input.previousHolder ?? null,
      fenceAgeMs: input.fenceAgeMs ?? null,
      recordedAt: input.recordedAt,
    },
  });
};

/** Seed one persisted iteration record (the active expectation). */
export const seedIteration = (
  harness: CoordinatorHarness,
  overrides: Partial<Record<string, unknown>> = {},
): void => {
  // The digest fingerprint must match the post-append cursor, otherwise the
  // next live cycle legitimately treats the mismatch as a digest change.
  const raw = harness.store.readRecords();
  const recordCount = raw.ok ? raw.value.records.length : 0;
  const ledger = readBlockerLedger(harness.store);
  const answered = new Set(
    ledger.ok ? ledger.value.answers.map((answer) => answer.questionId) : [],
  );
  const openCoordinator = ledger.ok
    ? ledger.value.questions.filter(
        (question) => question.audience === "coordinator" && !answered.has(question.id),
      ).length
    : 0;
  harness.appendRaw({
    kind: "coordinator.iteration",
    recordKey: `coordinator.iterations:${COORDINATOR_ID}`,
    payload: {
      schemaId: "delivery.coordinator.iteration.v1",
      iterationId: "iteration-seed",
      coordinatorId: COORDINATOR_ID,
      trigger: "collection",
      decision: "none",
      reason: "expectation",
      sessionId: "session-1",
      contextTokens: 10_000,
      digestFingerprint: `cursor=${recordCount + 1};open=${openCoordinator}`,
      expectationWindowMs: 600_000,
      recordedAt: new Date(0).toISOString(),
      ...overrides,
    },
  });
};

/** Seed one persisted restart record. */
export const seedRestart = (
  harness: CoordinatorHarness,
  input: { readonly ordinal: number; readonly epoch?: string; readonly reason?: string },
): void => {
  const epoch = input.epoch ?? "epoch-1";
  harness.appendRaw({
    kind: "coordinator.restart",
    recordKey: `coordinator/${COORDINATOR_ID}`,
    payload: {
      schemaId: "delivery.coordinator.restart.v1",
      restartId: `${COORDINATOR_ID}#${epoch}#${input.ordinal}`,
      coordinatorId: COORDINATOR_ID,
      budgetEpochId: epoch,
      sessionId: "session-1",
      ordinal: input.ordinal,
      reason: input.reason ?? "session-interrupted",
      previousSessionId: "session-0",
      recordedAt: new Date(0).toISOString(),
    },
  });
};

/** Seed one persisted `stuck` verdict record (phase=verdict). */
export const seedStuckVerdict = (
  harness: CoordinatorHarness,
  overrides: Partial<Record<string, unknown>> = {},
): void => {
  harness.appendRaw({
    kind: "coordinator.stuck",
    recordKey: `coordinator.stuck:${COORDINATOR_ID}`,
    payload: {
      schemaId: "delivery.coordinator.stuck.v1",
      stuckId: "iteration-1",
      coordinatorId: COORDINATOR_ID,
      iterationId: "iteration-1",
      verdict: "stuck",
      phase: "verdict",
      reason: "stuck-artifact-evidence",
      evidence: "digest-consumed=stale merge=stale answer=stale",
      killOutcome: "not-attempted",
      killFailureReason: null,
      recordedAt: new Date(1_000_000).toISOString(),
      ...overrides,
    },
  });
};

/** The JSON envelope of one harness invocation. */
export const envelopeOf = (result: {
  readonly json: Record<string, unknown> | undefined;
}): Record<string, unknown> => {
  if (result.json === undefined) throw new Error("missing JSON envelope");
  return result.json;
};

/** The observation data of a successful JSON invocation. */
export const dataOf = (result: {
  readonly json: Record<string, unknown> | undefined;
}): CoordinatorObservation => {
  const envelope = envelopeOf(result);
  const data = envelope["data"];
  if (typeof data !== "object" || data === null) throw new Error("missing data");
  return data as CoordinatorObservation;
};

/** The error code of a failure JSON invocation. */
export const errorCodeOf = (result: {
  readonly json: Record<string, unknown> | undefined;
}): string => {
  const envelope = envelopeOf(result);
  const error = envelope["error"];
  if (typeof error !== "object" || error === null) throw new Error("missing error");
  return String((error as { code?: unknown }).code);
};

export { HOLDER_FOR, readBlockerLedger };
