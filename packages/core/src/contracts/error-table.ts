/**
 * The internal error table — the single source of failure identity (F-2, F-3).
 *
 * Runtime-neutral by construction: types and `as const` data only. Classification,
 * projection, serialization, and redaction live at the surface tiers.
 *
 * The table carries two containment entries and one row per declared failure
 * discriminant. `fallback` is the reserved two-segment namespace.
 */
import type { AppErrorCode, ErrorCategory, ErrorConsequence, ProjectionClass } from "./result.js";

/** The declared domain kinds: the first link of the classification chain. */
export const DOMAIN_KINDS = ["provider", "input", "config"] as const;

/** Reserved containment code for broken invocations and unknown commands. */
export const FALLBACK_INVOCATION_CODE = "fallback.invocation" as const;

/** Reserved containment code for errors no table entry classifies. */
export const FALLBACK_INTERNAL_CODE = "fallback.internal" as const;

/** A declared domain kind, or the reserved containment namespace. */
export type ErrorTableDomainKind = (typeof DOMAIN_KINDS)[number] | "fallback";

/** One row of the machine-readable table (DM-3, Appendix B). */
export type ErrorTableEntry = {
  readonly code: AppErrorCode;
  readonly domainKind: ErrorTableDomainKind;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly consequence: ErrorConsequence;
  readonly remediationHint: string;
  readonly projectionClass: ProjectionClass;
  readonly summary?: string;
};

/**
 * The single machine-readable declaration. Ordered fallback entries first, then
 * one seed entry per declared domain kind.
 */
export const ERROR_TABLE = [
  {
    code: FALLBACK_INVOCATION_CODE,
    domainKind: "fallback",
    category: "user",
    retryable: false,
    consequence: "unknown",
    remediationHint: "Check the command name and arguments, then retry the invocation.",
    projectionClass: "user-validation",
    summary: "The invocation could not be understood.",
  },
  {
    code: FALLBACK_INTERNAL_CODE,
    domainKind: "fallback",
    category: "platform",
    retryable: false,
    consequence: "unknown",
    remediationHint: "Inspect the diagnostics stream and report the failure if it persists.",
    projectionClass: "platform-provider",
    summary: "The failure could not be classified.",
  },
  {
    code: "provider.quota.exceeded",
    domainKind: "provider",
    category: "transient",
    retryable: true,
    consequence: "not_landed",
    remediationHint: "Wait for the quota window to reset, then retry the operation.",
    projectionClass: "platform-provider",
    summary: "The provider quota was exceeded.",
  },
  {
    code: "input.value.rejected",
    domainKind: "input",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the rejected value and retry the command.",
    projectionClass: "user-validation",
    summary: "The supplied value was rejected.",
  },
  {
    code: "config.file.malformed",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the named configuration source and retry.",
    projectionClass: "user-validation",
    summary: "A configuration source is malformed.",
  },
  {
    code: "config.key.unknown",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Remove or correct the unknown configuration key and retry.",
    projectionClass: "user-validation",
    summary: "A configuration key is unknown.",
  },
  {
    code: "config.environment.unmapped",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Remove or map the environment name and retry.",
    projectionClass: "user-validation",
    summary: "An environment configuration name is unmapped.",
  },
  {
    code: "config.value.invalid",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the value to match the configuration schema and retry.",
    projectionClass: "user-validation",
    summary: "A configuration value is invalid.",
  },
  {
    code: "config.interpolation.rejected",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Use a typed environment override instead and retry.",
    projectionClass: "user-validation",
    summary: "In-file interpolation is not supported.",
  },
  {
    code: "config.secret.forbidden",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Move the secret to a supported environment source and retry.",
    projectionClass: "user-validation",
    summary: "A secret was supplied from a forbidden source.",
  },
  {
    code: "config.path.forbidden",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Move the machine path to a system or user-global source and retry.",
    projectionClass: "user-validation",
    summary: "A machine path was supplied from a forbidden source.",
  },
  {
    code: "config.reset.invalid",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the reset paths and retry.",
    projectionClass: "user-validation",
    summary: "A configuration reset is invalid.",
  },
  {
    code: "config.warning.strict",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Resolve the named warning and retry.",
    projectionClass: "user-validation",
    summary: "Strict configuration validation rejected a warning.",
  },
  {
    code: "config.credential.missing",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Supply the credential through its declared environment source and retry.",
    projectionClass: "user-validation",
    summary: "A required credential was not resolvable from its source.",
  },
] as const satisfies readonly ErrorTableEntry[];
