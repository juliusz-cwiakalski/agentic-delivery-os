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

/**
 * How a declared reference names its source key.
 *
 * Four closed styles, each carrying its own explicit keys: the two environment
 * styles name an environment variable, `command` names an allowlisted program
 * pair with its declared argv, and `harness-store` names the harness identity
 * and the integration id handed to the export's target selector. Nothing is
 * discovered by matching a label, an account name, or a provider's name; no
 * style has a fallback and no declaration admits a chain.
 */
export type CredentialSourceKey =
  | { readonly style: "literal"; readonly name: string }
  | { readonly style: "environment-prefixed"; readonly suffix: string }
  | {
      readonly style: "command";
      /** The allowlisted absolute program path, validated against the shipped table. */
      readonly program: string;
      /** The declared argv: the pinned subcommand prefix plus its permitted parameters. */
      readonly args: readonly string[];
      /** Optional per-execution timeout, bounded by the declared hard bound. */
      readonly timeoutMs?: number;
    }
  | {
      readonly style: "harness-store";
      /** The harness identity whose export reads the store; must match the active harness. */
      readonly harness: string;
      /** The declared integration id handed to the export's target selector. */
      readonly integrationId: string;
    };

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
 * The closed ten-member failure reason set (DM-3).
 *
 * `resolution-pending` is reserved: it is declared so the resident composition
 * specified forward can return it without reshaping this union. No shipped
 * caller observes it — one-shot commands resolve before returning, and the
 * shipped daemon resolves nothing.
 */
export const CREDENTIAL_FAILURE_REASONS = [
  "program-unavailable",
  "timeout",
  "non-zero-exit",
  "empty-output",
  "shape-drift",
  "ambiguous-account",
  "oauth-excluded",
  "source-not-supported",
  "variable-absent",
  "resolution-pending",
] as const;
export type CredentialFailureReason = (typeof CREDENTIAL_FAILURE_REASONS)[number];

/**
 * The reified `config.credential.missing` failure (F-6).
 *
 * The required fields mirror the machine-readable error-table row exactly; the
 * delivery suite binds the two so drift fails by name. The three optional
 * projection fields (`source`, `reason`, `remedy`) are additive data on the
 * variant, never columns on the bound row: `source` names the style plus source
 * identity of the reference being resolved, `reason` is one closed token, and
 * `remedy` is fixed table text naming the one operator act that helps — never
 * interpolated from configuration or child output.
 */
export type CredentialResolutionFailure = {
  readonly ok: false;
  readonly code: CredentialFailureCode;
  readonly domainKind: "config";
  readonly category: "user";
  readonly retryable: false;
  readonly consequence: "not_landed";
  readonly projectionClass: "user-validation";
  /** Style plus source identity, e.g. `literal:NAME`, `command:<program>`. */
  readonly source?: string;
  /** One token from the closed reason set. */
  readonly reason?: CredentialFailureReason;
  /** The fixed `(reason, style)`-keyed remedy text. */
  readonly remedy?: string;
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
