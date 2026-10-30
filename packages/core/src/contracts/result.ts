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

/** The only home of the v1 envelope schema identifier (DEC-8, DEC-9). */
export const RESULT_SCHEMA_VERSION = "delivery.result.v1" as const;

/** Responsibility and persistence of a failure (DEC-4). */
export type ErrorCategory = "user" | "platform" | "transient" | "permanent";

/** Whether the attempted mutation landed (DEC-5); `unknown` is first-class. */
export type ErrorConsequence = "landed" | "not_landed" | "unknown";

/** The standalone CLI's fixed exit-code projection class (F-4, Appendix C). */
export type ProjectionClass = "success" | "user-validation" | "platform-provider";

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

/** Failure envelope: `error` is present and `data` is absent by construction. */
export type CommandResultFailure = {
  readonly schemaVersion: typeof RESULT_SCHEMA_VERSION;
  readonly runId: string;
  readonly exitCode: number;
  readonly timing: RunTiming;
  readonly error: CommandResultError;
};

/**
 * The command-surface result contract.
 *
 * Exactly one of `data` or `error` is present; all four mandatory fields are
 * always present, on success and failure alike.
 */
export type CommandResult<TData = unknown> = CommandResultSuccess<TData> | CommandResultFailure;
