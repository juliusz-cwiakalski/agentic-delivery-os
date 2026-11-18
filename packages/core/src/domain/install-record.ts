/**
 * The install record (F-8; DM-2, DEC-13).
 *
 * One record at `<config root>/install.json` under `install.record.v1`. One
 * shape, one reader tolerance (`absent`, `unreadable`, `record`), and no secret
 * field: every consumer tolerates an absent or damaged record without throwing,
 * and a record that cannot be parsed is reported unreadable rather than guessed.
 */
import {
  INSTALL_LAUNCHER_DISPOSITIONS,
  INSTALL_PROVENANCE_STATES,
  INSTALL_RECORD_SCHEMA,
  type InstallArtifactIdentity,
  type InstallLauncherDisposition,
  type InstallPathBlockRecord,
  type InstallProvenance,
  type InstallRecord,
} from "../contracts/install.js";

/** A tolerant record read. */
export type InstallRecordRead =
  | { readonly kind: "absent" }
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "record"; readonly record: InstallRecord };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

const identityFrom = (value: unknown): InstallArtifactIdentity | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    !isText(value.version) ||
    !isText(value.commit) ||
    !isText(value.builtAt) ||
    typeof value.dirty !== "boolean" ||
    !isText(value.channel)
  ) {
    return undefined;
  }
  return {
    version: value.version,
    commit: value.commit,
    builtAt: value.builtAt,
    dirty: value.dirty,
    channel: value.channel,
  };
};

const pathBlockFrom = (value: unknown): InstallPathBlockRecord | undefined => {
  if (!isRecord(value)) return undefined;
  return isText(value.file) && isText(value.marker)
    ? { file: value.file, marker: value.marker }
    : undefined;
};

/**
 * Parse one record text tolerantly.
 *
 * Every required field must be present and well-formed; an identity field that
 * cannot be read makes the record unreadable, never half-populated. The four
 * legitimately absent fields (source checkout, previous slot, launcher detail,
 * PATH block) may be omitted.
 */
export const parseInstallRecord = (text: string): InstallRecordRead => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { kind: "unreadable", reason: "the record is not valid JSON" };
  }
  if (!isRecord(parsed)) return { kind: "unreadable", reason: "the record is not an object" };
  if (parsed.schemaVersion !== INSTALL_RECORD_SCHEMA) {
    return { kind: "unreadable", reason: "the record carries no install.record.v1 schema" };
  }
  if (
    !isText(parsed.version) ||
    !isText(parsed.commit) ||
    !isText(parsed.builtAt) ||
    typeof parsed.dirty !== "boolean" ||
    !isText(parsed.channel)
  ) {
    return { kind: "unreadable", reason: "the record's identity fields are incomplete" };
  }
  if (!isText(parsed.stateSchemaVersion)) {
    return { kind: "unreadable", reason: "the record names no accepted state format" };
  }
  if (!(INSTALL_PROVENANCE_STATES as readonly unknown[]).includes(parsed.provenance)) {
    return { kind: "unreadable", reason: "the record's provenance is not declared" };
  }
  if (!isText(parsed.installedAt)) {
    return { kind: "unreadable", reason: "the record carries no install instant" };
  }
  if (!(INSTALL_LAUNCHER_DISPOSITIONS as readonly unknown[]).includes(parsed.launcherDisposition)) {
    return { kind: "unreadable", reason: "the record's launcher disposition is not declared" };
  }
  const previous = parsed.previous === undefined ? undefined : identityFrom(parsed.previous);
  if (parsed.previous !== undefined && previous === undefined) {
    return { kind: "unreadable", reason: "the record's previous identity is incomplete" };
  }
  const pathBlock = parsed.pathBlock === undefined ? undefined : pathBlockFrom(parsed.pathBlock);
  if (parsed.pathBlock !== undefined && pathBlock === undefined) {
    return { kind: "unreadable", reason: "the record's PATH block is incomplete" };
  }
  if (parsed.sourceCheckout !== undefined && !isText(parsed.sourceCheckout)) {
    return { kind: "unreadable", reason: "the record's source checkout is not a path" };
  }
  return {
    kind: "record",
    record: {
      schemaVersion: INSTALL_RECORD_SCHEMA,
      version: parsed.version,
      commit: parsed.commit,
      builtAt: parsed.builtAt,
      dirty: parsed.dirty,
      channel: parsed.channel,
      stateSchemaVersion: parsed.stateSchemaVersion,
      ...(parsed.sourceCheckout === undefined
        ? {}
        : { sourceCheckout: parsed.sourceCheckout as string }),
      provenance: parsed.provenance as InstallProvenance,
      installedAt: parsed.installedAt,
      ...(previous === undefined ? {} : { previous }),
      launcherDisposition: parsed.launcherDisposition as InstallLauncherDisposition,
      ...(parsed.launcherDetail === undefined
        ? {}
        : { launcherDetail: String(parsed.launcherDetail) }),
      ...(pathBlock === undefined ? {} : { pathBlock }),
    },
  };
};

/** Render the record deterministically, one JSON object and one newline. */
export const serializeInstallRecord = (record: InstallRecord): string =>
  `${JSON.stringify(
    {
      schemaVersion: record.schemaVersion,
      version: record.version,
      commit: record.commit,
      builtAt: record.builtAt,
      dirty: record.dirty,
      channel: record.channel,
      stateSchemaVersion: record.stateSchemaVersion,
      ...(record.sourceCheckout === undefined ? {} : { sourceCheckout: record.sourceCheckout }),
      provenance: record.provenance,
      installedAt: record.installedAt,
      ...(record.previous === undefined ? {} : { previous: record.previous }),
      launcherDisposition: record.launcherDisposition,
      ...(record.launcherDetail === undefined ? {} : { launcherDetail: record.launcherDetail }),
      ...(record.pathBlock === undefined ? {} : { pathBlock: record.pathBlock }),
    },
    null,
    2,
  )}\n`;

/** Read a record from the file port; an absent path is the `absent` state. */
export const readInstallRecord = (input: {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string | undefined;
  readonly path: string;
}): InstallRecordRead => {
  if (!input.exists(input.path)) return { kind: "absent" };
  const text = input.readText(input.path);
  if (text === undefined) return { kind: "unreadable", reason: "the record cannot be read" };
  return parseInstallRecord(text);
};

/** The record a successful replacing install writes, from its declared facts. */
export const buildInstallRecord = (input: {
  readonly identity: InstallArtifactIdentity;
  readonly stateSchemaVersion: string;
  readonly sourceCheckout?: string;
  readonly provenance: InstallProvenance;
  readonly installedAt: string;
  readonly previous?: InstallArtifactIdentity;
  readonly launcherDisposition: InstallLauncherDisposition;
  readonly launcherDetail?: string;
  readonly pathBlock?: InstallPathBlockRecord;
}): InstallRecord => ({
  schemaVersion: INSTALL_RECORD_SCHEMA,
  version: input.identity.version,
  commit: input.identity.commit,
  builtAt: input.identity.builtAt,
  dirty: input.identity.dirty,
  channel: input.identity.channel,
  stateSchemaVersion: input.stateSchemaVersion,
  ...(input.sourceCheckout === undefined ? {} : { sourceCheckout: input.sourceCheckout }),
  provenance: input.provenance,
  installedAt: input.installedAt,
  ...(input.previous === undefined ? {} : { previous: input.previous }),
  launcherDisposition: input.launcherDisposition,
  ...(input.launcherDetail === undefined ? {} : { launcherDetail: input.launcherDetail }),
  ...(input.pathBlock === undefined ? {} : { pathBlock: input.pathBlock }),
});
