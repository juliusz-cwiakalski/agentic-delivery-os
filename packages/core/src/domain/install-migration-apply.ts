/**
 * GH-365 F-3 — the migration apply step (pure over injected facts).
 *
 * Copy and digest-verify the backup, write the manifest BEFORE the first move,
 * then move every planned non-derived entry without rewriting a byte. A
 * differing entry is never deleted or overwritten; a symlink is never followed.
 * No record of any kind is written here (the command-audit suppression is the
 * CLI runner's declared property).
 */
import type {
  InstallArtifactIdentity,
  InstallFilePort,
  InstallPathBlockRecord,
  MigrationManifestPayload,
  MigrationVerdict,
} from "#contracts";
import { entryFacts, factsEqual } from "./install-migration-digest.js";
import {
  buildMigrationManifest,
  movedEntries,
  serializeMigrationManifest,
} from "./install-migration-manifest.js";
import type { MigrationPlan, PlannedEntry, PlannedRoot } from "./install-migration-plan.js";
import { composeVerdict } from "./install-migration-table.js";

export type MigrationApplyFailureCode = "state.write.failed" | "state.permission.denied";

export type MigrationApplyResult = {
  readonly plan: MigrationPlan;
  readonly backupPath?: string;
  readonly manifest?: MigrationManifestPayload;
  readonly moved: number;
  readonly retiredRoots: readonly string[];
  readonly residuals: readonly string[];
  readonly verdict: MigrationVerdict;
  readonly failureCode?: MigrationApplyFailureCode;
  readonly failureDetail?: string;
};

type PlannedMove = { readonly root: PlannedRoot; readonly entry: PlannedEntry };

const joinPath = (base: string, name: string): string => `${base.replace(/\/+$/u, "")}/${name}`;

const parentDirectory = (path: string): string => {
  const trimmed = path.replace(/\/+$/u, "");
  const index = trimmed.lastIndexOf("/");
  return index <= 0 ? "/" : trimmed.slice(0, index);
};

const stampOf = (iso: string): string => {
  const digits = iso.replace(/[^0-9]/gu, "");
  return digits.length >= 14 ? digits.slice(0, 14) : `run${digits}`;
};

/** The run-stamp directory name derived from the injected clock (deterministic). */
export const migrationStamp = stampOf;

/** The would-be backup path for one run (used by a dry run too). */
export const migrationBackupPath = (backupRoot: string, iso: string): string =>
  joinPath(backupRoot, stampOf(iso));

const copyNode = (fs: InstallFilePort, source: string, target: string): boolean => {
  const stat = fs.stat(source);
  if (stat === undefined) return false;
  if (stat.kind === "file") {
    if (!fs.mkdirp(parentDirectory(target))) return false;
    const staged = fs.copyStaged(target, source, stat.executable ? 0o755 : 0o644);
    if (!staged.ok) return false;
    if (!fs.rename(staged.stagedPath, target)) {
      fs.remove(staged.stagedPath);
      return false;
    }
    return true;
  }
  if (stat.kind === "directory") {
    if (!fs.mkdirp(target)) return false;
    for (const name of fs.list(source)) {
      if (!copyNode(fs, joinPath(source, name), joinPath(target, name))) return false;
    }
    return true;
  }
  return false;
};

/**
 * Merge one file into an existing destination directory: copy to a fresh staged
 * file beside the target, verify the bytes, rename the staged file into place,
 * and only then remove the source. A missing or differing copy leaves both
 * sides intact (F-3 step 5: copy-then-verify-then-remove, never a rewrite).
 */
const mergeFile = (fs: InstallFilePort, source: string, target: string): boolean => {
  const stat = fs.stat(source);
  if (stat === undefined || stat.kind !== "file") return false;
  const staged = fs.copyStaged(target, source, stat.executable ? 0o755 : 0o644);
  if (!staged.ok) return false;
  const sourceDigest = fs.digest(source);
  const stagedDigest = fs.digest(staged.stagedPath);
  if (sourceDigest === undefined || stagedDigest === undefined || sourceDigest !== stagedDigest) {
    fs.remove(staged.stagedPath);
    return false;
  }
  if (!fs.rename(staged.stagedPath, target)) {
    fs.remove(staged.stagedPath);
    return false;
  }
  return fs.remove(source);
};

const writeManifest = (
  fs: InstallFilePort,
  path: string,
  manifest: MigrationManifestPayload,
): boolean => {
  if (!fs.mkdirp(parentDirectory(path))) return false;
  const staged = fs.writeStaged(
    path,
    new TextEncoder().encode(serializeMigrationManifest(manifest)),
    0o644,
  );
  if (!staged.ok) return false;
  if (!fs.rename(staged.stagedPath, path)) {
    fs.remove(staged.stagedPath);
    return false;
  }
  return true;
};

const moveKey = (root: PlannedRoot, entry: PlannedEntry): string =>
  `${root.label}\u0000${entry.relativePath}`;

const composeFinalPlan = (plan: MigrationPlan, moved: ReadonlySet<string>): MigrationPlan => {
  const roots = plan.roots.map((root): PlannedRoot => {
    if (root.scope !== "scoped") return root;
    let movedInRoot = 0;
    const entries = root.entries.map((entry): PlannedEntry => {
      if (entry.disposition !== "moved") return entry;
      if (moved.has(moveKey(root, entry))) {
        movedInRoot += 1;
        return entry;
      }
      return {
        ...entry,
        disposition: "blocked",
        reason:
          "the planned move did not complete; the entry remains in the source and the backup is complete",
      };
    });
    return {
      ...root,
      entries,
      verdict: composeVerdict(
        entries.map((entry) => entry.disposition),
        movedInRoot,
      ),
    };
  });
  const scoped = roots.filter((root) => root.scope === "scoped");
  const dispositions = scoped.flatMap((root) => root.entries.map((entry) => entry.disposition));
  const movedCount = scoped.reduce(
    (total, root) => total + root.entries.filter((entry) => entry.disposition === "moved").length,
    0,
  );
  return {
    roots,
    verdict: composeVerdict(dispositions, movedCount),
    movedCount,
    conflicts: plan.conflicts,
  };
};

const retainedSourceEntries = (root: PlannedRoot, fs: InstallFilePort): readonly string[] =>
  root.entries
    .filter(
      (entry) =>
        entry.derived !== true &&
        entry.sourcePath !== undefined &&
        entry.disposition !== "moved" &&
        fs.stat(entry.sourcePath) !== undefined,
    )
    .map((entry) => entry.sourcePath as string);

const residualsOf = (
  plan: MigrationPlan,
  fs: InstallFilePort,
  retiredRoots: readonly string[],
): readonly string[] => {
  const residuals: string[] = [];
  for (const root of plan.roots) {
    if (root.scope !== "scoped" || root.source === undefined) continue;
    if (retiredRoots.includes(root.source)) continue;
    for (const entry of root.entries) {
      if (entry.sourcePath === undefined || fs.stat(entry.sourcePath) === undefined) continue;
      const path = entry.path ?? entry.sourcePath;
      const detail = entry.reason === undefined ? "" : ` — ${entry.reason}`;
      if (entry.derived === true) {
        residuals.push(`derived residual: ${entry.sourcePath} (safe to delete)`);
      } else if (entry.disposition === "conflict") {
        residuals.push(`conflict retained: ${path}${detail}`);
      } else if (entry.disposition === "duplicate-identical") {
        residuals.push(`duplicate-identical retained: ${path}${detail}`);
      } else if (entry.disposition === "blocked") {
        residuals.push(`blocked retained: ${path}${detail}`);
      }
    }
  }
  return residuals;
};

const managedPathResidual = (
  block: InstallPathBlockRecord | undefined,
  fs: InstallFilePort,
  priorPrefixes: readonly string[],
): string | undefined => {
  if (block === undefined) return undefined;
  const text = fs.readText(block.file);
  if (text === undefined) return undefined;
  if (!priorPrefixes.some((prefix) => text.includes(prefix))) return undefined;
  return (
    `managed PATH block: ${block.file} names a path under a prior root; ` +
    "re-run the installed artifact's `install` to re-point it"
  );
};

/**
 * Apply a plan. `failAtOrdinal` is the injected partial-failure seam: returning
 * true at the 1-based move ordinal stops the run before that move; the backup
 * and manifest already cover every planned entry.
 */
export const applyMigrationPlan = (input: {
  readonly plan: MigrationPlan;
  readonly fs: InstallFilePort;
  readonly runId: string;
  readonly createdAt: string;
  readonly artifactIdentity?: InstallArtifactIdentity;
  readonly backupRoot: string;
  readonly failAtOrdinal?: (ordinal: number) => boolean;
  readonly onMove?: (ordinal: number) => void;
  readonly managedPathBlock?: InstallPathBlockRecord;
  readonly priorPrefixes: readonly string[];
}): MigrationApplyResult => {
  const planned: readonly PlannedMove[] = movedEntries(input.plan);
  const movedKeys = new Set<string>();
  let backupPath: string | undefined;
  let manifest: MigrationManifestPayload | undefined;

  if (planned.length > 0) {
    backupPath = joinPath(input.backupRoot, stampOf(input.createdAt));
    if (!input.fs.mkdirp(backupPath)) {
      return {
        plan: input.plan,
        moved: 0,
        retiredRoots: [],
        residuals: [],
        verdict: input.plan.verdict,
        failureCode: "state.write.failed",
        failureDetail: "the backup directory could not be created",
      };
    }
    for (const { root, entry } of planned) {
      const sourcePath = entry.sourcePath;
      if (sourcePath === undefined) continue;
      const target = joinPath(joinPath(backupPath, root.label), entry.relativePath);
      if (!copyNode(input.fs, sourcePath, target)) {
        return {
          plan: input.plan,
          backupPath,
          moved: 0,
          retiredRoots: [],
          residuals: [],
          verdict: input.plan.verdict,
          failureCode: "state.write.failed",
          failureDetail: `the backup copy of ${sourcePath} could not be written`,
        };
      }
      const verified = factsEqual(
        entryFacts(input.fs, target, entry.relativePath),
        entry.facts ?? { files: [], fileCount: 0, byteCount: 0 },
      );
      if (!verified) {
        return {
          plan: input.plan,
          backupPath,
          moved: 0,
          retiredRoots: [],
          residuals: [],
          verdict: input.plan.verdict,
          failureCode: "state.write.failed",
          failureDetail: `the backup copy of ${sourcePath} did not verify`,
        };
      }
    }
    manifest = buildMigrationManifest({
      plan: input.plan,
      runId: input.runId,
      createdAt: input.createdAt,
      ...(input.artifactIdentity === undefined ? {} : { artifactIdentity: input.artifactIdentity }),
    });
    if (!writeManifest(input.fs, joinPath(backupPath, "manifest.json"), manifest)) {
      return {
        plan: input.plan,
        backupPath,
        moved: 0,
        retiredRoots: [],
        residuals: [],
        verdict: input.plan.verdict,
        failureCode: "state.write.failed",
        failureDetail: "the backup manifest could not be written before the first move",
      };
    }
  }

  let moved = 0;
  for (const [index, { root, entry }] of planned.entries()) {
    if (input.failAtOrdinal?.(index + 1) === true) break;
    input.onMove?.(index + 1);
    const sourcePath = entry.sourcePath;
    const destinationPath = entry.destinationPath;
    if (sourcePath === undefined || destinationPath === undefined) break;
    const parent = parentDirectory(destinationPath);
    const merges =
      input.fs.stat(sourcePath)?.kind === "file" && input.fs.stat(parent)?.kind === "directory";
    if (!input.fs.mkdirp(parent)) break;
    const completed = merges
      ? mergeFile(input.fs, sourcePath, destinationPath)
      : input.fs.rename(sourcePath, destinationPath);
    if (!completed) break;
    moved += 1;
    movedKeys.add(moveKey(root, entry));
  }

  const finalPlan = composeFinalPlan(input.plan, movedKeys);

  const retiredRoots: string[] = [];
  for (const root of finalPlan.roots) {
    if (root.scope !== "scoped" || !root.sourceExisted || root.source === undefined) continue;
    if (retainedSourceEntries(root, input.fs).length > 0) continue;
    if (input.fs.removeTree(root.source)) retiredRoots.push(root.source);
  }

  const residuals = [...residualsOf(finalPlan, input.fs, retiredRoots)];
  const managed = managedPathResidual(input.managedPathBlock, input.fs, input.priorPrefixes);
  if (managed !== undefined && !residuals.includes(managed)) residuals.push(managed);

  return {
    plan: finalPlan,
    ...(backupPath === undefined ? {} : { backupPath }),
    ...(manifest === undefined ? {} : { manifest }),
    moved,
    retiredRoots,
    residuals,
    verdict: finalPlan.verdict,
  };
};
