/**
 * The lane-executor adapter (GH-238 F-9; C-1; DM-16; AC-F9-1, AC-F9-2).
 *
 * Composes the delivered `HarnessSessionPort` for spawn, observe, collect, and
 * liveness, plus the injected `LaneLaunchPlanner` for the prompt and execution
 * environment (the M1-S9 seam). Availability is reported honestly: without a
 * planner or with a declared capability gap it is unavailable, which produces
 * supervise-only. It never surfaces a treeRoot, prompt, transcript, or raw
 * provider payload into a record, log, or frame.
 */
import type {
  HarnessExecutionEnvironmentDescriptor,
  HarnessSessionHandle,
  HarnessSessionPort,
  LaneExecutorAvailability,
  LaneExecutorPort,
  LaneHandle,
  LaneLaunchPlanner,
  LaneLaunchRequest,
  LaneObservation,
} from "@delivery-os/core/contracts";

export type LaneExecutorAdapterOptions = {
  readonly session?: HarnessSessionPort;
  readonly planner?: LaneLaunchPlanner;
  /** The execution environment descriptor supplied by composition. */
  readonly descriptor?: HarnessExecutionEnvironmentDescriptor;
  /** A declared capability gap closes the executor honestly. */
  readonly capabilityGap?: string;
};

const handleFor = (handle: HarnessSessionHandle): LaneHandle => ({
  sessionId: handle.sessionId,
  harnessKind: handle.harnessKind,
});

export const createLaneExecutor = (options: LaneExecutorAdapterOptions): LaneExecutorPort => {
  const available = (): LaneExecutorAvailability =>
    options.session === undefined ||
    options.planner === undefined ||
    options.descriptor === undefined ||
    options.capabilityGap !== undefined
      ? {
          available: false,
          reason: options.capabilityGap ?? "lane-executor-unavailable",
        }
      : { available: true };

  return {
    availability: available,
    start: async (request: LaneLaunchRequest) => {
      if (
        !available().available ||
        options.session === undefined ||
        options.planner === undefined
      ) {
        return undefined;
      }
      const plan = options.planner.plan(request);
      if (plan === undefined) return undefined;
      const spawned = await options.session.spawn({
        workItemRef: request.ref,
        prompt: plan.prompt,
        descriptor: {
          ...options.descriptor!,
          environment: Object.keys(plan.environment).map((name) => ({
            kind: "variable" as const,
            name,
          })),
        },
      });
      return spawned.ok ? handleFor(spawned.value) : undefined;
    },
    observe: async (handle) => {
      if (options.session === undefined) {
        return { observable: false, progress: "unknown", done: false };
      }
      const sessionHandle: HarnessSessionHandle = {
        harnessKind: handle.harnessKind as HarnessSessionHandle["harnessKind"],
        sessionId: handle.sessionId,
        treeRoot: "",
        workItemRef: "",
      };
      const liveness = await options.session.liveness({ handle: sessionHandle });
      let progress: LaneObservation["progress"] = "unknown";
      if (liveness.ok) {
        const readings = liveness.value.readings;
        const sourced = readings.filter((reading) => reading.status === "sourced");
        const total = sourced.reduce(
          (sum, reading) => sum + (reading.status === "sourced" ? reading.value : 0),
          0,
        );
        if (total > 0) progress = "progressing";
        else if (sourced.length === readings.length && readings.length > 0) progress = "stalled";
      }
      const collected = await options.session.collect({ handle: sessionHandle });
      const done = collected.ok && collected.value.completionMarker;
      return {
        observable: true,
        sessionId: handle.sessionId,
        ...(handle.processId === undefined ? {} : { processId: handle.processId }),
        progress,
        ...(collected.ok && collected.value.failureReported
          ? { failureReason: "failure-reported" }
          : {}),
        done,
      };
    },
    collect: async (handle) => {
      if (options.session === undefined) return { ok: false };
      const collected = await options.session.collect({
        handle: {
          harnessKind: handle.harnessKind as HarnessSessionHandle["harnessKind"],
          sessionId: handle.sessionId,
          treeRoot: "",
          workItemRef: "",
        },
      });
      return collected.ok
        ? {
            ok: collected.value.completionMarker && !collected.value.failureReported,
            ...(collected.value.failureReported ? { detail: "failure-reported" } : {}),
          }
        : { ok: false, detail: collected.error.code };
    },
    resume: async (request) => {
      if (options.session === undefined || options.planner === undefined) return false;
      const plan = options.planner.plan({
        ref: "resume",
        repository: "",
        weightClass: "standard",
      });
      if (plan === undefined) return false;
      const resumed = await options.session.resume({
        handle: {
          harnessKind: request.handle.harnessKind as HarnessSessionHandle["harnessKind"],
          sessionId: request.handle.sessionId,
          treeRoot: "",
          workItemRef: "",
        },
        prompt: plan.prompt,
        ...(options.descriptor === undefined ? {} : { descriptor: options.descriptor }),
      });
      return resumed.ok;
    },
  };
};
