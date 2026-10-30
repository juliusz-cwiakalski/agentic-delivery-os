/**
 * The append-only JSONL ledger core (GH-174 F-2, TDR-0004 §1).
 *
 * Pure functions over bytes and values: framing, checksum, sequence, and
 * schema-version verification. No I/O, no clock, no runtime API — the driver
 * edge supplies the bytes. Detection always completes before a value is
 * returned; a tear is reported as a position, never as a payload.
 */
import { STATE_SCHEMA_VERSION, type StateJsonValue, type StateRecord } from "#contracts";

/** The recorded checksum width (16 lowercase hex digits, FNV-1a 64-bit). */
export const CHECKSUM_HEX_LENGTH = 16;

/** The six envelope fields, in canonical order. */
export const RECORD_FIELDS = [
  "schemaVersion",
  "kind",
  "key",
  "sequence",
  "checksum",
  "payload",
] as const;

/** A detected tear class (Appendix A); `truncated-tail` is the repairable one. */
export type TornTailVariant =
  | "truncated-tail"
  | "framing"
  | "sequence-gap"
  | "sequence-duplicate"
  | "sequence-reset"
  | "checksum";

export type LedgerVerification =
  | { readonly status: "verified"; readonly records: readonly StateRecord[] }
  | { readonly status: "empty" }
  | { readonly status: "torn"; readonly variant: TornTailVariant; readonly position: number }
  | { readonly status: "schema"; readonly position: number; readonly version: string };

const FNV_OFFSET_BASIS = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const MASK_64 = 0xffffffffffffffffn;

/** FNV-1a 64-bit over the UTF-8 bytes of the canonical payload JSON. */
export const checksumOfPayload = (payload: StateJsonValue): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let hash = FNV_OFFSET_BASIS;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(CHECKSUM_HEX_LENGTH, "0");
};

/** Serialize one record as a single LF-terminated ledger line. */
export const serializeRecord = (record: StateRecord): string => `${JSON.stringify(record)}\n`;

/** The canonical order used when a record is built by the store. */
export const buildRecord = (
  kind: string,
  key: string,
  sequence: number,
  payload: StateJsonValue,
  schemaVersion: string = STATE_SCHEMA_VERSION,
): StateRecord => ({
  schemaVersion,
  kind,
  key,
  sequence,
  checksum: checksumOfPayload(payload),
  payload,
});

const isJsonValue = (value: unknown): value is StateJsonValue => {
  if (value === null) return true;
  const type = typeof value;
  if (type === "string" || type === "boolean") return true;
  if (type === "number") return Number.isFinite(value as number);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (type === "object") return Object.values(value as Record<string, unknown>).every(isJsonValue);
  return false;
};

/** Parse one framing line; returns undefined when it does not frame. */
export const parseRecordLine = (line: string): StateRecord | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  const candidate = parsed as Record<string, unknown>;
  const fields = Object.keys(candidate).sort();
  if (fields.length !== RECORD_FIELDS.length) return undefined;
  for (const field of RECORD_FIELDS) {
    if (!Object.hasOwn(candidate, field)) return undefined;
  }
  const { schemaVersion, kind, key, sequence, checksum, payload } = candidate as {
    schemaVersion: unknown;
    kind: unknown;
    key: unknown;
    sequence: unknown;
    checksum: unknown;
    payload: unknown;
  };
  if (typeof schemaVersion !== "string" || schemaVersion.length === 0) return undefined;
  if (typeof kind !== "string" || kind.length === 0) return undefined;
  if (typeof key !== "string" || key.length === 0) return undefined;
  if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 1) return undefined;
  if (typeof checksum !== "string" || !/^[0-9a-f]{16}$/.test(checksum)) return undefined;
  if (!isJsonValue(payload)) return undefined;
  return { schemaVersion, kind, key, sequence, checksum, payload };
};

const sequenceVariant = (
  previous: number | undefined,
  actual: number,
  expected: number,
): TornTailVariant | undefined => {
  if (actual === expected) return undefined;
  if (actual < expected)
    return previous !== undefined && actual === previous ? "sequence-duplicate" : "sequence-reset";
  return "sequence-gap";
};

/**
 * Verify a whole ledger body. The single entry point for every read path:
 * terminal completeness, framing, sequence continuity, checksum, and schema
 * version. The first failure determines the reported class and position
 * (1-based record position).
 */
export const verifyLedger = (
  text: string,
  schemaVersion: string = STATE_SCHEMA_VERSION,
): LedgerVerification => {
  if (text.length === 0) return { status: "empty" };
  if (!text.endsWith("\n")) {
    const position = text.split("\n").length;
    return { status: "torn", variant: "truncated-tail", position };
  }
  const lines = text.slice(0, -1).split("\n");
  const records: StateRecord[] = [];
  for (const [index, line] of lines.entries()) {
    const position = index + 1;
    const record = parseRecordLine(line);
    if (record === undefined) return { status: "torn", variant: "framing", position };
    if (record.schemaVersion !== schemaVersion) {
      return { status: "schema", position, version: record.schemaVersion };
    }
    const previous = records[index - 1];
    const variant = sequenceVariant(previous?.sequence, record.sequence, position);
    if (variant !== undefined) return { status: "torn", variant, position };
    if (record.checksum !== checksumOfPayload(record.payload)) {
      return { status: "torn", variant: "checksum", position };
    }
    records.push(record);
  }
  return { status: "verified", records };
};

/** Latest recorded value per store-scoped key. */
export const valuesFromRecords = (
  records: readonly StateRecord[],
): Record<string, StateJsonValue> => {
  const values: Record<string, StateJsonValue> = {};
  for (const record of records) values[record.key] = record.payload;
  return values;
};

/** The number of bytes a verified ledger's records occupy (all but the last tail). */
export const verifiedPrefixLength = (text: string): number => {
  if (text.length === 0) return 0;
  return text.endsWith("\n") ? text.length : text.lastIndexOf("\n") + 1;
};
