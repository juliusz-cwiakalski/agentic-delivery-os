/**
 * The pure dual-run handover gate (GH-239 F-5, F-6; DM-6, DM-7; TDR-0015).
 *
 * One declared predicate home: fold the bounded attempt, divergence, and
 * handover evidence into the window, then evaluate the four-condition
 * conjunction. Evidence-class counting is one rule with one repository-scope
 * parameter; the floor-only "whichever comes first" binds only the floor;
 * coverage is exposure only; the incident lower bound is exclusive.
 */
import {
  DELIVERY_RESULT_TOKENS,
  DISPATCH_FLOOR_CONSECUTIVE_DATES,
  DISPATCH_FLOOR_DISPATCHES,
  DISPATCH_MAX_DIVERGENCE_IDS,
  type DeliveryResultToken,
  type DispatchAttemptRecord,
  type DispatchDivergenceBlock,
  type DispatchDivergenceRecord,
  type DispatchEvidenceClass,
  type DispatchExcludedEvidenceClass,
  type DispatchGateVerdict,
  type DispatchHandoverConditionsSnapshot,
  type DispatchSummaryData,
  type DispatchUnmetCondition,
  type DispatchWindowStartReason,
} from "#contracts";
import { corroborationSatisfied, requiredCorroboration } from "./dispatch-comparison.js";

/** The two repository scopes the counting rule distinguishes. */
export type DispatchRepositoryScope = "production" | "controlled";

/** The two declared scope kinds and the class each one counts. */
export const COUNTED_EVIDENCE_CLASS = {
  production: "pilot",
  controlled: "controlled-proof",
} as const satisfies Readonly<Record<DispatchRepositoryScope, DispatchEvidenceClass>>;

/** The declared counting rule: one scope parameter, one counted class. */
export const countedEvidenceClass = (scope: DispatchRepositoryScope): DispatchEvidenceClass =>
  COUNTED_EVIDENCE_CLASS[scope];

const utcDate = (recordedAt: string): string => recordedAt.slice(0, 10);

export const longestConsecutiveRun = (dates: readonly string[]): number => {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates)].sort();
  let best = 1;
  let current = 1;
  for (let index = 1; index < unique.length; index += 1) {
    const previous = Date.parse(`${unique[index - 1]}T00:00:00Z`);
    const next = Date.parse(`${unique[index]}T00:00:00Z`);
    if (next - previous === 86_400_000) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }
  return best;
};

/**
 * The one exact divergence-count computation (GH-289 DEC-15, TDR-0023 C-5).
 *
 * Folds latest-per-identifier over the records of ONE repository, reports the
 * exact open count, and returns the first at most 20 open identifiers with
 * `idsTruncated` true exactly when identifiers were omitted. The count never
 * comes from the truncated list's length, so a 25-open repository reports 25.
 */
export const summarizeRepositoryDivergences = (
  records: readonly DispatchDivergenceRecord[],
  repository: string,
): DispatchDivergenceBlock => {
  const latest = new Map<string, DispatchDivergenceRecord>();
  for (const record of records) {
    if (record.repository !== repository) continue;
    latest.set(record.divergenceId, record);
  }
  const folded = [...latest.values()];
  const openIds = folded
    .filter((record) => record.state === "open")
    .map((record) => record.divergenceId);
  const unresolvedIds = openIds.slice(0, DISPATCH_MAX_DIVERGENCE_IDS);
  return {
    reported: folded.length,
    resolved: folded.length - openIds.length,
    unresolved: openIds.length,
    unresolvedIds,
    idsTruncated: openIds.length > unresolvedIds.length,
  };
};

/** The folded evidence window (DM-6). */
export type DispatchEvidenceWindow = {
  readonly repository: string;
  readonly countedEvidenceClass: DispatchEvidenceClass;
  readonly windowStart: string;
  readonly windowStartReason: DispatchWindowStartReason;
  readonly windowEnd: string;
  readonly counted: readonly DispatchAttemptRecord[];
  readonly countedInWindow: readonly DispatchAttemptRecord[];
  readonly excludedEvidenceClasses: readonly DispatchExcludedEvidenceClass[];
  readonly incidents: number;
  readonly incidentAt?: string;
  readonly dayCount: number;
  readonly consecutiveDates: number;
  readonly divergences: DispatchDivergenceBlock;
  readonly coverage: {
    readonly present: readonly DeliveryResultToken[];
    readonly missing: readonly DeliveryResultToken[];
  };
  readonly corroboration: {
    readonly satisfied: number;
    readonly unsatisfied: number;
    readonly unsatisfiedRefs: readonly string[];
  };
  readonly floorMet: boolean;
  readonly truncated?: { readonly bound: number; readonly omittedRecords: number };
  readonly unverifiable?: string;
};

/** The gate verdict and the named unmet conditions. */
export type DispatchGateEvaluation = {
  readonly verdict: DispatchGateVerdict;
  readonly eligibility: boolean;
  readonly unmetConditions: readonly DispatchUnmetCondition[];
};

const classCounts = (
  attempts: readonly DispatchAttemptRecord[],
  repository: string,
  countedClass: DispatchEvidenceClass,
): readonly DispatchExcludedEvidenceClass[] => {
  const counts = new Map<DispatchEvidenceClass, number>();
  for (const attempt of attempts) {
    if (attempt.repository !== repository) continue;
    if (attempt.evidenceClass === countedClass) continue;
    counts.set(attempt.evidenceClass, (counts.get(attempt.evidenceClass) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([evidenceClass, count]) => ({ evidenceClass, count }))
    .sort((left, right) => (left.evidenceClass < right.evidenceClass ? -1 : 1));
};

/**
 * Fold the evidence into the window.
 *
 * When a false-success incident exists the lower bound is its recorded
 * timestamp, EXCLUSIVE, so the resetting incident and any same-instant record
 * sit outside the evaluated window; otherwise the bound is the first counted
 * dispatch, inclusive. An unreadable or torn stream is reported unverifiable and
 * never fabricates zeros.
 */
export const foldEvidenceWindow = (input: {
  readonly repository: string;
  readonly scope: DispatchRepositoryScope;
  readonly attempts: readonly DispatchAttemptRecord[];
  readonly divergences: readonly DispatchDivergenceRecord[];
  readonly windowEnd: string;
  readonly truncated?: { readonly bound: number; readonly omittedRecords: number };
  readonly unreadable?: string;
}): DispatchEvidenceWindow => {
  const countedClass = countedEvidenceClass(input.scope);
  const excludedEvidenceClasses = classCounts(input.attempts, input.repository, countedClass);
  const counted = input.attempts.filter(
    (attempt) => attempt.repository === input.repository && attempt.evidenceClass === countedClass,
  );

  const divergences = summarizeRepositoryDivergences(input.divergences, input.repository);

  const base = {
    repository: input.repository,
    countedEvidenceClass: countedClass,
    windowEnd: input.windowEnd,
    counted,
    excludedEvidenceClasses,
    divergences,
    ...(input.truncated === undefined ? {} : { truncated: input.truncated }),
  };

  if (input.unreadable !== undefined) {
    return {
      ...base,
      windowStart: "",
      windowStartReason: "no-counted-dispatch",
      countedInWindow: [],
      incidents: 0,
      dayCount: 0,
      consecutiveDates: 0,
      coverage: { present: [], missing: [...DELIVERY_RESULT_TOKENS] },
      corroboration: { satisfied: 0, unsatisfied: 0, unsatisfiedRefs: [] },
      floorMet: false,
      unverifiable: input.unreadable,
    };
  }

  const incidentsInHistory = counted.filter((attempt) => attempt.falseSuccess);
  const latestIncident = incidentsInHistory[incidentsInHistory.length - 1];
  const incidentAt = latestIncident?.recordedAt;
  const incidentTime = incidentAt === undefined ? undefined : Date.parse(incidentAt);

  const windowStart = (() => {
    if (incidentAt !== undefined) return incidentAt;
    return counted[0]?.recordedAt ?? "";
  })();
  const windowStartReason: DispatchWindowStartReason =
    counted.length === 0
      ? "no-counted-dispatch"
      : incidentAt !== undefined
        ? "false-success-incident-reset"
        : "first-counted-dispatch";

  const countedInWindow =
    incidentTime === undefined
      ? counted
      : counted.filter((attempt) => Date.parse(attempt.recordedAt) > incidentTime);

  const dates = countedInWindow.map((attempt) => utcDate(attempt.recordedAt));
  const consecutiveDates = longestConsecutiveRun(dates);
  const dayCount = new Set(dates).size;

  const presentSet = new Set<DeliveryResultToken>(countedInWindow.map((attempt) => attempt.token));
  const present = DELIVERY_RESULT_TOKENS.filter((token) => presentSet.has(token));
  const missing = DELIVERY_RESULT_TOKENS.filter((token) => !presentSet.has(token));

  const successClaims = countedInWindow.filter(
    (attempt) => requiredCorroboration(attempt.token).length > 0,
  );
  const satisfied = successClaims.filter((attempt) =>
    corroborationSatisfied(attempt.corroboration),
  );
  const unsatisfied = successClaims.filter(
    (attempt) => !corroborationSatisfied(attempt.corroboration),
  );

  const floorMet =
    countedInWindow.length >= DISPATCH_FLOOR_DISPATCHES ||
    consecutiveDates >= DISPATCH_FLOOR_CONSECUTIVE_DATES;

  return {
    ...base,
    windowStart,
    windowStartReason,
    countedInWindow,
    incidents: incidentsInHistory.length,
    ...(incidentAt === undefined ? {} : { incidentAt }),
    dayCount,
    consecutiveDates,
    coverage: { present, missing },
    corroboration: {
      satisfied: satisfied.length,
      unsatisfied: unsatisfied.length,
      unsatisfiedRefs: unsatisfied.map((attempt) => attempt.attemptId),
    },
    floorMet,
  };
};

/** Evaluate the four-condition conjunction over a folded window. */
export const evaluateHandoverGate = (window: DispatchEvidenceWindow): DispatchGateEvaluation => {
  if (window.unverifiable !== undefined) {
    return { verdict: "unverifiable", eligibility: false, unmetConditions: [] };
  }
  const inWindowIncidents = window.countedInWindow.filter((attempt) => attempt.falseSuccess).length;
  const unmet: DispatchUnmetCondition[] = [];
  if (inWindowIncidents > 0 || window.divergences.unresolved > 0) {
    unmet.push({
      condition: "truth",
      detail: `${inWindowIncidents} in-window incidents, ${window.divergences.unresolved} unresolved divergences`,
    });
  }
  if (window.coverage.missing.length > 0) {
    unmet.push({ condition: "coverage", detail: window.coverage.missing.join(",") });
  }
  if (!window.floorMet) {
    unmet.push({
      condition: "floor",
      detail: `${window.countedInWindow.length}<${DISPATCH_FLOOR_DISPATCHES} and ${window.consecutiveDates}<${DISPATCH_FLOOR_CONSECUTIVE_DATES}`,
    });
  }
  if (window.corroboration.unsatisfied > 0) {
    unmet.push({
      condition: "corroboration",
      detail: window.corroboration.unsatisfiedRefs.join(","),
    });
  }
  if (window.truncated !== undefined) {
    return { verdict: "unverifiable", eligibility: false, unmetConditions: unmet };
  }
  return {
    verdict: unmet.length === 0 ? "eligible" : "ineligible",
    eligibility: unmet.length === 0,
    unmetConditions: unmet,
  };
};

/** Build the DM-6 summary data from the folded window and verdict. */
export const toSummaryData = (
  window: DispatchEvidenceWindow,
  evaluation: DispatchGateEvaluation,
): DispatchSummaryData => ({
  repository: window.repository,
  windowStart: window.windowStart,
  windowStartReason: window.windowStartReason,
  windowEnd: window.windowEnd,
  dayCount: window.dayCount,
  countedDeliveries: window.countedInWindow.length,
  countedEvidenceClass: window.countedEvidenceClass,
  excludedEvidenceClasses: window.excludedEvidenceClasses,
  incidents: window.incidents,
  divergences: window.divergences,
  coverage: window.coverage,
  corroboration: {
    satisfied: window.corroboration.satisfied,
    unsatisfied: window.corroboration.unsatisfied,
    unsatisfiedRefs: window.corroboration.unsatisfiedRefs,
  },
  eligibility: evaluation.eligibility,
  verdict: evaluation.verdict,
  unmetConditions: evaluation.unmetConditions,
  floor: {
    met: window.floorMet,
    countedDeliveries: window.countedInWindow.length,
    consecutiveDates: window.consecutiveDates,
    onlyFloor: true,
  },
  ...(window.truncated === undefined ? {} : { truncation: window.truncated }),
});

/** Build the handover conditions snapshot from the folded window. */
export const handoverConditionsSnapshot = (
  window: DispatchEvidenceWindow,
  evaluation: DispatchGateEvaluation,
): DispatchHandoverConditionsSnapshot => ({
  verdict: evaluation.verdict,
  windowStart: window.windowStart,
  windowStartReason: window.windowStartReason,
  countedDeliveries: window.countedInWindow.length,
  coveragePresent: window.coverage.present,
  coverageMissing: window.coverage.missing,
  incidents: window.incidents,
  unresolvedDivergences: window.divergences.unresolved,
  floorMet: window.floorMet,
  corroborationSatisfied: window.corroboration.satisfied,
});
