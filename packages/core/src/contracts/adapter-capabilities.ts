/**
 * The adapter capability and gap declaration (F-2, DM-2, DM-10).
 *
 * Runtime-neutral by construction: types plus `as const` data only. Absence of
 * a capability flag is a machine-readable gap; parity is never implied.
 */

/** The closed set of metadata carrier kinds an adapter can declare (F-2, DM-10). */
export const CARRIER_KINDS = [
  "invisible-comment-block",
  "provider-custom-field",
  "compact-marker",
] as const;

/** One adapter-chosen metadata carrier form. */
export type CarrierKind = (typeof CARRIER_KINDS)[number];

/** The closed set of operations an adapter can declare (F-2, DM-2). */
export const ADAPTER_OPERATIONS = [
  "read-work-item",
  "write-work-item",
  "transition-work-item",
  "read-delivery-request",
  "write-delivery-request",
  "read-pipeline-run",
  "write-comment",
] as const;

/** One adapter operation an adapter may or may not support. */
export type AdapterOperation = (typeof ADAPTER_OPERATIONS)[number];

/** Why an operation is not supported (F-2, DM-2). */
export type CapabilityGapReason =
  | "provider-unsupported"
  | "adapter-not-implemented"
  | "plan-restriction";

/** An explicit gap record: the operation plus the reason (F-2, DM-2). */
export type CapabilityGap = {
  readonly operation: AdapterOperation;
  readonly reason: CapabilityGapReason;
};

/**
 * An adapter's full capability declaration (F-2, DM-2).
 *
 * `supportedOperations` is authoritative: an operation that is not listed is
 * unsupported. `declaredGaps` records the explicit reason for known gaps.
 */
export type AdapterCapabilityDeclaration = {
  readonly supportedOperations: readonly AdapterOperation[];
  readonly declaredGaps: readonly CapabilityGap[];
  readonly writableCarriers: readonly CarrierKind[];
  readonly readableCarriers: readonly CarrierKind[];
};

/**
 * A carrier selection constrained to an adapter's declared writable carriers.
 *
 * The generic parameter is constrained to `readonly CarrierKind[]`, so a
 * widened `string[]` union is rejected at compile time and an undeclared
 * carrier literal is not assignable.
 */
export type CarrierSelectionInput<Declared extends readonly CarrierKind[]> = {
  readonly carrier: Declared[number];
};

/**
 * Ask an adapter to write metadata through one declared carrier (F-2, DM-10).
 *
 * Presenting a carrier outside the adapter's declared writable set is a
 * declared gap, not a coercion.
 */
export type DeclaredCarrierWrite<Declared extends readonly CarrierKind[]> = {
  readonly selection: CarrierSelectionInput<Declared>;
};
