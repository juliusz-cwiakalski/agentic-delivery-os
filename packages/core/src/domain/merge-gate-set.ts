/**
 * Pure declared-gate-set resolution and surface projection (GH-225 F-1, DM-4,
 * DEC-2, DEC-9, GAP-9).
 *
 * No I/O, clock, randomness, or ambient environment. An absent declaration
 * yields the shipped default set; a declared set replaces it wholesale and must
 * keep every built-in with its shipped recipe and surface. Built-in ids are
 * reserved. The effective identity (schema version plus entry ids) is the F-2
 * binding datum.
 */
import {
  MERGE_BUILTIN_GATE_IDS,
  MERGE_DEFAULT_GATE_SET,
  MERGE_GATE_ENTRY_FIELDS,
  MERGE_GATE_RECIPES,
  MERGE_GATE_SET_SCHEMA_VERSIONS,
  MERGE_GATE_SURFACES,
  MERGE_MAX_GATE_ID_CHARS,
  MERGE_MAX_GATES,
  type MergeBuiltinGateId,
  type MergeDeclaredGateSet,
  type MergeGateEntry,
  type MergeGateRecipe,
  type MergeGateSurface,
  OWNER_GATE_CLASSES,
  type OwnerGateClass,
} from "#contracts";

/** One classified declared-set failure (configuration taxonomy, exit 1). */
export type MergeGateSetFailure = {
  readonly code: "config.value.invalid";
  readonly detail: string;
  readonly entry?: string;
};

/** The effective set plus its surface projections and identity. */
export type MergeEffectiveGateSet = {
  readonly schemaVersion: string;
  readonly entries: readonly MergeGateEntry[];
  readonly ids: readonly string[];
  readonly identity: string;
  /** Entries the `verify gates` battery evaluates (battery or both). */
  readonly batteryEntries: readonly MergeGateEntry[];
  /** Entries the merge surface freshly evaluates (merge or both). */
  readonly mergeEntries: readonly MergeGateEntry[];
  /**
   * Entries the merge transaction enforces: the mandatory built-in safety
   * gates plus the merge projection. A declared battery-only entry is not
   * enforced at merge; the built-ins cannot be weakened by a declaration
   * (RSK-3, DEC-9).
   */
  readonly enforcedMergeEntries: readonly MergeGateEntry[];
};

const BUILTIN_SET: ReadonlySet<string> = new Set(MERGE_BUILTIN_GATE_IDS);

/** The effective identity: declared schema version plus the entry-id sequence. */
export const mergeGateSetIdentity = (set: {
  readonly schemaVersion: string;
  readonly entries: readonly MergeGateEntry[];
}): string => `${set.schemaVersion}:[${set.entries.map((entry) => entry.id).join(",")}]`;

const fail = (detail: string, entry?: string): MergeGateSetFailure => ({
  code: "config.value.invalid",
  detail,
  ...(entry === undefined ? {} : { entry }),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const GATE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const project = (
  schemaVersion: string,
  entries: readonly MergeGateEntry[],
): MergeEffectiveGateSet => {
  const enforced: MergeGateEntry[] = [];
  for (const entry of entries) {
    if (BUILTIN_SET.has(entry.id) || entry.surface === "merge" || entry.surface === "both") {
      enforced.push(entry);
    }
  }
  return {
    schemaVersion,
    entries,
    ids: entries.map((entry) => entry.id),
    identity: mergeGateSetIdentity({ schemaVersion, entries }),
    batteryEntries: entries.filter(
      (entry) => entry.surface === "battery" || entry.surface === "both",
    ),
    mergeEntries: entries.filter((entry) => entry.surface === "merge" || entry.surface === "both"),
    enforcedMergeEntries: enforced,
  };
};

const shippedEntry = (id: MergeBuiltinGateId): MergeGateEntry =>
  MERGE_DEFAULT_GATE_SET.entries.find((entry) => entry.id === id) as MergeGateEntry;

const sameEntry = (left: MergeGateEntry, right: MergeGateEntry): boolean =>
  left.id === right.id &&
  left.recipe === right.recipe &&
  left.surface === right.surface &&
  left.class === right.class &&
  left.job === right.job;

type ParsedEntry = { readonly entry: MergeGateEntry } | { readonly failure: MergeGateSetFailure };

const parseEntry = (value: unknown): ParsedEntry => {
  if (!isRecord(value)) return { failure: fail("a gate entry must be an object") };
  for (const key of Object.keys(value)) {
    if (!(MERGE_GATE_ENTRY_FIELDS as readonly string[]).includes(key)) {
      return { failure: fail(`gate entry carries an undeclared field "${key}"`) };
    }
  }
  const id = value.id;
  if (!isNonEmptyString(id)) return { failure: fail("a gate entry id is empty") };
  if (id.length > MERGE_MAX_GATE_ID_CHARS) {
    return { failure: fail("a gate entry id exceeds its cap", id) };
  }
  if (!GATE_ID_PATTERN.test(id)) {
    return { failure: fail(`gate id "${id}" is malformed`, id) };
  }
  const recipe = value.recipe;
  if (!isNonEmptyString(recipe) || !(MERGE_GATE_RECIPES as readonly string[]).includes(recipe)) {
    return { failure: fail(`gate "${id}" declares an undeclared recipe`, id) };
  }
  const surface = value.surface;
  if (!isNonEmptyString(surface) || !(MERGE_GATE_SURFACES as readonly string[]).includes(surface)) {
    return { failure: fail(`gate "${id}" declares an undeclared surface`, id) };
  }
  let ownerClass: OwnerGateClass | undefined;
  if (value.class !== undefined) {
    if (
      !isNonEmptyString(value.class) ||
      !(OWNER_GATE_CLASSES as readonly string[]).includes(value.class)
    ) {
      return { failure: fail(`gate "${id}" declares an undeclared class`, id) };
    }
    ownerClass = value.class as OwnerGateClass;
  }
  let job: string | undefined;
  if (value.job !== undefined) {
    if (!isNonEmptyString(value.job)) {
      return { failure: fail(`gate "${id}" declares an empty job`, id) };
    }
    job = value.job;
  }
  if (recipe === "required-ci-job" && job === undefined) {
    return { failure: fail(`gate "${id}" requires a job binding`, id) };
  }
  return {
    entry: {
      id,
      recipe: recipe as MergeGateRecipe,
      surface: surface as MergeGateSurface,
      ...(ownerClass === undefined ? {} : { class: ownerClass }),
      ...(job === undefined ? {} : { job }),
    },
  };
};

/**
 * Resolve a raw `merge.gates` configuration value into the effective set.
 *
 * An absent value is the shipped default. Unsupported versions, omitted
 * built-ins, reserved-id redefinitions, duplicate ids, malformed entries, and
 * extra fields are classified failures; the effective set is never silently
 * reduced.
 */
export const resolveMergeGateSet = (
  raw: unknown,
):
  | { readonly ok: true; readonly value: MergeEffectiveGateSet }
  | {
      readonly ok: false;
      readonly failure: MergeGateSetFailure;
    } => {
  if (raw === undefined || raw === null) {
    return {
      ok: true,
      value: project(MERGE_DEFAULT_GATE_SET.schemaVersion, MERGE_DEFAULT_GATE_SET.entries),
    };
  }
  if (!isRecord(raw)) {
    return { ok: false, failure: fail("merge.gates must be an object") };
  }
  for (const key of Object.keys(raw)) {
    if (key !== "schemaVersion" && key !== "entries") {
      return { ok: false, failure: fail(`merge.gates carries an undeclared field "${key}"`) };
    }
  }
  const schemaVersion = raw.schemaVersion;
  if (
    !isNonEmptyString(schemaVersion) ||
    !(MERGE_GATE_SET_SCHEMA_VERSIONS as readonly string[]).includes(schemaVersion)
  ) {
    return {
      ok: false,
      failure: fail(`unsupported gate-set schema version "${String(schemaVersion)}"`),
    };
  }
  const rawEntries = raw.entries;
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return { ok: false, failure: fail("merge.gates.entries must be a non-empty list") };
  }
  if (rawEntries.length > MERGE_MAX_GATES) {
    return { ok: false, failure: fail("merge.gates.entries exceeds its cap") };
  }
  const entries: MergeGateEntry[] = [];
  const seen = new Set<string>();
  for (const rawEntry of rawEntries) {
    const parsed = parseEntry(rawEntry);
    if ("failure" in parsed) return { ok: false, failure: parsed.failure };
    if (seen.has(parsed.entry.id)) {
      return {
        ok: false,
        failure: fail(`duplicate gate id "${parsed.entry.id}"`, parsed.entry.id),
      };
    }
    seen.add(parsed.entry.id);
    entries.push(parsed.entry);
  }
  for (const id of MERGE_BUILTIN_GATE_IDS) {
    const declared = entries.find((entry) => entry.id === id);
    if (declared === undefined) {
      return {
        ok: false,
        failure: fail(`declared set omits the mandatory built-in "${id}"`, id),
      };
    }
    const shipped = shippedEntry(id);
    if (!sameEntry(declared, shipped)) {
      return {
        ok: false,
        failure: fail(
          `built-in "${id}" must keep its shipped recipe, surface, and class binding`,
          id,
        ),
      };
    }
  }
  return {
    ok: true,
    value: project(schemaVersion, entries),
  };
};

/** Resolve the effective set from a resolved configuration snapshot. */
export const resolveMergeGateSetFromConfig = (
  values: Readonly<Record<string, unknown>>,
):
  | { readonly ok: true; readonly value: MergeEffectiveGateSet }
  | {
      readonly ok: false;
      readonly failure: MergeGateSetFailure;
    } => {
  const merge = values.merge;
  if (!isRecord(merge))
    return {
      ok: true,
      value: project(MERGE_DEFAULT_GATE_SET.schemaVersion, MERGE_DEFAULT_GATE_SET.entries),
    };
  return resolveMergeGateSet(merge.gates);
};

/** The battery projection: battery or both entries, in declared order. */
export const batteryGateEntries = (set: MergeEffectiveGateSet): readonly MergeGateEntry[] =>
  set.batteryEntries;

/** The fresh merge projection: merge or both entries, in declared order. */
export const mergeSurfaceEntries = (set: MergeEffectiveGateSet): readonly MergeGateEntry[] =>
  set.mergeEntries;

/** The enforced merge set: mandatory built-ins plus the merge projection. */
export const enforcedMergeGateEntries = (set: MergeEffectiveGateSet): readonly MergeGateEntry[] =>
  set.enforcedMergeEntries;

/** One declared set as a plain declaration (for identity round-trips). */
export const declaredGateSetOf = (set: MergeEffectiveGateSet): MergeDeclaredGateSet => ({
  schemaVersion: set.schemaVersion as MergeDeclaredGateSet["schemaVersion"],
  entries: set.entries,
});
