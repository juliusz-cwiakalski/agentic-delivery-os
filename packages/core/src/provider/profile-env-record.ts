/**
 * Hardened `data-v1` model-environment record contract (GH-234 F-8, DM-7,
 * DEC-3; Appendix D).
 *
 * Pure policy: the record is validated as data and never shell-interpreted.
 * The carried-over floor (header, set/unset grammar, allowlist, duplicates,
 * final LF, CR/NUL, size limits) and the hardened ceiling (strict identifier,
 * embedded equals rejected, homoglyph/non-ASCII rejected, metacharacters
 * rejected, exact allowlist match) are enforced together. Every class is
 * rejected with a classified refusal and never partially applied.
 */
import {
  DEFAULT_ENV_RECORD_NAME_PATTERN,
  ENV_RECORD_FORMAT,
  ENV_RECORD_HEADER,
  ENV_RECORD_MAX_BYTES,
  ENV_RECORD_MAX_LINE_BYTES,
  ENV_RECORD_MAX_RECORDS,
  ENV_RECORD_NAME_PATTERN,
  type EnvRecord,
  type EnvRecordEntry,
  type ProviderEnvRecordPolicy,
  type ProviderProfileSeat,
} from "#contracts";

export type EnvRecordErrorCode =
  | "provider.env-record.unauthorized"
  | "provider.env-record.duplicate"
  | "provider.env-record.malformed"
  | "provider.env-record.oversized";

export type EnvRecordValidationError = {
  readonly code: EnvRecordErrorCode;
  readonly detail: string;
  readonly record?: string;
};

export type ResolvedEnvRecordPolicy = {
  readonly header: string;
  readonly namePattern: string;
  readonly maxBytes: number;
  readonly maxLineBytes: number;
  readonly maxRecords: number;
};

export type EnvRecordValidation =
  | {
      readonly ok: true;
      readonly entries: readonly EnvRecordEntry[];
      readonly variables: Readonly<Record<string, string>>;
    }
  | { readonly ok: false; readonly error: EnvRecordValidationError };

/** Resolve the declared grammar options over the shipped defaults. */
export const resolveEnvRecordPolicy = (
  policy: ProviderEnvRecordPolicy | undefined,
): ResolvedEnvRecordPolicy => ({
  header: policy?.header ?? ENV_RECORD_HEADER,
  namePattern: policy?.namePattern ?? DEFAULT_ENV_RECORD_NAME_PATTERN,
  maxBytes: policy?.maxBytes ?? ENV_RECORD_MAX_BYTES,
  maxLineBytes: policy?.maxLineBytes ?? ENV_RECORD_MAX_LINE_BYTES,
  maxRecords: policy?.maxRecords ?? ENV_RECORD_MAX_RECORDS,
});

/** Count UTF-8 bytes without a runtime text-encoding API. */
const utf8Bytes = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
};

const NAME_IDENTIFIER = new RegExp(`^(?:${ENV_RECORD_NAME_PATTERN})$`);

const failure = (
  code: EnvRecordErrorCode,
  detail: string,
  record?: string,
): EnvRecordValidation => ({
  ok: false,
  error: {
    code,
    detail,
    ...(record === undefined ? {} : { record }),
  },
});

/** Compile the configured allowlist once per resolved policy. */
const compileAllowlist = (pattern: string): RegExp => new RegExp(`^(?:${pattern})$`);

const headerInvalid = (header: string): boolean => /[\r\n\0]/.test(header);

const nameAllowed = (name: string, allowlist: RegExp): boolean =>
  NAME_IDENTIFIER.test(name) && allowlist.test(name);

const renderLine = (entry: EnvRecordEntry): string =>
  entry.operation === "set" ? `set ${entry.name}=${entry.value}` : `unset ${entry.name}`;

/** Render the wire form: exact header, one line per record, final LF. */
const renderEnvRecord = (
  entries: readonly EnvRecordEntry[],
  policy: ResolvedEnvRecordPolicy,
): string => `${[policy.header, ...entries.map(renderLine)].join("\n")}\n`;

const variablesOf = (entries: readonly EnvRecordEntry[]): Readonly<Record<string, string>> => {
  const variables: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.operation === "set") variables[entry.name] = entry.value;
  }
  return variables;
};

/** Serialize one structured entry list to the validated data-v1 wire form. */
export const serializeEnvRecord = (
  entries: readonly EnvRecordEntry[],
  policy: ProviderEnvRecordPolicy | undefined,
): EnvRecordValidation => {
  const resolved = resolveEnvRecordPolicy(policy);
  if (headerInvalid(resolved.header)) {
    return failure(
      "provider.env-record.malformed",
      "the configured header contains LF, CR, or NUL",
    );
  }
  const allowlist = compileAllowlist(resolved.namePattern);
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!nameAllowed(entry.name, allowlist)) {
      return failure(
        "provider.env-record.unauthorized",
        `name ${entry.name} is outside the configured allowlist`,
        entry.name,
      );
    }
    if (seen.has(entry.name)) {
      return failure(
        "provider.env-record.duplicate",
        `name ${entry.name} is duplicated`,
        entry.name,
      );
    }
    seen.add(entry.name);
    const line = renderLine(entry);
    if (line.includes("\r") || line.includes("\0")) {
      return failure("provider.env-record.malformed", "the record contains CR or NUL", entry.name);
    }
    if (utf8Bytes(line) > resolved.maxLineBytes) {
      return failure(
        "provider.env-record.oversized",
        `record for ${entry.name} exceeds the line limit`,
        entry.name,
      );
    }
  }
  if (entries.length > resolved.maxRecords) {
    return failure(
      "provider.env-record.oversized",
      "the record count exceeds the configured limit",
    );
  }
  const text = renderEnvRecord(entries, resolved);
  if (utf8Bytes(text) > resolved.maxBytes) {
    return failure("provider.env-record.oversized", "the record exceeds the byte limit");
  }
  return { ok: true, entries, variables: variablesOf(entries) };
};

/** Parse and validate one data-v1 record byte-level; no partial application. */
export const validateEnvRecord = (
  text: string,
  policy: ProviderEnvRecordPolicy | undefined,
): EnvRecordValidation => {
  const resolved = resolveEnvRecordPolicy(policy);
  if (headerInvalid(resolved.header)) {
    return failure(
      "provider.env-record.malformed",
      "the configured header contains LF, CR, or NUL",
    );
  }
  if (utf8Bytes(text) > resolved.maxBytes) {
    return failure("provider.env-record.oversized", "the record exceeds the byte limit");
  }
  if (text.includes("\r") || text.includes("\0")) {
    return failure("provider.env-record.malformed", "the record contains CR or NUL");
  }
  if (!text.endsWith("\n")) {
    return failure("provider.env-record.malformed", "the record lacks the final line feed");
  }
  const lines = text.slice(0, -1).split("\n");
  if (lines[0] !== resolved.header) {
    return failure("provider.env-record.malformed", "the record header is not the declared header");
  }
  const records = lines.slice(1);
  if (records.length > resolved.maxRecords) {
    return failure(
      "provider.env-record.oversized",
      "the record count exceeds the configured limit",
    );
  }
  const entries: EnvRecordEntry[] = [];
  const seen = new Set<string>();
  const allowlist = compileAllowlist(resolved.namePattern);
  for (const line of records) {
    if (utf8Bytes(line) > resolved.maxLineBytes) {
      return failure("provider.env-record.oversized", "a record line exceeds the line limit");
    }
    let entry: EnvRecordEntry;
    if (line.startsWith("set ")) {
      const body = line.slice(4);
      const equals = body.indexOf("=");
      if (equals <= 0) {
        return failure("provider.env-record.malformed", "a set record has no name/value separator");
      }
      entry = {
        operation: "set",
        name: body.slice(0, equals),
        value: body.slice(equals + 1),
      };
    } else if (line.startsWith("unset ")) {
      const name = line.slice(6);
      if (name.length === 0 || name.includes("=")) {
        return failure("provider.env-record.malformed", "an unset record has an invalid name");
      }
      entry = { operation: "unset", name };
    } else {
      return failure("provider.env-record.malformed", "a record line is neither set nor unset");
    }
    if (!nameAllowed(entry.name, allowlist)) {
      return failure(
        "provider.env-record.unauthorized",
        `name ${entry.name} is outside the configured allowlist`,
        entry.name,
      );
    }
    if (seen.has(entry.name)) {
      return failure(
        "provider.env-record.duplicate",
        `name ${entry.name} is duplicated`,
        entry.name,
      );
    }
    seen.add(entry.name);
    entries.push(entry);
  }
  return { ok: true, entries, variables: variablesOf(entries) };
};

export type ProfileEnvRecordInput = {
  readonly seatModels: Readonly<Record<string, string>>;
  readonly seats: Readonly<Record<string, ProviderProfileSeat>>;
  readonly namePrefix: string;
  readonly policy?: ProviderEnvRecordPolicy;
};

/** Derive the env-record name for a seat (explicit or `OC_<PREFIX>_AGENT_<SEAT>_MODEL`). */
export const envRecordNameForSeat = (
  seatName: string,
  seat: ProviderProfileSeat,
  namePrefix: string,
): string => {
  if (seat.envName !== undefined && seat.envName.length > 0) return seat.envName;
  const prefix = namePrefix.replace(/_+$/, "").toUpperCase();
  const seatToken = seatName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `OC_${prefix}_AGENT_${seatToken}_MODEL`;
};

/** Build, serialize, and validate the resolved model environment as data records. */
export const buildProfileEnvRecord = (
  input: ProfileEnvRecordInput,
):
  | { readonly ok: true; readonly record: EnvRecord }
  | { readonly ok: false; readonly error: EnvRecordValidationError } => {
  const entries: EnvRecordEntry[] = [];
  for (const seatName of Object.keys(input.seats).sort()) {
    const seat = input.seats[seatName];
    if (seat === undefined) {
      return {
        ok: false,
        error: {
          code: "provider.env-record.malformed",
          detail: `seat ${seatName} is not declared`,
        },
      };
    }
    entries.push({
      operation: "set",
      name: envRecordNameForSeat(seatName, seat, input.namePrefix),
      value: input.seatModels[seatName] ?? seat.model,
    });
  }
  const serialized = serializeEnvRecord(entries, input.policy);
  if (!serialized.ok) return serialized;
  const resolved = resolveEnvRecordPolicy(input.policy);
  const text = renderEnvRecord(entries, resolved);
  return {
    ok: true,
    record: { recordFormat: ENV_RECORD_FORMAT, entries, serialized: text },
  };
};
