/**
 * Harness-agnostic liveness assembly (GH-233 F-2, DEC-9, NFR-6).
 *
 * The neutral report carries exactly one entry per closed signal kind, in
 * closed order. A sourced entry carries the injected value and observation
 * time; an absent entry carries a closed reason and never a zero, a `false`, an
 * empty string, or an invented timestamp. The consumer-side watchdog mapping is
 * a projection yielding absent keys, so an unsourced signal stays unknown. The
 * watchdog module is deliberately not imported (DEC-9/NG-4 boundary).
 */
import {
  HARNESS_LIVENESS_KINDS,
  type HarnessLivenessAbsenceReason,
  type HarnessLivenessKind,
  type HarnessLivenessReading,
  type HarnessLivenessReport,
  type HarnessLivenessSourcedReading,
  type WatchdogSignals,
} from "#contracts";

/** Assemble the neutral report in the closed kind order. */
export const assembleHarnessLiveness = (input: {
  readonly sourced: readonly HarnessLivenessSourcedReading[];
  readonly absenceReasons?: Partial<Record<HarnessLivenessKind, HarnessLivenessAbsenceReason>>;
}): HarnessLivenessReport => {
  const readings: HarnessLivenessReading[] = HARNESS_LIVENESS_KINDS.map((kind) => {
    const sourced = input.sourced.find((reading) => reading.kind === kind);
    if (sourced !== undefined) return sourced;
    return {
      kind,
      status: "absent",
      reason: input.absenceReasons?.[kind] ?? "harness-unsupported",
    };
  });
  return { readings };
};

/**
 * Project a neutral report into the watchdog signal shape.
 *
 * Only `session-traffic` has a direct watchdog counterpart (`traffic`); the
 * other kinds project no numeric watchdog key because their units differ. An
 * absent entry therefore yields an absent key, never a zero.
 */
export const harnessLivenessToWatchdogSignals = (
  report: HarnessLivenessReport,
): WatchdogSignals => {
  const signals: { traffic?: number } = {};
  for (const reading of report.readings) {
    if (reading.kind !== "session-traffic") continue;
    if (reading.status !== "sourced") continue;
    signals.traffic = reading.value;
  }
  return signals;
};
