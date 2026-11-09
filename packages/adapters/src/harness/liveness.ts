/**
 * The coordinator new-turn mapping over the delivered harness liveness report
 * (GH-241 F-3, DEC-4; AC-F3-1..3, DM-7).
 *
 * A positive `token-delta` OR a positive `session-traffic` reading is a new turn
 * (`newTurn: "positive"`) and therefore sourced progress. A sourced reading of
 * zero or below is `zero`; an absent or unsupported reading is `unknown`, never
 * zero and never stale. The mapping lives only here; the domain consumes the
 * projected facts.
 */
import type {
  CoordinatorProgressState,
  EconomicsSourcedSignalReading,
  HarnessLivenessReport,
} from "@delivery-os/core/contracts";

/** The projected new-turn fact with its injected observation time. */
export type CoordinatorTurnFacts = {
  readonly newTurn: CoordinatorProgressState;
  /** The earliest sourced positive observation (ISO), or `null`. */
  readonly observedAt: string | null;
};

const sourcedValue = (
  report: HarnessLivenessReport,
  kind: "token-delta" | "session-traffic",
): { readonly value: number; readonly observedAt: string } | null => {
  if (kind === "session-traffic") {
    const reading = report.readings.find((entry) => entry.kind === "session-traffic");
    return reading !== undefined && reading.status === "sourced"
      ? { value: reading.value, observedAt: reading.observedAt }
      : null;
  }
  const signal = (report.sourcedSignals ?? []).find(
    (entry: EconomicsSourcedSignalReading) => entry.kind === "token-delta",
  );
  return signal !== undefined && signal.status === "sourced"
    ? { value: signal.value, observedAt: signal.observedAt }
    : null;
};

/**
 * Project a neutral liveness report into the new-turn/progress facts.
 *
 * Positive wins over zero over unknown: if either declared source is sourced
 * and positive the turn is positive; if at least one is sourced and none is
 * positive the turn is zero; if neither source is sourced the turn is unknown.
 */
export const mapCoordinatorNewTurn = (report: HarnessLivenessReport): CoordinatorTurnFacts => {
  const token = sourcedValue(report, "token-delta");
  const traffic = sourcedValue(report, "session-traffic");
  const positives = [token, traffic].filter(
    (entry): entry is { value: number; observedAt: string } =>
      entry !== null && entry.value > 0,
  );
  if (positives.length > 0) {
    const observedAt = positives
      .map((entry) => entry.observedAt)
      .sort((left, right) => left.localeCompare(right))[0] ?? null;
    return { newTurn: "positive", observedAt };
  }
  if (token !== null || traffic !== null) return { newTurn: "zero", observedAt: null };
  return { newTurn: "unknown", observedAt: null };
};
