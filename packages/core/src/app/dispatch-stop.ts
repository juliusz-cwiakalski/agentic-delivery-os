/**
 * `dispatch stop` — the operator-requested bounded-grace stop (GH-413 F-9,
 * F-10; DEC-15, DEC-21; DM-8; TDR-0077).
 *
 * Grammar runs in the command definition; this module owns the running
 * predicate, the one delivered terminate call, and the complete watcher-shaped
 * episode frame written only after a confirmed terminate. It never signals
 * itself, never appends a second park, and answers the delivered
 * unmet-precondition identity when the lane is not running.
 */
import type {
  DispatchLaneRecord,
  DispatchStopData,
  HarnessKind,
  HarnessSessionHandle,
  QueueParkPreservation,
  QueueParkRecord,
} from "#contracts";

/** The injected stop seams; every I/O edge is a port. */
export type DispatchStopPorts = {
  readonly resolveRepository: (ref: string) => string | undefined;
  readonly lanes: () => readonly DispatchLaneRecord[];
  readonly parks: () => readonly QueueParkRecord[];
  readonly terminate: (input: {
    readonly handle: HarnessSessionHandle;
    readonly graceMs: number;
  }) => Promise<{
    readonly ok: boolean;
    readonly terminated: boolean;
    readonly escalated?: boolean;
    readonly reaped?: boolean;
  }>;
  readonly appendPark: (record: QueueParkRecord) => boolean;
  readonly newEpisodeId: (ref: string) => string;
  /** The nominated profile's declared grace default, when the profile declares windows. */
  readonly profileGraceMsFor: (profile: string | undefined) => number | undefined;
  readonly killGraceMs: number;
  readonly mainCheckout: string;
};

/** One stop outcome: the success data or the delivered classified refusal. */
export type DispatchStopOutcome =
  | { readonly ok: true; readonly data: DispatchStopData }
  | {
      readonly ok: false;
      readonly kind: "queue" | "state" | "input";
      readonly code: string;
      readonly summary?: string;
    };

/** The newest lane record for one (repository, ref), or `undefined`. */
const newestLaneFor = (
  records: readonly DispatchLaneRecord[],
  repository: string,
  ref: string,
): DispatchLaneRecord | undefined => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record !== undefined && record.ref === ref && record.repository === repository) {
      return record;
    }
  }
  return undefined;
};

/** The latest park for one ref, or `undefined`. */
const newestParkFor = (
  records: readonly QueueParkRecord[],
  ref: string,
): QueueParkRecord | undefined => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record !== undefined && record.ref === ref) return record;
  }
  return undefined;
};

/**
 * Execute one `dispatch stop` request.
 *
 * Running means the newest lane record is `active`, carries a session identity,
 * and no open park of any cause stands for the ref (the delivered duplicate
 * invariant counts every cause). A terminal, absent, session-less, already
 * parked, or unconfirmed-terminate lane is the delivered
 * `queue.precondition.unmet` refusal; nothing is written.
 */
export const executeDispatchStop = async (
  ports: DispatchStopPorts,
  request: {
    readonly ref: string;
    readonly cause: "peak-window";
    readonly until: string;
    readonly nowIso: string;
    readonly nowMs: number;
  },
): Promise<DispatchStopOutcome> => {
  const repository = ports.resolveRepository(request.ref);
  if (repository === undefined) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      summary: "the repository identity is unresolvable",
    };
  }
  const untilMs = Date.parse(request.until);
  const normalizedUntil = Number.isFinite(untilMs) ? new Date(untilMs).toISOString() : undefined;
  const acceptedUntil =
    normalizedUntil !== undefined &&
    (request.until === normalizedUntil || request.until === `${normalizedUntil.slice(0, 19)}Z`);
  if (!acceptedUntil) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      summary: "the declared end is not a canonical instant",
    };
  }
  if (untilMs <= request.nowMs) {
    return {
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      summary: "the declared end must be after the request instant",
    };
  }
  const lane = newestLaneFor(ports.lanes(), repository, request.ref);
  if (lane === undefined) {
    return {
      ok: false,
      kind: "queue",
      code: "queue.precondition.unmet",
      summary: `ref=${request.ref}; state=absent; a stop request needs a running lane`,
    };
  }
  if (lane.state !== "active") {
    return {
      ok: false,
      kind: "queue",
      code: "queue.precondition.unmet",
      summary: `ref=${request.ref}; state=terminal; a stop request needs a running lane`,
    };
  }
  if (lane.sessionId.length === 0) {
    return {
      ok: false,
      kind: "queue",
      code: "queue.precondition.unmet",
      summary: `ref=${request.ref}; state=active-without-session; a stop request needs a running lane`,
    };
  }
  const park = newestParkFor(ports.parks(), request.ref);
  if (
    park !== undefined &&
    (park.recoveryState === "parked" || park.recoveryState === "clear-observed")
  ) {
    return {
      ok: false,
      kind: "queue",
      code: "queue.precondition.unmet",
      summary: `ref=${request.ref}; state=already-parked; cause=${park.cause}; a stop request never appends a second park`,
    };
  }
  const remainingMs = Math.max(0, untilMs - request.nowMs);
  const profileGraceMs = ports.profileGraceMsFor(lane.providerProfile);
  const graceMs = Math.max(
    0,
    Math.min(profileGraceMs ?? ports.killGraceMs, ports.killGraceMs, remainingMs),
  );
  const handle: HarnessSessionHandle = {
    harnessKind: lane.harnessKind as HarnessKind,
    sessionId: lane.sessionId,
    treeRoot: lane.worktreePath ?? ports.mainCheckout,
    workItemRef: request.ref,
  };
  const terminated = await ports.terminate({ handle, graceMs });
  if (!terminated.ok || !terminated.terminated) {
    return {
      ok: false,
      kind: "queue",
      code: "queue.precondition.unmet",
      summary: `ref=${request.ref}; state=unconfirmed-terminate; no live exact identity matched`,
    };
  }
  // F-8: an escalated stop (TERM survived, KILLed) is not a preserved session.
  const preservation: QueueParkPreservation =
    terminated.escalated === true ? "session-state-not-preserved" : "preserved";
  const episodeId = ports.newEpisodeId(request.ref);
  const record: QueueParkRecord = {
    schema: "delivery.queue.park.v1",
    ref: request.ref,
    repository,
    cause: "peak-window",
    conditionType: "provider-window",
    condition: { type: "provider-window", expiresAt: normalizedUntil },
    recheckMs: 60_000,
    evaluatedAt: request.nowIso,
    recoveryState: "parked",
    ...(lane.providerProfile === undefined ? {} : { providerProfile: lane.providerProfile }),
    until: normalizedUntil,
    graceDeadline: new Date(request.nowMs + (profileGraceMs ?? graceMs)).toISOString(),
    windowEnd: normalizedUntil,
    stoppedAt: request.nowIso,
    preservation,
    episodeId,
    recordedAt: request.nowIso,
  };
  if (!ports.appendPark(record)) {
    return {
      ok: false,
      kind: "state",
      code: "state.write.failed",
      summary: "the park record could not be appended",
    };
  }
  return {
    ok: true,
    data: {
      query: "stop",
      ref: request.ref,
      cause: "peak-window",
      until: normalizedUntil,
      episodeId,
      preservation,
    },
  };
};
