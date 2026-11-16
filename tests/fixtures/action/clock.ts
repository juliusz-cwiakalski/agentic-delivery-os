/**
 * The injected-clock and aging plan fixtures (GH-287 test-plan §4.1 item 4,
 * matrix A-01..A-11). Every instant is a literal; no case reads the wall clock.
 */
import { ACTION_AGING_DAY_MS } from "../../../packages/core/src/contracts/index";

/** The fixed "now" for non-aging cases: 2026-11-16T12:00:00Z. */
export const NOW_MS = Date.parse("2026-11-16T12:00:00Z");

/** The literal filing instant every aging case counts days from. */
export const FILING_MS = Date.parse("2026-10-01T00:00:00Z");

/** The literal ISO filing date recorded beside the epoch instant. */
export const FILING_ISO = "2026-10-01T00:00:00Z";

/** The literal due date recorded at filing. */
export const DUE_ISO = "2026-10-15T00:00:00Z";

/** One day in milliseconds, read from the declared contract constant. */
export const DAY_MS = ACTION_AGING_DAY_MS;

/** The clock at a given number of days open since the filing instant. */
export const clockAtDaysOpen = (days: number): number => FILING_MS + days * DAY_MS;

/** The declared day offsets the ladder asserts (matrix A-01..A-07). */
export const AGING_DAY_PLAN = [0, 13, 14, 15, 29, 30, 31] as const;

/** Two recorded due-date lapse events (the second-miss rule, DEC-9). */
export const TWO_LAPSES = ["2026-10-15T00:00:00Z", "2026-10-20T00:00:00Z"] as const;

/** One recorded due-date lapse event. */
export const ONE_LAPSE = [TWO_LAPSES[0]] as const;
