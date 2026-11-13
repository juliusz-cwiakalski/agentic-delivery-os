/**
 * The opencode per-session totals read (GH-291 OQ-T2 §1, F-6, NFR-6).
 *
 * At stream close the ingest seam asks the harness store one bounded, read-only
 * question: what did this one session report? The answer is the store's own
 * SUM aggregation — the same figures the delivered closeout extractor reads —
 * scoped to a single session id. The read opens the store read-only, sets the
 * query-only pragma before any read, and never touches conversation content.
 *
 * An unavailable store, an unreadable column set, or a query failure answers
 * `undefined`: no baseline is fabricated, and the session is disclosed as an
 * excluded baseline session downstream (DEC-5).
 */
import { HARNESS_TOKEN_CLASSES, type HarnessTokenCounts } from "@delivery-os/core/contracts";
import {
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

/** The token columns the store actually declares (a renamed column is absent). */
const COLUMNS: Readonly<Record<keyof HarnessTokenCounts, string>> = {
  input: "input_tokens",
  output: "output_tokens",
  reasoning: "reasoning_tokens",
  cacheRead: "cache_read_tokens",
  cacheWrite: "cache_write_tokens",
};

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const columnsOf = (rows: readonly HarnessSqliteRow[]): ReadonlySet<string> =>
  new Set(rows.flatMap((row) => str(row.name) ?? []));

/** Build the read-only per-session totals reader. */
export const createOpencodeSessionTotalsReader = (
  options: OpencodeSessionTotalsOptions,
): TelemetrySessionTotalsReader => {
  return (sessionId) => {
    const opened = openHarnessStoreReadOnly(options.opener, options.storePath, options.onStatement);
    if (!opened.ok) return undefined;
    const handle = opened.handle;
    try {
      const columns = columnsOf(handle.query("PRAGMA table_info(message)"));
      const selected = HARNESS_TOKEN_CLASSES.map((tokenClass) => {
        const column = COLUMNS[tokenClass];
        return columns.has(column) ? `SUM(${column}) AS ${tokenClass}` : `NULL AS ${tokenClass}`;
      });
      const cost = columns.has("cost") ? "SUM(cost) AS cost" : "NULL AS cost";
      const rows = handle.query(
        `SELECT COUNT(*) AS calls, ${[...selected, cost].join(", ")} FROM message WHERE session_id = ?`,
        [sessionId],
      );
      const row = rows[0];
      if (row === undefined) return undefined;
      const tokens: Record<string, number | null> = {};
      for (const tokenClass of HARNESS_TOKEN_CLASSES) {
        tokens[tokenClass] = columns.has(COLUMNS[tokenClass]) ? num(row[tokenClass]) : null;
      }
      return {
        tokens: {
          input: tokens.input ?? null,
          output: tokens.output ?? null,
          reasoning: tokens.reasoning ?? null,
          cacheRead: tokens.cacheRead ?? null,
          cacheWrite: tokens.cacheWrite ?? null,
        },
        calls: num(row.calls),
        cost: columns.has("cost") ? num(row.cost) : null,
      };
    } catch {
      return undefined;
    } finally {
      try {
        handle.close();
      } catch {
        // Closing a read-only handle is best effort; the store is untouched.
      }
    }
  };
};
