/**
 * The lane observation fold (GH-237 F-11, DM-11, DEC-8, AC-F11-1, AC-F11-2).
 *
 * A lane is a pure projection over queue entries, leases, parks, and the
 * delivered economics fold. Identity is the canonical work-item ref: no lane
 * record kind exists and no lane state is stored. An idle lane always carries a
 * bounded reason from the closed vocabulary; an underivable restart count or
 * amplification is `null` with a warning, never a fabricated zero.
 */

import {
  QUEUE_LANES_SCHEMA_VERSION,
  QUEUE_MAX_FINDINGS,
  QUEUE_MAX_HUMAN_BYTES,
  QUEUE_MAX_HUMAN_LINES,
  QUEUE_MAX_LANES,
  type QueueDegradationReason,
  type QueueLane,
  type QueueLaneIdleReason,
  type QueueLaneState,
  type QueueLanesData,
  type QueueParkedReason,
  type QueueWeightClass,
  type DaemonLaneRecord,
} from "#contracts";
import type { QueueSchedule } from "./queue-precedence.js";

/** The delivered economics fold inputs a lane carries. */
export type QueueLaneEconomics = {
  readonly restarts: number | null;
  readonly amplification: number | null;
  readonly amplificationWarning?: string;
  readonly failedPastBudget?: boolean;
};

/** Everything the lane fold consumes. */
export type QueueLaneFoldInput = {
  readonly schedule: QueueSchedule;
  readonly economics: Readonly<Record<string, QueueLaneEconomics>>;
  readonly degraded: readonly QueueDegradationReason[];
  /** Daemon execution evidence folded beside the queue truth (F-9, DM-13). */
  readonly daemonLanes?: readonly DaemonLaneRecord[];
};

const UNDERIVABLE_WARNING = "economics-underivable" as const;

const asIdleReason = (reason: string | undefined): QueueLaneIdleReason | QueueParkedReason => {
  if (reason?.startsWith("parked:")) {
    return reason as QueueParkedReason;
  }
  if (reason === undefined) return "not-ready";
  return reason as QueueLaneIdleReason;
};

const laneStateFor = (
  entry: QueueSchedule["entries"][number],
  leased: boolean,
  economics: QueueLaneEconomics | undefined,
): { state: QueueLaneState; reason?: QueueLaneIdleReason | QueueParkedReason } => {
  if (economics?.failedPastBudget === true) {
    return { state: "failed", reason: "restart-budget-exhausted" };
  }
  const parkCondition = entry.blocking.find((block) => block.reason === "park-condition-stuck");
  if (parkCondition !== undefined) {
    return { state: "idle-with-reason", reason: "park-condition-stuck" };
  }
  const parked = entry.blocking.find((block) => block.reason.startsWith("parked:"));
  if (parked !== undefined) {
    return { state: "parked", reason: asIdleReason(parked.reason) };
  }
  if (leased) {
    return { state: "delivering" };
  }
  if (entry.rankClass === "merge-ready") {
    return { state: "merge-ready" };
  }
  if (entry.rankClass === "in-review") {
    return { state: "in-review" };
  }
  if (entry.state === "ready") {
    return {
      state: "idle-with-reason",
      reason: entry.rankClass === "resume-parked" ? "resume-parked" : "new-start",
    };
  }
  return {
    state: "idle-with-reason",
    reason: asIdleReason(entry.blocking[0]?.reason),
  };
};

const weightClassOf = (entry: QueueSchedule["entries"][number]): QueueWeightClass =>
  entry.weightClass;

/**
 * Fold the schedule and economics into the bounded `lanes` payload. The lane
 * count is bounded at 200; every drop sets `truncated`.
 */
export const foldLanes = (input: QueueLaneFoldInput): QueueLanesData => {
  const entries = input.schedule.entries.slice(0, QUEUE_MAX_LANES);
  const leaseByRepository = new Map(
    input.schedule.leases.map((lease) => [lease.repository, lease]),
  );
  const daemonByRef = new Map<string, DaemonLaneRecord>();
  for (const lane of input.daemonLanes ?? []) daemonByRef.set(lane.ref, lane);
  const lanes: QueueLane[] = entries.map((entry) => {
    const lease =
      entry.repository === undefined ? undefined : leaseByRepository.get(entry.repository);
    const economics = input.economics[entry.ref];
    const daemon = daemonByRef.get(entry.ref);
    const resolved = laneStateFor(entry, lease !== undefined, economics);
    if (daemon?.state === "failed") {
      resolved.state = "failed";
      resolved.reason = "restart-budget-exhausted";
    } else if (daemon?.state === "delivering") {
      resolved.state = "delivering";
      delete resolved.reason;
    } else if (daemon?.state === "preempted") {
      resolved.state = "parked";
      resolved.reason = "parked:preempted-for-close-item";
    }
    const amplificationWarning =
      economics?.amplificationWarning ??
      (economics === undefined || economics.restarts === null || economics.amplification === null
        ? UNDERIVABLE_WARNING
        : undefined);
    return {
      id: entry.ref,
      ref: entry.ref,
      state: resolved.state,
      ...(resolved.reason === undefined ? {} : { reason: resolved.reason }),
      ...(lease === undefined ? {} : { lease: lease.leaseId }),
      ...(lease === undefined ? {} : { leaseScope: lease.scope }),
      restarts: economics?.restarts ?? null,
      amplification: economics?.amplification ?? null,
      ...(amplificationWarning === undefined ? {} : { amplificationWarning }),
      weightClass: weightClassOf(entry),
    };
  });
  const findings = input.schedule.findings.slice(0, QUEUE_MAX_FINDINGS);
  const truncated =
    input.schedule.entries.length > QUEUE_MAX_LANES ||
    findings.length < input.schedule.findings.length;
  return {
    schemaVersion: QUEUE_LANES_SCHEMA_VERSION,
    lanes,
    findings,
    degraded: input.degraded,
    truncated,
    ...(truncated ? { truncationReason: "lane-cap" } : {}),
    counts: {
      lanes: lanes.length,
      delivering: lanes.filter((lane) => lane.state === "delivering").length,
      idle: lanes.filter((lane) => lane.state === "idle-with-reason").length,
      parked: lanes.filter((lane) => lane.state === "parked").length,
      failed: lanes.filter((lane) => lane.state === "failed").length,
    },
  };
};

/** Select one lane by canonical ref, or `undefined` when it is unobserved. */
export const selectLane = (data: QueueLanesData, ref: string): QueueLane | undefined =>
  data.lanes.find((lane) => lane.ref === ref || lane.id === ref);

const utf8Length = (value: string): number => new TextEncoder().encode(value).length;

const truncateToBytes = (value: string, maxBytes: number): string => {
  if (maxBytes <= 0) return "";
  if (utf8Length(value) <= maxBytes) return value;
  const characters = Array.from(value);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (utf8Length(characters.slice(0, middle).join("")) <= maxBytes - 1) low = middle;
    else high = middle - 1;
  }
  return `${characters.slice(0, low).join("")}+`;
};

/**
 * Deterministic human text: one line per lane, bounded by the declared human
 * line and UTF-8 byte caps; every cut is marked `+more`.
 */
export const renderLanesHuman = (data: QueueLanesData): string => {
  const lines = data.lanes.map(
    (lane) => `${lane.id} ${lane.state}${lane.reason === undefined ? "" : ` ${lane.reason}`}`,
  );
  const header = `lanes ${data.counts.lanes}${data.truncated ? "+more" : ""}`;
  const kept: string[] = [];
  let bytes = utf8Length(header) + 1;
  for (const line of lines) {
    const next = truncateToBytes(line, 512);
    // Leave room for the header and a possible "+more" marker line.
    if (kept.length >= QUEUE_MAX_HUMAN_LINES - 2) break;
    const nextBytes = utf8Length(next) + 1;
    if (bytes + nextBytes > QUEUE_MAX_HUMAN_BYTES) break;
    kept.push(next);
    bytes += nextBytes;
  }
  if (kept.length < lines.length) kept.push("+more");
  return `${[header, ...kept].join("\n")}\n`;
};
