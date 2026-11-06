/**
 * The MCP tool payload contract (F-5, DM-1..DM-4, DEC-4, DEC-7).
 *
 * Success payloads are the engine data types by reference from
 * `@delivery-os/core/contracts`: this module re-declares no shape. Failure
 * payloads are exactly the CLI `CommandResultError` field set, resolved through
 * the same error-table classification chain the CLI uses (the chain itself is
 * CLI-owned and cannot be imported, so its semantics are mirrored here against
 * the shared `ERROR_TABLE` data; the CLI parity suite is the live drift guard).
 *
 * No envelope field ever crosses this boundary: no `schemaVersion`, `exitCode`,
 * `runId`, or `timing` key is introduced at any depth.
 */

import type { VerifyChangeSuccessData } from "@delivery-os/core";
import type { StatusDigest } from "@delivery-os/core/contracts";
import {
  BOARD_COLLECTOR_ERROR_PREFIX,
  BOARD_COLLECTOR_ERROR_SUFFIX,
  type CommandResultError,
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  type VerifyGatesReport,
} from "@delivery-os/core/contracts";

/** The failure payload is the CLI error object by shape (DM-4). */
export type McpToolError = CommandResultError;

/** A tool success carries the engine data. */
export type McpToolSuccess<TData> = { readonly ok: true; readonly data: TData };

/** A tool failure carries only the contracted error fields. */
export type McpToolFailure = { readonly ok: false; readonly error: McpToolError };

/** The discriminated tool outcome. */
export type McpToolResult<TData = unknown> = McpToolSuccess<TData> | McpToolFailure;

/** The `status` success payload is the status digest by reference (DM-1). */
export type StatusToolData = StatusDigest;

/** The `verify-artifact` success payload is the verify-change data (DM-2). */
export type VerifyArtifactToolData = VerifyChangeSuccessData;

/** The `gate-report` success payload is the gates report by reference (DM-3). */
export type GateReportToolData = VerifyGatesReport;

/** The CLI grammar-rejection summary analogue (DEC-7, mirror parity). */
const GRAMMAR_REJECTION_SUMMARY = "result=failed; variant=unknown; missing=-";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDeclaredKind = (kind: string): kind is (typeof DOMAIN_KINDS)[number] =>
  (DOMAIN_KINDS as readonly string[]).includes(kind);

const entryForCode = (code: string): ErrorTableEntry | undefined =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.code === code);

const COLLECTOR_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** The declared status collector family, mirroring the CLI chain (GAP-3). */
const collectorFamilyEntry = (code: string, kind?: string): ErrorTableEntry | undefined => {
  if (kind !== undefined && kind !== "status") return undefined;
  if (!code.startsWith(BOARD_COLLECTOR_ERROR_PREFIX)) return undefined;
  if (!code.endsWith(BOARD_COLLECTOR_ERROR_SUFFIX)) return undefined;
  const id = code.slice(
    BOARD_COLLECTOR_ERROR_PREFIX.length,
    code.length - BOARD_COLLECTOR_ERROR_SUFFIX.length,
  );
  if (!COLLECTOR_ID_PATTERN.test(id)) return undefined;
  const base = entryForCode("status.collector.tracker.unavailable");
  return base === undefined ? undefined : { ...base, code };
};

const resolveEntry = (code: string): ErrorTableEntry | undefined =>
  entryForCode(code) ?? collectorFamilyEntry(code);

const containedInternalEntry = (): ErrorTableEntry => {
  const entry = resolveEntry(FALLBACK_INTERNAL_CODE);
  if (entry === undefined) throw new Error(`${FALLBACK_INTERNAL_CODE} is not declared`);
  return entry;
};

const entryForKind = (kind: string, code?: string): ErrorTableEntry => {
  if (!isDeclaredKind(kind)) throw new Error(`undeclared domain kind: ${kind}`);
  if (code !== undefined) {
    const entry = resolveEntry(code);
    if (entry === undefined || entry.domainKind !== kind) {
      throw new Error("no entry classifies domain discriminant");
    }
    return entry;
  }
  const matches = (ERROR_TABLE as readonly ErrorTableEntry[]).filter(
    (candidate) => candidate.domainKind === kind,
  );
  if (matches.length !== 1) throw new Error(`ambiguous or missing domain kind: ${kind}`);
  return matches[0] as ErrorTableEntry;
};

/** The adapter-local provider payload identity mirrored from the CLI chain. */
const ADAPTER_LOCAL_PAYLOAD_ENTRY: ErrorTableEntry = {
  code: "provider.payload.invalid",
  domainKind: "provider",
  category: "platform",
  retryable: false,
  consequence: "unknown",
  remediationHint:
    "Correct the malformed provider payload or fix the adapter normalization, then retry.",
  projectionClass: "platform-provider",
  summary: "A provider payload was malformed or unparsable.",
};

const adapterLocalEntry = (kind: string, code: unknown): ErrorTableEntry | undefined =>
  kind === "provider" && code === "provider.payload.invalid"
    ? ADAPTER_LOCAL_PAYLOAD_ENTRY
    : undefined;

/** Mirror `classifyThrown`: declared kinds resolve; everything else contains. */
const classifyThrown = (value: unknown): ErrorTableEntry => {
  if (isRecord(value) && "kind" in value) {
    const kind = value.kind;
    if (typeof kind === "string" && isDeclaredKind(kind)) {
      const code = value.code;
      try {
        if (code !== undefined && typeof code !== "string") return containedInternalEntry();
        const adapterLocal = adapterLocalEntry(kind, code);
        if (adapterLocal !== undefined) return adapterLocal;
        return entryForKind(kind, code);
      } catch {
        return containedInternalEntry();
      }
    }
  }
  return containedInternalEntry();
};

const explicitSummary = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  const summary = value.summary;
  return typeof summary === "string" && summary.length > 0 ? summary : undefined;
};

const effectiveSummary = (entry: ErrorTableEntry, value: unknown): string | undefined => {
  // No untrusted config summary, even when a malformed discriminator was
  // contained as `fallback.internal` (mirrors `failureOutcome`).
  const configShaped =
    isRecord(value) &&
    (value.kind === "config" ||
      (typeof value.code === "string" && value.code.startsWith("config.")));
  if (configShaped || entry.domainKind === "config") return undefined;
  return explicitSummary(value);
};

const toErrorObject = (entry: ErrorTableEntry, summary: string | undefined): CommandResultError => {
  const effective = summary ?? entry.summary;
  const error: CommandResultError = {
    code: entry.code,
    category: entry.category,
    retryable: entry.retryable,
    consequence: entry.consequence,
    remediationHint: entry.remediationHint,
  };
  return effective === undefined ? error : { ...error, summary: effective };
};

/** Shape one classified failure into the contracted tool failure. */
const failureForEntry = (entry: ErrorTableEntry, summary: string | undefined): McpToolFailure => ({
  ok: false,
  error: toErrorObject(entry, summary),
});

/** The boundary rejection for a missing, empty, or non-string ref (DEC-7). */
export const inputRejection = (): McpToolFailure => {
  const entry = resolveEntry("input.value.rejected");
  if (entry === undefined) throw new Error("input.value.rejected is not declared");
  return failureForEntry(entry, GRAMMAR_REJECTION_SUMMARY);
};

/** Convert any returned or thrown failure value into the contracted payload. */
export const failureFromValue = (value: unknown): McpToolFailure => {
  const entry = classifyThrown(value);
  return failureForEntry(entry, effectiveSummary(entry, value));
};
