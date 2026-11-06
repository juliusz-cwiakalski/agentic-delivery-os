/**
 * Precise staging-set computation (GH-227 F-5, DEC-15).
 *
 * Tracked pending work is always staged, with scope drift disclosed. Untracked
 * files are staged only inside the declared scope; untracked material outside
 * every declared scope is a stray and is never staged. Forbidden paths and
 * oversized binaries are excluded and disclosed. An empty remaining set is the
 * caller's `commit.staging-blocked-untracked` classification.
 */
import {
  COMMIT_FORBIDDEN_PATH_PATTERNS,
  COMMIT_MAX_BINARY_BYTES,
  type CommitCandidateFile,
  type CommitExcludedEntry,
  type CommitScopeSource,
  type CommitStagingPlan,
} from "#contracts";
import { packageCovers } from "./plan-paths.js";

/** One staging computation input; all facts are resolved before this call. */
export type CommitStagingInput = {
  readonly files: readonly CommitCandidateFile[];
  readonly scopePaths: readonly string[];
  readonly scopeSource: CommitScopeSource;
  readonly forbiddenPatterns?: readonly string[];
  readonly maxBinaryBytes?: number;
};

const FORBIDDEN = COMMIT_FORBIDDEN_PATH_PATTERNS.map((pattern) => new RegExp(pattern));

const isForbidden = (path: string, extra: readonly RegExp[]): boolean =>
  [...FORBIDDEN, ...extra].some((pattern) => pattern.test(path));

const scopeCovers = (declaredPaths: readonly string[], path: string): boolean =>
  declaredPaths.some((declared) => packageCovers(declared, path));

const sortedUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

/** Compute the staging set and every disclosure from the working-tree facts. */
export const computeStagingPlan = (input: CommitStagingInput): CommitStagingPlan => {
  const forbidden = (input.forbiddenPatterns ?? []).map((pattern) => new RegExp(pattern));
  const maxBinaryBytes = input.maxBinaryBytes ?? COMMIT_MAX_BINARY_BYTES;
  const include: { path: string; tracked: boolean }[] = [];
  const excluded: CommitExcludedEntry[] = [];
  const scopeDrift: string[] = [];
  const untrackedNotStaged: string[] = [];

  for (const file of input.files) {
    if (isForbidden(file.path, forbidden)) {
      excluded.push({ path: file.path, kind: "forbidden-path" });
      continue;
    }
    if (file.binary && file.sizeBytes > maxBinaryBytes) {
      excluded.push({ path: file.path, kind: "oversized-binary" });
      continue;
    }
    if (file.tracked) {
      include.push({ path: file.path, tracked: true });
      if (!scopeCovers(input.scopePaths, file.path)) scopeDrift.push(file.path);
      continue;
    }
    if (input.scopePaths.length > 0 && scopeCovers(input.scopePaths, file.path)) {
      include.push({ path: file.path, tracked: false });
      continue;
    }
    excluded.push({ path: file.path, kind: "stray" });
    untrackedNotStaged.push(file.path);
  }

  return {
    include: include.sort((left, right) => left.path.localeCompare(right.path)),
    excluded: excluded.sort((left, right) => left.path.localeCompare(right.path)),
    scopeDrift: sortedUnique(scopeDrift),
    untrackedNotStaged: sortedUnique(untrackedNotStaged),
    scopeSource: input.scopeSource,
    scopeDegraded: input.scopeSource === "plan-absent",
  };
};
