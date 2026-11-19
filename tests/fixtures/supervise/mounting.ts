/**
 * The captured pre-change prompt-required family list (GH-295 TC-SUP-096): the
 * single statement of the delivered base of 23 (through GH-298's `steer`), so
 * the three appended families (`metrics`, `supervise`, then GH-346's `install`
 * = 26) are asserted once and every count pin is checked here.
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

/**
 * The mounted set: the delivered 23 plus metrics as the twenty-fourth family
 * (GH-299), supervise as the twenty-fifth (GH-295), and GH-346's `install` as
 * the twenty-sixth and last.
 */
export const MOUNTED_FAMILIES = [...BASE_FAMILIES, "metrics", "supervise", "install"] as const;
