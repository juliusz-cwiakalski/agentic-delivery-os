/**
 * The captured prompt-required family lists (GH-299 TC-METRICS-080).
 *
 * One statement of the delivered 23-family base (steer at index 22), one of the
 * mounted 24-family set, and the pinning files every count must move in. The
 * base stays 22 for the GH-298 steer fixture, which asserts its own delta.
 */

/** The families through GH-298: 23 entries with steer last. */
export const DELIVERED_FAMILIES = [
  "status",
  "brief",
  "queue",
  "lanes",
  "blockers",
  "phase",
  "commit",
  "lint",
  "plan",
  "verify",
  "merge",
  "closeout",
  "spend",
  "retro",
  "dispatch",
  "coordinator",
  "daemon",
  "projects",
  "repos",
  "events",
  "board",
  "ceremony",
  "steer",
] as const;

/** The mounted set after GH-299: metrics appended as the twenty-fourth family. */
export const MOUNTED_FAMILIES = [...DELIVERED_FAMILIES, "metrics"] as const;

/** The suites that pin the family count and must all read 24. */
export const PINNING_FILES = [
  "tests/structure/entrypoint-bin.test.ts",
  "tests/structure/steer-mounting.test.ts",
  "tests/structure/board-mounting.test.ts",
  "tests/structure/events-production-composition.test.ts",
  "tests/structure/dispatch-attempts-composition.test.ts",
  "tests/structure/daemon-production-composition.test.ts",
  "tests/behaviour/repos-help.test.ts",
  "tests/behaviour/board-help.test.ts",
  "tests/behaviour/events-mount-help.test.ts",
  "tests/behaviour/ceremony-cli.test.ts",
  "tests/structure/metrics-mounting.test.ts",
] as const;

/** The declared non-count residual: the queue-ready control-matrix count. */
export const NON_COUNT_RESIDUAL = "tests/behaviour/queue-ready-negative-controls.test.ts";
