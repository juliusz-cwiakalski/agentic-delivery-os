/**
 * The dispatch lane resolver (GH-347 F-3, API-3; DEC-3; TDR-0049).
 *
 * One function resolves "the lane for this ref": the newest recorded lane that
 * carries a session identity, among the dispatch-owned `dispatch.lane` records
 * (any state — a recorded `pr-open` attempt is resumable) and the daemon lanes
 * in the delivered resumable states (`delivering`, `detached`, `preempted`).
 *
 * The daemon family never reads or writes the dispatch lane; this module only
 * reads both kinds through their delivered readers. A ref with no lane resolves
 * `undefined` — the classified "no lane" state, never a fabricated one.
 */
import {
  type DispatchLaneFacts,
  type DispatchLaneRecord,
  HARNESS_KINDS,
  type HarnessKind,
  type StateStorePort,
} from "#contracts";
import { readDaemonLanes } from "./daemon.js";
import { latestDispatchLaneFor, readDispatchLanes } from "./dispatch-ledger.js";

/** The delivered daemon states a resume may attach to (DEC-3). */
export const DISPATCH_RESUMABLE_DAEMON_STATES = ["delivering", "detached", "preempted"] as const;

export type DispatchLaneResolutionInput = {
  readonly ref: string;
  /** The harness kind a daemon lane defaults to when it records none. */
  readonly defaultHarnessKind: HarnessKind;
  /** The checkout root a resolved handle carries. */
  readonly treeRoot: string;
  /** The completed phase identifiers (the resume position), injected as data. */
  readonly completedPhases: (ref: string) => readonly string[];
  /** The persisted restart total for the ref, read at resolution time. */
  readonly restartCount: (ref: string) => number;
  /** The adapter's declared resume-injection capability, injected as data. */
  readonly supportsResumeInjection: (kind: HarnessKind) => boolean;
};

type Candidate = {
  readonly sessionId: string;
  readonly harnessKind: HarnessKind;
  readonly recordedAt: string;
  /** The dispatch-owned lane wins a recordedAt tie (append-latest semantics). */
  readonly dispatchOwned: boolean;
};

const newer = (left: Candidate, right: Candidate): Candidate => {
  const leftAt = Date.parse(left.recordedAt);
  const rightAt = Date.parse(right.recordedAt);
  if (Number.isNaN(leftAt) || Number.isNaN(rightAt)) return left;
  if (leftAt !== rightAt) return leftAt > rightAt ? left : right;
  return left.dispatchOwned ? left : right;
};

const dispatchCandidate = (record: DispatchLaneRecord): Candidate => ({
  sessionId: record.sessionId,
  harnessKind: record.harnessKind,
  recordedAt: record.recordedAt,
  dispatchOwned: true,
});

/**
 * Resolve the lane for a ref, or the classified absence.
 *
 * The two readers are consulted independently; an unreadable ledger resolves
 * `undefined` (the same "no lane" outcome) so a resume never fabricates a
 * session from a partial read.
 */
export const resolveDispatchLane = (
  store: StateStorePort,
  input: DispatchLaneResolutionInput,
): DispatchLaneFacts | undefined => {
  const candidates: Candidate[] = [];

  const dispatchLanes = readDispatchLanes(store);
  if (dispatchLanes.ok) {
    const latest = latestDispatchLaneFor(dispatchLanes.records, input.ref);
    if (latest !== undefined) candidates.push(dispatchCandidate(latest));
  }

  const daemonLanes = readDaemonLanes(store);
  if (daemonLanes.ok) {
    const resumable = [...daemonLanes.records]
      .reverse()
      .find(
        (lane) =>
          lane.ref === input.ref &&
          lane.sessionId !== undefined &&
          (DISPATCH_RESUMABLE_DAEMON_STATES as readonly string[]).includes(lane.state),
      );
    if (resumable?.sessionId !== undefined) {
      const kind: HarnessKind =
        resumable.harnessKind !== undefined &&
        (HARNESS_KINDS as readonly string[]).includes(resumable.harnessKind)
          ? (resumable.harnessKind as HarnessKind)
          : input.defaultHarnessKind;
      candidates.push({
        sessionId: resumable.sessionId,
        harnessKind: kind,
        recordedAt: resumable.recordedAt,
        dispatchOwned: false,
      });
    }
  }

  const selected = candidates.reduce<Candidate | undefined>(
    (best, candidate) => (best === undefined ? candidate : newer(candidate, best)),
    undefined,
  );
  if (selected === undefined) return undefined;

  return {
    handle: {
      harnessKind: selected.harnessKind,
      sessionId: selected.sessionId,
      treeRoot: input.treeRoot,
      workItemRef: input.ref,
    },
    completedPhases: [...input.completedPhases(input.ref)],
    adapterSupportsResumeInjection: input.supportsResumeInjection(selected.harnessKind),
    restartCount: input.restartCount(input.ref),
  };
};
