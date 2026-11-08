/**
 * The pure progress-based liveness verdict (GH-239 F-1, NFR-2; DEC-9).
 *
 * Elapsed time alone never stalls a lane. A verdict is `progressing` when any
 * sourced signal advances between two evaluations, `unknown` when every sourced
 * reading is absent or there is only one observation, and `stalled` only after
 * two consecutive sourced evaluations with no advance. Absent readings keep
 * their declared absence reason and are never coerced to zero.
 */
import type { EconomicsSourcedSignalAbsenceReason } from "#contracts";

/** The four declared progress signals. */
export const DISPATCH_LIVENESS_SIGNALS = [
  "token-delta",
  "session-traffic",
  "worktree-activity",
  "prefill",
] as const;

export type DispatchLivenessSignal = (typeof DISPATCH_LIVENESS_SIGNALS)[number];

/** One sourced reading: a value that only progress makes larger. */
export type DispatchLivenessSourced = {
  readonly signal: DispatchLivenessSignal;
  readonly status: "sourced";
  readonly value: number;
};

/** One absent reading with its declared reason; never a fabricated zero. */
export type DispatchLivenessAbsent = {
  readonly signal: DispatchLivenessSignal;
  readonly status: "absent";
  readonly reason: EconomicsSourcedSignalAbsenceReason;
};

export type DispatchLivenessReading = DispatchLivenessSourced | DispatchLivenessAbsent;

/** The declared absence reasons admitted by the delivered sourced-signal type. */
export const DISPATCH_LIVENESS_ABSENCE_REASONS: readonly EconomicsSourcedSignalAbsenceReason[] = [
  "harness-unsupported",
  "not-observed",
];

/** The closed verdicts. */
export const DISPATCH_LIVENESS_VERDICTS = ["progressing", "stalled", "unknown"] as const;

export type DispatchLivenessVerdict = (typeof DISPATCH_LIVENESS_VERDICTS)[number];

/** Why an unknown verdict was returned. */
export const DISPATCH_LIVENESS_UNKNOWN_REASONS = [
  "all-absent",
  "insufficient-observations",
] as const;

export type DispatchLivenessUnknownReason = (typeof DISPATCH_LIVENESS_UNKNOWN_REASONS)[number];

/** One evaluation's verdict and the evidence that produced it. */
export type DispatchLivenessEvaluation = {
  readonly verdict: DispatchLivenessVerdict;
  /** The signals that advanced between the two evaluations, in declared order. */
  readonly advancing: readonly DispatchLivenessSignal[];
  /** Absent readings with their declared reasons, in declared order. */
  readonly absent: readonly { readonly signal: DispatchLivenessSignal; readonly reason: string }[];
  /** Present only for an `unknown` verdict. */
  readonly unknownReason?: DispatchLivenessUnknownReason;
  /** The cadence supplied as data (from `lane.liveness-interval`), echoed. */
  readonly cadenceMs: number;
};

const sourcedBySignal = (
  readings: readonly DispatchLivenessReading[],
): ReadonlyMap<DispatchLivenessSignal, number> => {
  const map = new Map<DispatchLivenessSignal, number>();
  for (const reading of readings) {
    if (reading.status === "sourced") map.set(reading.signal, reading.value);
  }
  return map;
};

/**
 * Evaluate one observation against the previous one.
 *
 * `previous` absent is the first evaluation: it can never stall. A sourced
 * value must strictly increase to count as progress; a decrease or an equal
 * value is no advance. Absent readings never contribute a value.
 */
export const evaluateDispatchLiveness = (input: {
  readonly readings: readonly DispatchLivenessReading[];
  readonly previous?: readonly DispatchLivenessReading[];
  readonly cadenceMs: number;
}): DispatchLivenessEvaluation => {
  const current = sourcedBySignal(input.readings);
  const previous = input.previous === undefined ? undefined : sourcedBySignal(input.previous);
  const absent = input.readings
    .filter((reading): reading is DispatchLivenessAbsent => reading.status === "absent")
    .map((reading) => ({ signal: reading.signal, reason: reading.reason }));
  const echo = { absent, cadenceMs: input.cadenceMs };

  if (current.size === 0) {
    return { verdict: "unknown", advancing: [], unknownReason: "all-absent", ...echo };
  }

  if (previous === undefined) {
    return {
      verdict: "unknown",
      advancing: [],
      unknownReason: "insufficient-observations",
      ...echo,
    };
  }

  const advancing = DISPATCH_LIVENESS_SIGNALS.filter((signal) => {
    const before = previous.get(signal);
    const after = current.get(signal);
    return before !== undefined && after !== undefined && after > before;
  });
  if (advancing.length > 0) {
    return { verdict: "progressing", advancing, ...echo };
  }

  // Two consecutive sourced evaluations with no advance may classify stalled;
  // an absent previous reading cannot corroborate a stall.
  if (previous.size === 0) {
    return { verdict: "unknown", advancing: [], unknownReason: "insufficient-observations", ...echo };
  }

  return { verdict: "stalled", advancing: [], ...echo };
};
