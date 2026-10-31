/**
 * The binding cold/live/leaf boundary matrix B-01..B-16 (test-plan §4.4).
 * Every value is derived from the fixed injected clock; no host time is read.
 */
import { DAY_MS, LIVE_BOUNDARY, MINUTE_MS, NOW_MS } from "./harness";
import { makeSession, type SessionFixture } from "./store";

export const cutoffMs = (olderThanDays: number): number => NOW_MS - olderThanDays * DAY_MS;

export const BOUNDARY_IDS = {
  b01: "ses_b01_cutoff",
  b02: "ses_b02_cutoff_minus_1",
  b03: "ses_b03_cutoff_plus_1",
  b04: "ses_b04_one_day_minus_1",
  b05: "ses_b05_live_boundary",
  b06: "ses_b06_live_boundary_plus_1",
  b07: "ses_b07_live_boundary_minus_1",
  b08: "ses_b08_sixteen_minutes",
  b09: "ses_b09_live_and_warm",
  b10: "ses_b10_cold_leaf",
  b11: "ses_b11_cold_parent",
  b12: "ses_b12_cold_parent_live_child",
  b16a: "a",
  b16b: "b",
} as const;

export type BoundaryCase = {
  readonly id: string;
  readonly label: string;
  readonly session: SessionFixture;
};

const at = (id: string, label: string, timeUpdated: number): BoundaryCase => ({
  id,
  label,
  session: makeSession({ id, timeUpdated }),
});

/** B-01..B-12 and the B-16 tie pair as stored facts. */
export const BOUNDARY_CASES: readonly BoundaryCase[] = [
  at(BOUNDARY_IDS.b01, "B-01 exactly at the 30-day cutoff", cutoffMs(30)),
  at(BOUNDARY_IDS.b02, "B-02 1 ms older than the cutoff", cutoffMs(30) - 1),
  at(BOUNDARY_IDS.b03, "B-03 1 ms newer than the cutoff", cutoffMs(30) + 1),
  at(BOUNDARY_IDS.b04, "B-04 24 h + 1 ms old", cutoffMs(1) - 1),
  at(BOUNDARY_IDS.b05, "B-05 exactly 15 minutes old", LIVE_BOUNDARY),
  at(BOUNDARY_IDS.b06, "B-06 15 minutes - 1 ms old", LIVE_BOUNDARY + 1),
  at(BOUNDARY_IDS.b07, "B-07 15 minutes + 1 ms old", LIVE_BOUNDARY - 1),
  at(BOUNDARY_IDS.b08, "B-08 16 minutes old", NOW_MS - 16 * MINUTE_MS),
  at(BOUNDARY_IDS.b09, "B-09 live-and-warm policy probe", LIVE_BOUNDARY),
  at(BOUNDARY_IDS.b10, "B-10 cold leaf", cutoffMs(30) - DAY_MS),
  at(BOUNDARY_IDS.b11, "B-11 cold parent", cutoffMs(30) - 2 * DAY_MS),
  at(BOUNDARY_IDS.b12, "B-12 cold parent with a live child", cutoffMs(30) - 3 * DAY_MS),
  at(BOUNDARY_IDS.b16a, "B-16 tie id a", cutoffMs(30) - 4 * DAY_MS),
  at(BOUNDARY_IDS.b16b, "B-16 tie id b", cutoffMs(30) - 4 * DAY_MS),
];

/** The cold-leaf population selected by `db prune --older-than 30`. */
export const COLD_LEAF_SESSIONS: readonly SessionFixture[] = [
  makeSession({ id: BOUNDARY_IDS.b02, timeUpdated: cutoffMs(30) - 1 }),
  makeSession({ id: BOUNDARY_IDS.b10, timeUpdated: cutoffMs(30) - DAY_MS }),
  makeSession({
    id: "ses_cold_child_leaf",
    parentId: BOUNDARY_IDS.b11,
    timeUpdated: cutoffMs(30) - DAY_MS,
  }),
];

/** Parent/child fixtures for the leaf-only checks. */
export const LEAF_SESSIONS: readonly SessionFixture[] = [
  makeSession({ id: BOUNDARY_IDS.b11, timeUpdated: cutoffMs(30) - 2 * DAY_MS, hasChildren: true }),
  makeSession({
    id: "ses_cold_child",
    parentId: BOUNDARY_IDS.b11,
    timeUpdated: cutoffMs(30) - DAY_MS,
  }),
  makeSession({ id: BOUNDARY_IDS.b12, timeUpdated: cutoffMs(30) - 3 * DAY_MS, hasChildren: true }),
  makeSession({
    id: "ses_live_child",
    parentId: BOUNDARY_IDS.b12,
    timeUpdated: NOW_MS - MINUTE_MS,
  }),
];

/** The five-candidate ordering fixture (t1 < t2 = t3 < t4 < t5). */
export const ORDER_SESSIONS: readonly SessionFixture[] = [
  makeSession({ id: "ses_t5", timeUpdated: cutoffMs(30) - 2_000 }),
  makeSession({ id: "ses_t1", timeUpdated: cutoffMs(30) - 5_000 }),
  makeSession({ id: "ses_t2_a", timeUpdated: cutoffMs(30) - 4_000 }),
  makeSession({ id: "ses_t4", timeUpdated: cutoffMs(30) - 3_000 }),
  makeSession({ id: "ses_t2_b", timeUpdated: cutoffMs(30) - 4_000 }),
];
