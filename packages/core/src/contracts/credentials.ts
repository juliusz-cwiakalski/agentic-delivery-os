/**
 * The credential-resolution port contract (F-3, DM-9).
 *
 * Runtime-neutral by construction: types only. The environment-backed
 * implementation lives outside this tier in `@delivery-os/adapters/credentials`.
 *
 * ## Sidecar adoption path (documented constraint)
 *
 * The port exposes one operation and nothing else. A future credential sidecar
 * becomes the port's second implementation: adapters forward their operations
 * to the sidecar over local transport instead of executing locally with
 * credentials, and the port interface does not change. No sidecar or forwarded
 * execution code exists in this change.
 */

/** How a declared reference names its source key. */
export type CredentialSourceKey =
  | { readonly style: "literal"; readonly name: string }
  | { readonly style: "environment-prefixed"; readonly suffix: string };

/**
 * A declared credential reference (DM-9).
 *
 * The reference carries its own explicit source-key mapping; the mapping is
 * declarative data, never derived from an external system's name and never an
 * ambient environment read.
 */
export type CredentialReference = {
  readonly referenceName: string;
  readonly sourceKey: CredentialSourceKey;
};

/** Resolved secret material, returned exactly once through the port result. */
export type SecretMaterial = { readonly value: string };

/** The classified identity of an unresolvable credential (F-6, DM-9). */
export type CredentialFailureCode = "config.credential.missing";

/**
 * The reified `config.credential.missing` failure (F-6).
 *
 * The fields mirror the machine-readable error-table row exactly; the delivery
 * suite binds the two so drift fails by name.
 */
export type CredentialResolutionFailure = {
  readonly ok: false;
  readonly code: CredentialFailureCode;
  readonly domainKind: "config";
  readonly category: "user";
  readonly retryable: false;
  readonly consequence: "not_landed";
  readonly projectionClass: "user-validation";
};

/** A resolved credential: the material or the classified failure (DM-9). */
export type CredentialResolution =
  | { readonly ok: true; readonly material: SecretMaterial }
  | CredentialResolutionFailure;

/**
 * The credential-resolution port (DM-9).
 *
 * Callers hand in a declared reference and receive either the material or the
 * classified failure. There is no diagnostic channel on the port: resolved
 * material never enters logs, errors, or diagnostics.
 */
export type CredentialPort = {
  readonly resolve: (reference: CredentialReference) => CredentialResolution;
};
