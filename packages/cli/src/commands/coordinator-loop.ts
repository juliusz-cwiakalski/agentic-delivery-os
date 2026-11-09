/**
 * The coordinator supervision engine and the declared foreground loop (GH-241
 * F-1, F-4..F-9; AC-F1-1..5, AC-F8-1..7, AC-F9-1, AC-F10-3).
 *
 * Every decision is composed here over injected ports: the state store, the
 * clock, id and fence factories, the process port with its declared
 * capabilities, the harness session facts and effects, the delivered blocker
 * ledger, and the injected cycle driver. Handlers never write streams and never
 * choose an exit code; the command surface owns the envelope and projection.
 */
import { appendBlockerQuestion, readBlockerLedger } from "@delivery-os/core/state";
import {
  appendCoordinatorExhaustion,
  appendCoordinatorFence,
  appendCoordinatorIteration,
  appendCoordinatorRestart,
  appendCoordinatorStuck,
  appendCoordinatorWake,
  coordinatorFenceKey,
  foldCoordinatorDecision,
  foldCoordinatorStuck,
  foldCoordinatorWake,
  readCoordinatorRecords,
  type CoordinatorRecordsRead,
} from "@delivery-os/core/state";
import {
  decideCoordinatorClaim,
  decideLifecycle,
  escalationOptions,
  evaluateCoordinatorRestartAdmission,
  evaluateStuck,
  evaluateWake,
  isReservedEscalationQuestion,
  projectCoordinatorObservation,
  projectEscalationState,
  type CoordinatorClaimDecision,
  type CoordinatorLease,
} from "@delivery-os/core";
import { killCoordinatorProcess } from "@delivery-os/adapters/daemon";
import { formatBlockerQuestionId, rankBlockerQuestions } from "@delivery-os/core";
import {
  BLOCKER_ANSWER_RECORD_KIND,
  COORDINATOR_ERROR_CODES,
  COORDINATOR_V1_SUPERVISOR_MODE,
  FALLBACK_INVOCATION_CODE,
  type BlockerQuestionRecord,
  type CoordinatorConfigKey,
  type CoordinatorDecisionView,
  type CoordinatorEscalationView,
  type CoordinatorFenceRecord,
  type CoordinatorInstance,
  type CoordinatorIterationTrigger,
  type CoordinatorObservation,
  type CoordinatorProgressState,
  type CoordinatorRestartRecord,
  type CoordinatorRestartReason,
  type CoordinatorSession,
  type CoordinatorStuckRecord,
  type CoordinatorStuckView,
  type CoordinatorTickVerdict,
  type CoordinatorWakeRecord,
  type CoordinatorWakeView,
  type DaemonProcessPort,
  type StateStorePort,
} from "@delivery-os/core/contracts";
import type { CoordinatorSettings } from "@delivery-os/core";

/* ------------------------------- results --------------------------------- */

export type CoordinatorFailure = {
  readonly error: {
    readonly kind: string;
    readonly code: string;
    readonly summary?: string;
  };
};

export type CoordinatorResult<T> = { readonly data: T } | CoordinatorFailure;

export type CoordinatorStopData = CoordinatorObservation & {
  readonly requested: boolean;
  readonly released: boolean;
  readonly state: "requested" | "not-running";
};

/* -------------------------------- ports ---------------------------------- */

/** The recorded harness-session facts the engine consumes. */
export type CoordinatorSessionFacts = {
  readonly sessionId: string | null;
  readonly liveness: "alive" | "absent" | "unknown";
  readonly contextTokens: number | null;
  readonly harnessKind: string;
  readonly completedCleanly: boolean;
  readonly resumable: boolean;
  readonly resumeDeclared: boolean;
  readonly pid: number | null;
  readonly processStartTimeMs: number | null;
};

/** The injected supervisor ports. */
export type CoordinatorSupervisorPorts = {
  readonly store: StateStorePort;
  readonly clock: { readonly nowMs: () => number; readonly nowIso: () => string };
  readonly newFenceToken: () => string;
  readonly newId: (prefix: string) => string;
  readonly coordinatorId: string;
  readonly stateDirectory: string;
  readonly settings: CoordinatorSettings;
  readonly processPort: {
    readonly port: DaemonProcessPort;
    readonly capabilities: {
      readonly alive: boolean;
      readonly killWithGrace: boolean;
      readonly startTimeIdentity: boolean;
    };
    /** Declared probe; `null` means declared but no answer for the handle. */
    readonly probe: (identity: {
      readonly pid: number;
      readonly processStartTimeMs: number;
    }) => boolean | null;
    /** The supervisor's own recorded identity. */
    readonly ownIdentity: () => {
      readonly pid: number;
      readonly processStartTimeMs: number;
    } | null;
    /** A bounded injected wait used by the grace half. */
    readonly wait: (ms: number) => Promise<void>;
    /** The projected new-turn facts (adapter mapping). */
    readonly progress: () => {
      readonly newTurn: CoordinatorProgressState;
      readonly observedAtMs: number | null;
    };
  };
  readonly session: {
    readonly read: () => CoordinatorSessionFacts;
    readonly apply: (
      effect: "attach" | "resume" | "spawn",
    ) => { readonly ok: true } | { readonly ok: false; readonly code: string };
    readonly wake: () => { readonly ok: boolean };
  };
  readonly loop: CoordinatorLoopPort;
};

/** The declared loop-exit vocabulary. */
export type CoordinatorLoopExit = "stopped" | "signal";

/** The injected cycle driver/clock seam (bounded, cancellable, no ambient timer). */
export type CoordinatorLoopPort = {
  readonly run: (onCycle: () => Promise<"continue" | "stop">) => Promise<CoordinatorLoopExit>;
};

/* ------------------------------- helpers --------------------------------- */

const failure = (kind: string, code: string, summary?: string): CoordinatorFailure => ({
  error: { kind, code, ...(summary === undefined ? {} : { summary }) },
});

const failureFor = (thrown: unknown): CoordinatorFailure => {
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

const stateFailure = (code: string): CoordinatorFailure => failure("state", code);

const isStateCode = (code: string): boolean => code.startsWith("state.");

const deliveredFailure = (code: string): CoordinatorFailure =>
  isStateCode(code) ? stateFailure(code) : failure("coordinator", code);

const toMs = (iso: string | null): number | null => {
  if (iso === null) return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
};

const HOLDER = (pid: number, processStartTimeMs: number): string =>
  `pid:${pid}:start:${processStartTimeMs}`;

const cachedView = (store: StateStorePort, raw: StoreRead): StateStorePort => ({
  ...store,
  readRecords: () => raw,
});

const fingerprint = (recordCount: number, openCoordinatorQuestions: number): string =>
  `cursor=${recordCount};open=${openCoordinatorQuestions}`;

/** The durable budget epoch: latest restart epoch, else latest exhaustion, else `epoch-1`. */
export const currentBudgetEpoch = (read: CoordinatorRecordsRead): string => {
  if (!read.ok) return "epoch-1";
  const latestRestart = read.restarts[read.restarts.length - 1];
  if (latestRestart !== undefined) return latestRestart.budgetEpochId;
  const latestExhaustion = read.exhaustion[read.exhaustion.length - 1];
  if (latestExhaustion !== undefined) return latestExhaustion.budgetEpochId;
  return "epoch-1";
};

/** A fresh epoch opens after the highest epoch index seen; history remains. */
export const freshBudgetEpoch = (read: CoordinatorRecordsRead): string => {
  if (!read.ok) return "epoch-1";
  let highest = 0;
  for (const record of [...read.restarts, ...read.exhaustion]) {
    const match = /^epoch-(\d+)$/.exec(record.budgetEpochId);
    if (match?.[1] !== undefined) highest = Math.max(highest, Number(match[1]));
  }
  return `epoch-${highest + 1}`;
};

/** The escalation ref shape `<coordinatorId>#<budgetEpochId>`. */
export const escalationRef = (coordinatorId: string, epoch: string): string =>
  `${coordinatorId}#${epoch}`;

/* ------------------------------- engine ---------------------------------- */

export type CoordinatorSupervisor = {
  start(input: {
    readonly foreground: boolean;
    readonly freshBudget: boolean;
  }): Promise<CoordinatorResult<CoordinatorObservation>>;
  stop(): Promise<CoordinatorResult<CoordinatorStopData>>;
  status(input: { readonly live: boolean }): Promise<CoordinatorResult<CoordinatorObservation>>;
  tick(): Promise<CoordinatorResult<CoordinatorObservation>>;
};

type RecordedIdentity = {
  readonly instanceId: string;
  readonly holder: string;
  readonly pid: number;
  readonly processStartTimeMs: number;
};

type StoreRead = ReturnType<StateStorePort["readRecords"]>;

type OkRead = Extract<CoordinatorRecordsRead, { readonly ok: true }>;

type Claimed = {
  readonly read: OkRead;
  readonly raw: StoreRead;
  readonly instance: CoordinatorInstance;
  readonly identity: RecordedIdentity;
  readonly fence: CoordinatorFenceRecord;
  readonly action: "acquired" | "stale-takeover";
};

type ClaimOutcome =
  | { readonly ok: true; readonly claimed: Claimed }
  | { readonly ok: false; readonly failure: CoordinatorFailure };

type CycleOutcome =
  | {
      readonly kind: "ok";
      readonly read: OkRead;
      readonly tickVerdict: CoordinatorTickVerdict | null;
      readonly wakeOutcome: CoordinatorWakeView | null;
    }
  | {
      readonly kind: "stop";
      readonly read: OkRead;
      readonly tickVerdict: CoordinatorTickVerdict | null;
      readonly wakeOutcome: CoordinatorWakeView | null;
    }
  | {
      readonly kind: "failure";
      readonly failure: CoordinatorFailure;
      readonly read: OkRead;
      readonly tickVerdict: CoordinatorTickVerdict | null;
      readonly wakeOutcome: CoordinatorWakeView | null;
    };

export const createCoordinatorSupervisor = (
  ports: CoordinatorSupervisorPorts,
): CoordinatorSupervisor => {
  const { store, coordinatorId, stateDirectory, settings } = ports;
  const alreadyRunning = COORDINATOR_ERROR_CODES[0];
  const restartExhausted = COORDINATOR_ERROR_CODES[1];
  const capabilityGap = COORDINATOR_ERROR_CODES[2];
  const killFailed = COORDINATOR_ERROR_CODES[3];
  const publishFailed = COORDINATOR_ERROR_CODES[4];
  const wakeFailed = COORDINATOR_ERROR_CODES[5];

  const configValue = (key: CoordinatorConfigKey): number => {
    switch (key) {
      case "coordinator.stuck-window":
        return settings.stuckWindowMs;
      case "coordinator.kill-grace":
        return settings.killGraceMs;
      case "coordinator.restart-budget":
        return settings.restartBudget;
      case "coordinator.resume-context-limit":
        return settings.resumeContextLimit;
      case "coordinator.collection-interval":
        return settings.collectionIntervalMs;
      case "coordinator.progress-bound":
        return settings.progressBoundMs;
    }
  };

  const readOnce = (): StoreRead => store.readRecords();

  const coordinatorRead = (raw: StoreRead) =>
    readCoordinatorRecords(cachedView(store, raw), coordinatorId);

  const blockersRead = (raw: StoreRead) => readBlockerLedger(cachedView(store, raw));

  const leaseOf = (read: CoordinatorRecordsRead): CoordinatorLease | null => {
    if (!read.ok) return null;
    let latest: CoordinatorFenceRecord | null = null;
    let acquisition: CoordinatorFenceRecord | null = null;
    for (const record of read.fences) {
      latest = record;
      if (record.action === "acquired" || record.action === "stale-takeover") {
        acquisition = record;
      }
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

  const probe = (lease: CoordinatorLease | null): boolean | null => {
    if (!ports.processPort.capabilities.alive) return null;
    if (lease === null) return null;
    return ports.processPort.probe({
      pid: lease.pid,
      processStartTimeMs: lease.processStartTimeMs,
    });
  };

  const appendFence = (
    action: CoordinatorFenceRecord["action"],
    identity: {
      readonly instanceId: string;
      readonly holder: string;
      readonly pid: number;
      readonly processStartTimeMs: number;
    },
    extra: { readonly previousHolder?: string | null; readonly fenceAgeMs?: number | null } = {},
  ): CoordinatorFenceRecord => ({
    schemaId: "delivery.coordinator.fence.v1",
    fenceId: ports.newId("fence"),
    instanceId: identity.instanceId,
    coordinatorId,
    action,
    holder: identity.holder,
    pid: identity.pid,
    processStartTimeMs: identity.processStartTimeMs,
    supervisorMode: COORDINATOR_V1_SUPERVISOR_MODE,
    externalUnit: "absent",
    previousHolder: extra.previousHolder ?? null,
    fenceAgeMs: extra.fenceAgeMs ?? null,
    recordedAt: ports.clock.nowIso(),
  });

  const claim = (): ClaimOutcome => {
    const fenceToken = ports.newFenceToken();
    let acquired = store.acquireFence(fenceToken);
    if (!acquired.ok && acquired.error.code === "state.lock.busy") {
      const status = store.fenceStatus();
      if (status.stale) {
        const recovered = store.recoverFence(fenceToken);
        if (recovered.ok) acquired = store.acquireFence(fenceToken);
      }
    }
    if (!acquired.ok) {
      return acquired.error.code === "state.lock.busy"
        ? { ok: false, failure: failure("coordinator", alreadyRunning) }
        : { ok: false, failure: stateFailure(acquired.error.code) };
    }
    const handle = acquired.value.handle;
    try {
      const raw = readOnce();
      if (!raw.ok) return { ok: false, failure: stateFailure(raw.error.code) };
      const read = coordinatorRead(raw);
      if (!read.ok) {
        return { ok: false, failure: stateFailure(read.code as string) };
      }
      const lease = leaseOf(read);
      const decision: CoordinatorClaimDecision = decideCoordinatorClaim({
        lease,
        alive: probe(lease),
        aliveDeclared: ports.processPort.capabilities.alive,
        nowMs: ports.clock.nowMs(),
        collectionIntervalMs: configValue("coordinator.collection-interval"),
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
      if (own === null) {
        return { ok: false, failure: failure("coordinator", capabilityGap) };
      }
      const instanceId = ports.newId("instance");
      const holder = HOLDER(own.pid, own.processStartTimeMs);
      const startedAt = ports.clock.nowIso();
      const action: "acquired" | "stale-takeover" =
        decision.kind === "takeover" ? "stale-takeover" : "acquired";
      const fence: CoordinatorFenceRecord = {
        schemaId: "delivery.coordinator.fence.v1",
        fenceId: ports.newId("fence"),
        instanceId,
        coordinatorId,
        action,
        holder,
        pid: own.pid,
        processStartTimeMs: own.processStartTimeMs,
        supervisorMode: COORDINATOR_V1_SUPERVISOR_MODE,
        externalUnit: "absent",
        previousHolder: decision.kind === "takeover" ? decision.previousHolder : null,
        fenceAgeMs: decision.kind === "takeover" ? decision.fenceAgeMs : null,
        recordedAt: startedAt,
      };
      const appended = store.append(handle, {
        kind: "coordinator.fence",
        recordKey: coordinatorFenceKey(coordinatorId),
        payload: { ...fence },
      });
      if (!appended.ok) return { ok: false, failure: stateFailure(appended.error.code) };
      const instance: CoordinatorInstance = {
        instanceId,
        pid: own.pid,
        holder,
        startedAt,
        supervisorMode: COORDINATOR_V1_SUPERVISOR_MODE,
        externalUnit: "absent",
      };
      return {
        ok: true,
        claimed: {
          read: { ...read, fences: [...read.fences, fence] },
          raw,
          instance,
          identity: {
            instanceId,
            holder,
            pid: own.pid,
            processStartTimeMs: own.processStartTimeMs,
          },
          fence,
          action,
        },
      };
    } finally {
      store.releaseFence(handle);
    }
  };

  type CycleContext = {
    readonly raw: StoreRead;
    readonly openCoordinator: number;
    readonly recordCount: number;
    readonly appended: number;
  };

  const appendIteration = (
    read: OkRead,
    context: CycleContext,
    input: {
      readonly trigger: CoordinatorIterationTrigger;
      readonly decision: CoordinatorDecisionView["kind"];
      readonly reason: CoordinatorDecisionView["reason"];
      readonly sessionId: string | null;
      readonly contextTokens: number | null;
      readonly iterationId?: string;
    },
  ):
    | { readonly ok: true; readonly read: OkRead; readonly iterationId: string }
    | { readonly ok: false; readonly failure: CoordinatorFailure } => {
    const iterationId = input.iterationId ?? ports.newId("iteration");
    const record = {
      schemaId: "delivery.coordinator.iteration.v1" as const,
      iterationId,
      coordinatorId,
      trigger: input.trigger,
      decision: input.decision,
      reason: input.reason,
      sessionId: input.sessionId,
      contextTokens: input.contextTokens,
      digestFingerprint: fingerprint(
        context.recordCount + context.appended,
        context.openCoordinator,
      ),
      expectationWindowMs: configValue("coordinator.stuck-window"),
      recordedAt: ports.clock.nowIso(),
    };
    const appended = appendCoordinatorIteration(store, ports.newFenceToken(), record, read);
    if (!appended.ok) return { ok: false, failure: deliveredFailure(appended.code) };
    return { ok: true, read: { ...read, iterations: [...read.iterations, record] }, iterationId };
  };

  const restartReasonFor = (reason: string): CoordinatorRestartReason => {
    if (reason === "context-pressure") return "context-pressure";
    if (reason === "context-unknown") return "context-unknown";
    if (reason === "stuck-artifact-evidence") return "stuck-artifact-evidence";
    return "session-interrupted";
  };

  /** Append one admitted restart and apply the recovery effect. */
  const applyRecovery = (
    read: OkRead,
    epoch: string,
    reason: string,
    effect: "resume" | "spawn",
  ):
    | { readonly ok: true; readonly read: OkRead }
    | { readonly ok: false; readonly failure: CoordinatorFailure } => {
    const admission = evaluateCoordinatorRestartAdmission({
      records: read.restarts,
      budgetEpochId: epoch,
      bound: configValue("coordinator.restart-budget"),
    });
    if (admission.state === "unevaluable") {
      return { ok: false, failure: stateFailure("state.store.torn") };
    }
    if (admission.state === "refuse") {
      return { ok: false, failure: failure("coordinator", restartExhausted) };
    }
    const session = ports.session.read();
    const record: CoordinatorRestartRecord = {
      schemaId: "delivery.coordinator.restart.v1",
      restartId: `${coordinatorId}#${epoch}#${admission.nextOrdinal}`,
      coordinatorId,
      budgetEpochId: epoch,
      sessionId: session.sessionId,
      ordinal: admission.nextOrdinal,
      reason: restartReasonFor(reason),
      previousSessionId: session.sessionId,
      recordedAt: ports.clock.nowIso(),
    };
    const appended = appendCoordinatorRestart(store, ports.newFenceToken(), record, read);
    if (!appended.ok) return { ok: false, failure: deliveredFailure(appended.code) };
    if (appended.appended) {
      const applied = ports.session.apply(effect);
      if (!applied.ok) return { ok: false, failure: failure("harness", applied.code) };
    }
    const nextRead = appended.appended ? { ...read, restarts: [...read.restarts, record] } : read;
    return { ok: true, read: nextRead };
  };

  /** Apply the lifecycle decision; a live session is a quiet join. */
  const applyLifecycle = (
    read: OkRead,
    context: CycleContext,
    epoch: string,
    trigger: CoordinatorIterationTrigger,
    recordDecision: boolean,
  ):
    | { readonly ok: true; readonly read: OkRead }
    | { readonly ok: false; readonly failure: CoordinatorFailure } => {
    const session = ports.session.read();
    const decision = decideLifecycle({
      live: session.liveness === "alive",
      prior:
        session.sessionId === null
          ? null
          : {
              completedCleanly: session.completedCleanly,
              resumable: session.resumable,
              contextTokens: session.contextTokens,
            },
      resumeDeclared: session.resumeDeclared,
      contextLimit: configValue("coordinator.resume-context-limit"),
    });
    if (decision.kind === "join-live") {
      if (recordDecision) {
        const recorded = appendIteration(read, context, {
          trigger,
          decision: "join-live",
          reason: "live-session",
          sessionId: session.sessionId,
          contextTokens: session.contextTokens,
        });
        if (!recorded.ok) return recorded;
        return { ok: true, read: recorded.read };
      }
      return { ok: true, read };
    }
    if (decision.consumesOrdinal === 1) {
      const recovered = applyRecovery(
        read,
        epoch,
        decision.reason,
        decision.kind === "resume-context" ? "resume" : "spawn",
      );
      if (!recovered.ok) {
        // Exhaustion escalates loudly exactly once. The first refusal is the
        // budget identity at exit 1; a later tick reuses the receipt and is an
        // idempotent `exhausted-escalated` success at exit 0.
        if (recovered.failure.error.code === restartExhausted) {
          const alreadyReceipted = read.exhaustion.some((record) => record.budgetEpochId === epoch);
          const escalated = escalate(read, epoch);
          if (!escalated.ok) return { ok: false, failure: escalated.failure };
          if (alreadyReceipted) return { ok: true, read: escalated.read };
        }
        return recovered;
      }
      const recorded = appendIteration(recovered.read, context, {
        trigger,
        decision: decision.kind,
        reason: decision.reason,
        sessionId: session.sessionId,
        contextTokens: session.contextTokens,
      });
      if (!recorded.ok) return recorded;
      return { ok: true, read: recorded.read };
    }
    const recorded = appendIteration(read, context, {
      trigger,
      decision: decision.kind,
      reason: decision.reason,
      sessionId: session.sessionId,
      contextTokens: session.contextTokens,
    });
    if (!recorded.ok) return recorded;
    const effect = ports.session.apply("spawn");
    if (!effect.ok) return { ok: false, failure: failure("harness", effect.code) };
    return { ok: true, read: recorded.read };
  };

  /** Publish (or reuse) exactly one owner escalation question and its receipt. */
  const escalate = (
    read: OkRead,
    epoch: string,
  ):
    | { readonly ok: true; readonly read: OkRead; readonly questionId: string }
    | { readonly ok: false; readonly failure: CoordinatorFailure } => {
    const ref = escalationRef(coordinatorId, epoch);
    const raw = readOnce();
    const ledger = blockersRead(raw);
    if (!ledger.ok) return { ok: false, failure: stateFailure(ledger.error.code) };
    const answered = new Set(ledger.value.answers.map((answer) => answer.questionId));
    const existing = ledger.value.questions.find(
      (question) =>
        !answered.has(question.id) &&
        isReservedEscalationQuestion({
          type: question.type,
          audience: question.audience,
          lane: question.lane,
          ref: question.ref,
        }) &&
        question.ref === ref,
    );
    const terminal = read.exhaustion.find((entry) => entry.budgetEpochId === epoch);
    if (existing !== undefined && terminal !== undefined) {
      return { ok: true, read, questionId: existing.id };
    }
    let questionId = existing?.id ?? null;
    if (existing === undefined) {
      const status = store.fenceStatus();
      if (status.held && status.stale) store.recoverFence(ports.newFenceToken());
      const count = read.restarts.filter((entry) => entry.budgetEpochId === epoch).length;
      const bound = configValue("coordinator.restart-budget");
      const record: BlockerQuestionRecord = {
        schemaId: "delivery.blocker.question.v1",
        id: formatBlockerQuestionId(ports.newId("q")),
        type: "decision-needed",
        audience: "owner",
        lane: "coordinator",
        ref,
        question: `Coordinator ${coordinatorId} exhausted its restart budget (${count}/${bound}). Choose restart-fresh-budget or park-owner-review.`,
        options: [...escalationOptions()],
        askedAt: ports.clock.nowIso(),
      };
      const published = appendBlockerQuestion(store, {
        record,
        fenceToken: ports.newFenceToken(),
        current: ledger.value,
      });
      if (!published.ok) {
        return { ok: false, failure: failure("coordinator", publishFailed) };
      }
      questionId = record.id;
    }
    if (questionId === null) return { ok: false, failure: failure("coordinator", publishFailed) };
    if (terminal !== undefined) return { ok: true, read, questionId };
    const receipt = {
      schemaId: "delivery.coordinator.exhaustion.v1" as const,
      exhaustionId: `${coordinatorId}#${epoch}`,
      coordinatorId,
      budgetEpochId: epoch,
      restarts: read.restarts.filter((entry) => entry.budgetEpochId === epoch).length,
      historyRef: `${COORDINATOR_RESTART_NAMESPACE}${coordinatorId}`,
      escalationQuestionId: questionId,
      options: [...escalationOptions()],
      terminal: true as const,
      recordedAt: ports.clock.nowIso(),
    };
    const appended = appendCoordinatorExhaustion(store, ports.newFenceToken(), receipt, read);
    if (!appended.ok) return { ok: false, failure: deliveredFailure(appended.code) };
    return {
      ok: true,
      read: appended.appended ? { ...read, exhaustion: [...read.exhaustion, receipt] } : read,
      questionId,
    };
  };

  const activeExpectation = (
    read: OkRead,
  ): { readonly recordedAt: string | null; readonly sequenceIndex: number } | null => {
    if (!read.ok) return null;
    const last = read.iterations[read.iterations.length - 1];
    if (last === undefined) return null;
    return { recordedAt: last.recordedAt, sequenceIndex: read.iterations.length - 1 };
  };

  const cycle = async (
    raw: StoreRead,
    read: OkRead,
    epoch: string,
    trigger: CoordinatorIterationTrigger,
    wantTick: boolean,
  ): Promise<CycleOutcome> => {
    const ledger = blockersRead(raw);
    const openCoordinator = ledger.ok
      ? rankBlockerQuestions(
          ledger.value.questions,
          ledger.value.answers,
          ports.clock.nowMs(),
        ).open.filter((question) => question.audience === "coordinator").length
      : 0;
    const context: CycleContext = {
      raw,
      openCoordinator,
      recordCount: raw.ok ? raw.value.records.length : 0,
      appended: 0,
    };
    let tickVerdict: CoordinatorTickVerdict | null = wantTick
      ? { verdict: "progressing", phase: null, reason: null, evidence: null }
      : null;
    let wakeOutcome: CoordinatorWakeView | null = null;
    // A stop request observed at the boundary ends the loop before any effect.
    const lease = leaseOf(read);
    if (lease !== null && lease.action === "stop-requested") {
      return { kind: "stop", read, tickVerdict, wakeOutcome };
    }
    const lifecycle = applyLifecycle(read, context, epoch, trigger, trigger === "start");
    if (!lifecycle.ok) {
      return { kind: "failure", failure: lifecycle.failure, read, tickVerdict, wakeOutcome };
    }
    let current = lifecycle.read;

    // Wake-on-typed-question (the same verified read as the claim).
    if (ledger.ok) {
      const ranking = rankBlockerQuestions(
        ledger.value.questions,
        ledger.value.answers,
        ports.clock.nowMs(),
      );
      const woken = evaluateWake({
        coordinatorId,
        ranked: ranking.open.map((question) => ({
          id: question.id,
          rank: question.rank ?? 0,
          audience: question.audience,
          ...(question.status === undefined ? {} : { status: question.status }),
          askedAt: question.askedAt,
        })),
        answeredQuestionIds: ledger.value.answers.map((answer) => answer.questionId),
        woken: current.wakes.map((record) => ({
          coordinatorId,
          questionId: record.questionId,
          askedAt: record.askedAt,
        })),
        delivered: true,
      });
      if (woken.question !== null) {
        wakeOutcome = {
          outcome: woken.outcome,
          questionId: woken.question.id,
          questionRank: woken.question.rank,
          askedAt: woken.question.askedAt,
          iterationId: null,
        };
      }
      if (woken.outcome === "woken" && woken.question !== null) {
        const wake = ports.session.wake();
        if (!wake.ok) {
          return {
            kind: "failure",
            failure: failure("coordinator", wakeFailed),
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        }
        const iterationId = ports.newId("iteration");
        wakeOutcome = {
          outcome: "woken",
          questionId: woken.question.id,
          questionRank: woken.question.rank,
          askedAt: woken.question.askedAt,
          iterationId,
        };
        const record: CoordinatorWakeRecord = {
          schemaId: "delivery.coordinator.wake.v1",
          wakeId: ports.newId("wake"),
          coordinatorId,
          questionId: woken.question.id,
          questionRank: woken.question.rank,
          askedAt: woken.question.askedAt,
          outcome: "woken",
          iterationId,
          recordedAt: ports.clock.nowIso(),
        };
        const appended = appendCoordinatorWake(store, ports.newFenceToken(), record, current);
        if (!appended.ok)
          return {
            kind: "failure",
            failure: deliveredFailure(appended.code),
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        current = appended.appended ? { ...current, wakes: [...current.wakes, record] } : current;
        const expectation = appendIteration(current, context, {
          trigger: "wake",
          decision: "none",
          reason: "expectation",
          sessionId: ports.session.read().sessionId,
          contextTokens: ports.session.read().contextTokens,
          iterationId,
        });
        if (expectation.ok) current = expectation.read;
      }
    }

    // Artifact-evidence stuck evaluation over the active expectation.
    const expectation = activeExpectation(current);
    if (expectation !== null && expectation.recordedAt !== null) {
      const expectedAtMs = toMs(expectation.recordedAt);
      const progress = ports.processPort.progress();
      const currentRecords = context.raw.ok ? context.raw.value.records : [];
      const expectationSequence =
        currentRecords.find(
          (record) =>
            record.kind === "coordinator.iteration" &&
            (record.payload as { recordedAt?: unknown }).recordedAt === expectation.recordedAt,
        )?.sequence ?? 0;
      const mergeLanded = currentRecords.some(
        (record) => record.kind === "merge.transaction" && record.sequence > expectationSequence,
      );
      const answerLanded = currentRecords.some(
        (record) =>
          record.kind === BLOCKER_ANSWER_RECORD_KIND && record.sequence > expectationSequence,
      );
      const currentFingerprint = fingerprint(
        currentRecords.length,
        ledger.ok
          ? rankBlockerQuestions(
              ledger.value.questions,
              ledger.value.answers,
              ports.clock.nowMs(),
            ).open.filter((question) => question.audience === "coordinator").length
          : 0,
      );
      const expectationFingerprint =
        current.iterations.find((record) => record.recordedAt === expectation.recordedAt)
          ?.digestFingerprint ?? "";
      const evaluation = evaluateStuck({
        nowMs: ports.clock.nowMs(),
        expectedAtMs: expectedAtMs ?? ports.clock.nowMs(),
        stuckWindowMs: configValue("coordinator.stuck-window"),
        progressBoundMs: configValue("coordinator.progress-bound"),
        fingerprintAdvanced: currentFingerprint !== expectationFingerprint,
        newTurn: ledger.ok ? progress.newTurn : "unknown",
        progressObservedAtMs: progress.observedAtMs,
        merge: ledger.ok ? (mergeLanded ? "advanced" : "stale") : "unknown",
        answer: ledger.ok ? (answerLanded ? "advanced" : "stale") : "unknown",
      });
      if (evaluation.verdict === "progressing") {
        tickVerdict = { verdict: "progressing", phase: null, reason: null, evidence: null };
      } else {
        const stuckId =
          current.iterations.find((record) => record.recordedAt === expectation.recordedAt)
            ?.iterationId ?? ports.newId("iteration");
        const already = foldCoordinatorStuck(current.stuck)[stuckId];
        let verdictRecord: CoordinatorStuckRecord | null = null;
        if (already === undefined) {
          verdictRecord = {
            schemaId: "delivery.coordinator.stuck.v1",
            stuckId,
            coordinatorId,
            iterationId: stuckId,
            verdict: evaluation.verdict,
            phase: "verdict",
            reason: evaluation.reason,
            evidence: evaluation.evidence,
            killOutcome: "not-attempted",
            killFailureReason: null,
            recordedAt: ports.clock.nowIso(),
          };
          const appended = appendCoordinatorStuck(
            store,
            ports.newFenceToken(),
            verdictRecord,
            current,
          );
          if (!appended.ok)
            return {
              kind: "failure",
              failure: deliveredFailure(appended.code),
              read: current,
              tickVerdict,
              wakeOutcome,
            };
          if (appended.appended) current = { ...current, stuck: [...current.stuck, verdictRecord] };
        }
        tickVerdict = {
          verdict: evaluation.verdict,
          phase: "verdict",
          reason: evaluation.reason,
          evidence: evaluation.evidence,
        };
        if (evaluation.verdict === "unevaluable") {
          return {
            kind: "failure",
            failure: stateFailure(ledger.ok ? "state.store.unknown" : ledger.error.code),
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        }
        // A stuck verdict already carried an attempted outcome means no replay.
        const latest = foldCoordinatorStuck(current.stuck)[stuckId];
        if (latest !== undefined && latest.phase === "outcome") {
          return { kind: "ok", read: current, tickVerdict, wakeOutcome };
        }
        if (
          !ports.processPort.capabilities.killWithGrace ||
          !ports.processPort.capabilities.startTimeIdentity
        ) {
          return {
            kind: "failure",
            failure: failure("coordinator", capabilityGap),
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        }
        const session = ports.session.read();
        if (session.pid === null || session.processStartTimeMs === null) {
          return {
            kind: "failure",
            failure: failure("coordinator", capabilityGap),
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        }
        const killed = await killCoordinatorProcess({
          port: ports.processPort.port,
          identity: { pid: session.pid, processStartTimeMs: session.processStartTimeMs },
          graceMs: configValue("coordinator.kill-grace"),
          wait: ports.processPort.wait,
          capabilities: ports.processPort.capabilities,
        });
        if (killed.outcome === "capability-gap") {
          return {
            kind: "failure",
            failure: failure("coordinator", capabilityGap),
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        }
        const outcomeRecord: CoordinatorStuckRecord = {
          ...(verdictRecord ?? {
            schemaId: "delivery.coordinator.stuck.v1" as const,
            stuckId,
            coordinatorId,
            iterationId: stuckId,
            verdict: evaluation.verdict,
            phase: "verdict" as const,
            reason: evaluation.reason,
            evidence: evaluation.evidence,
            killOutcome: "not-attempted" as const,
            killFailureReason: null,
            recordedAt: ports.clock.nowIso(),
          }),
          phase: "outcome",
          killOutcome: killed.outcome,
          killFailureReason: killed.outcome === "failed" ? killed.failureReason : null,
          recordedAt: ports.clock.nowIso(),
        };
        const appendedOutcome = appendCoordinatorStuck(
          store,
          ports.newFenceToken(),
          outcomeRecord,
          current,
        );
        if (!appendedOutcome.ok)
          return {
            kind: "failure",
            failure: deliveredFailure(appendedOutcome.code),
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        if (appendedOutcome.appended)
          current = { ...current, stuck: [...current.stuck, outcomeRecord] };
        if (killed.outcome === "failed") {
          return {
            kind: "failure",
            failure: failure("coordinator", killFailed),
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        }
        // Budget check runs only after the outcome append.
        const recovered = applyRecovery(current, epoch, "stuck-artifact-evidence", "spawn");
        if (!recovered.ok) {
          const escalated = escalate(current, epoch);
          if (!escalated.ok)
            return {
              kind: "failure",
              failure: escalated.failure,
              read: current,
              tickVerdict,
              wakeOutcome,
            };
          current = escalated.read;
          const settled = appendIteration(current, context, {
            trigger: "stuck-restart",
            decision: "none",
            reason: "expectation",
            sessionId: null,
            contextTokens: null,
          });
          if (settled.ok) current = settled.read;
          return {
            kind: "failure",
            failure: recovered.failure,
            read: current,
            tickVerdict,
            wakeOutcome,
          };
        }
        current = recovered.read;
        const settled = appendIteration(current, context, {
          trigger: "stuck-restart",
          decision: "spawn-fresh",
          reason: "session-interrupted",
          sessionId: ports.session.read().sessionId,
          contextTokens: ports.session.read().contextTokens,
        });
        if (settled.ok) current = settled.read;
      }
    }
    return { kind: "ok", read: current, tickVerdict, wakeOutcome };
  };

  const observation = (
    read: OkRead,
    tickVerdict: CoordinatorTickVerdict | null,
    degradation: readonly string[] = [],
    wakeOverride: CoordinatorWakeView | null = null,
    epochOverride: string | null = null,
  ): CoordinatorObservation => {
    const lease = leaseOf(read);
    const instance: CoordinatorInstance | null =
      lease !== null && lease.action !== "released"
        ? {
            instanceId: lease.instanceId,
            pid: lease.pid,
            holder: lease.holder,
            startedAt: read.ok
              ? ([...read.fences]
                  .reverse()
                  .find(
                    (record) => record.action === "acquired" || record.action === "stale-takeover",
                  )?.recordedAt ?? ports.clock.nowIso())
              : ports.clock.nowIso(),
            supervisorMode: COORDINATOR_V1_SUPERVISOR_MODE,
            externalUnit: "absent",
          }
        : null;
    const session = ports.session.read();
    const sessionView: CoordinatorSession = {
      sessionId: session.sessionId,
      liveness: session.liveness,
      contextTokens: session.contextTokens,
      harnessKind: session.harnessKind,
    };
    const lastDecision = read.ok ? foldCoordinatorDecision(read.iterations) : null;
    const decisionView: CoordinatorDecisionView | null =
      lastDecision === null
        ? null
        : {
            kind: lastDecision.decision,
            reason: lastDecision.reason,
            iterationId: lastDecision.iterationId,
            recordedAt: lastDecision.recordedAt,
          };
    const epoch = epochOverride ?? currentBudgetEpoch(read);
    const restarts = read.ok
      ? read.restarts.filter((record) => record.budgetEpochId === epoch).length
      : 0;
    const terminal = read.ok
      ? read.exhaustion.some((record) => record.budgetEpochId === epoch)
      : false;
    const bound = configValue("coordinator.restart-budget");
    const latestStuck = read.ok ? read.stuck[read.stuck.length - 1] : undefined;
    const stuckView: CoordinatorStuckView | null = latestStuck
      ? {
          verdict: latestStuck.verdict,
          phase: latestStuck.phase,
          reason: latestStuck.reason,
          evidence: latestStuck.evidence,
          evaluatedAt: latestStuck.recordedAt,
        }
      : null;
    const lastWake = read.ok ? foldCoordinatorWake(read.wakes) : null;
    const questionId = read.ok
      ? (read.exhaustion.find((record) => record.budgetEpochId === epoch)?.escalationQuestionId ??
        null)
      : null;
    const escalation: CoordinatorEscalationView = {
      state: projectEscalationState({
        terminal,
        publishFailed: !terminal && restarts >= bound,
      }),
      questionId,
    };
    return projectCoordinatorObservation({
      coordinatorId,
      stateDirectory,
      instance,
      session: sessionView,
      decision: decisionView,
      restarts: {
        count: restarts,
        bound,
        budgetEpochId: epoch,
        historyRef: `${COORDINATOR_RESTART_NAMESPACE}${coordinatorId}`,
        terminal,
      },
      stuck: stuckView,
      tickVerdict,
      wake:
        wakeOverride ??
        (lastWake
          ? {
              outcome: lastWake.outcome,
              questionId: lastWake.questionId,
              questionRank: lastWake.questionRank,
              askedAt: lastWake.askedAt,
              iterationId: lastWake.iterationId,
            }
          : null),
      escalation,
      fence: lease
        ? {
            holder: lease.holder,
            action: lease.action,
            previousHolder: lease.previousHolder,
            fenceAgeMs: lease.fenceAgeMs,
            recordedAt: read.ok ? (read.fences[read.fences.length - 1]?.recordedAt ?? null) : null,
          }
        : null,
      degradation,
    });
  };

  const appendReleased = (identity: {
    readonly instanceId: string;
    readonly holder: string;
    readonly pid: number;
    readonly processStartTimeMs: number;
  }): CoordinatorFenceRecord | null => {
    const record = appendFence("released", identity);
    const appended = appendCoordinatorFence(store, ports.newFenceToken(), record);
    return appended.ok ? record : null;
  };

  const withReleased = (read: OkRead, record: CoordinatorFenceRecord): OkRead => ({
    ...read,
    fences: [...read.fences, record],
  });

  const releaseFailure = (): CoordinatorFailure =>
    store.fenceStatus().held ? stateFailure("state.lock.busy") : stateFailure("state.write.failed");

  const runClaimedCycle = async (
    claimed: Claimed,
  ): Promise<CoordinatorResult<CoordinatorObservation>> => {
    const epoch = currentBudgetEpoch(claimed.read);
    let outcome: CycleOutcome;
    try {
      outcome = await cycle(claimed.raw, claimed.read, epoch, "collection", true);
    } catch (thrown) {
      const typed = failureFor(thrown);
      const released = appendReleased(claimed.identity);
      return released !== null ? typed : releaseFailure();
    }
    const released = appendReleased(claimed.identity);
    if (released === null) return releaseFailure();
    const read = withReleased(outcome.read, released);
    if (outcome.kind === "failure") return outcome.failure;
    return {
      data: observation(read, outcome.tickVerdict, [], outcome.wakeOutcome, epoch),
    };
  };

  const start = async (input: {
    readonly foreground: boolean;
    readonly freshBudget: boolean;
  }): Promise<CoordinatorResult<CoordinatorObservation>> => {
    if (!input.foreground) {
      return failure(
        "fallback",
        FALLBACK_INVOCATION_CODE,
        "coordinator start requires --foreground in v1; detached and OS-unit hosting is the M1-S18 seam",
      );
    }
    const claimed = claim();
    if (!claimed.ok) return claimed.failure;
    const epoch = input.freshBudget
      ? freshBudgetEpoch(claimed.claimed.read)
      : currentBudgetEpoch(claimed.claimed.read);
    const startRaw = claimed.claimed.raw;
    const startBlockers = blockersRead(startRaw);
    const startContext: CycleContext = {
      raw: startRaw,
      openCoordinator: startBlockers.ok
        ? rankBlockerQuestions(
            startBlockers.value.questions,
            startBlockers.value.answers,
            ports.clock.nowMs(),
          ).open.filter((question) => question.audience === "coordinator").length
        : 0,
      recordCount: startRaw.ok ? startRaw.value.records.length : 0,
      appended: 0,
    };
    const lifecycle = applyLifecycle(claimed.claimed.read, startContext, epoch, "start", true);
    if (!lifecycle.ok) {
      appendReleased(claimed.claimed.identity);
      return lifecycle.failure;
    }
    let current = lifecycle.read;
    let failureOutcome: CoordinatorFailure | null = null;
    try {
      const exit = await ports.loop.run(async () => {
        const cycleRaw = readOnce();
        const cycleRead = cycleRaw.ok ? coordinatorRead(cycleRaw) : current;
        const baseRead = cycleRead.ok ? cycleRead : current;
        const result = await cycle(cycleRaw, baseRead, epoch, "collection", false);
        current = result.read;
        if (result.kind === "stop") return "stop";
        if (result.kind === "failure") {
          failureOutcome = result.failure;
          return "stop";
        }
        return "continue";
      });
      void exit;
    } catch (thrown) {
      failureOutcome = failureFor(thrown);
    }
    const released = appendReleased(claimed.claimed.identity);
    if (released === null) return releaseFailure();
    current = withReleased(current, released);
    if (failureOutcome !== null) return failureOutcome;
    return { data: observation(current, null, ["supervisor-loop-stopped"], null, epoch) };
  };

  const tick = async (): Promise<CoordinatorResult<CoordinatorObservation>> => {
    const claimed = claim();
    if (!claimed.ok) return claimed.failure;
    return runClaimedCycle(claimed.claimed);
  };

  const status = async (input: {
    readonly live: boolean;
  }): Promise<CoordinatorResult<CoordinatorObservation>> => {
    const raw = readOnce();
    if (!raw.ok) return stateFailure(raw.error.code);
    const read = coordinatorRead(raw);
    if (!read.ok) return stateFailure(read.code as string);
    const degradation: string[] = [];
    if (input.live) {
      const lease = leaseOf(read);
      const answer = probe(lease);
      if (answer === null) degradation.push("live-facts-unknown");
    }
    if (store.fenceStatus().held) degradation.push("state write fence busy");
    return { data: observation(read, null, degradation) };
  };

  const stop = async (): Promise<CoordinatorResult<CoordinatorStopData>> => {
    const raw = readOnce();
    if (!raw.ok) return stateFailure(raw.error.code);
    const read = coordinatorRead(raw);
    if (!read.ok) return stateFailure(read.code as string);
    const lease = leaseOf(read);
    if (lease === null || lease.action === "released") {
      return {
        data: {
          ...observation(read, null),
          requested: false,
          released: false,
          state: "not-running",
        },
      };
    }
    if (!ports.processPort.capabilities.alive) {
      return failure("coordinator", capabilityGap);
    }
    const answer = probe(lease);
    const age = lease.acquisitionAtMs === null ? null : ports.clock.nowMs() - lease.acquisitionAtMs;
    const bound = 2 * configValue("coordinator.collection-interval");
    if (answer === false || (answer === null && age !== null && age > bound)) {
      return {
        data: {
          ...observation(read, null),
          requested: false,
          released: false,
          state: "not-running",
        },
      };
    }
    // The request is recorded against the live holder: `stop` never acquires
    // another process's identity and never releases its handle.
    const record = appendFence("stop-requested", {
      instanceId: lease.instanceId,
      holder: lease.holder,
      pid: lease.pid,
      processStartTimeMs: lease.processStartTimeMs,
    });
    const appended = appendCoordinatorFence(store, ports.newFenceToken(), record);
    if (!appended.ok) return deliveredFailure(appended.code);
    return {
      data: { ...observation(read, null), requested: true, released: false, state: "requested" },
    };
  };

  return { start, stop, status, tick };
};

/** The restart namespace prefix (the restart records live under `coordinator/<id>`). */
const COORDINATOR_RESTART_NAMESPACE = "coordinator/";
