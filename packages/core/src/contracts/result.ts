/**
 * `CommandResult` envelope contract (F-1, DM-1).
 *
 * Runtime-neutral by construction: this module declares types and one
 * `as const` constant only — no I/O, clock, randomness, or environment access.
 *
 * DEC-1: the generic `Result<T, E>` remains the internal computation result;
 * `CommandResult` is the command-surface envelope a command's result is
 * rendered into.
 */

import type { HarnessKind, HarnessMode, HarnessVersionVerdict } from "./harness.js";

/** The only home of the v1 envelope schema identifier (DEC-8, DEC-9). */
export const RESULT_SCHEMA_VERSION = "delivery.result.v1" as const;

/** Responsibility and persistence of a failure (DEC-4). */
export type ErrorCategory = "user" | "platform" | "transient" | "permanent";

/** Whether the attempted mutation landed (DEC-5); `unknown` is first-class. */
export type ErrorConsequence = "landed" | "not_landed" | "unknown";

/** The standalone CLI's fixed exit-code projection class (F-4, Appendix C). */
export type ProjectionClass = "success" | "user-validation" | "platform-provider" | "attention";

/**
 * Stable symbolic hierarchical identity: `domain.reason.detail`.
 *
 * The reserved two-segment `fallback` namespace admits exactly
 * `fallback.invocation` and `fallback.internal` (DEC-13).
 */
export type AppErrorCode = string;

/** Measured timing facts; `totalMs` is an integer-millisecond run duration. */
export type RunTiming = { readonly totalMs: number };

/** The envelope error object (DM-2): prose is never identity. */
export type CommandResultError = {
  readonly code: AppErrorCode;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly consequence: ErrorConsequence;
  readonly remediationHint: string;
  readonly summary?: string;
};

/**
 * The single-line bound for a failure-envelope `detail` member (TDR-0027,
 * NFR-6): identifiers only, never truncated — a value that cannot fit is a
 * contract failure, not a silent clip.
 */
export const COMMAND_FAILURE_DETAIL_MAX_CHARS = 128 as const;

/**
 * The closed failure-envelope `detail` contract (TDR-0027 ALT-3): one
 * command-declared, optional member at the failure-envelope root. `holder`
 * names the live lease's holder identity on a `queue.single-flight` refusal;
 * `suiteBreadth` names the complete declared local suite breadth on a
 * `verify.narrowed-scope` refusal (GH-300 DM-6), bounded by its own declaration
 * (`VERIFY_SUITE_MAX_BREADTH` entries of at most `VERIFY_SUITE_MAX_ID_CHARS`
 * characters) and never truncated. A future member is a declared addition with
 * its own bound and test; this never becomes an open key-value map.
 */
export type CommandResultDetail = {
  readonly holder?: string;
  readonly suiteBreadth?: readonly string[];
  readonly harness?: CommandFailureHarnessDetail;
};

/** The bounded normalized-version member of the harness evidence slot (TDR-0037). */
export const COMMAND_FAILURE_HARNESS_VERSION_MAX_CHARS = 32 as const;

/**
 * The declared `detail.harness` evidence member (TDR-0037).
 *
 * Exactly four closed facts, populated only on the four new pre-session harness
 * refusals: the harness kind, the normalized observed version (explicit `null`
 * when indeterminable), the window verdict, and — only where mode resolution
 * ran — the mode. The vocabularies are imported type-only from the harness
 * contract and never restated here.
 */
export type CommandFailureHarnessDetail = {
  readonly kind: HarnessKind;
  readonly observedVersion: string | null;
  readonly versionVerdict: HarnessVersionVerdict;
  readonly mode?: HarnessMode;
};

/** An explicit empty success payload for void successes (D7). */
export type VoidSuccessPayload = Record<string, never>;

/** Success envelope: `data` is present and `error` is absent by construction. */
export type CommandResultSuccess<TData = unknown> = {
  readonly schemaVersion: typeof RESULT_SCHEMA_VERSION;
  readonly runId: string;
  readonly exitCode: number;
  readonly timing: RunTiming;
  readonly data: TData;
};

/**
 * Failure envelope: `error` is present and `data` is absent by construction.
 * `detail` is the additive optional, command-declared evidence member
 * (TDR-0027); a command that does not opt in carries no `detail` key.
 */
export type CommandResultFailure = {
  readonly schemaVersion: typeof RESULT_SCHEMA_VERSION;
  readonly runId: string;
  readonly exitCode: number;
  readonly timing: RunTiming;
  readonly error: CommandResultError;
  readonly detail?: CommandResultDetail;
};

/**
 * The command-surface result contract.
 *
 * Exactly one of `data` or `error` is present; all four mandatory fields are
 * always present, on success and failure alike.
 */
export type CommandResult<TData = unknown> = CommandResultSuccess<TData> | CommandResultFailure;
