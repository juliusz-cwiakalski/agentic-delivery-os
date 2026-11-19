/**
 * The golden status worlds (GH-348 TC-VERB-003; API-4, API-7).
 *
 * Three declared worlds — running, stopped-with-folded-stop, and
 * absent-identifier — with their human block. The absent world keeps
 * `loop_id=loop-main` and `restarts=0/<bound>` and leaves only the genuinely
 * optional identifiers empty.
 */

export const LOOP_STATUS_GOLDEN_RUNNING = {
  lines: [
    "loop_running=yes",
    "loop_pid=9001",
    "ceo_alive=yes",
    "ceo_pid=4242",
    "ceo_session=session-1",
    "stop_signal=no",
    "stop_mode=",
    "loop_id=loop-main",
    "ceo_title=ceo-loop-19700101-001640",
    "restarts=0/10",
    "budget_epoch=epoch-1",
    "last_restart_reason=",
    "last_verdict=",
    "degraded=",
  ],
} as const;

export const LOOP_STATUS_GOLDEN_STOPPED = {
  lines: [
    "loop_running=no",
    "loop_pid=",
    "ceo_alive=no",
    "ceo_pid=",
    "ceo_session=",
    "stop_signal=yes",
    "stop_mode=drain",
    "loop_id=loop-main",
    "ceo_title=",
    "restarts=0/10",
    "budget_epoch=epoch-1",
    "last_restart_reason=",
    "last_verdict=",
    "degraded=",
  ],
} as const;

/** The absent-identifier world: only the optional identifiers are empty. */
export const LOOP_STATUS_GOLDEN_ABSENT = {
  lines: [
    "loop_running=no",
    "loop_pid=",
    "ceo_alive=no",
    "ceo_pid=",
    "ceo_session=",
    "stop_signal=no",
    "stop_mode=",
    "loop_id=loop-main",
    "ceo_title=",
    "restarts=0/10",
    "budget_epoch=epoch-1",
    "last_restart_reason=",
    "last_verdict=",
    "degraded=",
  ],
} as const;

/** The golden log header for a bounded read (API-5). */
export const LOOP_LOG_GOLDEN_HEADER = "loop log  lines=0/50  bytes=0  truncated=no  unreadable=no";
