/**
 * The lane supervision cycle (GH-238 F-9; DEC-1, DEC-13, DEC-16; C-1; DM-3,
 * DM-16).
 *
 * Compute the next action through an injected scheduling seam, claim the lease
 * through the delivered fenced claim port, ask the injected executor to start,
 * record one `daemon.lane` delivering record, observe, and release or park. The
 * daemon performs no delivery work in-process: no phase run, no commit, no gate.
 * A missing executor is the declared `supervise-only` mode.
 */
import type {
  DaemonLaneRecord,
  DaemonResumeIntent,
  LaneExecutorPort,
  LaneHandle,
  LaneObservation,
  StateStorePort,
} from "#contracts";
import { classifyLaneProgress, nextSpawnOrdinal, shapeDaemonLane } from "../domain/daemon-lane.js";
import { appendDaemonLane, readDaemonLanes } from "./daemon.js";

export type SupervisionAction = {
  readonly ref: string;
  readonly repository: string;
  readonly weightClass: string;
  readonly phaseId?: string;
};

export type SupervisionPorts = {
  readonly executor: LaneExecutorPort;
  readonly nextAction: () => SupervisionAction | undefined;
  readonly claim: (
    action: SupervisionAction,
  ) =>
    | { readonly ok: true; readonly leaseId: string }
    | { readonly ok: false; readonly code: string };
  readonly release: (
    action: SupervisionAction,
    cause: "completed" | "failed" | "preempted",
  ) => boolean;
  readonly nowIso: () => string;
  /**
   * The delivered restart-admission/economics seam for a corroborated stall.
   * Absent means the cycle reports `restart-admission-unavailable` instead of
   * silently marking the lane failed.
   */
  readonly admitRestart?: (input: {
    readonly action: SupervisionAction;
    readonly lane: DaemonLaneRecord;
  }) => StallRestartAdmission | Promise<StallRestartAdmission>;
};

export type StallRestartAdmission =
  | { readonly outcome: "admitted"; readonly ordinal: number }
  | { readonly outcome: "refused"; readonly code: string }
  | { readonly outcome: "unevaluable"; readonly code: string };

export type SupervisionResult =
  | { readonly mode: "supervise-only"; readonly action?: SupervisionAction }
  | { readonly mode: "idle" }
  | {
      readonly mode: "spawned";
      readonly action: SupervisionAction;
      readonly lane: DaemonLaneRecord;
      readonly observation: LaneObservation;
    }
  | {
      readonly mode: "completed" | "stalled";
      readonly action: SupervisionAction;
      readonly lane: DaemonLaneRecord;
      readonly admission?: StallRestartAdmission;
    }
  | { readonly mode: "claim-refused"; readonly code: string }
  | { readonly mode: "executor-refused"; readonly action: SupervisionAction };

export type SupervisionInput = {
  readonly store: StateStorePort;
  readonly fenceToken: string;
  readonly ports: SupervisionPorts;
};

const latestLaneFor = (store: StateStorePort, ref: string): DaemonLaneRecord | undefined => {
  const read = readDaemonLanes(store);
  if (!read.ok) return undefined;
  return [...read.records].reverse().find((lane) => lane.ref === ref);
};

export const runSupervisionCycle = async (input: SupervisionInput): Promise<SupervisionResult> => {
  const availability = input.ports.executor.availability();
  if (!availability.available) {
    const pending = input.ports.nextAction();
    return pending === undefined
      ? { mode: "supervise-only" }
      : { mode: "supervise-only", action: pending };
  }
  const action = input.ports.nextAction();
  if (action === undefined) return { mode: "idle" };
  const claimed = input.ports.claim(action);
  if (!claimed.ok) return { mode: "claim-refused", code: claimed.code };
  const started = await input.ports.executor.start({
    ref: action.ref,
    repository: action.repository,
    ...(action.phaseId === undefined ? {} : { phaseId: action.phaseId }),
    weightClass: action.weightClass,
  });
  if (started === undefined) {
    input.ports.release(action, "failed");
    return { mode: "executor-refused", action };
  }
  const previous = latestLaneFor(input.store, action.ref);
  const nowIso = input.ports.nowIso();
  const delivering = shapeDaemonLane({
    ref: action.ref,
    state: "delivering",
    harnessKind: started.harnessKind,
    sessionId: started.sessionId,
    ...(started.processId === undefined ? {} : { processId: started.processId }),
    ...(previous?.ledgerPosition === undefined ? {} : { ledgerPosition: previous.ledgerPosition }),
    spawnOrdinal: nextSpawnOrdinal(previous),
    ...(previous?.resumeIntent === undefined ? {} : { resumeIntent: previous.resumeIntent }),
    recordedAt: nowIso,
  });
  const recorded = appendDaemonLane(input.store, input.fenceToken, delivering);
  if (!recorded.ok) return { mode: "executor-refused", action };

  const observation = await input.ports.executor.observe(started);
  const progress = classifyLaneProgress({
    tokenDelta: observation.progress === "progressing" ? 1 : 0,
    traffic: observation.progress === "progressing" ? 1 : 0,
    corroborated: observation.progress === "stalled",
  });
  const livenessLane = shapeDaemonLane({
    ...delivering,
    liveness: progress,
    observedAt: nowIso,
    recordedAt: nowIso,
  });
  appendDaemonLane(input.store, input.fenceToken, livenessLane);

  if (progress === "stalled") {
    const admission =
      input.ports.admitRestart === undefined
        ? { outcome: "unevaluable" as const, code: "restart-admission-unavailable" }
        : await input.ports.admitRestart({ action, lane: livenessLane });
    input.ports.release(action, "failed");
    const failed = shapeDaemonLane({
      ...livenessLane,
      state: "failed",
      liveness: "stalled",
      recordedAt: nowIso,
    });
    appendDaemonLane(input.store, input.fenceToken, failed);
    return { mode: "stalled", action, lane: failed, admission };
  }
  if (observation.done) {
    const collected = await input.ports.executor.collect(started);
    if (delivering.resumeIntent !== undefined) {
      await input.ports.executor.resume({
        handle: started,
        mode: delivering.resumeIntent.mode,
        questionId: delivering.resumeIntent.questionId,
      });
    }
    const completed = shapeDaemonLane({
      ...livenessLane,
      state: collected.ok ? "completed" : "failed",
      recordedAt: nowIso,
    });
    appendDaemonLane(input.store, input.fenceToken, completed);
    input.ports.release(action, collected.ok ? "completed" : "failed");
    return { mode: "completed", action, lane: completed };
  }
  return { mode: "spawned", action, lane: livenessLane, observation };
};

/** Attach a pending blocker-answer resume intent to an existing lane record. */
export const recordResumeIntent = (
  input: {
    readonly store: StateStorePort;
    readonly fenceToken: string;
    readonly nowIso: () => string;
  },
  lane: DaemonLaneRecord,
  resumeIntent: DaemonResumeIntent,
): DaemonLaneRecord | undefined => {
  const record = shapeDaemonLane({
    ...lane,
    resumeIntent,
    recordedAt: input.nowIso(),
  });
  const appended = appendDaemonLane(input.store, input.fenceToken, record);
  return appended.ok ? record : undefined;
};

/** The supervise-only degradation marker, exported for composition. */
export const SUPERVISE_ONLY_DEGRADATION = "lane-executor-unavailable" as const;

/** A helper the composition uses to derive the injected handle type. */
export type SupervisionHandle = LaneHandle;
