/**
 * The opencode per-session totals read over the OBSERVED store contract
 * (GH-291 OQ-T2 §1, GH-335 F-5/F-6; DM-10, NFR-6).
 *
 * At stream close the ingest seam asks the harness store one bounded, read-only
 * question: what did this one session report? The answer is the session row's
 * own token columns and cost plus the count of its usage-bearing assistant
 * messages — the same figures the closeout extractor reads, so the per-step
 * rows and the session baseline are one totals basis rather than two.
 *
 * An unavailable store, an unrecognised generation, or a query failure answers
 * `undefined`: no baseline is fabricated and the session is disclosed as an
 * excluded baseline downstream (DEC-5, DEC-9).
 */
import type { HarnessTokenCounts } from "@delivery-os/core/contracts";
import {
  type HarnessSqliteHandle,
  type HarnessSqliteRow,
  type HarnessStoreOpener,
  openHarnessStoreReadOnly,
} from "./sqlite-loader.js";

/** One session's harness-reported totals in the units the store records. */
export type TelemetrySessionTotals = {
  readonly tokens: HarnessTokenCounts;
  readonly calls: number | null;
  readonly cost: number | null;
};

/** The injected per-session totals read the ingest seam consumes. */
export type TelemetrySessionTotalsReader = (
  sessionId: string,
) => TelemetrySessionTotals | undefined;

export type OpencodeSessionTotalsOptions = {
  readonly opener: HarnessStoreOpener;
  readonly storePath: string;
  readonly onStatement?: (sql: string) => void;
};

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

/** The observed session generation the store carries, or undefined. */
const generationOf = (handle: HarnessSqliteHandle): "current" | "legacy" | undefined => {
  const tables = new Set(
    handle
      .query("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => str(row.name))
      .filter((name): name is string => name !== undefined),
  );
  if (tables.has("session_v2") && tables.has("session_message")) return "current";
  if (tables.has("session") && tables.has("message")) return "legacy";
  return undefined;
};

const totalsOf = (
  handle: HarnessSqliteHandle,
  sessionId: string,
): TelemetrySessionTotals | undefined => {
  const generation = generationOf(handle);
  if (generation === undefined) return undefined;
  const sessionTable = generation === "current" ? "session_v2" : "session";
  const row: HarnessSqliteRow | undefined = handle.query(
    `SELECT cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write FROM ${sessionTable} WHERE id = ? LIMIT 1`,
    [sessionId],
  )[0];
  if (row === undefined) return undefined;
  const messageScope =
    generation === "current"
      ? `SELECT COUNT(*) AS calls FROM session_message WHERE session_id = ? AND type = 'assistant' LIMIT 1`
      : `SELECT COUNT(*) AS calls FROM message WHERE session_id = ? LIMIT 1`;
  const calls = num(handle.query(messageScope, [sessionId])[0]?.calls);
  return {
    tokens: {
      input: num(row.tokens_input),
      output: num(row.tokens_output),
      reasoning: num(row.tokens_reasoning),
      cacheRead: num(row.tokens_cache_read),
      cacheWrite: num(row.tokens_cache_write),
    },
    calls,
    cost: num(row.cost),
  };
};

/** Build the read-only per-session totals reader. */
export const createOpencodeSessionTotalsReader = (
  options: OpencodeSessionTotalsOptions,
): TelemetrySessionTotalsReader => {
  return (sessionId) => {
    const opened = openHarnessStoreReadOnly(options.opener, options.storePath, options.onStatement);
    if (!opened.ok) return undefined;
    try {
      return totalsOf(opened.handle, sessionId);
    } catch {
      return undefined;
    } finally {
      try {
        opened.handle.close();
      } catch {
        // Best effort: a read-only handle closes or fails harmlessly.
      }
    }
  };
};
