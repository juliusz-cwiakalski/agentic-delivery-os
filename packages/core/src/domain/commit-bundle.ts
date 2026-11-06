/**
 * Deterministic model bundle construction (GH-227 F-2, DEC-12, NFR-1).
 *
 * Generated noise (lockfiles, minified or vendored files) is stripped before
 * any model sees the bundle. Over-cap files contribute name-status metadata
 * only, the top-N files are fully diffed, and the total input stays inside the
 * shipped budget. Paths are normalized and sorted, so the same tree and context
 * always produce the same bundle.
 */
import {
  COMMIT_DIFF_PER_FILE_CAP,
  COMMIT_DIFF_TOP_FILES,
  COMMIT_NOISE_PATH_PATTERNS,
  COMMIT_TOTAL_INPUT_BUDGET,
  type CommitBundle,
  type CommitBundleFile,
  type CommitCandidateFile,
  type CommitSkeleton,
  type CommitStagingPlan,
} from "#contracts";

/** One bundle build input; the staging set is already computed. */
export type CommitBundleInput = {
  readonly skeleton: CommitSkeleton;
  readonly planSummary?: string;
  readonly files: readonly CommitCandidateFile[];
  readonly staging: CommitStagingPlan;
  readonly lastCommitSubjects: readonly string[];
  readonly totalInputBudget?: number;
  readonly perFileCap?: number;
  readonly topFiles?: number;
  readonly noisePatterns?: readonly string[];
};

/** The bundle plus the noise paths removed from it (envelope disclosure). */
export type CommitBundleResult = {
  readonly bundle: CommitBundle;
  readonly noiseStripped: readonly string[];
};

const NOISE = COMMIT_NOISE_PATH_PATTERNS.map((pattern) => new RegExp(pattern));

/** True when the path is deterministic generated noise, not authored content. */
export const isGeneratedNoise = (path: string): boolean =>
  NOISE.some((pattern) => pattern.test(path));

const capDiff = (text: string | undefined, cap: number): string | undefined => {
  if (text === undefined) return undefined;
  if (text.length <= cap) return text;
  return `${text.slice(0, cap)}\n... [truncated]`;
};

/** Build the deterministic bundle from safety-scanned staged content. */
export const buildCommitBundle = (input: CommitBundleInput): CommitBundleResult => {
  const budget = input.totalInputBudget ?? COMMIT_TOTAL_INPUT_BUDGET;
  const perFileCap = input.perFileCap ?? COMMIT_DIFF_PER_FILE_CAP;
  const topFiles = input.topFiles ?? COMMIT_DIFF_TOP_FILES;
  const byPath = new Map(input.files.map((file) => [file.path, file]));
  const noiseStripped: string[] = [];
  const files: CommitBundleFile[] = [];
  let totalInputChars = 0;
  let fullyDiffed = 0;
  let trimmed = false;

  for (const staged of input.staging.include) {
    if (isGeneratedNoise(staged.path)) {
      noiseStripped.push(staged.path);
      continue;
    }
    const file = byPath.get(staged.path);
    if (file === undefined) continue;
    const metadata: CommitBundleFile = {
      path: file.path,
      status: file.status,
      binary: file.binary,
      overCap: file.overCap,
    };
    if (file.binary || file.overCap || fullyDiffed >= topFiles) {
      files.push(metadata);
      continue;
    }
    const diffText = capDiff(file.diffText, perFileCap);
    if (diffText === undefined) {
      files.push(metadata);
      continue;
    }
    const cost = file.path.length + diffText.length;
    if (totalInputChars + cost > budget) {
      trimmed = true;
      files.push(metadata);
      continue;
    }
    totalInputChars += cost;
    fullyDiffed += 1;
    files.push({ ...metadata, diffText });
  }

  files.sort((left, right) => left.path.localeCompare(right.path, "en"));
  noiseStripped.sort((left, right) => left.localeCompare(right, "en"));
  return {
    bundle: {
      skeleton: input.skeleton,
      ...(input.planSummary === undefined ? {} : { planSummary: input.planSummary }),
      files,
      lastCommitSubjects: [...input.lastCommitSubjects],
      totalInputChars,
      trimmed,
    },
    noiseStripped,
  };
};
