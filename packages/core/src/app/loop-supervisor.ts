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
  type CoordinatorProgressState,
  type CoordinatorRestartRecord,
  type CoordinatorStuckRecord,
  type DaemonProcessPort,
  type LoopDegradation,
  type LoopLogEvent,
  type LoopSessionRecord,
  type LoopStatusProjection,
  type LoopStopRecord,
  type Result,
  type StateFenceHandle,
} from "#contracts";
import type { CoordinatorSettings } from "../config/index.js";
import { type CoordinatorLease, decideCoordinatorClaim } from "../domain/coordinator-fence.js";
import { orderDegradations, projectLoopStatus } from "../domain/loop-status.js";
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
  readonly delay: LoopDelay;
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

/** The lease fold over the loop identity's own fence records (F-6). */
export const loopLeaseOf = (read: LoopCoordinatorRead): CoordinatorLease | null => {
  if (!read.ok) return null;
  let latest: CoordinatorFenceRecord | null = null;
  let acquisition: CoordinatorFenceRecord | null = null;
  for (const record of read.fences) {
    latest = record;
    if (record.action === "acquired" || record.action === "stale-takeover") acquisition = record;
  }
  if (latest === null) return null;
  return {
    action: latest.action,
    instanceId: latest.instanceId,
    holder: latest.holder,
    pid: latest.pid,
    processStartTimeMs: latest.processStartTimeMs,
    supervisorMode: latest.supervisorMode,
    externalUnit: latest.externalUnit,
    acquisitionAtMs: toMs(acquisition?.recordedAt ?? null),
    previousHolder: latest.previousHolder,
    fenceAgeMs: latest.fenceAgeMs,
  };
};

/** The recorded facts default when the composition has nothing to report. */
export const absentSessionFacts = (): LoopSessionFacts => ({
  sessionId: null,
  liveness: "absent",
  harnessKind: "opencode",
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

  /** Establish the CEO session before any observation (F-2). */
  /** Establish the CEO session before any observation (F-2). */
  const establishSession = async (): Promise<
    | {
        readonly ok: true;
        readonly facts: LoopSessionFacts;
        readonly record: LoopSessionRecord | null;
      }
    | { readonly ok: false; readonly failure: LoopFailure }
  > => {
    const facts = ports.session.read();
    if (facts.liveness === "alive") {
      const joined = await ports.session.join();
      if (!joined.ok) return { ok: false, failure: refusalFor(joined.code) };
      return { ok: true, facts, record: null };
    }
    const title = freshSessionTitle(clock.nowMs());
    const spawned = await ports.session.spawn({ title, prompt: loopSpawnPrompt(loopId) });
    if (!spawned.ok) return { ok: false, failure: refusalFor(spawned.code) };
    const acquisition = recordAcquisition(spawned);
    return { ok: true, facts: acquisition.facts, record: acquisition.record };
  };

  /** One supervision cycle at the collection boundary (F-5; phases 4-6 extend it). */
  const cycle = async (): Promise<"continue" | "stop"> => "continue";

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
    const claimed = claim({ freshBudget: input.freshBudget });
    if (!claimed.ok) return claimed.failure;
    const identity = claimed.claimed;
    let facts: LoopSessionFacts = absentSessionFacts();
    let acquisition: LoopSessionRecord | null = null;
    try {
      const established = await establishSession();
      if (!established.ok) {
        release(identity);
        return established.failure;
      }
      facts = established.facts;
      acquisition = established.record;
      await ports.loop.run(cycle);
    } catch (thrown) {
      recordEnd(acquisition);
      release(identity);
      return failureFor(thrown);
    }
    recordEnd(acquisition);
    facts = { ...facts, liveness: "absent" };
    release(identity);
    const snapshot = ledger.read();
    const data = projection(snapshot.loop, snapshot.coordinator, facts, []);
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
    return { data: projection(loopRead, coordinatorRead, facts, degraded) };
  };

  return { start, status };
};

/** The delivered progress vocabulary the projection reuses (DM-6). */
export type LoopProgressState = CoordinatorProgressState;
