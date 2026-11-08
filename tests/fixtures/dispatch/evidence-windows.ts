/**
 * Deterministic evidence-window fixtures (GH-239 §6.3): floor variants, the
 * incident-exclusive window, same-instant ties, post-incident recovery, the
 * positive all-eleven fixture, one-class-missing mutants, uncorroborated
 * success claims, gapped dates, and mixed evidence classes per scope.
 */
import {
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultToken,
  type DispatchAttemptRecord,
  type DispatchEvidenceClass,
} from "../../../packages/core/src/contracts/index";
import { evaluateHandoverGate, foldEvidenceWindow } from "../../../packages/core/src/domain/dispatch-gate";
import { comparisonForToken, corroborationFor } from "./ledger";

const START = Date.UTC(2026, 10, 1, 10, 0, 0);

export const dayAt = (day: number, hour = 10): string =>
  new Date(START + day * 86_400_000 + (hour - 10) * 3_600_000).toISOString();

/** A local short alias: keeps fixture signatures recognizable. */
type DispatchToken = DeliveryResultToken;

export type AttemptSpec = {
  readonly token: DispatchToken;
  readonly id: string;
  readonly day: number;
  readonly repository?: string;
  readonly evidenceClass?: DispatchEvidenceClass;
  readonly falseSuccess?: boolean;
  readonly corroboration?: DispatchAttemptRecord["corroboration"];
  readonly hour?: number;
};

export const buildAttempts = (specs: readonly AttemptSpec[]): DispatchAttemptRecord[] =>
  specs.map((spec) => ({
    schema: "delivery.dispatch.attempt.v1",
    attemptId: spec.id,
    repository: spec.repository ?? "github.com/owner/repo",
    ref: "GH-239",
    harness: "opencode",
    evidenceClass: spec.evidenceClass ?? "pilot",
    startedAt: dayAt(spec.day, spec.hour),
    finishedAt: dayAt(spec.day, spec.hour),
    handoverState: "dual-run",
    outcome: "completed",
    token: spec.token,
    comparison: comparisonForToken(spec.token, { urlResolved: spec.token !== "pr-open-unverified" }),
    falseSuccess: spec.falseSuccess ?? false,
    corroboration:
      spec.corroboration ??
      corroborationFor(spec.token, {
        "pm-notes": "satisfied",
        tracker: "satisfied",
        ci: "satisfied",
      }),
    evidenceRefs: [`attempt:${spec.id}`],
    recordedAt: dayAt(spec.day, spec.hour),
  }));

/** One attempt per token across the first seven days. */
const allElevenSpecs = (
  options: {
    readonly startDay?: number;
    readonly repository?: string;
    readonly evidenceClass?: DispatchEvidenceClass;
    readonly prefix?: string;
  } = {},
): AttemptSpec[] =>
  DELIVERY_RESULT_TOKENS.map((token, index) => ({
    token,
    id: `${options.prefix ?? "all11"}-${index}`,
    day: (options.startDay ?? 0) + (index % 7),
    ...(options.repository === undefined ? {} : { repository: options.repository }),
    ...(options.evidenceClass === undefined ? {} : { evidenceClass: options.evidenceClass }),
  }));

/** The positive fixture: all eleven classes, floor met, corroborated. */
export const eligibleSpecs = (
  options: {
    readonly startDay?: number;
    readonly repository?: string;
    readonly evidenceClass?: DispatchEvidenceClass;
    readonly prefix?: string;
  } = {},
): AttemptSpec[] => {
  const specs = allElevenSpecs(options);
  // Pad to the 20-dispatch floor with corroborated pr-open deliveries.
  const startDay = options.startDay ?? 0;
  let padding = specs.length;
  while (padding < 20) {
    specs.push({
      token: "pr-open",
      id: `${options.prefix ?? "pad"}-${padding}`,
      day: startDay + (padding % 7),
      ...(options.repository === undefined ? {} : { repository: options.repository }),
      ...(options.evidenceClass === undefined ? {} : { evidenceClass: options.evidenceClass }),
    });
    padding += 1;
  }
  return specs;
};

/** The floor variant: exactly 20 dispatches across six dates. */
export const twentyOnSixDates = (options: { readonly prefix?: string } = {}): AttemptSpec[] => {
  const specs = allElevenSpecs({ prefix: options.prefix });
  while (specs.length < 20) {
    specs.push({ token: "pr-open", id: `${options.prefix ?? "twenty"}-${specs.length}`, day: 0 });
  }
  return specs.map((spec, index) => ({ ...spec, day: index % 6 }));
};

/** The floor variant: 14 dispatches on seven consecutive dates. */
export const fourteenOnSevenDates = (): AttemptSpec[] => {
  const specs = allElevenSpecs({ prefix: "fourteen" });
  let day = 0;
  while (specs.length < 14) {
    specs.push({ token: "pr-open", id: `fourteen-${specs.length}`, day: day % 7 });
    day += 1;
  }
  return specs;
};

/** Six consecutive dates, a one-day gap, then a seventh date (14 dispatches). */
export const gappedDates = (): AttemptSpec[] => {
  const days = [0, 1, 2, 3, 4, 5, 7, 7];
  const specs = allElevenSpecs({ prefix: "gapped" });
  while (specs.length < 14) {
    specs.push({ token: "pr-open", id: `gapped-${specs.length}`, day: 0 });
  }
  return specs.map((spec, index) => ({ ...spec, day: days[index % days.length] as number }));
};

/** One class removed from the positive fixture. */
export const missingClassSpecs = (
  token: DispatchToken,
  options: { readonly prefix?: string } = {},
): AttemptSpec[] =>
  eligibleSpecs({ prefix: options.prefix }).filter((spec) => spec.token !== token);

/** One success claim made uncorroborated. */
export const uncorroboratedSpecs = (): AttemptSpec[] =>
  eligibleSpecs({ prefix: "uncorroborated" }).map((spec, index) =>
    index === 0
      ? {
          ...spec,
          corroboration: corroborationFor("pr-open", { tracker: "unsatisfied" }),
        }
      : spec,
  );

/** A false-success incident at T with pre-incident and post-incident evidence. */
export const incidentSpecs = (): {
  readonly before: AttemptSpec[];
  readonly incident: AttemptSpec;
  readonly tie: AttemptSpec;
  readonly recovery: AttemptSpec[];
  readonly incidentAt: string;
  readonly tieAt: string;
} => {
  const incidentAt = dayAt(3);
  const tieAt = incidentAt;
  const before: AttemptSpec[] = Array.from({ length: 20 }, (_, index) => ({
    token: "pr-open",
    id: `pre-${index}`,
    day: 0,
  }));
  const recovery = eligibleSpecs({ startDay: 4, prefix: "recovery" });
  return {
    before,
    incident: {
      token: "pr-open",
      id: "incident",
      day: 3,
      falseSuccess: true,
    },
    tie: { token: "failed", id: "tie", day: 3 },
    recovery,
    incidentAt,
    tieAt,
  };
};

/** A resolved-divergence resource set that must not reset the window. */
export const resolvedDivergenceSet = (): AttemptSpec[] => eligibleSpecs({ prefix: "resolved" });

/** Mixed evidence classes for one repository scope. */
export const mixedClassSpecs = (options: {
  readonly repository?: string;
  readonly classes: readonly DispatchEvidenceClass[];
}): AttemptSpec[] =>
  allElevenSpecs({ prefix: "mixed", ...(options.repository === undefined ? {} : { repository: options.repository }) }).map(
    (spec, index) => ({
      ...spec,
      evidenceClass: options.classes[index % options.classes.length] as DispatchEvidenceClass,
    }),
  );

/** Fold and evaluate one spec set through the real gate. */
export const evaluateSpecs = (
  specs: readonly AttemptSpec[],
  options: {
    readonly scope?: "production" | "controlled";
    readonly repository?: string;
    readonly divergences?: readonly import("../../../packages/core/src/contracts/index").DispatchDivergenceRecord[];
    readonly truncated?: { readonly bound: number; readonly omittedRecords: number };
  } = {},
) => {
  const repository = options.repository ?? "github.com/owner/repo";
  const window = foldEvidenceWindow({
    repository,
    scope: options.scope ?? "production",
    attempts: buildAttempts(specs),
    divergences: options.divergences ?? [],
    windowEnd: dayAt(30),
    ...(options.truncated === undefined ? {} : { truncated: options.truncated }),
  });
  return { window, evaluation: evaluateHandoverGate(window) };
};
