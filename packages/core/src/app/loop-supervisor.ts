/**
 * The loop supervision cycle (GH-348 F-1, F-2, F-6; DM-1, DM-3, DM-4).
 *
 * A COMPOSITION PROFILE over the delivered supervision engine under the
 * distinct identity `loop-main` (TDR-0055): it reuses the delivered append-only
 * instance lease and its claim decision, the delivered restart budget, stuck
 * record pair, and identity-verified kill primitives, plus the delivered
 * per-identity state read. It reimplements none of them, and it never imports the
 * state tier: the injected ledger port supplies every read and append, so the
 * composition (CLI edge or test harness) owns the wiring.
 *
 * The cycle's step order is implementation-decided (Appendix D). The declared
 * boundaries are: the lease is always released, no session is spawned beside a
 * live recorded one, and a log fault never changes a verdict, exit, or record.
 */
import {
  COORDINATOR_ERROR_CODES,
  type CoordinatorExhaustionRecord,
  type CoordinatorFenceRecord,
  type CoordinatorKillFailureReason,
  type CoordinatorKillOutcome,
  type CoordinatorProgressState,
  type CoordinatorRestartRecord,
  type CoordinatorStuckRecord,
  type DaemonProcessPort,
  type LoopDegradation,
  type LoopDeliveryReading,
  type LoopLogEvent,
  type LoopLogProjection,
  type LoopSessionRecord,
  type LoopStatusProjection,
  type LoopStopMode,
  type LoopStopRecord,
  type Result,
  type StateFenceHandle,
} from "#contracts";
import type { CoordinatorSettings } from "../config/index.js";
import {
  type CoordinatorLease,
  decideCoordinatorClaim,
  foldCoordinatorLease,
} from "../domain/coordinator-fence.js";
import { restartDelayMs } from "../domain/loop-backoff.js";
import {
  foldLoopStop,
  isStopFolded,
  orderDegradations,
  projectLoopStatus,
} from "../domain/loop-status.js";

import { evaluateLoopVerdict, observeProgress } from "../domain/loop-verdict.js";
import {
  endedSessionRecord,
  freshSessionTitle,
  type LoopSessionFacts,
  type LoopSessionPort,
  loopSpawnPrompt,
  sessionRecordFrom,
} from "./loop-session.js";

/* ------------------------------- results --------------------------------- */

export type LoopFailure = {
  readonly error: { readonly kind: string; readonly code: string; readonly summary?: string };
};

export type LoopResult<T> = { readonly data: T } | LoopFailure;

/** The `start` receipt: a terminal stopped projection plus its release fact. */
export type LoopStartReceipt = LoopStatusProjection & { readonly released: boolean };

/** The declared foreground-loop exit vocabulary (API-1). */
export type LoopExit = "stopped" | "signal";

/** One termination result from the injected delivered kill path (AC-F5-6). */
export type LoopTerminateOutcome = {
  readonly outcome: CoordinatorKillOutcome | "capability-gap";
  readonly failureReason: CoordinatorKillFailureReason | null;
};

/* -------------------------------- ledger --------------------------------- */

/**
 * The injected ledger port: every loop and coordinator record operation the
 * cycle needs, supplied by the composition from the state tier. A thin port, not
 * a second store — no lock fold, no schema, and no record shape is re-declared.
 */
/** One classified loop-record read: the folded sets or a state failure code. */
export type LoopLedgerRead =
  | {
      readonly ok: true;
      readonly sessions: readonly LoopSessionRecord[];
      readonly stops: readonly LoopStopRecord[];
    }
  | { readonly ok: false; readonly code: string };

/** One classified coordinator-record read over the loop identity. */
export type LoopCoordinatorRead =
  | {
      readonly ok: true;
      readonly fences: readonly CoordinatorFenceRecord[];
      readonly restarts: readonly CoordinatorRestartRecord[];
      readonly stuck: readonly CoordinatorStuckRecord[];
      readonly exhaustion: readonly CoordinatorExhaustionRecord[];
    }
  | { readonly ok: false; readonly code: string };

/** One append outcome: landed, replayed, or a typed failure code. */
export type LoopRecordAppend =
  | { readonly ok: true; readonly appended: boolean }
  | { readonly ok: false; readonly code: string };

export type LoopLedgerSnapshot = {
  readonly loop: LoopLedgerRead;
  readonly coordinator: LoopCoordinatorRead;
};

export type LoopLedgerPort = {
  /** ONE verified state read: both record sets fold from the same snapshot. */
  readonly read: () => LoopLedgerSnapshot;
  readonly acquireFence: (
    token: string,
  ) => Result<{ readonly handle: StateFenceHandle }, { readonly code: string }>;
  readonly releaseFence: (handle: StateFenceHandle) => void;
  readonly fenceStatus: () => { readonly held: boolean; readonly stale: boolean };
  readonly recoverFence: (token: string) => boolean;
  readonly appendSession: (record: LoopSessionRecord) => LoopRecordAppend;
  readonly appendStuck: (record: CoordinatorStuckRecord) => LoopRecordAppend;
  readonly appendRestart: (record: CoordinatorRestartRecord) => LoopRecordAppend;
  readonly appendStop: (record: LoopStopRecord) => LoopRecordAppend;
  /** The newest restart record's ledger sequence, or `null` when none exists. */
  readonly lastRestartSequence: () => number | null;
  /**
   * Append one lease record. `handle` carries the claim's already-held write
   * fence so the claim append is atomic with the decision; without it the port
   * takes the delivered short-lived per-append fence.
   */
  readonly appendFence: (
    record: CoordinatorFenceRecord,
    handle?: StateFenceHandle,
  ) => { readonly ok: true } | { readonly ok: false; readonly code: string };
};

/* --------------------------------- ports --------------------------------- */

/** The injected process port with its declared capabilities (F-5, F-6). */
export type LoopProcessPort = {
  readonly port: DaemonProcessPort;
  readonly capabilities: {
    readonly alive: boolean;
    readonly killWithGrace: boolean;
    readonly startTimeIdentity: boolean;
  };
  readonly probe: (identity: {
    readonly pid: number;
    readonly processStartTimeMs: number;
  }) => boolean | null;
  readonly ownIdentity: () => { readonly pid: number; readonly processStartTimeMs: number } | null;
};

/** The four declared delay reasons (DM-5, NFR-1); the wait itself is injected. */
export type LoopDelayReason =
  | "restart-backoff"
  | "collection-interval"
  | "terminate-grace"
  | "fence-wait";

/** The injected bounded wait, so a battery records rather than sleeps (NFR-1). */
export type LoopDelay = (ms: number, reason: LoopDelayReason) => Promise<void>;

/** The bounded operational-log sink (F-7). A sink fault never changes an outcome. */
export type LoopLogSink = {
  readonly append: (
    event: LoopLogEvent,
    pairs?: Readonly<Record<string, string | number | boolean | null>>,
  ) => void;
  /** Whether the sink can write; `false` discloses `log-unavailable` on `status`. */
  readonly available?: () => boolean;
  /**
   * The bounded tail read (API-5). A missing or empty log is a success with
   * zero lines; an unreadable log reports the marker instead of borrowing a
   * failure identity.
   */
  readonly read?: (lines: number) => {
    readonly lines: readonly string[];
    readonly totalBytes: number;
    readonly truncated: boolean;
    readonly unreadable: boolean;
  };
};

/** The injected supervisor ports. */
export type LoopSupervisorPorts = {
  readonly ledger: LoopLedgerPort;
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly newFenceToken: () => string;
  readonly newId: (prefix: string) => string;
  readonly loopId: string;
  readonly settings: CoordinatorSettings;
  readonly processPort: LoopProcessPort;
  readonly session: LoopSessionPort;
  readonly log: LoopLogSink;
  /** The sourced progress reading; `null` is UNREADABLE, never zero (F-5). */
  readonly progress: {
    readonly read: (
      sessionId: string | null,
    ) => { readonly state: CoordinatorProgressState; readonly observedAtMs: number | null } | null;
  };
  /** The read-only delivery corroborator reading (F-5). */
  readonly corroborator: { readonly read: () => LoopDeliveryReading };
  /** Whether a merge or blocker answer landed since the observation (F-5). */
  readonly artifactAdvanced: () => boolean;
  /** The delivered identity-verified termination over the injected port (F-5). */
  readonly terminate: (graceMs: number) => Promise<LoopTerminateOutcome>;
  /** The delivered restart-admission fold, recorded but not performed (phase 4). */
  readonly admission: (input: { readonly ordinal: number; readonly budgetEpochId: string }) => {
    readonly state: "admit" | "refuse" | "unevaluable";
    readonly nextOrdinal: number;
  };
  readonly delay: LoopDelay;
  /** Whether a durable stop or a signal has cancelled the pending wait (F-3). */
  readonly cancelled?: () => boolean;
  readonly loop: {
    readonly run: (onCycle: () => Promise<"continue" | "stop">) => Promise<LoopExit>;
  };
};

export type LoopSupervisor = {
  start(input: {
    readonly foreground: boolean;
    readonly freshBudget: boolean;
  }): Promise<LoopResult<LoopStartReceipt>>;
  status(): Promise<LoopResult<LoopStatusProjection>>;
  log(input: { readonly lines: number }): Promise<LoopResult<LoopLogProjection>>;
  stop(input: { readonly mode: LoopStopMode }): Promise<LoopResult<LoopStopData>>;
  reset(): Promise<LoopResult<LoopStopData>>;
};

/** The `stop`/`reset` receipt (API-2, API-3). */
export type LoopStopData = {
  readonly loopId: string;
  readonly state: "requested" | "cleared" | "none";
  readonly mode: LoopStopMode | null;
  readonly recordedAt: string | null;
};

/* -------------------------------- helpers -------------------------------- */

const failure = (kind: string, code: string, summary?: string): LoopFailure => ({
  error: { kind, code, ...(summary === undefined ? {} : { summary }) },
});

const failureFor = (thrown: unknown): LoopFailure => {
  if (typeof thrown === "object" && thrown !== null) {
    const candidate = thrown as { kind?: unknown; code?: unknown; summary?: unknown };
    if (typeof candidate.kind === "string" && typeof candidate.code === "string") {
      return failure(
        candidate.kind,
        candidate.code,
        typeof candidate.summary === "string" ? candidate.summary : undefined,
      );
    }
  }
  return failure("fallback", "fallback.internal");
};

const stateFailure = (code: string): LoopFailure => failure("state", code);

/**
 * The declared domain kind an identity belongs to. A delivered refusal keeps its
 * own identity AND its own family, so the closed projection table can classify
 * it; an unknown code stays a contained internal failure.
 */
const FAMILY_PREFIXES: readonly (readonly [string, string])[] = [
  ["provider.", "provider"],
  ["config.", "config"],
  ["harness.", "harness"],
  ["coordinator.", "coordinator"],
  ["state.", "state"],
  ["fallback.", "fallback"],
];

const refusalFor = (code: string): LoopFailure => {
  const family = FAMILY_PREFIXES.find(([prefix]) => code.startsWith(prefix));
  return family === undefined ? failure("fallback", "fallback.internal") : failure(family[1], code);
};

const HOLDER = (pid: number, processStartTimeMs: number): string =>
  `pid:${pid}:start:${processStartTimeMs}`;

const toMs = (iso: string | null): number | null => {
  if (iso === null) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
};

const epochIndexOf = (epoch: string | null | undefined): number =>
  Number(/^epoch-(\d+)$/u.exec(epoch ?? "")?.[1] ?? 0);

/**
 * The durable budget epoch: the latest non-null epoch carried on the instance
 * lease, else the newest restart epoch, else `epoch-1`. The lease carrier makes
 * a `--fresh-budget` reset survive later invocations (AC-F3-4).
 */
export const loopBudgetEpoch = (read: LoopCoordinatorRead): string => {
  if (!read.ok) return "epoch-1";
  for (let index = read.fences.length - 1; index >= 0; index -= 1) {
    const carried = read.fences[index]?.budgetEpochId;
    if (carried !== null && carried !== undefined) return carried;
  }
  const latestRestart = read.restarts[read.restarts.length - 1];
  return latestRestart === undefined ? "epoch-1" : latestRestart.budgetEpochId;
};

/**
 * The lease over the loop identity's own fence records: the DELIVERED fold, not
 * a second one (TC-CONTRACT-006). A foreign identity's records never reach this
 * fold because the per-identity read skips them by construction.
 */
export const loopLeaseOf = (read: LoopCoordinatorRead): CoordinatorLease | null => {
  if (!read.ok) return null;
  return foldCoordinatorLease({ records: read.fences, recordedAtMs: toMs });
};

/** The recorded facts default when the composition has nothing to report. */
export const absentSessionFacts = (): LoopSessionFacts => ({
  sessionId: null,
  liveness: "absent",
  // No harness name is fabricated here: the closed vocabulary lives in the
  // composition and in config defaults, never in core (TC-HARN-028).
  harnessKind: "",
  pid: null,
  processStartTimeMs: null,
  title: null,
});

/* -------------------------------- engine --------------------------------- */

export const createLoopSupervisor = (ports: LoopSupervisorPorts): LoopSupervisor => {
  const { ledger, loopId, settings, clock } = ports;
  const alreadyRunning = COORDINATOR_ERROR_CODES[0];
  const capabilityGap = COORDINATOR_ERROR_CODES[2];

  /** Best-effort narration: a sink fault is swallowed, never an outcome (F-7). */
  const log = (
    event: LoopLogEvent,
    pairs?: Readonly<Record<string, string | number | boolean | null>>,
  ): void => {
    try {
      ports.log.append(event, pairs);
    } catch {
      // The log is bounded observability, not durable truth.
    }
  };

  const appendFence = (record: CoordinatorFenceRecord): boolean => ledger.appendFence(record).ok;

  /** The projection over both record sets plus the injected live session. */
  const projection = (
    loopRead: LoopLedgerRead,
    coordinatorRead: LoopCoordinatorRead,
    live: LoopSessionFacts,
    degraded: readonly LoopDegradation[],
  ): LoopStatusProjection => {
    const lease = loopLeaseOf(coordinatorRead);
    const running = lease !== null && lease.action !== "released";
    const epoch = coordinatorRead.ok ? loopBudgetEpoch(coordinatorRead) : null;
    const epochRestarts = coordinatorRead.ok
      ? coordinatorRead.restarts.filter((record) => record.budgetEpochId === epoch)
      : [];
    const latestRestart = epochRestarts[epochRestarts.length - 1];
    const latestStuck = coordinatorRead.ok
      ? coordinatorRead.stuck[coordinatorRead.stuck.length - 1]
      : undefined;
    const newestSession = loopRead.ok ? loopRead.sessions[loopRead.sessions.length - 1] : undefined;
    const stop = loopRead.ok ? loopRead.stops[loopRead.stops.length - 1] : undefined;
    const requested = stop?.action === "requested";
    return projectLoopStatus({
      loopId,
      state: running ? "running" : "stopped",
      instance:
        lease !== null && lease.action !== "released"
          ? { instanceId: lease.instanceId, pid: lease.pid }
          : null,
      liveSession: {
        sessionId: live.liveness === "alive" ? live.sessionId : null,
        alive: live.liveness === "alive",
        pid: live.liveness === "alive" ? live.pid : null,
      },
      recordedTitle: newestSession?.title ?? null,
      recordedProgress: null,
      restarts: {
        count: epochRestarts.length,
        bound: settings.restartBudget,
        budgetEpochId: epoch,
        lastReason: latestRestart?.reason ?? null,
      },
      stop: {
        requested,
        mode: requested ? (stop?.mode ?? "drain") : null,
        recordedAt: stop?.recordedAt ?? null,
      },
      verdict:
        latestStuck === undefined
          ? null
          : {
              verdict: latestStuck.verdict,
              reason: latestStuck.reason,
              evidence: latestStuck.evidence,
            },
      degraded: orderDegradations(degraded),
    });
  };

  type Claimed = {
    readonly instanceId: string;
    readonly holder: string;
    readonly pid: number;
    readonly processStartTimeMs: number;
    readonly budgetEpochId: string;
  };

  type ClaimOutcome =
    | { readonly ok: true; readonly claimed: Claimed }
    | { readonly ok: false; readonly failure: LoopFailure };

  /** Claim the DELIVERED instance lease under the loop identity (F-6, DEC-1). */
  const claim = (input: { readonly freshBudget: boolean }): ClaimOutcome => {
    const fenceToken = ports.newFenceToken();
    let acquired = ledger.acquireFence(fenceToken);
    if (!acquired.ok && acquired.error.code === "state.lock.busy") {
      if (ledger.fenceStatus().stale && ledger.recoverFence(fenceToken)) {
        acquired = ledger.acquireFence(fenceToken);
      }
    }
    if (!acquired.ok) {
      return acquired.error.code === "state.lock.busy"
        ? { ok: false, failure: failure("coordinator", alreadyRunning) }
        : { ok: false, failure: stateFailure(acquired.error.code) };
    }
    const handle = acquired.value.handle;
    try {
      const coordinatorRead = ledger.read().coordinator;
      if (!coordinatorRead.ok) return { ok: false, failure: stateFailure(coordinatorRead.code) };
      const lease = loopLeaseOf(coordinatorRead);
      const decision = decideCoordinatorClaim({
        lease,
        alive:
          lease === null || !ports.processPort.capabilities.alive
            ? null
            : ports.processPort.probe({
                pid: lease.pid,
                processStartTimeMs: lease.processStartTimeMs,
              }),
        aliveDeclared: ports.processPort.capabilities.alive,
        nowMs: clock.nowMs(),
        collectionIntervalMs: settings.collectionIntervalMs,
      });
      if (decision.kind === "capability-gap") {
        return { ok: false, failure: failure("coordinator", capabilityGap) };
      }
      if (decision.kind === "refuse") {
        return {
          ok: false,
          failure: failure("coordinator", alreadyRunning, `holder=${decision.holder}`),
        };
      }
      const own = ports.processPort.ownIdentity();
      if (own === null) return { ok: false, failure: failure("coordinator", capabilityGap) };
      const highestEpoch = Math.max(
        ...coordinatorRead.fences.map((record) => epochIndexOf(record.budgetEpochId)),
        ...coordinatorRead.restarts.map((record) => epochIndexOf(record.budgetEpochId)),
        0,
      );
      const budgetEpochId = input.freshBudget
        ? `epoch-${String(highestEpoch + 1)}`
        : loopBudgetEpoch(coordinatorRead);
      const record: CoordinatorFenceRecord = {
        schemaId: "delivery.coordinator.fence.v1",
        fenceId: ports.newId("fence"),
        instanceId: ports.newId("instance"),
        coordinatorId: loopId,
        action: decision.kind === "takeover" ? "stale-takeover" : "acquired",
        holder: HOLDER(own.pid, own.processStartTimeMs),
        pid: own.pid,
        processStartTimeMs: own.processStartTimeMs,
        supervisorMode: "foreground",
        externalUnit: "absent",
        previousHolder: decision.kind === "takeover" ? decision.previousHolder : null,
        fenceAgeMs: decision.kind === "takeover" ? decision.fenceAgeMs : null,
        budgetEpochId,
        recordedAt: clock.nowIso(),
      };
      const appended = ledger.appendFence(record, handle);
      if (!appended.ok) return { ok: false, failure: stateFailure(appended.code) };
      log("start", { instance: record.instanceId, epoch: budgetEpochId, pid: own.pid });
      return {
        ok: true,
        claimed: {
          instanceId: record.instanceId,
          holder: record.holder,
          pid: own.pid,
          processStartTimeMs: own.processStartTimeMs,
          budgetEpochId,
        },
      };
    } finally {
      ledger.releaseFence(handle);
    }
  };

  /** Record one acquisition; one append per acquisition, never one per cycle. */
  const recordAcquisition = (session: {
    readonly sessionId: string;
    readonly harnessKind: string;
    readonly pid: number | null;
    readonly processStartTimeMs: number | null;
    readonly title: string | null;
  }): { readonly facts: LoopSessionFacts; readonly record: LoopSessionRecord } => {
    const acquiredAt = clock.nowIso();
    const record = sessionRecordFrom({
      sessionRecordId: ports.newId("session-record"),
      loopId,
      sessionId: session.sessionId,
      harnessKind: session.harnessKind,
      pid: session.pid,
      processStartTimeMs: session.processStartTimeMs,
      title: session.title,
      state: "active",
      acquiredAt,
      recordedAt: acquiredAt,
    });
    const appended = ledger.appendSession(record);
    if (!appended.ok) log("error", { reason: appended.code });
    log("session", { session: session.sessionId, state: "active" });
    return {
      record,
      facts: {
        sessionId: session.sessionId,
        liveness: "alive",
        harnessKind: session.harnessKind,
        pid: session.pid,
        processStartTimeMs: session.processStartTimeMs,
        title: session.title,
      },
    };
  };

  /**
   * Record the session's end: ONE append per state change and none per cycle
   * (DM-1). A join or a resume of an existing session records no second
   * acquisition.
   */
  const recordEnd = (record: LoopSessionRecord | null): void => {
    if (record === null) return;
    const ended = endedSessionRecord({
      record,
      sessionRecordId: ports.newId("session-record"),
      recordedAt: clock.nowIso(),
    });
    const appended = ledger.appendSession(ended);
    if (!appended.ok) log("error", { reason: appended.code });
    log("session", { session: ended.sessionId, state: "ended" });
  };

  /**
   * Resolve the recorded session BEFORE considering another spawn (F-6):
   *
   *   - a recorded pid alive with a matching start time  -> JOIN and observe;
   *   - a session recorded `ended`                       -> REPLACE with one
   *     fresh session (the re-homed TC-PARITY-005 path);
   *   - `active` with no process identity                -> unknown-liveness,
   *     RESUMED exactly once with the recorded session id and no title;
   *   - no usable record                                 -> one fresh spawn.
   *
   * No path spawns a second session beside a recorded live one.
   */
  const establishSession = async (): Promise<
    | {
        readonly ok: true;
        readonly facts: LoopSessionFacts;
        readonly record: LoopSessionRecord | null;
      }
    | { readonly ok: false; readonly failure: LoopFailure }
  > => {
    const facts = ports.session.read();
    const prompt = loopSpawnPrompt(loopId);
    const snapshot = ledger.read().loop;
    const recorded = snapshot.ok ? snapshot.sessions[snapshot.sessions.length - 1] : undefined;

    if (facts.liveness === "alive") {
      const joined = await ports.session.join();
      if (!joined.ok) return { ok: false, failure: refusalFor(joined.code) };
      return { ok: true, facts, record: null };
    }

    if (recorded !== undefined && recorded.state === "active") {
      if (recorded.sessionId === null) {
        // A record without a session identity cannot be joined or resumed.
      } else if (recorded.pid === null) {
        // Unknown-liveness: resume, never duplicate and never kill (AC-F6-5).
        const resumed = await ports.session.resume({ sessionId: recorded.sessionId, prompt });
        if (!resumed.ok) return { ok: false, failure: refusalFor(resumed.code) };
        return { ok: true, facts: { ...facts, ...resumed, liveness: "alive" }, record: null };
      } else {
        const answer = ports.processPort.capabilities.alive
          ? ports.processPort.probe({
              pid: recorded.pid,
              processStartTimeMs: recorded.processStartTimeMs ?? 0,
            })
          : null;
        if (answer === true) {
          const joined = await ports.session.join();
          if (!joined.ok) return { ok: false, failure: refusalFor(joined.code) };
          return { ok: true, facts, record: null };
        }
      }
    }

    const title = freshSessionTitle(clock.nowMs());
    const spawned = await ports.session.spawn({ title, prompt });
    if (!spawned.ok) return { ok: false, failure: refusalFor(spawned.code) };
    const acquisition = recordAcquisition(spawned);
    return { ok: true, facts: acquisition.facts, record: acquisition.record };
  };

  /** The supervisor's own last sourced-progress observation (seeded at acquisition). */
  let lastProgressAtMs: number | null = null;
  let cycleOrdinal = 0;
  let degradations: LoopDegradation[] = [];
  let exhaustion: string | null = null;
  let acquiredSession: LoopSessionRecord | null = null;

  type CycleStep = "continue" | "stop" | "kill-failed" | "exhausted";

  /**
   * The two-signal stuck step (F-5, DEC-3): the loop's own pure verdict over
   * sourced progress, artifact advance, and the readable corroborator. An
   * unreadable input is `unevaluable` and never a kill; a confirmed termination
   * records the restart ADMISSION decision only (phases 5 performs the restart);
   * an unconfirmed termination is TERMINAL.
   */
  const cycle = async (): Promise<CycleStep> => {
    const nowMs = clock.nowMs();
    const session = ports.session.read();
    // ONE verified state read per supervision cycle: the stop fold, the
    // already-recorded expectation, and the epoch all fold from this snapshot.
    const snapshot = ledger.read();
    const stopRead = snapshot.loop;
    if (!stopRead.ok) return "stop";
    const folded = foldLoopStop(stopRead.stops);
    if (folded.applied && folded.kind === "requested") {
      log("stop", { mode: folded.mode });
      if (folded.mode === "immediate") {
        if (session.pid === null) {
          // Unverifiable identity: never signalled, reported, ends here.
          return "stop";
        }
        await ports.terminate(settings.killGraceMs);
      }
      return "stop";
    }
    if (lastProgressAtMs === null) lastProgressAtMs = nowMs;
    cycleOrdinal += 1;

    const reading = ports.progress.read(session.sessionId);
    const progressState: CoordinatorProgressState = reading === null ? "unknown" : reading.state;
    const delivery = ports.corroborator.read();
    const verdict = evaluateLoopVerdict({
      liveSession: session.liveness === "alive",
      progress: progressState,
      progressObservedAtMs: reading?.observedAtMs ?? null,
      lastProgressAtMs,
      nowMs,
      stuckWindowMs: settings.stuckWindowMs,
      progressBoundMs: settings.progressBoundMs,
      artifactAdvanced: ports.artifactAdvanced(),
      delivery,
    });
    lastProgressAtMs = observeProgress({
      progress: progressState,
      observedAtMs: reading?.observedAtMs ?? null,
      nowMs,
      progressBoundMs: settings.progressBoundMs,
      lastProgressAtMs,
    });
    const observed: LoopDegradation[] = [];
    if (progressState === "unknown") observed.push("progress-unreadable");
    if (delivery === "unknown") observed.push("delivery-corroborator-unreadable");
    if (session.liveness !== "alive") observed.push("live-facts-unknown");
    degradations = [...orderDegradations(observed)];
    log("cycle", { verdict: verdict.verdict, delivery });

    if (verdict.verdict === "progressing") return "continue";

    const stuckId = `${loopId}:${String(cycleOrdinal)}`;
    const already = snapshot.coordinator.ok
      ? snapshot.coordinator.stuck.filter((record) => record.stuckId === stuckId)
      : [];
    if (already.length === 0) {
      const verdictRecord: CoordinatorStuckRecord = {
        schemaId: "delivery.coordinator.stuck.v1",
        stuckId,
        coordinatorId: loopId,
        iterationId: stuckId,
        verdict: verdict.verdict,
        phase: "verdict",
        reason: verdict.reason ?? "evidence-unevaluable",
        evidence: verdict.evidence ?? "",
        killOutcome: "not-attempted",
        killFailureReason: null,
        recordedAt: clock.nowIso(),
      };
      const appended = ledger.appendStuck(verdictRecord);
      if (!appended.ok) return "stop";
      log("stuck-verdict", { verdict: verdict.verdict, stuck: stuckId });
    }
    if (verdict.verdict === "unevaluable") return "continue";

    const killed = await ports.terminate(settings.killGraceMs);
    log("kill", { outcome: killed.outcome, session: session.sessionId });
    const outcomeRecord: CoordinatorStuckRecord = {
      schemaId: "delivery.coordinator.stuck.v1",
      stuckId,
      coordinatorId: loopId,
      iterationId: stuckId,
      verdict: verdict.verdict,
      phase: "outcome",
      reason: verdict.reason ?? "stuck-artifact-evidence",
      evidence: verdict.evidence ?? "",
      killOutcome: killed.outcome === "capability-gap" ? "failed" : killed.outcome,
      killFailureReason: killed.failureReason,
      recordedAt: clock.nowIso(),
    };
    const appendedOutcome = ledger.appendStuck(outcomeRecord);
    if (!appendedOutcome.ok) return "stop";
    if (killed.outcome === "failed" || killed.outcome === "capability-gap") {
      // A possibly-live orphan must never be joined by another session (R3).
      return "kill-failed";
    }
    // Confirmed. The terminated session's record closes BEFORE any replacement
    // is recorded, so at most one `active` record ever exists (AC-F6-4).
    recordEnd(acquiredSession);
    acquiredSession = null;

    // The delivered restart-admission fold decides exactly once.
    const epoch = loopBudgetEpoch(snapshot.coordinator);
    const admission = ports.admission({ ordinal: cycleOrdinal, budgetEpochId: epoch });
    if (admission.state === "unevaluable") return "stop";
    const bound = settings.restartBudget;
    const consumed = snapshot.coordinator.ok
      ? snapshot.coordinator.restarts.filter((record) => record.budgetEpochId === epoch).length
      : 0;
    if (admission.state === "refuse" || consumed >= bound) {
      // At/above the bound: no restart record, no session, the loop's own
      // remediation and the derivable history reference (R-20).
      const sequence = ledger.lastRestartSequence();
      const summary = `epoch=${epoch};restarts=${String(consumed)}/${String(
        bound,
      )};historyRef=${epoch};restarts=${String(consumed)};seq=${String(sequence ?? 0)};remediation=loop start --foreground --fresh-budget`;
      log("budget-exhausted", { epoch, restarts: `${String(consumed)}/${String(bound)}` });
      exhaustion = summary;
      return "exhausted";
    }
    const delayMs = restartDelayMs(admission.nextOrdinal);
    const restartRecord: CoordinatorRestartRecord = {
      schemaId: "delivery.coordinator.restart.v1",
      restartId: `${loopId}#${epoch}#${String(admission.nextOrdinal)}`,
      coordinatorId: loopId,
      budgetEpochId: epoch,
      sessionId: null,
      ordinal: admission.nextOrdinal,
      reason: "stuck-artifact-evidence",
      previousSessionId: session.sessionId,
      recordedAt: clock.nowIso(),
    };
    const appendedRestart = ledger.appendRestart(restartRecord);
    if (!appendedRestart.ok) return "stop";
    log("restart", {
      ordinal: admission.nextOrdinal,
      reason: "stuck-artifact-evidence",
      delayMs,
      replaced: session.sessionId ?? "",
    });
    // The wait is CANCELLABLE: a durable stop or a signal ends it without the
    // session effect (AC-F3-2).
    await ports.delay(delayMs, "restart-backoff");
    log("backoff", { delayMs, ordinal: admission.nextOrdinal });
    if (ports.cancelled !== undefined && ports.cancelled()) return "stop";
    const title = freshSessionTitle(clock.nowMs());
    const spawned = await ports.session.spawn({ title, prompt: loopSpawnPrompt(loopId) });
    if (!spawned.ok) return "stop";
    acquiredSession = recordAcquisition(spawned).record;
    return "continue";
  };

  /* --------------------------------- start --------------------------------- */

  const start = async (input: {
    readonly foreground: boolean;
    readonly freshBudget: boolean;
  }): Promise<LoopResult<LoopStartReceipt>> => {
    if (!input.foreground) {
      return failure(
        "fallback",
        "fallback.invocation",
        "loop start requires --foreground in v1; detached hosting is not declared",
      );
    }
    // The stop is folded BEFORE the claim: a folded request starts nothing.
    const preflight = ledger.read();
    if (!preflight.loop.ok) return stateFailure(preflight.loop.code);
    if (isStopFolded(preflight.loop.stops)) {
      const data = projection(preflight.loop, preflight.coordinator, absentSessionFacts(), []);
      return { data: { ...data, state: "stopped", released: false } };
    }
    const claimed = claim({ freshBudget: input.freshBudget });
    if (!claimed.ok) return claimed.failure;
    const identity = claimed.claimed;
    let facts: LoopSessionFacts = absentSessionFacts();
    let acquisition: LoopSessionRecord | null = null;
    let killFailed = false;
    try {
      const established = await establishSession();
      if (!established.ok) {
        release(identity);
        return established.failure;
      }
      facts = established.facts;
      acquisition = established.record;
      acquiredSession = established.record;
      lastProgressAtMs = clock.nowMs();
      const exit = await ports.loop.run(async () => {
        const step = await cycle();
        if (step === "kill-failed") killFailed = true;
        return step === "continue" ? "continue" : "stop";
      });
      void exit;
      if (killFailed) {
        recordEnd(acquiredSession ?? acquisition);
        release(identity);
        return failure("coordinator", COORDINATOR_ERROR_CODES[3], `session=${facts.sessionId}`);
      }
      if (exhaustion !== null) {
        recordEnd(acquiredSession ?? acquisition);
        release(identity);
        return failure("coordinator", COORDINATOR_ERROR_CODES[1], exhaustion);
      }
    } catch (thrown) {
      recordEnd(acquisition);
      release(identity);
      return failureFor(thrown);
    }
    recordEnd(acquiredSession ?? acquisition);
    facts = { ...facts, liveness: "absent" };
    release(identity);
    const snapshot = ledger.read();
    const data = projection(snapshot.loop, snapshot.coordinator, facts, degradations);
    return { data: { ...data, state: "stopped", released: true } };
  };

  function release(identity: Claimed): void {
    const record: CoordinatorFenceRecord = {
      schemaId: "delivery.coordinator.fence.v1",
      fenceId: ports.newId("fence"),
      instanceId: identity.instanceId,
      coordinatorId: loopId,
      action: "released",
      holder: identity.holder,
      pid: identity.pid,
      processStartTimeMs: identity.processStartTimeMs,
      supervisorMode: "foreground",
      externalUnit: "absent",
      previousHolder: null,
      fenceAgeMs: null,
      budgetEpochId: identity.budgetEpochId,
      recordedAt: clock.nowIso(),
    };
    void appendFence(record);
    log("release", { instance: identity.instanceId });
  }

  /* -------------------------------- status --------------------------------- */

  const status = async (): Promise<LoopResult<LoopStatusProjection>> => {
    const snapshot = ledger.read();
    const loopRead = snapshot.loop;
    if (!loopRead.ok) return stateFailure(loopRead.code);
    const coordinatorRead = snapshot.coordinator;
    if (!coordinatorRead.ok) return stateFailure(coordinatorRead.code);
    const facts = ports.session.read();
    const degraded: LoopDegradation[] = [];
    // A recorded `active` session with no process identity is unknown-liveness,
    // never a fabricated fact (DM-3, AC-F6-5).
    const newest = loopRead.sessions[loopRead.sessions.length - 1];
    if (newest !== undefined && newest.state === "active" && newest.pid === null) {
      degraded.push("session-pid-unknown");
    }
    if (ports.log.available !== undefined && !ports.log.available()) {
      degraded.push("log-unavailable");
    }
    degraded.push(...degradations);
    return { data: projection(loopRead, coordinatorRead, facts, degraded) };
  };

  /* ---------------------------------- log ---------------------------------- */

  const logRead = async (input: {
    readonly lines: number;
  }): Promise<LoopResult<LoopLogProjection>> => {
    const requested =
      Number.isInteger(input.lines) && input.lines >= 1 && input.lines <= 100 ? input.lines : 50;
    const tail =
      ports.log.read === undefined
        ? { lines: [], totalBytes: 0, truncated: false, unreadable: false }
        : ports.log.read(requested);
    return {
      data: {
        schemaVersion: "delivery.loop.log.v1",
        loopId,
        requestedLines: requested,
        returnedLines: tail.lines.length,
        totalBytes: tail.totalBytes,
        truncated: tail.truncated,
        unreadable: tail.unreadable,
        lines: tail.lines,
      },
    };
  };

  /* ------------------------------ stop/reset ------------------------------- */

  const stop = async (input: {
    readonly mode: LoopStopMode;
  }): Promise<LoopResult<LoopStopData>> => {
    const read = ledger.read().loop;
    if (!read.ok) return stateFailure(read.code);
    const folded = foldLoopStop(read.stops);
    if (folded.applied && folded.kind === "requested") {
      // Idempotent within a stop episode: a repeat appends nothing.
      return {
        data: {
          loopId,
          state: "requested",
          mode: folded.mode,
          recordedAt: folded.recordedAt,
        },
      };
    }
    const record: LoopStopRecord = {
      schemaId: "delivery.loop.stop.v1",
      stopId: ports.newId("stop"),
      loopId,
      action: "requested",
      mode: input.mode,
      recordedAt: clock.nowIso(),
    };
    const appended = ledger.appendStop(record);
    if (!appended.ok) return stateFailure(appended.code);
    log("stop", { mode: input.mode });
    return {
      data: { loopId, state: "requested", mode: input.mode, recordedAt: record.recordedAt },
    };
  };

  const reset = async (): Promise<LoopResult<LoopStopData>> => {
    const read = ledger.read().loop;
    if (!read.ok) return stateFailure(read.code);
    const folded = foldLoopStop(read.stops);
    if (!folded.applied || folded.kind !== "requested") {
      return { data: { loopId, state: "none", mode: null, recordedAt: null } };
    }
    const record: LoopStopRecord = {
      schemaId: "delivery.loop.stop.v1",
      stopId: ports.newId("stop"),
      loopId,
      action: "cleared",
      mode: null,
      recordedAt: clock.nowIso(),
    };
    const appended = ledger.appendStop(record);
    if (!appended.ok) return stateFailure(appended.code);
    return {
      data: { loopId, state: "cleared", mode: null, recordedAt: record.recordedAt },
    };
  };

  return { start, status, log: logRead, stop, reset };
};

/** The delivered progress vocabulary the projection reuses (DM-6). */
export type LoopProgressState = CoordinatorProgressState;
