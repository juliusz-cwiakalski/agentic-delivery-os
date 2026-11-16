/**
 * The captured pre-change prompt-required family list (GH-298 TC-STEER-060,
 * GAP-T6): the single statement of the delivered base of 22, so the mount delta
 * (`+ steer` = 23) is asserted once and every count pin is checked against it.
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
] as const;

/** The mounted set: the delivered 22 plus steer as the twenty-third family. */
export const MOUNTED_FAMILIES = [...BASE_FAMILIES, "steer"] as const;
