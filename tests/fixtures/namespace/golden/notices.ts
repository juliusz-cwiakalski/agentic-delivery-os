/**
 * GH-365 P7 — the four delivered prior-identity notice lines (API-4, NFR-7).
 *
 * The golden text is committed here so a case compares emitted output to the
 * declaration rather than to a test-local copy. P8 appends the fifth
 * `override-read` line together with the reason.
 */
export const GOLDEN_NOTICE_REASONS = [
  "config-read",
  "config-skipped",
  "state-read",
  "state-skipped",
] as const;
export type GoldenNoticeReason = (typeof GOLDEN_NOTICE_REASONS)[number];

const NO_MOVE = "nothing was moved, copied, or deleted";

const TEMPLATES: Readonly<Record<GoldenNoticeReason, string>> = {
  "config-read": `prior-identity-fallback: config-read read the prior identity configuration at {prior} because {current} is absent (${NO_MOVE})`,
  "config-skipped": `prior-identity-fallback: config-skipped the current configuration at {current} is in effect; the prior identity configuration at {prior} was not read (${NO_MOVE})`,
  "state-read": `prior-identity-fallback: state-read the prior identity host root at {prior} is in effect because {current} is absent (${NO_MOVE})`,
  "state-skipped": `prior-identity-fallback: state-skipped the current host root at {current} is in effect; the prior identity host root at {prior} was not used (${NO_MOVE})`,
};

/** The exact committed line for one reason and the two absolute locations. */
export const goldenNotice = (
  reason: GoldenNoticeReason,
  priorLocation: string,
  currentLocation: string,
): string =>
  TEMPLATES[reason].split("{prior}").join(priorLocation).split("{current}").join(currentLocation);
