/**
 * Driver read strategies (GH-174 F-3, TDR-0004 §2/§4).
 *
 * Both strategies consume the same verified ledger records. The `jsonl` kind
 * derives values directly; the `sqlite` kind maintains a disposable derived
 * index and never becomes truth.
 */
import type {
  StateFailure,
  StateIndexRebuildReport,
  StateJsonValue,
  StateRecord,
  StateResult,
  StateVerificationClass,
} from "#contracts";
import type { StateRuntimeEdge } from "../edge.js";

export type StateStrategyReadOutcome = {
  readonly values: Record<string, StateJsonValue>;
  readonly rebuild?: StateIndexRebuildReport;
};

export type StateReadStrategy = {
  readonly verification: readonly StateVerificationClass[];
  read(
    records: readonly StateRecord[],
    indexPath: string,
    edge: StateRuntimeEdge,
  ): StateResult<StateStrategyReadOutcome>;
  /** Best-effort index maintenance after a landed append (never fails a write). */
  afterAppend(records: readonly StateRecord[], indexPath: string, edge: StateRuntimeEdge): void;
};

const valuesFromRecords = (records: readonly StateRecord[]): Record<string, StateJsonValue> => {
  const values: Record<string, StateJsonValue> = {};
  for (const record of records) values[record.key] = record.payload;
  return values;
};

const writeFailed = (path: string): StateFailure => ({
  kind: "state",
  code: "state.write.failed",
  consequence: "not_landed",
  location: { path },
});

/** The scan kind: the ledger is the only read path (correctness baseline). */
export const createJsonlStrategy = (): StateReadStrategy => ({
  verification: ["framing", "terminal", "sequence", "checksum"],
  read: (records) => ({
    ok: true,
    value: { values: valuesFromRecords(records) },
  }),
  afterAppend: () => {
    // The scan kind needs no derived projection.
  },
});

const agreement = (rows: readonly Record<string, unknown>[], records: readonly StateRecord[]) => {
  if (rows.length !== records.length) return false;
  return records.every((record, index) => {
    const row = rows[index];
    if (row === undefined) return false;
    return (
      Number(row.sequence) === record.sequence &&
      String(row.key) === record.key &&
      String(row.kind) === record.kind &&
      String(row.checksum) === record.checksum
    );
  });
};

const asRows = (records: readonly StateRecord[]) =>
  records.map((record) => ({
    sequence: record.sequence,
    key: record.key,
    kind: record.kind,
    checksum: record.checksum,
    payload: JSON.stringify(record.payload),
  }));

const parseRowValues = (
  rows: readonly { readonly key: string; readonly payload: string }[],
): Record<string, StateJsonValue> | undefined => {
  const values: Record<string, StateJsonValue> = {};
  for (const row of rows) {
    try {
      values[row.key] = JSON.parse(row.payload) as StateJsonValue;
    } catch {
      return undefined;
    }
  }
  return values;
};

/** The indexed kind: derived, disposable, verified against the ledger. */
export const createSqliteStrategy = (): StateReadStrategy => ({
  verification: ["framing", "terminal", "sequence", "checksum", "index"],
  read: (records, indexPath, edge) => {
    if (!edge.indexAvailable()) return { ok: false, error: writeFailed(indexPath) };
    const existing = edge.indexRead(indexPath);
    let reason: StateIndexRebuildReport["reason"] | undefined;
    if (existing === undefined) {
      reason = edge.exists(indexPath) ? "corrupt" : "missing";
    } else if (!agreement(existing, records)) {
      reason = "divergent";
    }

    let rebuild: StateIndexRebuildReport | undefined;
    if (reason !== undefined) {
      try {
        edge.raiseFault("index-rebuild-write");
        edge.indexWrite(indexPath, asRows(records));
        rebuild = { reason, records: records.length, path: indexPath };
      } catch {
        // A failed rebuild never serves a stale read (AC-F3-1).
        return { ok: false, error: writeFailed(indexPath) };
      }
    }

    const rows = rebuild === undefined ? (existing ?? []) : asRows(records);
    const values = parseRowValues(rows);
    if (values === undefined) return { ok: false, error: writeFailed(indexPath) };
    return {
      ok: true,
      value: rebuild === undefined ? { values } : { values, rebuild },
    };
  },
  afterAppend: (records, indexPath, edge) => {
    if (!edge.indexAvailable()) return;
    try {
      edge.indexWrite(indexPath, asRows(records));
    } catch {
      // The index is disposable: the ledger landed, the next read rebuilds.
    }
  },
});
