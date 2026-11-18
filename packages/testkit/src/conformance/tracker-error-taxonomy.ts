/**
 * Tracker error taxonomy (GH-339 F-2, DM-3; TDR-0037).
 *
 * Data plus one pure decision function. The four class ids are testkit-local
 * comparison labels: they resolve to delivered failure identities and are never
 * emitted as a failure `code`, an error-table row, a domain kind, a projection
 * class, or an exit-code case. No provider name, environment read, clock, or
 * randomness appears here.
 */

/** The four closed tracker error class ids (TDR-0037 §1). */
export const TRACKER_ERROR_CLASS_IDS = [
  "tracker.capability.unsupported",
  "tracker.auth.rejected",
  "tracker.transport.failed",
  "tracker.payload.invalid",
] as const;

export type TrackerErrorClassId = (typeof TRACKER_ERROR_CLASS_IDS)[number];

/** Named literals: the class ids live in this module only (TDR-0037 C-1). */
export const TRACKER_CAPABILITY_UNSUPPORTED_CLASS = "tracker.capability.unsupported" as const;
export const TRACKER_AUTH_REJECTED_CLASS = "tracker.auth.rejected" as const;
export const TRACKER_TRANSPORT_FAILED_CLASS = "tracker.transport.failed" as const;
export const TRACKER_PAYLOAD_INVALID_CLASS = "tracker.payload.invalid" as const;

/** The delivered identity a class resolves to. */
export type TrackerDeliveredIdentity = "capability-gap" | "provider.payload.invalid";

/** The structured discriminator that decides a class (never prose). */
export type TrackerStructuredDiscriminator =
  | "operation-membership"
  | "status-401-or-403"
  | "status-absent"
  | "status-other-or-refusal-or-undecodable";

/** The six closed trap families (TDR-0037 §3). */
export const TRACKER_TRAP_FAMILIES = [
  "auth-shape",
  "transport-failure",
  "rate-limit",
  "payload-shape",
  "workflow-state-mismatch",
  "pagination-truncation",
] as const;

export type TrackerTrapFamily = (typeof TRACKER_TRAP_FAMILIES)[number];

/** What one family proves. */
export type TrackerFamilyOutcome =
  | { readonly proves: TrackerErrorClassId; readonly assertion: "class" }
  | { readonly proves: "bounded-observation"; readonly assertion: "bounded-observation" };

/** The declared class table; each class resolves to exactly one identity. */
export type TrackerErrorClass = {
  readonly id: TrackerErrorClassId;
  readonly deliveredIdentity: TrackerDeliveredIdentity;
  readonly discriminator: TrackerStructuredDiscriminator;
  /** Empty for the structurally proven capability class. */
  readonly provingFamilies: readonly TrackerTrapFamily[];
  readonly provingMechanism: "structural" | "family";
};

export const TRACKER_ERROR_TAXONOMY: readonly TrackerErrorClass[] = [
  {
    id: "tracker.capability.unsupported",
    deliveredIdentity: "capability-gap",
    discriminator: "operation-membership",
    provingFamilies: [],
    provingMechanism: "structural",
  },
  {
    id: "tracker.auth.rejected",
    deliveredIdentity: "provider.payload.invalid",
    discriminator: "status-401-or-403",
    provingFamilies: ["auth-shape"],
    provingMechanism: "family",
  },
  {
    id: "tracker.transport.failed",
    deliveredIdentity: "provider.payload.invalid",
    discriminator: "status-absent",
    provingFamilies: ["transport-failure"],
    provingMechanism: "family",
  },
  {
    id: "tracker.payload.invalid",
    deliveredIdentity: "provider.payload.invalid",
    discriminator: "status-other-or-refusal-or-undecodable",
    provingFamilies: ["rate-limit", "payload-shape", "workflow-state-mismatch"],
    provingMechanism: "family",
  },
];

/** The declared outcome of each family; `pagination-truncation` is not a class. */
export const TRACKER_FAMILY_OUTCOMES: Readonly<Record<TrackerTrapFamily, TrackerFamilyOutcome>> = {
  "auth-shape": { proves: "tracker.auth.rejected", assertion: "class" },
  "transport-failure": { proves: "tracker.transport.failed", assertion: "class" },
  "rate-limit": { proves: "tracker.payload.invalid", assertion: "class" },
  "payload-shape": { proves: "tracker.payload.invalid", assertion: "class" },
  "workflow-state-mismatch": { proves: "tracker.payload.invalid", assertion: "class" },
  "pagination-truncation": { proves: "bounded-observation", assertion: "bounded-observation" },
};

/** The five observable outcomes of the total decision rule (TDR-0037 §2). */
export type TrackerObservableOutcome =
  | { readonly kind: "capability-gap" }
  | { readonly kind: "adapter-refusal" }
  | { readonly kind: "no-response" }
  | { readonly kind: "read-not-found" }
  | {
      readonly kind: "status";
      readonly httpStatus: number;
      readonly operationKind: "read" | "write";
      readonly undecodable?: boolean;
    }
  | { readonly kind: "decoded-success" };

/** The total decision result: a class, a decoded success, or an absence outside. */
export type TrackerClassification = TrackerErrorClassId | "outside-taxonomy" | "success";

/**
 * Classify one observable outcome, in the declared order.
 *
 * Order is binding: capability gap, adapter refusal, no response, a read's 404,
 * an undecodable response, then the status-bearing classes, then any other
 * status. An undecodable body decides the payload class even when the transport
 * carried a 401/403, because the adapter had nothing to decode. The function
 * reads no prose and branches on no provider.
 */
export const classifyTrackerOutcome = (
  outcome: TrackerObservableOutcome,
): TrackerClassification => {
  if (outcome.kind === "capability-gap") return "tracker.capability.unsupported";
  if (outcome.kind === "adapter-refusal") return "tracker.payload.invalid";
  if (outcome.kind === "no-response") return "tracker.transport.failed";
  if (outcome.kind === "read-not-found") return "outside-taxonomy";
  if (outcome.kind === "decoded-success") return "success";
  if (outcome.operationKind === "read" && outcome.httpStatus === 404) return "outside-taxonomy";
  if (outcome.undecodable === true) return "tracker.payload.invalid";
  if (outcome.httpStatus === 401 || outcome.httpStatus === 403) return "tracker.auth.rejected";
  return "tracker.payload.invalid";
};

/** The structured failure shape the delivered client results expose. */
export type TrackerStructuredFailure = {
  readonly ok: false;
  readonly code: string;
  readonly httpStatus?: number;
};

/**
 * Resolve a delivered read/write failure to the total decision input.
 *
 * `adapterRefusal` is supplied by the caller when the failure was raised before
 * dispatch (zero provider requests); a credential-resolution failure is
 * reported outside the taxonomy because its code is neither a payload nor a
 * not-found identity.
 */
export const classifyTrackerFailure = (
  failure: TrackerStructuredFailure,
  context: { readonly operationKind: "read" | "write"; readonly adapterRefusal?: boolean },
): TrackerClassification => {
  if (failure.code === "config.credential.missing") return "outside-taxonomy";
  if (context.adapterRefusal === true) return "tracker.payload.invalid";
  if (failure.code === "provider.not-found") {
    return context.operationKind === "read" ? "outside-taxonomy" : "tracker.payload.invalid";
  }
  if (failure.code !== "provider.payload.invalid") return "outside-taxonomy";
  if (!Object.hasOwn(failure, "httpStatus") || failure.httpStatus === undefined) {
    return "tracker.transport.failed";
  }
  return classifyTrackerOutcome({
    kind: "status",
    httpStatus: failure.httpStatus,
    operationKind: context.operationKind,
  });
};

/** True when a failure owns an `httpStatus` property (absence, not `undefined`). */
export const ownsHttpStatus = (failure: TrackerStructuredFailure): boolean =>
  Object.hasOwn(failure, "httpStatus") && failure.httpStatus !== undefined;
