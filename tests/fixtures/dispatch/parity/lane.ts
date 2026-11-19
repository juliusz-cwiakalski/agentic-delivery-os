/**
 * Dispatch-lane seeders and readers for the parity battery (GH-347 §6.1).
 *
 * The seeds are written through the real lane append and the real daemon-lane
 * append, so the resolver reads exactly what production would read. The store
 * wrapper fails only `dispatch.lane` appends (the append-failure disclosure),
 * and the "lane exists before any attempt" probe observes the acquisition
 * rather than the classification.
 */
import {
  type DaemonLaneRecord,
  DAEMON_LANE_PAYLOAD_SCHEMA,
  DISPATCH_LANE_PAYLOAD_SCHEMA,
  DISPATCH_LANE_RECORD_KIND,
  type DispatchLaneRecord,
  type HarnessKind,
  type HarnessOutcome,
  type StateStorePort,
} from "../../../../packages/core/src/contracts/index";
import { appendDaemonLane, readDaemonLanes } from "../../../../packages/core/src/app/daemon";
import {
  appendDispatchLane,
  readDispatchAttempts,
  readDispatchLanes,
} from "../../../../packages/core/src/app/dispatch-ledger";
import { createParityHarness, type ParityObservation } from "./harness";
import { createGuardedRunner } from "./process-runner";

export const LANE_NOW = "2026-11-19T00:00:00.000Z";

export type LaneSeed = {
  readonly ref: string;
  readonly repository?: string;
  readonly attemptId?: string;
  readonly sessionId: string;
  readonly harnessKind?: HarnessKind;
  readonly processId?: number;
  readonly startedAt?: string;
  readonly iterationOrdinal?: number;
  readonly restartsConsumed?: number;
  readonly state?: "active" | "terminal";
  readonly lastToken?: string;
  readonly lastOutcome?: HarnessOutcome;
  readonly recordedAt?: string;
};

/** Append one real `dispatch.lane` record (active by default). */
export const seedDispatchLane = (store: StateStorePort, seed: LaneSeed): DispatchLaneRecord => {
  const state = seed.state ?? "active";
  const record: DispatchLaneRecord = {
    schema: DISPATCH_LANE_PAYLOAD_SCHEMA,
    ref: seed.ref,
    repository: seed.repository ?? "github.com/owner/repo",
    attemptId: seed.attemptId ?? `attempt-seed-${seed.ref}`,
    sessionId: seed.sessionId,
    harnessKind: seed.harnessKind ?? "opencode",
    owner: { processId: seed.processId ?? 4242, startedAt: seed.startedAt ?? LANE_NOW },
    iterationOrdinal: seed.iterationOrdinal ?? 1,
    restartsConsumed: seed.restartsConsumed ?? 0,
    state,
    ...(state === "terminal"
      ? {
          lastToken: seed.lastToken ?? "pr-open",
          lastOutcome: seed.lastOutcome ?? "completed",
        }
      : {}),
    recordedAt: seed.recordedAt ?? LANE_NOW,
  };
  const appended = appendDispatchLane(store, `seed-lane-${seed.ref}`, record);
  if (!appended.ok) throw new Error(`lane seed failed: ${JSON.stringify(appended)}`);
  return record;
};

/** Append one real daemon lane record in a declared state. */
export const seedDaemonLane = (
  store: StateStorePort,
  seed: {
    readonly ref: string;
    readonly state: "delivering" | "detached" | "preempted" | "completed";
    readonly sessionId?: string;
    readonly harnessKind?: string;
    readonly recordedAt?: string;
  },
): void => {
  const record: DaemonLaneRecord = {
    schema: DAEMON_LANE_PAYLOAD_SCHEMA,
    ref: seed.ref,
    state: seed.state,
    ...(seed.sessionId === undefined ? {} : { sessionId: seed.sessionId }),
    ...(seed.harnessKind === undefined ? {} : { harnessKind: seed.harnessKind }),
    processId: 4242,
    spawnOrdinal: 1,
    recordedAt: seed.recordedAt ?? LANE_NOW,
  };
  const appended = appendDaemonLane(store, `seed-daemon-${seed.ref}-${seed.state}`, record);
  if (!appended.ok) throw new Error(`daemon lane seed failed: ${JSON.stringify(appended)}`);
};

/** The dispatch lane records for a ref, in append order. */
export const dispatchLanesOf = (
  store: StateStorePort,
  ref: string,
): readonly DispatchLaneRecord[] => {
  const read = readDispatchLanes(store);
  if (!read.ok) throw new Error("lane read failed");
  return read.records.filter((record) => record.ref === ref);
};

/** The daemon lane records for a ref, in append order (the delivered reader). */
export const daemonLanesOf = (store: StateStorePort, ref: string) => {
  const read = readDaemonLanes(store);
  if (!read.ok) throw new Error("daemon lane read failed");
  return read.records.filter((record) => record.ref === ref);
};

/** Whether any attempt record exists for the ref (the acquisition probe). */
export const attemptCountFor = (store: StateStorePort, ref: string): number => {
  const read = readDispatchAttempts(store);
  if (!read.ok) throw new Error("attempt read failed");
  return read.records.filter((record) => record.ref === ref).length;
};

/** A store wrapper that fails only `dispatch.lane` appends. */
export const failLaneAppends = (store: StateStorePort): StateStorePort =>
  ({
    ...store,
    append: (handle, request) => {
      if (request.kind === DISPATCH_LANE_RECORD_KIND) {
        return {
          ok: false as const,
          error: { code: "state.write.failed", location: { path: "state/ledger.log" } },
        };
      }
      return store.append(handle, request);
    },
  }) as StateStorePort;

/** Re-exported for the suites that assert the payload key set exactly. */
export type { DispatchLaneRecord };

/* ------------------------------------------------------------------------- */
/* The resume rows (GH-347 AC-F3-1/AC-F3-3/AC-F3-4; DEC-3).                  */
/* ------------------------------------------------------------------------- */

/** A recorded terminal `pr-open` lane resumes; it is never replaced by a spawn. */
export const resumeOverPrOpen = async (): Promise<ParityObservation> => {
  const h = createParityHarness({ label: "resume-pr-open" });
  try {
    seedDispatchLane(h.store, {
      ref: "GH-347",
      sessionId: "ses-347",
      state: "terminal",
      lastToken: "pr-open",
      lastOutcome: "completed",
    });
    await h.run(["dispatch", "GH-347", "--resume-prompt", "continue the merge", "--json"]);
    return h.observe();
  } finally {
    h.dispose();
  }
};

/** No recorded lane: an explicit fresh spawn carrying the operator's text. */
export const resumeWithoutLane = async (): Promise<ParityObservation> => {
  const h = createParityHarness({ label: "resume-no-lane" });
  try {
    await h.run(["dispatch", "GH-347", "--resume-prompt", "start over", "--json"]);
    return h.observe();
  } finally {
    h.dispose();
  }
};

/** A recorded lane the adapter reports unknown is a classified failure, no spawn. */
export const resumeUnknownSession = async (): Promise<ParityObservation> => {
  const guarded = createGuardedRunner({
    session: () => ({ sessionId: "", stdout: "", status: 0, timedOut: false }),
  });
  const h = createParityHarness({ label: "resume-unknown", guarded });
  try {
    seedDispatchLane(h.store, { ref: "GH-347", sessionId: "ses-gone", harnessKind: "opencode" });
    await h.run(["dispatch", "GH-347", "--resume-prompt", "continue", "--json"]);
    return h.observe();
  } finally {
    h.dispose();
  }
};
