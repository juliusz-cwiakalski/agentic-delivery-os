/**
 * GH-365 F-3 — the migration plan builder (pure).
 *
 * Enumerates each scoped root's observable entries (the union of the source and
 * destination immediate children, so an already-migrated destination is
 * visible), applies the derived rule before the five-row table, and composes the
 * run verdict. It performs no I/O beyond the injected facts and writes nothing.
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

const join = (base: string, name: string): string => `${base.replace(/\/+$/u, "")}/${name}`;

const absoluteJoin = (base: string, name: string): string => join(base, name);

const builtEntry = (input: {
  readonly name: string;
  readonly sourcePath: string;
  readonly destinationPath: string;
  readonly sourceStat: ReturnType<InstallFilePort["stat"]>;
  readonly destinationStat: ReturnType<InstallFilePort["stat"]>;
  readonly fs: InstallFilePort;
  readonly derivedEntries: readonly string[];
}): PlannedEntry => {
  const derived = input.derivedEntries.includes(input.name);
  if (derived) {
    const disposition = decideDerived(input.destinationStat !== undefined);
    return {
      relativePath: input.name,
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
  }
  const sourceIsSymlink = input.sourceStat?.kind === "symlink";
  const destinationIsSymlink = input.destinationStat?.kind === "symlink";
  const identical =
    input.sourceStat !== undefined &&
    input.destinationStat !== undefined &&
    !sourceIsSymlink &&
    !destinationIsSymlink &&
    factsEqual(
      entryFacts(input.fs, input.sourcePath, input.name),
      entryFacts(input.fs, input.destinationPath, input.name),
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
      ? entryFacts(input.fs, input.sourcePath, input.name)
      : undefined;
  return {
    relativePath: input.name,
    disposition,
    files: facts?.fileCount ?? 0,
    bytes: facts?.byteCount ?? 0,
    ...(disposition === "blocked"
      ? { reason: "a source symlink entry is never followed and never moved" }
      : disposition === "conflict" && destinationIsSymlink
        ? { reason: "a destination symlink entry is never followed; both sides are retained" }
        : {}),
    sourcePath: input.sourcePath,
    destinationPath: input.destinationPath,
    ...(facts === undefined ? {} : { facts }),
    sourceIsSymlink,
    destinationIsSymlink,
  };
};

const planRoot = (root: InstallMigrationRoot, fs: InstallFilePort): PlannedRoot => {
  if (root.scope === "unscoped") {
    return { label: root.label, scope: "unscoped", sourceExisted: false, entries: [] };
  }
  const source = root.source ?? "";
  const destination = root.destination ?? "";
  const sourceExisted = fs.exists(source);
  const destinationExisted = fs.exists(destination);
  const names = new Set<string>();
  if (sourceExisted) for (const name of fs.list(source)) names.add(name);
  if (destinationExisted) for (const name of fs.list(destination)) names.add(name);
  const entries = [...names].sort().map((name) =>
    builtEntry({
      name,
      sourcePath: absoluteJoin(source, name),
      destinationPath: absoluteJoin(destination, name),
      sourceStat: sourceExisted ? fs.stat(absoluteJoin(source, name)) : undefined,
      destinationStat: destinationExisted ? fs.stat(absoluteJoin(destination, name)) : undefined,
      fs,
      derivedEntries: root.derivedEntries ?? [],
    }),
  );
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

/** The absolute conflict/blocked paths a run reports (API-2's `conflicts[]`). */
export const migrationConflictPaths = (plan: MigrationPlan): readonly string[] =>
  plan.roots
    .filter((root) => root.scope === "scoped")
    .flatMap((root) =>
      root.entries
        .filter((entry) => entry.disposition === "conflict" || entry.disposition === "blocked")
        .map((entry) =>
          entry.sourcePath === undefined ? `${root.label}:${entry.relativePath}` : entry.sourcePath,
        ),
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
      ...(entry.reason === undefined ? {} : { reason: entry.reason }),
      ...(entry.derived === undefined ? {} : { derived: entry.derived }),
    })),
  }));

export type { MigrationDisposition };
