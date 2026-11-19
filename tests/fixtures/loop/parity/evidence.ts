/**
 * The permanent proof boundary (GH-348 Appendix C/Appendix G, DM-9; AC-F8-5).
 *
 * The ONLY source of `LOOP_PARITY_PROOF_BOUNDARY`: nine proven surfaces and six
 * not-proven surfaces, in the declared order. Every battery row declares one
 * proven seam, and no row may name a not-proven one. A missing, added, or
 * reordered id fails the boundary case by name.
 */

export const LOOP_PROVEN_SURFACES = [
  "verbs",
  "log",
  "spawn",
  "stuck",
  "kill",
  "backoff-budget",
  "stop",
  "single-instance",
  "no-shell",
] as const;

export const LOOP_NOT_PROVEN_SURFACES = [
  "live-opencode",
  "live-provider",
  "os-termination",
  "real-pick-deliver-merge",
  "long-run-loop",
  "cross-process-race",
] as const;

export type LoopProvenSurface = (typeof LOOP_PROVEN_SURFACES)[number];
export type LoopNotProvenSurface = (typeof LOOP_NOT_PROVEN_SURFACES)[number];

export const LOOP_PARITY_PROOF_BOUNDARY = {
  proven: LOOP_PROVEN_SURFACES,
  notProven: LOOP_NOT_PROVEN_SURFACES,
} as const;

/** Whether a declared seam names a proven surface (the battery's only licence). */
export const isProvenSurface = (seam: string): seam is LoopProvenSurface =>
  (LOOP_PROVEN_SURFACES as readonly string[]).includes(seam);

/** The ids a row must not name: an off-boundary row proves nothing. */
export const isOffBoundarySeam = (seam: string): boolean =>
  (LOOP_NOT_PROVEN_SURFACES as readonly string[]).includes(seam);

/** The boundary's declared counts, so a case never restates them as literals. */
export const LOOP_BOUNDARY_COUNTS = {
  proven: LOOP_PROVEN_SURFACES.length,
  notProven: LOOP_NOT_PROVEN_SURFACES.length,
} as const;

/**
 * The canonical form the determinism case compares: field order and whitespace
 * never vary, so two runs that differ at all fail.
 */
export const canonicalizeObservation = (value: unknown): string =>
  JSON.stringify(value, (_key, entry: unknown) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, record[key]]),
    );
  });
