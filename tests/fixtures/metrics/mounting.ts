/**
 * The captured prompt-required family lists (GH-299 TC-METRICS-080).
 *
 * One statement of the delivered 23-family base (steer at index 22), one of the
 * metrics-mounted 24-family set (GH-299), the merged 25-family set (GH-295
 * appends `supervise`), and the 26-family set GH-346 appends `install` to,
 * plus the pinning files every count must move in.
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
export const METRICS_MOUNTED_FAMILIES = [...DELIVERED_FAMILIES, "metrics"] as const;

/** The merged mounted set: supervise appended as the twenty-fifth family. */
export const SUPERVISE_MOUNTED_FAMILIES = [...METRICS_MOUNTED_FAMILIES, "supervise"] as const;

/** The mounted set after GH-346: install appended as the twenty-sixth family. */
export const INSTALL_MOUNTED_FAMILIES = [...SUPERVISE_MOUNTED_FAMILIES, "install"] as const;

/** The mounted set after GH-348: loop appended as the twenty-seventh family. */
export const MOUNTED_FAMILIES = [...INSTALL_MOUNTED_FAMILIES, "loop"] as const;

/** The suites that pin the family count and must all read 27. */
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
