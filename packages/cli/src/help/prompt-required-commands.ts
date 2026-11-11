/**
 * The prompt-required command set (GH-242 F-1, §8.1).
 *
 * This module is dependency-free on purpose: checks and tests that need the
 * command list import it directly, so they resolve no workspace entrypoint and
 * therefore no built `dist/` output. The entrypoint and the help inventory
 * import the same declaration.
 */

/** The exact §8.1 prompt-required command set composed by the entrypoint. */
export const PROMPT_REQUIRED_COMMANDS = [
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
] as const;

export type PromptRequiredCommand = (typeof PROMPT_REQUIRED_COMMANDS)[number];
