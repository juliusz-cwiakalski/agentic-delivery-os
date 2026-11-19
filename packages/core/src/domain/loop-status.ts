/**
 * The `delivery.loop.v1` projection and the declared status-key block (GH-348
 * F-1, API-4, API-7; DM-4).
 *
 * Pure: the caller supplies already-folded live and recorded facts, and the
 * projection names no source of its own. The status block renders `key=value`
 * lines in the DECLARED order, exactly three keys are boolean and render
 * `yes`/`no`, `restarts` renders `<n>/<bound>`, and every absent value renders
 * as the empty string after `=` — never a placeholder token (PM rulings R1/R2).
 */
import {
  type CoordinatorProgressState,
  type CoordinatorVerdict,
  LOOP_BOOLEAN_STATUS_KEYS,
  LOOP_STATUS_KEYS,
  LOOP_V1_SUPERVISOR_IDENTITY,
  type LoopDegradation,
  type LoopInstanceState,
  type LoopStatusProjection,
  type LoopStopMode,
} from "#contracts";

const statusValue = (
  projection: LoopStatusProjection,
  key: (typeof LOOP_STATUS_KEYS)[number],
): string => {
  switch (key) {
    case "loop_running":
      return projection.state === "running" ? "yes" : "no";
    case "loop_pid":
      return projection.instance?.pid === null || projection.instance === null
        ? ""
        : String(projection.instance.pid);
    case "ceo_alive":
      return projection.session.alive ? "yes" : "no";
    case "ceo_pid":
      // Live session ONLY: an ended session renders both identifiers empty,
      // exactly as the shell's `--status` prints them (API-7, §8.5).
      return projection.session.alive && projection.session.pid !== null
        ? String(projection.session.pid)
        : "";
    case "ceo_session":
      return projection.session.alive && projection.session.sessionId !== null
        ? projection.session.sessionId
        : "";
    case "stop_signal":
      return projection.stop.requested ? "yes" : "no";
    case "stop_mode":
      return projection.stop.requested ? (projection.stop.mode ?? "drain") : "";
    case "loop_id":
      // The CONSTANT supervisor identity: always present, never empty.
      return projection.loopId.length === 0 ? LOOP_V1_SUPERVISOR_IDENTITY : projection.loopId;
    case "ceo_title":
      return projection.session.title ?? "";
    case "restarts":
      return `${String(projection.restarts.count)}/${String(projection.restarts.bound)}`;
    case "budget_epoch":
      return projection.restarts.budgetEpochId ?? "";
    case "last_restart_reason":
      return projection.restarts.lastReason ?? "";
    case "last_verdict":
      return projection.verdict === null ? "" : projection.verdict.verdict;
    case "degraded":
      return projection.degraded.join(",");
    default:
      return "";
  }
};

/** The declared human status block, one `key=value` line per key. */
export const renderStatusBlock = (projection: LoopStatusProjection): readonly string[] =>
  LOOP_STATUS_KEYS.map((key) => `${key}=${statusValue(projection, key)}`);

/** Exactly the three declared boolean keys render `yes`/`no`. */
export const booleanStatusKeys = (): readonly (typeof LOOP_BOOLEAN_STATUS_KEYS)[number][] =>
  LOOP_BOOLEAN_STATUS_KEYS;

/** The fold input the projection consumes; every fact arrives already read. */
export type LoopStatusFacts = {
  readonly loopId?: string;
  readonly state: LoopInstanceState;
  readonly instance: { readonly instanceId: string; readonly pid: number | null } | null;
  readonly liveSession: {
    readonly sessionId: string | null;
    readonly alive: boolean;
    readonly pid: number | null;
  };
  readonly recordedTitle: string | null;
  readonly recordedProgress: CoordinatorProgressState | null;
  readonly restarts: {
    readonly count: number;
    readonly bound: number;
    readonly budgetEpochId: string | null;
    readonly lastReason: string | null;
  };
  readonly stop: {
    readonly requested: boolean;
    readonly mode: LoopStopMode | null;
    readonly recordedAt: string | null;
  };
  readonly verdict: {
    readonly verdict: CoordinatorVerdict;
    readonly reason: string | null;
    readonly evidence: string | null;
  } | null;
  readonly degraded: readonly LoopDegradation[];
};

/** Project the declared read-only observation over folded facts (API-4). */
export const projectLoopStatus = (facts: LoopStatusFacts): LoopStatusProjection => ({
  schemaVersion: "delivery.loop.v1",
  loopId: facts.loopId ?? LOOP_V1_SUPERVISOR_IDENTITY,
  state: facts.state,
  instance: facts.instance,
  session: {
    sessionId: facts.liveSession.sessionId,
    alive: facts.liveSession.alive,
    pid: facts.liveSession.pid,
    title: facts.recordedTitle,
    progress: facts.recordedProgress,
  },
  restarts: facts.restarts,
  stop: facts.stop,
  verdict: facts.verdict,
  degraded: facts.degraded,
});

/** The closed degradation list, in the declared vocabulary order. */
export const orderDegradations = (
  values: readonly LoopDegradation[],
): readonly LoopDegradation[] => {
  const set = new Set(values);
  return [
    "session-pid-unknown",
    "progress-unreadable",
    "delivery-corroborator-unreadable",
    "live-facts-unknown",
    "log-unavailable",
  ].filter((value): value is LoopDegradation => set.has(value as LoopDegradation));
};
