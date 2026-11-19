/**
 * The process-tree model and the terminate doubles (GH-347 test plan §6.1,
 * §6.2; TC-TERM-001/006).
 *
 * The model records every signal per pid with a virtual timestamp, so the
 * assertion set — TERM before KILL, KILL only after the declared grace, zero
 * signals to unrelated processes, an exact-identity reap — is observable
 * without a kernel. The capable double implements the API-5 contract over the
 * model; the incapable double declares no member and records any call as a
 * violation.
 */
import type {
  DispatchDelay,
  HarnessEvidence,
  HarnessLivenessReport,
  HarnessResult,
  HarnessSessionHandle,
  HarnessSessionPort,
  HarnessTerminateInput,
  HarnessTerminateResult,
} from "../../../../packages/core/src/contracts/index";

export const TERM = "SIGTERM" as const;
export const KILL = "SIGKILL" as const;

export type SignalRecord = {
  readonly signal: string;
  readonly pid: number;
  readonly atMs: number;
};

export type ProcessRecord = {
  readonly pid: number;
  /** The session tree this process belongs to (the root pid). */
  readonly treeOf?: number;
  /**
   * An escaped runtime (outside the tree) reachable only by exact identity: its
   * session id or its title. Unrelated processes are neither.
   */
  readonly escaped?: boolean;
  readonly sessionId?: string;
  readonly title?: string;
  exited: boolean;
  reaped: boolean;
};

export type ProcessTreeModel = {
  readonly processes: ProcessRecord[];
  readonly signals: SignalRecord[];
  /**
   * The signal-discipline violations the model itself observed: a signal to a
   * pid that is neither this lane's tree member nor this lane's escaped
   * runtime. A correct adapter never produces one, and the planted
   * broad-pattern control does — which is what makes the "0 unrelated
   * processes signalled" assertion able to fail.
   */
  readonly violations: string[];
  /** The virtual clock advanced only by the injected delay. */
  readonly nowMs: () => number;
  readonly addProcess: (record: Omit<ProcessRecord, "exited" | "reaped">) => void;
  readonly signalTree: (pid: number, signal: string) => void;
  readonly signalProcess: (pid: number, signal: string) => boolean;
  readonly reapExact: (input: { readonly sessionId?: string; readonly title?: string }) => number;
  /**
   * The PLANTED CONTROL ONLY: a broad substring matcher over identity, which
   * the exact-identity contract forbids. It exists so the negative control can
   * be observed to fail; the double's real path never calls it.
   */
  readonly reapByPattern: (pattern: RegExp) => readonly number[];
  /** The pids a reap marked reaped, in process order. */
  readonly reaped: () => readonly number[];
  readonly signalsFor: (pid: number) => readonly SignalRecord[];
};

/** One node: this lane's session tree plus unrelated near-miss processes. */
export const createProcessTreeModel = (options: {
  readonly nowMs: () => number;
}): ProcessTreeModel => {
  const processes: ProcessRecord[] = [];
  const signals: SignalRecord[] = [];
  const violations: string[] = [];
  const model: ProcessTreeModel = {
    processes,
    signals,
    violations,
    nowMs: options.nowMs,
    addProcess: (record) => {
      processes.push({ ...record, exited: false, reaped: false });
    },
    signalProcess: (pid, signal) => {
      const target = processes.find((process) => process.pid === pid);
      if (target === undefined) {
        violations.push(`signal to unknown pid ${pid}`);
        return false;
      }
      // Only this lane's tree members and this lane's exact-identity escaped
      // runtimes may ever be signalled.
      if (target.treeOf === undefined && target.escaped !== true) {
        violations.push(`signal to unrelated pid ${pid}`);
        return false;
      }
      signals.push({ signal, pid, atMs: options.nowMs() });
      if (signal === KILL) target.exited = true;
      return true;
    },
    signalTree: (pid, signal) => {
      // The tree is the group leader plus its recorded descendants; an
      // unrelated process (no treeOf) is never signalled.
      for (const process of processes) {
        if (process.treeOf === undefined || process.treeOf !== pid) continue;
        if (process.exited) continue;
        model.signalProcess(process.pid, signal);
      }
    },
    reapExact: (input) => {
      let reaped = 0;
      for (const process of processes) {
        if (process.escaped !== true || process.reaped) continue;
        const bySession = input.sessionId !== undefined && process.sessionId === input.sessionId;
        const byTitle = input.title !== undefined && process.title === input.title;
        if (!bySession && !byTitle) continue;
        model.signalProcess(process.pid, TERM);
        process.reaped = true;
        process.exited = true;
        reaped += 1;
      }
      return reaped;
    },
    reapByPattern: (pattern) => {
      const matched = processes.filter(
        (process) =>
          !process.reaped &&
          ((process.sessionId !== undefined && pattern.test(process.sessionId)) ||
            (process.title !== undefined && pattern.test(process.title))),
      );
      for (const process of matched) {
        model.signalProcess(process.pid, TERM);
        process.reaped = true;
        process.exited = true;
      }
      return matched.map((process) => process.pid);
    },
    reaped: () => processes.filter((process) => process.reaped).map((process) => process.pid),
    signalsFor: (pid) => signals.filter((record) => record.pid === pid),
  };
  return model;
};

/** The scripted evidence/liveness of one iteration. */
export type IterationScript = {
  readonly liveness: readonly HarnessLivenessReport[];
  readonly evidence: HarnessEvidence;
};

export type StallPortOptions = {
  readonly model: ProcessTreeModel;
  readonly iterations: readonly IterationScript[];
  /** The injected delay the terminate grace is waited on. */
  readonly delay: DispatchDelay;
  /** `true` implements terminate; `false` declares no member and records calls. */
  readonly terminateCapable?: boolean;
  readonly title?: string;
};

export type StallPort = {
  readonly port: HarnessSessionPort;
  readonly calls: string[];
  readonly terminateCalls: readonly HarnessTerminateInput[];
  readonly violations: string[];
  readonly acquisitions: () => number;
};

const completedEvidence = (): HarnessEvidence => ({
  completionMarker: true,
  exitStatus: 0,
  timedOut: false,
  spawnRefused: false,
  failureReported: false,
  toolFailure: false,
});

/**
 * Build the session-port double the stall/loop cases inject (D2).
 *
 * `spawn` opens iteration 1; `resume` opens the next iteration on the recorded
 * session. `collect` resolves only after the iteration's liveness script has
 * been consumed, so a stall is a current verdict at collection.
 */
export const createStallPort = (options: StallPortOptions): StallPort => {
  const calls: string[] = [];
  const terminateCalls: HarnessTerminateInput[] = [];
  // The terminated set is PER ACQUISITION: a resume registers a NEW live stream,
  // so a later stall of iteration 2+ IS signalled (GH-347 AC-F5-5, review M2).
  const terminated = new Set<string>();
  let iteration = 0;
  let polls = 0;
  let resolveCollect: (() => void) | undefined;
  let handle: HarnessSessionHandle | undefined;
  let acquisitions = 0;

  const script = (): IterationScript =>
    options.iterations[Math.min(Math.max(iteration - 1, 0), options.iterations.length - 1)] ??
    ({ liveness: [], evidence: completedEvidence() } satisfies IterationScript);

  const open = (sessionId: string): HarnessResult<HarnessSessionHandle> => {
    iteration += 1;
    acquisitions += 1;
    polls = 0;
    handle = {
      harnessKind: "opencode",
      sessionId,
      treeRoot: `${8800 + iteration}`,
      workItemRef: "GH-347",
    };
    const root = 8800 + iteration;
    options.model.addProcess({
      pid: root,
      treeOf: root,
      sessionId,
      ...(options.title === undefined ? {} : { title: options.title }),
    });
    // Two descendants belong to the same tree; the escaped runtime is reaped by
    // its exact session identity.
    options.model.addProcess({ pid: root + 100, treeOf: root, sessionId });
    options.model.addProcess({ pid: root + 200, treeOf: root, sessionId });
    return { ok: true, value: handle };
  };

  const port: HarnessSessionPort & {
    readonly capabilities: { readonly supportedOperations: readonly string[] };
  } = {
    // The declaration the engine reads to decide capability (GH-347 DM-5,
    // AC-F5-4): an incapable adapter omits `terminate`, so the engine starts no
    // second session and never has to ask.
    capabilities: {
      supportedOperations:
        options.terminateCapable === false
          ? ["spawn", "deliver", "resume", "collect", "session-list"]
          : ["spawn", "deliver", "resume", "collect", "session-list", "terminate"],
    },
    spawn: async () => {
      calls.push("spawn");
      return open("ses-loop-1");
    },
    deliver: async (input) => {
      calls.push("deliver");
      return { ok: true, value: input.handle };
    },
    resume: async (input) => {
      calls.push("resume");
      // A resume continues the recorded session; the iteration script advances.
      iteration += 1;
      acquisitions += 1;
      polls = 0;
      handle = input.handle;
      // A resumed stream is a NEW live process tree: the previous termination
      // fact is cleared and this lane's tree is revived.
      terminated.delete(input.handle.sessionId);
      const root = Number(input.handle.treeRoot);
      for (const process of options.model.processes) {
        if (process.treeOf !== undefined && process.treeOf === root) process.exited = false;
      }
      return { ok: true, value: input.handle };
    },
    collect: async () => {
      calls.push("collect");
      const current = script();
      if (current.liveness.length === 0) return { ok: true, value: current.evidence };
      return new Promise((resolve) => {
        resolveCollect = () => resolve({ ok: true, value: current.evidence });
      });
    },
    classify: (evidence) => {
      const outcome = evidence.timedOut
        ? "timed-out"
        : evidence.failureReported || (evidence.exitStatus ?? 0) !== 0
          ? "failed"
          : evidence.toolFailure || !evidence.completionMarker
            ? "premature-end"
            : "completed";
      const resultToken = evidence.timedOut
        ? "max-restarts"
        : evidence.failureReported || (evidence.exitStatus ?? 0) !== 0
          ? "failed"
          : evidence.toolFailure || !evidence.completionMarker
            ? "partial"
            : "finished";
      return { outcome, token: resultToken, derivationClass: "verify" };
    },
    liveness: async () => {
      calls.push("liveness");
      const current = script();
      const report = current.liveness[Math.min(polls, current.liveness.length - 1)];
      polls += 1;
      if (polls >= current.liveness.length) {
        resolveCollect?.();
        resolveCollect = undefined;
      }
      return {
        ok: true,
        value: report ?? { readings: [] },
      };
    },
    listSessions: async () => ({
      ok: true,
      value: { handles: handle === undefined ? [] : [handle] },
    }),
  };

  if (options.terminateCapable !== false) {
    port.terminate = async (
      input: HarnessTerminateInput,
    ): Promise<HarnessResult<HarnessTerminateResult>> => {
      calls.push("terminate");
      terminateCalls.push(input);
      const pid = Number(input.handle.treeRoot);
      // Idempotent PER ACQUISITION: a repeated call before a resume reports the
      // same terminal facts and signals nothing further (GH-347 AC-F5-5,
      // TDR-0046 DC-4). A resume clears the entry, so iteration 2+ IS signalled.
      if (terminated.has(input.handle.sessionId)) {
        return { ok: true, value: { terminated: true, escalated: false, reaped: false } };
      }
      terminated.add(input.handle.sessionId);
      options.model.signalTree(pid, TERM);
      await options.delay(input.graceMs, "terminate-grace");
      options.model.signalTree(pid, KILL);
      const reaped = options.model.reapExact({
        sessionId: input.handle.sessionId,
        ...(options.title === undefined ? {} : { title: options.title }),
      });
      return {
        ok: true,
        value: { terminated: true, escalated: true, reaped: reaped > 0 },
      };
    };
  }
  // An incapable adapter exposes NO `terminate` member and declares it absent in
  // its capability declaration, so the engine starts no second session and never
  // asks. The model itself records a violation if a signal ever reaches an
  // unrelated pid (`violations`), which the planted control exercises.

  return {
    port,
    calls,
    terminateCalls,
    violations: options.model.violations,
    acquisitions: () => acquisitions,
  };
};

/** A liveness report with the given sourced values (all three signals). */
export const sourcedReadings = (
  values: { readonly traffic: number; readonly worktree: number; readonly process: number },
  observedAt = "2026-11-19T00:00:00.000Z",
): HarnessLivenessReport => ({
  readings: [
    { kind: "session-traffic", status: "sourced", value: values.traffic, observedAt },
    { kind: "worktree-activity", status: "sourced", value: values.worktree, observedAt },
    { kind: "process", status: "sourced", value: values.process, observedAt },
  ],
});

/* ------------------------------------------------------------------------- */
/* The registry scenario builders for the loop/terminate rows (GH-347 §6.1).  */
/* ------------------------------------------------------------------------- */

import {
  readDispatchAttempts,
  readDispatchLanes,
} from "../../../../packages/core/src/app/dispatch-ledger";
import { readEconomicsRecords } from "../../../../packages/core/src/state/index";
import { createCommandScenario, readsFrom } from "../golden/harness";
import { COMPLETED_EVIDENCE } from "../harness";
import { artifacts, readOk } from "../truth";
import type { ParityEnvelope, ParityObservation } from "./harness";

/** A decisive artifact outside the terminal pre-restart set. */
const outsideSetReads = () =>
  readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })) });

const stall = (): IterationScript => ({
  liveness: [
    sourcedReadings({ traffic: 1, worktree: 1, process: 1 }),
    sourcedReadings({ traffic: 1, worktree: 1, process: 1 }),
  ],
  evidence: COMPLETED_EVIDENCE,
});

const clean = (): IterationScript => ({
  liveness: [
    sourcedReadings({ traffic: 1, worktree: 1, process: 1 }),
    sourcedReadings({ traffic: 9, worktree: 9, process: 9 }),
  ],
  evidence: COMPLETED_EVIDENCE,
});

const runLoop = async (input: {
  readonly label: string;
  readonly iterations: readonly IterationScript[];
  readonly reads?: ReturnType<typeof readsFrom>;
  readonly readsSequence?: readonly ReturnType<typeof readsFrom>[];
  readonly restartBudget?: number;
  readonly restartCount?: number;
  readonly terminateCapable?: boolean;
}): Promise<ParityObservation> => {
  const model = createProcessTreeModel({ nowMs: () => Date.parse("2026-11-08T10:00:00.000Z") });
  const waits: { ms: number; reason: string }[] = [];
  const stallPort = createStallPort({
    model,
    iterations: input.iterations,
    delay: async (ms, reason) => {
      waits.push({ reason, ms });
    },
    ...(input.terminateCapable === undefined ? {} : { terminateCapable: input.terminateCapable }),
  });
  const scenario = createCommandScenario({
    label: input.label,
    harnessPort: stallPort.port,
    livenessIntervalMs: 30_000,
    killGraceMs: 20_000,
    laneOwner: { processId: 4242, startedAt: "2026-11-08T10:00:00.000Z" },
    ...(input.readsSequence === undefined
      ? { reads: input.reads ?? readsFrom() }
      : { readsSequence: [...input.readsSequence] }),
    ...(input.restartBudget === undefined ? {} : { restartBudget: input.restartBudget }),
    ...(input.restartCount === undefined ? {} : { restartCount: input.restartCount }),
  });
  try {
    const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
    const attempts = readDispatchAttempts(scenario.state.store);
    const lanes = readDispatchLanes(scenario.state.store);
    const economics = readEconomicsRecords(scenario.state.store, "GH-301");
    if (!attempts.ok || !lanes.ok || !economics.ok) throw new Error("observation read failed");
    return {
      exit: run.exit,
      token: run.envelope?.data?.result,
      results: [
        {
          exit: run.exit,
          stdout: run.stdout,
          stderr: run.stderr,
          ...(run.envelope === undefined ? {} : { envelope: run.envelope as ParityEnvelope }),
        },
      ],
      attempts: attempts.records,
      lanes: lanes.records,
      divergences: 0,
      economicsRestarts: economics.restarts.length,
      leaseRecords: 0,
      leaseAcquisitions: 0,
      spawns: stallPort.calls.filter((call) => call === "spawn").length,
      resumes: stallPort.calls.filter((call) => call === "resume").length,
      waits,
      violations: [...stallPort.violations],
      invocations: [],
      envelopes: run.envelope === undefined ? [] : [run.envelope as ParityEnvelope],
    };
  } finally {
    scenario.dispose();
  }
};

/** Loop rows: below-bound restart, at-bound max-restarts, unverified, clean exit. */
export const loopBelowBound = (): Promise<ParityObservation> =>
  runLoop({
    label: "loop-below-bound",
    iterations: [stall(), clean()],
    readsSequence: [outsideSetReads(), readsFrom()],
    restartBudget: 3,
    restartCount: 0,
  });

export const loopAtBound = (): Promise<ParityObservation> =>
  runLoop({
    label: "loop-at-bound",
    iterations: [stall()],
    reads: outsideSetReads(),
    restartBudget: 3,
    restartCount: 0,
  });

export const loopUnverifiedStall = (): Promise<ParityObservation> =>
  runLoop({
    label: "loop-unverified",
    iterations: [stall()],
    reads: readsFrom({
      tracker: { ok: false, reason: "tracker", identity: "tracker:exhausted" },
      artifacts: { ok: false, reason: "artifact" },
    }),
    restartBudget: 3,
    restartCount: 0,
  });

export const loopCleanExit = (): Promise<ParityObservation> =>
  runLoop({
    label: "loop-clean-exit",
    iterations: [clean()],
    restartBudget: 3,
    restartCount: 0,
  });

export const loopPersistedAboveBound = (): Promise<ParityObservation> =>
  runLoop({
    label: "loop-persisted-above-bound",
    iterations: [clean()],
    restartBudget: 3,
    restartCount: 4,
  });

/** Terminate rows: capable, incapable, and the exact-identity reap. */
export const terminateCapable = (): Promise<ParityObservation> =>
  runLoop({
    label: "terminate-capable",
    iterations: [stall()],
    reads: readsFrom({ tracker: readOk({ state: "done", blocking: false }) }),
    restartBudget: 3,
    restartCount: 0,
    terminateCapable: true,
  });

export const terminateIncapable = (): Promise<ParityObservation> =>
  runLoop({
    label: "terminate-incapable",
    iterations: [stall()],
    reads: readsFrom({ tracker: readOk({ state: "done", blocking: false }) }),
    restartBudget: 3,
    restartCount: 0,
    terminateCapable: false,
  });

export const terminateExactIdentity = (): Promise<ParityObservation> => {
  const nowMs = () => Date.parse("2026-11-08T10:00:00.000Z");
  const model = createProcessTreeModel({ nowMs });
  const port = createStallPort({
    model,
    iterations: [stall()],
    delay: async () => {},
    title: "ticket-GH-301",
  });
  model.addProcess({ pid: 9101, escaped: true, sessionId: "ses-loop-1" });
  model.addProcess({ pid: 9103, sessionId: "ses-999", title: "ticket-GH-348" });
  const scenario = createCommandScenario({
    label: "terminate-exact-identity",
    harnessPort: port.port,
    livenessIntervalMs: 30_000,
    killGraceMs: 20_000,
    reads: readsFrom({ tracker: readOk({ state: "done", blocking: false }) }),
  });
  return (async () => {
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      const attempts = readDispatchAttempts(scenario.state.store);
      if (!attempts.ok) throw new Error("attempt read failed");
      return {
        exit: run.exit,
        token: run.envelope?.data?.result,
        results: [
          {
            exit: run.exit,
            stdout: run.stdout,
            stderr: run.stderr,
            ...(run.envelope === undefined ? {} : { envelope: run.envelope as ParityEnvelope }),
          },
        ],
        attempts: attempts.records,
        lanes: [],
        divergences: 0,
        economicsRestarts: 0,
        leaseRecords: 0,
        leaseAcquisitions: 0,
        spawns: 1,
        resumes: 0,
        waits: [],
        violations: model
          .signalsFor(9103)
          .map((signal) => `unrelated pid 9103 got ${signal.signal}`),
        invocations: [],
        envelopes: run.envelope === undefined ? [] : [run.envelope as ParityEnvelope],
      };
    } finally {
      scenario.dispose();
    }
  })();
};
