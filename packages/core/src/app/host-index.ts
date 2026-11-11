/**
 * The derived host-index fold (GH-288 F-2, DEC-4, DEC-14, DEC-18).
 *
 * The index is a derived, revisioned cache: it is not a state record, never
 * overrides delivery state, and is rebuildable from checkouts. This module owns
 * the pure maintenance rule — upsert the current project, prune only entries
 * that are provably dead (recorded root absent, or the root's identity marker
 * resolves to a different project identifier), leave uncertain entries, compute
 * the next revision, always re-derive every reported state location, and refuse
 * to adopt a key the index already holds under another identifier.
 *
 * No write is produced when the maintained content is unchanged: the returned
 * document is `undefined`, so the caller performs exactly one read and at most
 * one write per maintaining invocation.
 */
import {
  HOST_INDEX_ARTIFACT_NAME,
  HOST_INDEX_CORRUPT_SUFFIX,
  HOST_INDEX_INITIAL_REVISION,
  HOST_INDEX_MAX_ENTRIES,
  HOST_INDEX_SCHEMA,
  type HostIndexConflict,
  type HostIndexDocument,
  type HostIndexEntry,
  type HostIndexMaintenanceOutcome,
  type HostIndexRegistration,
} from "../contracts/projects.js";
import { projectStateRoot } from "./state-scope.js";

/**
 * The bounded recorded-root probe supplied by the adapter composition.
 * `absent` proves the entry dead; a resolved identifier that differs from the
 * recorded one proves it dead; `uncertain` leaves the entry in place.
 */
export type HostIndexRootProbe =
  | { readonly state: "absent" }
  | { readonly state: "resolved"; readonly projectIdentifier: string }
  | { readonly state: "uncertain" };

/** One maintenance input: the read result plus the current registration. */
export type HostIndexMaintenanceInput = {
  readonly hostRoot: string;
  /** The parsed document, or `undefined` when the index is absent. */
  readonly document: HostIndexDocument | undefined;
  /** Whether the present bytes could not be parsed (corrupt for a read). */
  readonly corrupt: boolean;
  readonly registration: HostIndexRegistration;
  /** Probe one recorded checkout root's identity; bounded, read-only. */
  readonly probe: (root: string) => HostIndexRootProbe;
};

/** One maintenance result: the document to write (or `undefined`) and facts. */
export type HostIndexMaintenanceResult = {
  readonly outcome: HostIndexMaintenanceOutcome;
  /** The document to write; `undefined` means no write and no revision advance. */
  readonly next: HostIndexDocument | undefined;
  readonly revision: number;
  readonly entries: readonly HostIndexEntry[];
  readonly warnings: readonly string[];
  readonly conflict?: HostIndexConflict;
  /** The corrupt sibling name the caller must preserve once (DEC-14). */
  readonly preserveCorruptAs?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * Parse and validate one index document. A payload is accepted only when the
 * schema matches, the revision is a non-negative integer, and every entry
 * carries the five declared string fields with a single-segment project key.
 */
export const parseHostIndexDocument = (text: string): HostIndexDocument | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) return undefined;
  if (parsed.schema !== HOST_INDEX_SCHEMA) return undefined;
  const revision = parsed.revision;
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) return undefined;
  const projects = parsed.projects;
  if (!Array.isArray(projects)) return undefined;
  if (projects.length > HOST_INDEX_MAX_ENTRIES) return undefined;
  const entries: HostIndexEntry[] = [];
  for (const candidate of projects) {
    if (!isRecord(candidate)) return undefined;
    const { projectKey, projectIdentifier, root, stateLocation, lastWrittenAt } = candidate;
    if (
      !isNonEmptyString(projectKey) ||
      !isNonEmptyString(projectIdentifier) ||
      !isNonEmptyString(root) ||
      !isNonEmptyString(stateLocation) ||
      !isNonEmptyString(lastWrittenAt)
    ) {
      return undefined;
    }
    if (projectKey.includes("/") || projectKey.includes("\\")) return undefined;
    entries.push({ projectKey, projectIdentifier, root, stateLocation, lastWrittenAt });
  }
  return { schema: HOST_INDEX_SCHEMA, revision, projects: entries };
};

/** Serialize one index document (stable field order, newline-terminated). */
export const serializeHostIndexDocument = (document: HostIndexDocument): string =>
  `${JSON.stringify(
    {
      schema: document.schema,
      revision: document.revision,
      projects: document.projects.map((entry) => ({
        projectKey: entry.projectKey,
        projectIdentifier: entry.projectIdentifier,
        root: entry.root,
        stateLocation: entry.stateLocation,
        lastWrittenAt: entry.lastWrittenAt,
      })),
    },
    null,
    2,
  )}\n`;

/** The corrupt sibling name the maintenance preserves the bytes as (DEC-14). */
export const corruptHostIndexSiblingName = (recordedAt: string): string =>
  `${HOST_INDEX_ARTIFACT_NAME}.${recordedAt.replace(/[^0-9A-Za-z]+/gu, "-")}${HOST_INDEX_CORRUPT_SUFFIX}`;

const byKey = (left: HostIndexEntry, right: HostIndexEntry): number =>
  left.projectKey < right.projectKey ? -1 : left.projectKey > right.projectKey ? 1 : 0;

const ordered = (entries: readonly HostIndexEntry[]): readonly HostIndexEntry[] =>
  [...entries].sort(byKey).slice(0, HOST_INDEX_MAX_ENTRIES);

/** Content equality over the maintained fields; `lastWrittenAt` is not content. */
const sameContent = (
  left: readonly HostIndexEntry[],
  right: readonly HostIndexEntry[],
): boolean => {
  const a = ordered(left);
  const b = ordered(right);
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      entry.projectKey === other.projectKey &&
      entry.projectIdentifier === other.projectIdentifier &&
      entry.root === other.root &&
      entry.stateLocation === other.stateLocation
    );
  });
};

/**
 * Fold one maintenance step (F-2, DEC-4, DEC-14, DEC-18).
 *
 * Exactly one read feeds this fold; at most one write comes out of it. Pruning
 * removes index entries only and never touches a state root.
 */
export const maintainHostIndex = (input: HostIndexMaintenanceInput): HostIndexMaintenanceResult => {
  const { registration, hostRoot } = input;
  if (input.corrupt) {
    const fresh: HostIndexDocument = {
      schema: HOST_INDEX_SCHEMA,
      revision: HOST_INDEX_INITIAL_REVISION + 1,
      projects: [
        {
          projectKey: registration.projectKey,
          projectIdentifier: registration.projectIdentifier,
          root: registration.root,
          stateLocation: registration.stateLocation,
          lastWrittenAt: registration.recordedAt,
        },
      ],
    };
    const sibling = corruptHostIndexSiblingName(registration.recordedAt);
    return {
      outcome: "corrupt-replaced",
      next: fresh,
      revision: fresh.revision,
      entries: fresh.projects,
      warnings: [
        `the host index was unreadable and is replaced by a fresh index; the previous bytes were preserved as ${sibling}`,
      ],
      preserveCorruptAs: sibling,
    };
  }
  const existing = ordered(input.document?.projects ?? []);
  const revision = input.document?.revision ?? HOST_INDEX_INITIAL_REVISION;
  const warnings: string[] = [];

  // DEC-18: a key already held under another identifier is never adopted.
  const held = existing.find((entry) => entry.projectKey === registration.projectKey);
  if (held !== undefined && held.projectIdentifier !== registration.projectIdentifier) {
    return {
      outcome: "conflict",
      next: undefined,
      revision,
      entries: existing,
      warnings: [
        `project key ${registration.projectKey} is already registered to another checkout ` +
          `(${held.root} and ${registration.root}); the existing entry is kept unchanged`,
      ],
      conflict: {
        projectKey: registration.projectKey,
        existingIdentifier: held.projectIdentifier,
        existingRoot: held.root,
        candidateIdentifier: registration.projectIdentifier,
        candidateRoot: registration.root,
      },
    };
  }

  // Prune only provably dead entries; every uncertain entry stays.
  const kept: HostIndexEntry[] = [];
  for (const entry of existing) {
    const probe = input.probe(entry.root);
    const dead =
      probe.state === "absent" ||
      (probe.state === "resolved" && probe.projectIdentifier !== entry.projectIdentifier);
    if (!dead) kept.push(entry);
  }

  // Always re-derive every reported state location from its key (F-2, DEC-4).
  const rewritten = kept.map((entry) => {
    const derived = projectStateRoot(hostRoot, entry.projectKey);
    if (entry.stateLocation === derived) return entry;
    warnings.push(
      `project ${entry.projectKey} recorded state location ${entry.stateLocation} disagrees with ` +
        "the location derived from its key; the derived location is reported",
    );
    return { ...entry, stateLocation: derived };
  });

  const candidate: HostIndexEntry = {
    projectKey: registration.projectKey,
    projectIdentifier: registration.projectIdentifier,
    root: registration.root,
    stateLocation: registration.stateLocation,
    lastWrittenAt: registration.recordedAt,
  };
  const currentIndex = rewritten.findIndex((entry) => entry.projectKey === registration.projectKey);
  const nextEntries = [...rewritten];
  if (currentIndex < 0) {
    nextEntries.push(candidate);
  } else {
    const previous = rewritten[currentIndex];
    const moved =
      previous === undefined ||
      previous.root !== candidate.root ||
      previous.stateLocation !== candidate.stateLocation;
    // Nothing changed: keep the recorded `lastWrittenAt` so no write is needed.
    nextEntries[currentIndex] = moved
      ? candidate
      : { ...previous, lastWrittenAt: previous.lastWrittenAt };
  }

  const boundedEntries = ordered(nextEntries);
  if (sameContent(boundedEntries, existing)) {
    return {
      outcome: "unchanged",
      next: undefined,
      revision,
      entries: boundedEntries,
      warnings,
    };
  }
  const next: HostIndexDocument = {
    schema: HOST_INDEX_SCHEMA,
    revision: revision + 1,
    projects: boundedEntries,
  };
  return {
    outcome: "written",
    next,
    revision: next.revision,
    entries: boundedEntries,
    warnings,
  };
};
