/**
 * The embedded metadata envelope v1 data contract (F-5, DM-10).
 *
 * Runtime-neutral by construction: types and `as const` data only. The pure
 * codec (serialize, parse, strip) is an adapter-internal module; no behaviour or
 * new core subpath lives here (DEC-9).
 *
 * ## Version policy (DEC-7)
 *
 * v1 is the only schema version at delivery. The standing read window is
 * current-plus-all-older, read forward-compatibly; because no older version
 * exists at delivery, any version string outside the known set — older or
 * newer — binds to the visible-degradation path naming the `unknown-version`
 * reason. Narrowing the window or retiring a version is a future spec change,
 * never silent.
 *
 * ## Carrier discipline (DM-10)
 *
 * The payload is compact JSON, closed at v1, and admits no secret or
 * credential material. Carrier markers and namespaces follow the brand-neutral
 * `delivery.*.v1` discipline; no product token is committed.
 */
import type { CarrierKind } from "./adapter-capabilities.js";

/** The only v1 envelope schema identifier (brand-neutral `delivery.*.v1`). */
export const ENVELOPE_SCHEMA_ID = "delivery.metadata.v1" as const;

/** The serialized-envelope size bound in bytes (v1 ceiling). */
export const ENVELOPE_MAX_BYTES = 2048 as const;

/** The closed set of envelope kinds at v1. */
export const ENVELOPE_KINDS = ["work-item-comment"] as const;

/** What an envelope is about. */
export type EnvelopeKind = (typeof ENVELOPE_KINDS)[number];

/** The closed set of mechanically detectable degradation reasons (DEC-8). */
export const DEGRADATION_REASONS = [
  "missing",
  "malformed",
  "wrong-kind",
  "unknown-version",
] as const;

/** Why a read degraded; absent and stripped share `missing` (DEC-8). */
export type DegradationReason = (typeof DEGRADATION_REASONS)[number];

/** The carrier-kind union the envelope can travel in (DM-10). */
export type EnvelopeCarrierKind = CarrierKind;

/** Comment provenance: which agent produced the artifact and under whose authority. */
export type EnvelopeCommentProvenance = {
  readonly producingAgent: string;
  readonly operatorAuthority: string;
};

/** Delivery linkage: the work item and run the artifact belongs to. */
export type EnvelopeDeliveryLinkage = {
  readonly workItemRef: string;
  readonly runId: string;
};

/** The closed v1 payload (no secret or credential field is admitted). */
export type EnvelopeV1Payload = {
  readonly comment: EnvelopeCommentProvenance;
  readonly delivery: EnvelopeDeliveryLinkage;
};

/** A parseable v1 envelope. */
export type MetadataEnvelopeV1 = {
  readonly schema: typeof ENVELOPE_SCHEMA_ID;
  readonly kind: EnvelopeKind;
  readonly payload: EnvelopeV1Payload;
};

/**
 * Account-based heuristic provenance attached to a degraded read (DEC-8).
 *
 * `structural: false` keeps heuristic provenance visibly distinct from payload
 * provenance; it never masquerades as structural.
 */
export type HeuristicProvenance = {
  readonly source: "account-heuristic";
  readonly account: string;
  readonly structural: false;
};

/** Visible evidence that a metadata read degraded rather than failed (DEC-5, DEC-8). */
export type MetadataDegradationEvidence = {
  readonly reason: DegradationReason;
  readonly heuristics: HeuristicProvenance;
};

/**
 * An agent-facing comment write request (F-5).
 *
 * It carries requested provenance and human content only; it exposes no raw
 * carrier, marker, or serializer field.
 */
export type CommentWriteRequest = {
  readonly body: string;
  readonly provenance: EnvelopeCommentProvenance;
  readonly delivery: EnvelopeDeliveryLinkage;
};

/** An agent-facing comment read view (F-5). */
export type CommentReadView = {
  readonly body: string;
  readonly provenance: EnvelopeCommentProvenance | HeuristicProvenance;
  readonly degradation?: MetadataDegradationEvidence;
};

/**
 * The verdict a content policy returns for one serialized envelope (DM-5).
 *
 * A denial carries exactly one rule/entry id and never content; the codec maps
 * it to the fail-closed `content-policy-violation` serialization failure.
 */
export type ContentPolicyVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly ruleOrEntryId: string };

/**
 * The injected pure content policy (DM-5).
 *
 * It receives the exact compact JSON representation that would be embedded and
 * is total, non-throwing, and free of I/O, ambient reads, clock, and randomness.
 */
export type EnvelopeContentPolicy = (compactJson: string) => ContentPolicyVerdict;
