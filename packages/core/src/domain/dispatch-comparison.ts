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
  DISPATCH_CORROBORATION_SUFFICIENCY,
  type DeliveryResultToken,
  type DispatchComparisonClass,
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

/** The independently required corroboration sources for a success claim. */
export const requiredCorroboration = (
  token: DispatchToken,
): readonly DispatchCorroborationSource[] => DISPATCH_CORROBORATION_SUFFICIENCY[token];

/** Injected per-source corroboration facts; absent means unsatisfied. */
export type CorroborationFacts = Partial<
  Readonly<Record<DispatchCorroborationSource, DispatchCorroborationState>>
>;

/**
 * Build the tri-state corroboration record: a non-success token requires no
 * source and satisfies corroboration vacuously; a success claim requires its
 * declared sources and records each of them.
 */
export const buildCorroborationRecord = (input: {
  readonly token: DispatchToken;
  readonly facts?: CorroborationFacts;
}): DispatchCorroborationRecord => {
  const required = requiredCorroboration(input.token);
  const stateFor = (source: DispatchCorroborationSource): DispatchCorroborationState => {
    if (!required.includes(source)) return "not-applicable";
    const fact = input.facts?.[source];
    return fact === undefined ? "unsatisfied" : fact === "not-applicable" ? "unsatisfied" : fact;
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
 * the comparison or by an unsatisfied required corroboration source. A
 * non-success token is never a false-success claim.
 */
export const classifyFalseSuccess = (input: {
  readonly token: DispatchToken;
  readonly comparison: DispatchComparisonRecord;
  readonly corroboration: DispatchCorroborationRecord;
}): boolean => {
  if (requiredCorroboration(input.token).length === 0) return false;
  return input.comparison.outcome === "mismatch" || !corroborationSatisfied(input.corroboration);
};
