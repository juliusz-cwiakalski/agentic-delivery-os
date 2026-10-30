/**
 * The internal error table — the single source of failure identity (F-2, F-3).
 *
 * Runtime-neutral by construction: types and `as const` data only. Classification,
 * projection, serialization, and redaction live at the surface tiers.
 *
 * The table carries the two DEC-13 containment entries plus one seed entry per
 * failure projection class. `fallback` is the reserved two-segment namespace;
 * declared domain kinds are exactly `provider` and `input` at v1.
 */
import type { AppErrorCode, ErrorCategory, ErrorConsequence, ProjectionClass } from "./result.js";

/** The declared domain kinds: the first link of the classification chain. */
export const DOMAIN_KINDS = ["provider", "input"] as const;

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
] as const satisfies readonly ErrorTableEntry[];
