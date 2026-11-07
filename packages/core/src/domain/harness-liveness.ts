/**
 * Harness-agnostic liveness assembly (GH-233 F-2, DEC-9, NFR-6; GH-235 D-3).
 *
 * The neutral report carries exactly one entry per closed liveness kind, in
 * closed order. A sourced entry carries the injected value and observation time;
 * an absent entry carries a closed reason and never a zero, a `false`, an empty
 * string, or an invented timestamp. GH-235 adds an additive sourced-signal
 * carriage beside the unchanged exact-three readings (DEC-8), and the
 * consumer-side watchdog mapping projects all three declared signal keys,
 * yielding absent keys so an unsourced signal stays unknown.
 */
import {
  ECONOMICS_SOURCED_SIGNAL_KINDS,
  HARNESS_LIVENESS_KINDS,
  type EconomicsSourcedSignalAbsenceReason,
  type EconomicsSourcedSignalKind,
  type EconomicsSourcedSignalReading,
  type HarnessLivenessAbsenceReason,
  type HarnessLivenessFacts,
  type HarnessLivenessKind,
  type HarnessLivenessReading,
  type HarnessLivenessReport,
  type HarnessLivenessSourcedReading,
  type WatchdogSignalSource,
  type WatchdogSignals,
} from "#contracts";

/** Assemble the neutral report in the closed kind order (GH-233), with D-3 signals. */
export const assembleHarnessLiveness = (input: {
  readonly sourced: readonly HarnessLivenessSourcedReading[];
  readonly absenceReasons?: Partial<Record<HarnessLivenessKind, HarnessLivenessAbsenceReason>>;
  readonly sourcedSignalFacts?: readonly EconomicsSourcedSignalReading[];
  readonly sourcedSignalAbsenceReasons?: Partial<
    Record<EconomicsSourcedSignalKind, EconomicsSourcedSignalAbsenceReason>
  >;
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
  const facts = input.sourcedSignalFacts;
  if (facts === undefined) return { readings };
  const sourcedSignals: EconomicsSourcedSignalReading[] = ECONOMICS_SOURCED_SIGNAL_KINDS.map(
    (kind) => {
      const sourced = facts.find((fact) => fact.kind === kind && fact.status === "sourced");
      if (sourced !== undefined) return sourced;
      return {
        kind,
        status: "absent",
        reason: input.sourcedSignalAbsenceReasons?.[kind] ?? "harness-unsupported",
      };
    },
  );
  return { readings, sourcedSignals };
};

/**
 * Project a neutral report into the watchdog signal shape.
 *
 * `session-traffic` projects to `traffic`; the additive sourced signals project
 * heartbeat age to `heartbeatAgeMs` (ms) and token delta to `tokenDelta`. An
 * absent entry yields an absent key, never a zero. No CPU kind exists to
 * project.
 */
export const harnessLivenessToWatchdogSignals = (
  report: HarnessLivenessReport,
): WatchdogSignals => {
  const signals: { heartbeatAgeMs?: number; tokenDelta?: number; traffic?: number } = {};
  for (const reading of report.readings) {
    if (reading.kind !== "session-traffic") continue;
    if (reading.status !== "sourced") continue;
    signals.traffic = reading.value;
  }
  for (const sourced of report.sourcedSignals ?? []) {
    if (sourced.status !== "sourced") continue;
    if (sourced.kind === "heartbeat-age") signals.heartbeatAgeMs = sourced.value;
    else if (sourced.kind === "token-delta") signals.tokenDelta = sourced.value;
  }
  return signals;
};

/**
 * Compose a watchdog signal source over injected adapter facts: assemble the
 * neutral report, then project it. No second store or file read occurs here.
 */
export const createSourcedWatchdogSignalSource = (
  readFacts: (lane: string) => HarnessLivenessFacts | undefined,
): WatchdogSignalSource => {
  return (lane) => {
    const facts = readFacts(lane);
    if (facts === undefined) return undefined;
    return harnessLivenessToWatchdogSignals(
      assembleHarnessLiveness({
        sourced: facts.readings ?? [],
        absenceReasons: {
          "session-traffic": "not-observed",
          "worktree-activity": "harness-unsupported",
          process: "not-observed",
        },
        sourcedSignalFacts: facts.sourcedSignals ?? [],
        sourcedSignalAbsenceReasons: {
          "heartbeat-age": "not-observed",
          "token-delta": "not-observed",
        },
      }),
    );
  };
};

/** Compose a watchdog signal source over an injected neutral liveness read. */
export const createHarnessLivenessSignalSource = (
  readReport: (lane: string) => HarnessLivenessReport | undefined,
): WatchdogSignalSource => {
  return (lane) => {
    const report = readReport(lane);
    return report === undefined ? undefined : harnessLivenessToWatchdogSignals(report);
  };
};
