/**
 * Bounded discovery and one-shot reads of the legacy provider-policy sources
 * (GH-350 F-6, DM-7; TDR-0060 D1/D2).
 *
 * Sources are the legacy profile directory (`<home>/<priorDirectoryName>/config/
 * profiles/*.sh`) and the pre-iteration hook
 * (`<home>/<priorDirectoryName>/hooks/pre-opencode-iteration`); the command's
 * flags override either path. Each present source is opened exactly once and
 * bounded by the three declared caps. Nothing here parses the content: the pure
 * migration grammar does that, so no value ever reaches this edge.
 */
import {
  PROVIDER_MIGRATE_MAX_SOURCES,
  PROVIDER_MIGRATE_SOURCE_MAX_BYTES,
  PROVIDER_MIGRATE_SOURCE_MAX_LINES,
} from "@delivery-os/core/contracts";
import type { FileSystemFacts } from "./config-source.js";

/** The filesystem facts a migration read needs; listing is required for a directory. */
export type ProviderMigrateFileSystem = FileSystemFacts & {
  readonly readDirectory?: (path: string) => readonly string[];
};

export type ProviderMigrateSourceKind = "profiles" | "hook";

export type ProviderMigrateSourceRefusalReason =
  | "no-source"
  | "unreadable-source"
  | "oversized-source";

export type ProviderMigrateSourcesFailure = {
  readonly ok: false;
  readonly reason: ProviderMigrateSourceRefusalReason;
  readonly summary: string;
  readonly source?: string;
};

export type ProviderMigrateSourceFile = {
  readonly kind: ProviderMigrateSourceKind;
  readonly path: string;
  readonly text: string;
  readonly bytes: number;
  readonly lines: number;
};

export type ProviderMigrateSourceState = {
  readonly kind: ProviderMigrateSourceKind;
  readonly path: string;
  readonly state: "read" | "absent";
  readonly bytes?: number;
};

export type ProviderMigrateSourcesRead =
  | {
      readonly ok: true;
      readonly sources: readonly ProviderMigrateSourceFile[];
      readonly states: readonly ProviderMigrateSourceState[];
    }
  | ProviderMigrateSourcesFailure;

export type ProviderMigrateSourcesInput = {
  readonly homeDirectory: string;
  /**
   * The prior identity's configuration-directory name (for example
   * `.delivery-os`), which is the brand-derived `.<priorWorkingName>` directory.
   * Absent means the invoking identity declares no prior identity, so the legacy
   * identity does not exist.
   */
  readonly priorDirectoryName?: string;
  readonly profilesDir?: string;
  readonly hookPath?: string;
  readonly fs: ProviderMigrateFileSystem;
};

const NO_PRIOR_IDENTITY = "(no prior identity declared)" as const;

const join = (...parts: readonly string[]): string =>
  parts
    .join("/")
    .replaceAll(/\/{2,}/gu, "/")
    .replace(/\/$/u, "");

const refuse = (
  reason: ProviderMigrateSourceRefusalReason,
  summary: string,
  source?: string,
): ProviderMigrateSourcesFailure => ({
  ok: false,
  reason,
  summary,
  ...(source === undefined ? {} : { source }),
});

const unreadable = (path: string): ProviderMigrateSourcesFailure =>
  refuse("unreadable-source", "cannot be read as one regular file", path);

const oversized = (path: string, detail: string): ProviderMigrateSourcesFailure =>
  refuse("oversized-source", detail, path);

/** Read one source once and enforce the byte and line caps. */
const readSource = (
  input: ProviderMigrateSourcesInput,
  kind: ProviderMigrateSourceKind,
  path: string,
):
  | { readonly ok: true; readonly source: ProviderMigrateSourceFile }
  | ProviderMigrateSourcesFailure => {
  // Size first: an oversized path is refused from its stat entry and its text is
  // never allocated. The post-read byte/line checks below stay as defence in
  // depth for injected facts that cannot supply a size.
  const declaredSize = input.fs.size?.(path);
  if (declaredSize !== undefined && declaredSize > PROVIDER_MIGRATE_SOURCE_MAX_BYTES) {
    return oversized(
      path,
      `is ${declaredSize} bytes; PROVIDER_MIGRATE_SOURCE_MAX_BYTES = ${PROVIDER_MIGRATE_SOURCE_MAX_BYTES}`,
    );
  }
  let text: string;
  try {
    text = input.fs.readText(path);
  } catch {
    return unreadable(path);
  }
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > PROVIDER_MIGRATE_SOURCE_MAX_BYTES) {
    return oversized(
      path,
      `is ${bytes} bytes; PROVIDER_MIGRATE_SOURCE_MAX_BYTES = ${PROVIDER_MIGRATE_SOURCE_MAX_BYTES}`,
    );
  }
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  if (lines > PROVIDER_MIGRATE_SOURCE_MAX_LINES) {
    return oversized(
      path,
      `is ${lines} lines; PROVIDER_MIGRATE_SOURCE_MAX_LINES = ${PROVIDER_MIGRATE_SOURCE_MAX_LINES}`,
    );
  }
  return { ok: true, source: { kind, path, text, bytes, lines } };
};

/**
 * Discover and read the legacy sources.
 *
 * An absent source is reported `absent`, never an error; a directory that exists
 * but cannot be listed, a path that is not a readable regular file, and any
 * declared cap violation are classified refusals. When nothing is present the
 * read refuses `no-source`.
 */
export const readProviderMigrateSources = (
  input: ProviderMigrateSourcesInput,
): ProviderMigrateSourcesRead => {
  const prior = input.priorDirectoryName;
  const profilesDirectory =
    input.profilesDir ??
    (prior === undefined ? undefined : join(input.homeDirectory, prior, "config", "profiles"));
  const hookPath =
    input.hookPath ??
    (prior === undefined
      ? undefined
      : join(input.homeDirectory, prior, "hooks", "pre-opencode-iteration"));

  const sources: ProviderMigrateSourceFile[] = [];
  const states: ProviderMigrateSourceState[] = [];

  // Profiles: the directory's `.sh` files, sorted so directory order is never an
  // input.
  const profilesPath = profilesDirectory ?? NO_PRIOR_IDENTITY;
  if (profilesDirectory === undefined || !input.fs.exists(profilesDirectory)) {
    states.push({ kind: "profiles", path: profilesPath, state: "absent" });
  } else {
    const list = input.fs.readDirectory;
    if (list === undefined) return unreadable(profilesDirectory);
    let entries: readonly string[];
    try {
      entries = [...list(profilesDirectory)];
    } catch {
      return unreadable(profilesDirectory);
    }
    const files = entries.filter((entry) => entry.endsWith(".sh")).sort();
    for (const file of files) {
      if (sources.length + 1 > PROVIDER_MIGRATE_MAX_SOURCES) {
        return oversized(
          profilesDirectory,
          `declares more than PROVIDER_MIGRATE_MAX_SOURCES = ${PROVIDER_MIGRATE_MAX_SOURCES} sources`,
        );
      }
      const read = readSource(input, "profiles", join(profilesDirectory, file));
      if (!read.ok) return read;
      sources.push(read.source);
    }
    states.push({
      kind: "profiles",
      path: profilesDirectory,
      state: files.length === 0 ? "absent" : "read",
      ...(files.length === 0 ? {} : { bytes: sources.reduce((sum, item) => sum + item.bytes, 0) }),
    });
  }

  // Hook: one file, read once.
  const hookLabel = hookPath ?? NO_PRIOR_IDENTITY;
  if (hookPath !== undefined && input.fs.exists(hookPath)) {
    if (sources.length + 1 > PROVIDER_MIGRATE_MAX_SOURCES) {
      return oversized(
        hookPath,
        `declares more than PROVIDER_MIGRATE_MAX_SOURCES = ${PROVIDER_MIGRATE_MAX_SOURCES} sources`,
      );
    }
    const read = readSource(input, "hook", hookPath);
    if (!read.ok) return read;
    sources.push(read.source);
    states.push({ kind: "hook", path: hookPath, state: "read", bytes: read.source.bytes });
  } else {
    states.push({ kind: "hook", path: hookLabel, state: "absent" });
  }

  if (sources.length === 0) {
    return refuse(
      "no-source",
      "neither the legacy profile directory nor the hook exists; declare provider policy in configuration, or pass --profiles-dir/--hook",
    );
  }
  return { ok: true, sources, states };
};
