/**
 * The derived aging ladder (GH-287 F-3, DM-2; DEC-3, DEC-9, NFR-3).
 *
 * A pure function of recorded data only: the action's recorded filing timestamp
 * (the one declared basis), the recorded due-date lapse events (which feed only
 * the second-miss counter), the injected clock instant, and the contract
 * constants. Nothing is stored, nothing writes, and no ambient time is read.
 */
import {
  ACTION_AGING_BASIS,
  ACTION_AGING_DAY_MS,
  ACTION_AGING_ESCALATE_DAYS,
  ACTION_AGING_NUDGE_DAYS,
  ACTION_SECOND_MISS_LAPSES,
  type RetroActionAging,
  type RetroActionRecord,
} from "#contracts";

/** Whether the recorded due-date lapse events reach the second-miss rule. */
export const secondMissReached = (record: RetroActionRecord): boolean =>
  record.dueDateLapses.length >= ACTION_SECOND_MISS_LAPSES;

/** The whole days an action has been open at the injected instant (never negative). */
export const actionOpenDays = (record: RetroActionRecord, nowMs: number): number => {
  // `ACTION_AGING_BASIS` pins the basis to the recorded filing timestamp: the
  // due dates are read only by `secondMissReached`, never here (DEC-9).
  const elapsed = nowMs - record.filedAt;
  return elapsed <= 0 ? 0 : Math.floor(elapsed / ACTION_AGING_DAY_MS);
};

/**
 * Evaluate one action's aging state at the injected instant.
 *
 * The ladder is exact at both boundaries: day 13 is `current`, day 14 is
 * `nudged`, day 29 is `nudged`, day 30 is `escalated`; the second missed due
 * date escalates at any age.
 */
export const evaluateActionAging = (record: RetroActionRecord, nowMs: number): RetroActionAging => {
  const ageMs = nowMs - record.filedAt;
  const openDays = actionOpenDays(record, nowMs);
  if (secondMissReached(record)) {
    return {
      basis: ACTION_AGING_BASIS,
      ageMs,
      openDays,
      state: "escalated",
      escalationReason: "second-miss",
    };
  }
  if (openDays >= ACTION_AGING_ESCALATE_DAYS) {
    return {
      basis: ACTION_AGING_BASIS,
      ageMs,
      openDays,
      state: "escalated",
      escalationReason: "threshold-days",
    };
  }
  if (openDays >= ACTION_AGING_NUDGE_DAYS) {
    return { basis: ACTION_AGING_BASIS, ageMs, openDays, state: "nudged" };
  }
  return { basis: ACTION_AGING_BASIS, ageMs, openDays, state: "current" };
};
