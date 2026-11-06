/**
 * Parity harness helpers: normalize the CLI envelope and the MCP toolset result
 * into one comparable outcome, and assert the shared non-vacuity rules.
 */
import type { McpToolResult } from "../../../../packages/mcp/src/index";

/** One normalized outcome for either surface. */
export type CaseOutcome =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: Record<string, unknown> };

/** Extract the outcome from one CLI machine envelope. */
export const fromEnvelope = (envelope: Record<string, unknown> | undefined): CaseOutcome => {
  if (envelope === undefined) throw new Error("expected one machine envelope");
  if (Object.hasOwn(envelope, "error")) {
    const error = envelope.error;
    if (typeof error !== "object" || error === null || Array.isArray(error)) {
      throw new Error("expected an error object");
    }
    return { ok: false, error: error as Record<string, unknown> };
  }
  return { ok: true, data: envelope.data };
};

/** Normalize one toolset result into the comparable outcome. */
export const fromToolResult = (result: McpToolResult): CaseOutcome =>
  result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error as unknown as Record<string, unknown> };

/** The contracted failure key set; `summary` is conditional on the CLI. */
export const CONTRACTED_ERROR_KEYS = [
  "code",
  "category",
  "retryable",
  "consequence",
  "remediationHint",
] as const;

/** Deep-scan a payload for envelope-only keys at any depth. */
export const envelopeLeaks = (value: unknown): string[] => {
  const leaks: string[] = [];
  const visit = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => {
        visit(entry, `${path}[${index}]`);
      });
      return;
    }
    if (typeof node === "object" && node !== null) {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (key === "exitCode" || key === "runId" || key === "timing") {
          leaks.push(`${path}.${key}`);
        }
        if (key === "schemaVersion" && child === "delivery.result.v1") {
          leaks.push(`${path}.schemaVersion=delivery.result.v1`);
        }
        visit(child, `${path}.${key}`);
      }
    }
  };
  visit(value, "$");
  return leaks;
};

/** The error key set, asserting no extra or missing field. */
export const errorKeyViolations = (error: Record<string, unknown>): string[] => {
  const failures: string[] = [];
  for (const key of CONTRACTED_ERROR_KEYS) {
    if (!Object.hasOwn(error, key)) failures.push(`missing error field ${key}`);
  }
  const allowed = new Set<string>([...CONTRACTED_ERROR_KEYS, "summary"]);
  for (const key of Object.keys(error)) {
    if (!allowed.has(key)) failures.push(`unexpected error field ${key}`);
  }
  return failures;
};
