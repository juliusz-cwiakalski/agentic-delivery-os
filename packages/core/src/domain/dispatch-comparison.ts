/**
 * The one declared per-attempt comparison record (GH-239 F-4; DM-1, DM-2,
 * DM-7; TDR-0015 §5).
 *
 * It is the only family classifier: consumers never re-derive family
 * membership, and a divergence exists if and only if the outcome is `mismatch`.
 * The engine token selects the family through the delivered taxonomy.
 */
import {
  DELIVERY_RESULT_TAXONOMY,
  DELIVERY_RESULT_TOKENS,
  type DeliveryResultToken,
  DISPATCH_CORROBORATION_ARM_SUFFICIENCY,
  DISPATCH_CORROBORATION_SUFFICIENCY,
  type DispatchComparisonClass,
  type DispatchCorroborationArm,
  type DispatchComparisonOutcome,
  type DispatchComparisonReason,
  type DispatchComparisonRecord,
  type DispatchCorroborationRecord,
  type DispatchCorroborationSource,
  type DispatchCorroborationState,
} from "#contracts";

/**
 * Short aliases for the few tokens this module compares. `f` failed, `po`
 * pr-open, `pou` pr-open-unverified, `su` state-unverified.
 */
/** A local alias: keeps parameter and field types short and recognizable. */
type DispatchToken = DeliveryResultToken;

const [, , po, pou, f, , , su] = DELIVERY_RESULT_TOKENS;

/** The family a token belongs to, resolved from the one taxonomy. */
export const dispatchFamilyOf = (
  token: DispatchToken,
): "verify" | "tracker-pr" | "dispatch-session" => {
  const row = DELIVERY_RESULT_TAXONOMY.find((entry) => entry.token === token);
  if (row === undefined) throw new Error("delivery-result token is not in the taxonomy");
  return row.derivationClass;
};

const notApplicable = (reason: DispatchComparisonReason): DispatchComparisonRecord => ({
  class: "not-applicable",
  token: null,
  outcome: "not-applicable",
  reason,
});

/** What the caller knows independently of the engine result. */
export type ComparisonInput =
  | {
      readonly kind: "verify-change";
      readonly engineToken: DeliveryResultToken;
      /** The verify-change ledger outcome for the same reference, read independently. */
      readonly ledgerOutcome: DeliveryResultToken | null;
    }
  | {
      readonly kind: "tracker-truth";
      readonly engineToken: DeliveryResultToken;
      /** The independent tracker truth token for the same reference. */
      readonly trackerToken: DeliveryResultToken;
      readonly urlResolved?: boolean;
    }
  | {
      readonly kind: "not-applicable";
      readonly engineToken: DeliveryResultToken;
      readonly reason: DispatchComparisonReason;
    }
  | {
      readonly kind: "dispatch-derived-failure";
      readonly engineToken: DeliveryResultToken;
      readonly reason: DispatchComparisonReason;
    };

/** The declared shape invariants (AC-F4-6). */
export const isComparisonShapeValid = (record: DispatchComparisonRecord): boolean => {
  const nullToken = record.token === null;
  const notApplicableOutcome = record.outcome === "not-applicable";
  const notApplicableClass = record.class === "not-applicable";
  return (
    nullToken === notApplicableClass &&
    notApplicableOutcome === notApplicableClass &&
    (record.urlResolved === undefined || record.class === "tracker-truth")
  );
};

/** A divergence exists iff the comparison outcome is `mismatch`. */
export const isComparisonDivergence = (record: DispatchComparisonRecord): boolean =>
  record.outcome === "mismatch";

/**
 * Build the one comparison record for one attempt.
 *
 * A cross-family pairing (for example a verify-class token with a tracker
 * truth) is a contract error and throws rather than counting as agreement.
 */
export const buildComparisonRecord = (input: ComparisonInput): DispatchComparisonRecord => {
  const family = dispatchFamilyOf(input.engineToken);

  if (input.kind === "dispatch-derived-failure") {
    if (input.engineToken !== f) {
      throw new Error("a dispatch-derived failure pair must carry the verify-class failed token");
    }
    return notApplicable(input.reason);
  }

  if (input.kind === "not-applicable") {
    return notApplicable(input.reason);
  }

  if (input.kind === "verify-change") {
    if (family !== "verify") {
      throw new Error("a verify-change comparison requires a verify-class token");
    }
    if (input.engineToken === su || input.ledgerOutcome === null) {
      return notApplicable("comparison-source-unavailable");
    }
    const compared = input.engineToken;
    return {
      class: "verify-change",
      token: compared,
      outcome: input.ledgerOutcome === compared ? "match" : "mismatch",
    };
  }

  if (family !== "tracker-pr") {
    throw new Error("a tracker-truth comparison requires a tracker-pr token");
  }
  if (dispatchFamilyOf(input.trackerToken) !== "tracker-pr") {
    throw new Error("the tracker truth must be a tracker-pr token");
  }
  const equivalent =
    input.engineToken === input.trackerToken ||
    (input.engineToken === pou && input.trackerToken === po);
  const outcome: DispatchComparisonOutcome = equivalent ? "match" : "mismatch";
  const compared = input.trackerToken;
  return {
    class: "tracker-truth",
    token: compared,
    outcome,
    ...(input.urlResolved === undefined ? {} : { urlResolved: input.urlResolved }),
  };
};

/** The nine-cell comparison class/outcome cross-check for a call-site guard. */
export const comparisonClassOf = (record: DispatchComparisonRecord): DispatchComparisonClass =>
  record.class;

/**
 * The independently required corroboration sources for a success claim.
 *
 * `arm` is data, not a second classification: the one derivation decides the
 * arm at its two arm-aware branches (GH-347 DEC-6, TDR-0048) and every
 * consumer passes that same value. Absent an arm the token-level requirement
 * applies, so a persisted consumer with no arm (the evidence-window gate) is
 * unchanged.
 */
export const requiredCorroboration = (
  token: DispatchToken,
  arm?: DispatchCorroborationArm,
): readonly DispatchCorroborationSource[] =>
  arm === undefined
    ? DISPATCH_CORROBORATION_SUFFICIENCY[token]
    : DISPATCH_CORROBORATION_ARM_SUFFICIENCY[arm];

/**
 * One injected per-source corroboration fact (AC-F4-4).
 *
 * `satisfied` and `unsatisfied` are readable facts (`unsatisfied` is a genuine
 * contradiction); `unreadable` is the explicit unevaluable marker for a source
 * whose read failed. An unreadable source still blocks corroboration but is
 * never recorded as a false-success contradiction.
 */
export type CorroborationFact = DispatchCorroborationState | "unreadable";

/** Injected per-source corroboration facts; absent means unsatisfied. */
export type CorroborationFacts = Partial<
  Readonly<Record<DispatchCorroborationSource, CorroborationFact>>
>;

/** The sources a fact set marks unevaluable (its read failed). */
export const unreadableCorroborationSources = (
  facts: CorroborationFacts,
): readonly DispatchCorroborationSource[] =>
  (["pm-notes", "tracker", "ci"] as const).filter((source) => facts[source] === "unreadable");

/**
 * Build the tri-state corroboration record: a non-success token requires no
 * source and satisfies corroboration vacuously; a success claim requires its
 * declared sources and records each of them. An `unreadable` fact is recorded
 * as `unsatisfied` — the claim is not corroborated — while the caller keeps the
 * unreadable marker for false-success classification.
 */
export const buildCorroborationRecord = (input: {
  readonly token: DispatchToken;
  readonly facts?: CorroborationFacts;
  readonly arm?: DispatchCorroborationArm;
}): DispatchCorroborationRecord => {
  const required = requiredCorroboration(input.token, input.arm);
  const stateFor = (source: DispatchCorroborationSource): DispatchCorroborationState => {
    if (!required.includes(source)) return "not-applicable";
    const fact = input.facts?.[source];
    if (fact === undefined || fact === "not-applicable" || fact === "unreadable") {
      return "unsatisfied";
    }
    return fact;
  };
  return { pmNotes: stateFor("pm-notes"), tracker: stateFor("tracker"), ci: stateFor("ci") };
};

/** Whether every required corroboration source is satisfied. */
export const corroborationSatisfied = (record: DispatchCorroborationRecord): boolean =>
  record.pmNotes !== "unsatisfied" &&
  record.tracker !== "unsatisfied" &&
  record.ci !== "unsatisfied";

/**
 * Classify a false-success incident: an engine success claim contradicted by
 * the comparison or by a readable corroboration source that contradicts it
 * (AC-F4-4).
 *
 * A source whose read failed is unevaluable, not contradicted: it leaves the
 * claim uncorroborated (so eligibility is blocked) but never resets the evidence
 * window. Absent `unreadable`, every unsatisfied required source is treated as a
 * readable contradiction, which is the historical call-site contract.
 */
export const classifyFalseSuccess = (input: {
  readonly token: DispatchToken;
  readonly comparison: DispatchComparisonRecord;
  readonly corroboration: DispatchCorroborationRecord;
  readonly unreadable?: readonly DispatchCorroborationSource[];
  readonly arm?: DispatchCorroborationArm;
}): boolean => {
  const required = requiredCorroboration(input.token, input.arm);
  if (required.length === 0) return false;
  if (input.comparison.outcome === "mismatch") return true;
  const unreadable = input.unreadable ?? [];
  const fieldOf = (source: DispatchCorroborationSource): keyof DispatchCorroborationRecord =>
    source === "pm-notes" ? "pmNotes" : source;
  return required.some(
    (source) =>
      !unreadable.includes(source) && input.corroboration[fieldOf(source)] === "unsatisfied",
  );
};

/**
 * The TOKEN-LEVEL corroboration requirement, for a persisted consumer that has
 * no arm to consult (GH-347 phase 4 obligation 4.5): the evidence-window gate
 * reads an attempt record, which carries no arm, and adding one would be an
 * attempt-schema change (NFR-3). The window therefore stays token-level by
 * decision; this named accessor is the one place it reads the requirement.
 */
export const windowCorroborationRequirement = (
  token: DispatchToken,
): readonly DispatchCorroborationSource[] => requiredCorroboration(token);
