/**
 * GH-365 F-3 — the migration plan builder (pure).
 *
 * Enumerates each scoped root's observable entries (the union of the source and
 * destination immediate children, so an already-migrated destination is
 * visible), classifies the source and destination ROOTS before enumerating, and
 * descends the declared container directories (`projects`, `documents.*`,
 * `quarantine.*`) into per-entry decisions. It applies the derived rule before
 * the five-row table and composes the run verdict. It performs no I/O beyond the
 * injected facts and writes nothing.
 */
import type {
  InstallFilePort,
  InstallMigrationRoot,
  MigrationDisposition,
  MigrationEntryData,
  MigrationRootData,
  MigrationRootLabel,
  MigrationRootScope,
  MigrationVerdict,
} from "#contracts";
import { entryFacts, factsEqual, type MigrationEntryFacts } from "./install-migration-digest.js";
import { composeVerdict, decideDerived, decideNonDerived } from "./install-migration-table.js";

export type PlannedEntry = MigrationEntryData & {
  readonly sourcePath?: string;
  readonly destinationPath?: string;
  readonly facts?: MigrationEntryFacts;
  readonly sourceIsSymlink: boolean;
  readonly destinationIsSymlink: boolean;
  /** The bounded remedy a symlink or differing-entry disposition reports. */
  readonly remedy?: string;
};

export type PlannedRoot = {
  readonly label: MigrationRootLabel;
  readonly scope: MigrationRootScope;
  readonly source?: string;
  readonly destination?: string;
  readonly sourceExisted: boolean;
  readonly entries: readonly PlannedEntry[];
  readonly verdict?: MigrationVerdict;
};

export type MigrationPlan = {
  readonly roots: readonly PlannedRoot[];
  readonly verdict: MigrationVerdict;
  readonly movedCount: number;
  readonly conflicts: readonly string[];
};

/** The bounded remedies AC-F3-1/F-3 step 6 require for both symlink sides. */
const SOURCE_SYMLINK_REMEDY =
  "replace it with the file or directory you intend to migrate, then re-run install migrate";
const DESTINATION_SYMLINK_REMEDY =
  "remove or re-point the destination symlink, then re-run install migrate";
const DIFFERING_CONFLICT_REMEDY =
  "resolve the difference between the two retained copies, then re-run install migrate";

const join = (base: string, name: string): string => `${base.replace(/\/+$/u, "")}/${name}`;

const absoluteJoin = (base: string, name: string): string => join(base, name);

/** DM-6's declared container directories; other subdirectories stay atomic. */
const isContainerDirectory = (name: string): boolean =>
  name === "projects" || name.startsWith("documents.") || name.startsWith("quarantine.");

type EntryInput = {
  readonly relativePath: string;
  readonly sourcePath: string;
  readonly destinationPath: string;
  readonly sourceStat: ReturnType<InstallFilePort["stat"]>;
  readonly destinationStat: ReturnType<InstallFilePort["stat"]>;
  readonly fs: InstallFilePort;
};

const derivedEntry = (input: EntryInput): PlannedEntry => {
  const disposition = decideDerived(input.destinationStat !== undefined);
  return {
    relativePath: input.relativePath,
    disposition,
    files: 0,
    bytes: 0,
    derived: true,
    reason:
      disposition === "already-migrated"
        ? "the destination copy wins; a derived entry is outside the move set"
        : "the destination re-derives it; a derived entry is outside the move set",
    sourcePath: input.sourcePath,
    destinationPath: input.destinationPath,
    sourceIsSymlink: input.sourceStat?.kind === "symlink",
    destinationIsSymlink: input.destinationStat?.kind === "symlink",
  };
};

const symlinkEntry = (input: EntryInput): PlannedEntry => {
  const sourceIsSymlink = input.sourceStat?.kind === "symlink";
  const destinationIsSymlink = input.destinationStat?.kind === "symlink";
  const disposition: MigrationDisposition = sourceIsSymlink ? "blocked" : "conflict";
  const path = sourceIsSymlink ? input.sourcePath : input.destinationPath;
  const remedy = sourceIsSymlink ? SOURCE_SYMLINK_REMEDY : DESTINATION_SYMLINK_REMEDY;
  return {
    relativePath: input.relativePath,
    disposition,
    files: 0,
    bytes: 0,
    reason: remedy,
    path,
    sourcePath: input.sourcePath,
    destinationPath: input.destinationPath,
    sourceIsSymlink,
    destinationIsSymlink,
    remedy,
  };
};

const nonDerivedEntry = (input: EntryInput): PlannedEntry => {
  const sourceIsSymlink = input.sourceStat?.kind === "symlink";
  const destinationIsSymlink = input.destinationStat?.kind === "symlink";
  const identical =
    input.sourceStat !== undefined &&
    input.destinationStat !== undefined &&
    !sourceIsSymlink &&
    !destinationIsSymlink &&
    factsEqual(
      entryFacts(input.fs, input.sourcePath, input.relativePath),
      entryFacts(input.fs, input.destinationPath, input.relativePath),
    );
  const disposition = decideNonDerived({
    sourceExists: input.sourceStat !== undefined,
    sourceIsSymlink,
    destinationExists: input.destinationStat !== undefined,
    destinationIsSymlink,
    identical,
  });
  const facts =
    input.sourceStat !== undefined && !sourceIsSymlink
      ? entryFacts(input.fs, input.sourcePath, input.relativePath)
      : undefined;
  const remedy =
    disposition === "blocked"
      ? SOURCE_SYMLINK_REMEDY
      : disposition !== "conflict"
        ? undefined
        : destinationIsSymlink
          ? DESTINATION_SYMLINK_REMEDY
          : DIFFERING_CONFLICT_REMEDY;
  const path =
    disposition === "blocked"
      ? input.sourcePath
      : disposition === "conflict"
        ? destinationIsSymlink
          ? input.destinationPath
          : input.sourcePath
        : undefined;
  return {
    relativePath: input.relativePath,
    disposition,
    files: facts?.fileCount ?? 0,
    bytes: facts?.byteCount ?? 0,
    ...(path === undefined ? {} : { path }),
    ...(remedy === undefined ? {} : { reason: remedy }),
    sourcePath: input.sourcePath,
    destinationPath: input.destinationPath,
    ...(facts === undefined ? {} : { facts }),
    sourceIsSymlink,
    destinationIsSymlink,
    ...(remedy === undefined ? {} : { remedy }),
  };
};

const planEntries = (input: {
  readonly prefix: string;
  readonly sourceDirectory: string;
  readonly destinationDirectory: string;
  readonly sourceExisted: boolean;
  readonly destinationExisted: boolean;
  readonly insideContainer: boolean;
  readonly fs: InstallFilePort;
  readonly derivedEntries: readonly string[];
}): PlannedEntry[] => {
  const names = new Set<string>();
  if (input.sourceExisted) for (const name of input.fs.list(input.sourceDirectory)) names.add(name);
  if (input.destinationExisted) {
    for (const name of input.fs.list(input.destinationDirectory)) names.add(name);
  }
  const entries: PlannedEntry[] = [];
  for (const name of [...names].sort()) {
    const relativePath = input.prefix.length === 0 ? name : `${input.prefix}/${name}`;
    const sourcePath = absoluteJoin(input.sourceDirectory, name);
    const destinationPath = absoluteJoin(input.destinationDirectory, name);
    const entry: EntryInput = {
      relativePath,
      sourcePath,
      destinationPath,
      sourceStat: input.sourceExisted ? input.fs.stat(sourcePath) : undefined,
      destinationStat: input.destinationExisted ? input.fs.stat(destinationPath) : undefined,
      fs: input.fs,
    };
    if (entry.sourceStat?.kind === "symlink" || entry.destinationStat?.kind === "symlink") {
      entries.push(symlinkEntry(entry));
      continue;
    }
    const descend =
      entry.sourceStat?.kind === "directory" &&
      entry.destinationStat?.kind === "directory" &&
      (input.insideContainer || isContainerDirectory(name));
    if (descend) {
      entries.push(
        ...planEntries({
          prefix: relativePath,
          sourceDirectory: sourcePath,
          destinationDirectory: destinationPath,
          sourceExisted: true,
          destinationExisted: true,
          insideContainer: true,
          fs: input.fs,
          derivedEntries: input.derivedEntries,
        }),
      );
      continue;
    }
    if (input.prefix.length === 0 && input.derivedEntries.includes(name)) {
      entries.push(derivedEntry(entry));
      continue;
    }
    entries.push(nonDerivedEntry(entry));
  }
  return entries;
};

const rootSymlinkEntry = (input: {
  readonly source: string;
  readonly destination: string;
  readonly sourceStat: ReturnType<InstallFilePort["stat"]>;
  readonly destinationStat: ReturnType<InstallFilePort["stat"]>;
}): PlannedEntry => {
  const sourceIsSymlink = input.sourceStat?.kind === "symlink";
  const disposition: MigrationDisposition = sourceIsSymlink ? "blocked" : "conflict";
  const path = sourceIsSymlink ? input.source : input.destination;
  const remedy = sourceIsSymlink ? SOURCE_SYMLINK_REMEDY : DESTINATION_SYMLINK_REMEDY;
  return {
    relativePath: ".",
    disposition,
    files: 0,
    bytes: 0,
    reason: remedy,
    path,
    sourcePath: input.source,
    destinationPath: input.destination,
    sourceIsSymlink,
    destinationIsSymlink: input.destinationStat?.kind === "symlink",
    remedy,
  };
};

const planRoot = (root: InstallMigrationRoot, fs: InstallFilePort): PlannedRoot => {
  if (root.scope === "unscoped") {
    return { label: root.label, scope: "unscoped", sourceExisted: false, entries: [] };
  }
  const source = root.source ?? "";
  const destination = root.destination ?? "";
  const sourceStat = fs.stat(source);
  const destinationStat = fs.stat(destination);
  const sourceExisted = sourceStat !== undefined;
  const destinationExisted = destinationStat !== undefined;

  // The ROOT itself is classified before its children: a root-level symlink is
  // never followed or renamed through (AC-F3-1, DM-6, §22).
  if (sourceStat?.kind === "symlink" || destinationStat?.kind === "symlink") {
    const entry = rootSymlinkEntry({ source, destination, sourceStat, destinationStat });
    return {
      label: root.label,
      scope: "scoped",
      source,
      destination,
      sourceExisted,
      entries: [entry],
      verdict: composeVerdict([entry.disposition], 0),
    };
  }

  const entries = planEntries({
    prefix: "",
    sourceDirectory: source,
    destinationDirectory: destination,
    sourceExisted,
    destinationExisted,
    insideContainer: false,
    fs,
    derivedEntries: root.derivedEntries ?? [],
  });
  const moved = entries.filter((entry) => entry.disposition === "moved").length;
  const verdict = composeVerdict(
    entries.map((entry) => entry.disposition),
    moved,
  );
  return {
    label: root.label,
    scope: "scoped",
    source,
    destination,
    sourceExisted,
    entries,
    verdict,
  };
};

/** Build the migration plan over the injected roots and filesystem facts. */
export const buildMigrationPlan = (input: {
  readonly roots: readonly InstallMigrationRoot[];
  readonly fs: InstallFilePort;
}): MigrationPlan => {
  const roots = input.roots.map((root) => planRoot(root, input.fs));
  const scoped = roots.filter((root) => root.scope === "scoped");
  const dispositions = scoped.flatMap((root) => root.entries.map((entry) => entry.disposition));
  const movedCount = scoped.reduce(
    (total, root) => total + root.entries.filter((entry) => entry.disposition === "moved").length,
    0,
  );
  const conflicts = migrationConflictPaths({
    roots,
    verdict: composeVerdict(dispositions, movedCount),
    movedCount,
    conflicts: [],
  });
  return {
    roots,
    verdict: composeVerdict(dispositions, movedCount),
    movedCount,
    conflicts,
  };
};

/**
 * The absolute conflict/blocked paths a run reports (API-2's `conflicts[]`).
 * A symlink or differing-entry finding carries its bounded remedy beside the
 * absolute path, so the payload and the human block name both.
 */
export const migrationConflictPaths = (plan: MigrationPlan): readonly string[] =>
  plan.roots
    .filter((root) => root.scope === "scoped")
    .flatMap((root) =>
      root.entries
        .filter((entry) => entry.disposition === "conflict" || entry.disposition === "blocked")
        .map((entry) => {
          const resolved = entry.path ?? entry.sourcePath ?? `${root.label}:${entry.relativePath}`;
          return entry.remedy === undefined ? resolved : `${resolved} — ${entry.remedy}`;
        }),
    );

/** Project the plan's roots onto the CLI payload shape. */
export const planRootsData = (plan: MigrationPlan): readonly MigrationRootData[] =>
  plan.roots.map((root) => ({
    label: root.label,
    scope: root.scope,
    ...(root.source === undefined ? {} : { source: root.source }),
    ...(root.destination === undefined ? {} : { destination: root.destination }),
    ...(root.verdict === undefined ? {} : { verdict: root.verdict }),
    entries: root.entries.map((entry) => ({
      relativePath: entry.relativePath,
      disposition: entry.disposition,
      files: entry.files,
      bytes: entry.bytes,
      ...(entry.path === undefined ? {} : { path: entry.path }),
      ...(entry.reason === undefined ? {} : { reason: entry.reason }),
      ...(entry.derived === undefined ? {} : { derived: entry.derived }),
    })),
  }));

export type { MigrationDisposition };
