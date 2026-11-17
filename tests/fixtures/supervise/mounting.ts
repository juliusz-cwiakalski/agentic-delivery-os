/**
 * The captured pre-change prompt-required family list (GH-295 TC-SUP-096): the
 * single statement of the delivered base of 23, so the mount delta
 * (`+ supervise` = 24) is asserted once and every count pin is checked here.
 */
export const BASE_FAMILIES = [
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

/** The mounted set: the delivered 23 plus supervise as the twenty-fourth family. */
export const MOUNTED_FAMILIES = [...BASE_FAMILIES, "supervise"] as const;
