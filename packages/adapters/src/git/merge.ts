/**
 * `@delivery-os/adapters/git` merge seam (GH-225 F-7, F-8, GAP-14).
 *
 * The only spawn surface for the merge transaction's git mutations: local
 * bounded reads, exactly one rebase-refresh attempt, one squash landing, and
 * branch deletion. Fixed argv, no shell, no network, no remotes. The operation
 * union is the declared contract set and contains no force-capable variant.
 */
import { execFile } from "node:child_process";
import {
  MERGE_GIT_OPERATIONS,
  type MergeGitOperation,
  PROTECTED_REF_NAMES,
} from "@delivery-os/core/contracts";

/** One child-runner result; a non-zero exit is data, not a throw. */
export type MergeChildRunnerResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
  readonly timedOut: boolean;
};

/** The injectable child-process seam (production default: `execFile`). */
export type MergeChildRunner = (
  file: string,
  args: readonly string[],
  options: {
    readonly timeout: number;
    readonly killSignal: "SIGKILL";
    readonly cwd?: string;
  },
) => Promise<MergeChildRunnerResult>;

/** Construction input for the merge seam. */
export type GitMergeSeamOptions = {
  readonly timeoutMs?: number;
  readonly cwd?: string;
  readonly childRunner?: MergeChildRunner;
};

/** The single refresh attempt's outcome. */
export type MergeGitRefreshResult =
  | { readonly outcome: "conflicted"; readonly paths: readonly string[] }
  | { readonly outcome: "succeeded"; readonly oldSha: string; readonly newSha: string }
  | { readonly outcome: "failed"; readonly code: string };

/** The landing mutation's outcome. */
export type MergeGitLandResult =
  | {
      readonly ok: true;
      readonly squashSha: string;
      readonly requestState: string;
      readonly containedOnBase: boolean | "failed";
    }
  | { readonly ok: false; readonly code: string };

/** The bounded git merge seam. */
export type GitMergeSeam = {
  readonly head: () => Promise<string | undefined>;
  readonly resolveRef: (ref: string) => Promise<boolean>;
  readonly readBranchHead: (branch: string) => Promise<string | undefined>;
  readonly isContained: (sha: string, ref: string) => Promise<boolean | "failed">;
  readonly commitCount: (ref: string) => Promise<number | undefined>;
  readonly parentOf: (sha: string) => Promise<string | undefined>;
  readonly treeOf: (sha: string) => Promise<string | undefined>;
  readonly refresh: (input: {
    readonly branch: string;
    readonly baseRef: string;
  }) => Promise<MergeGitRefreshResult>;
  readonly squashLand: (input: {
    readonly branch: string;
    readonly baseRef: string;
    readonly message: string;
  }) => Promise<MergeGitLandResult>;
  readonly deleteBranch: (input: {
    readonly branch: string;
    readonly expectedHead?: string;
  }) => Promise<"ok" | "failed">;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const SAFE_SHA = /^[0-9a-f]{7,64}$/;
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const FORBIDDEN_REF = /(\.\.|~|\^|:|\?|\*|\[|\\|\s)/;

const isSafeRef = (value: string): boolean =>
  REF_PATTERN.test(value) && !FORBIDDEN_REF.test(value) && !value.startsWith("-");

const isSafeSha = (value: string): boolean => SAFE_SHA.test(value);

const execFileRunner: MergeChildRunner = (file, args, options) =>
  new Promise((resolve) => {
    execFile(
      file,
      [...args],
      {
        timeout: options.timeout,
        killSignal: options.killSignal,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      },
      (error, stdout, stderr) => {
        const status =
          error === null
            ? 0
            : typeof (error as { readonly code?: unknown }).code === "number"
              ? (error as { readonly code: number }).code
              : 1;
        resolve({
          stdout,
          stderr,
          status,
          timedOut: error !== null && (error as { readonly killed?: boolean }).killed === true,
        });
      },
    );
  });

const trim = (value: string): string => value.trim();

/** Build the merge seam over an injected (or production) child runner. */
export const createGitMergeSeam = (options: GitMergeSeamOptions = {}): GitMergeSeam => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.childRunner ?? execFileRunner;

  const git = (args: readonly string[]): Promise<MergeChildRunnerResult> =>
    runner("git", args, {
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    });

  const head = async (): Promise<string | undefined> => {
    const result = await git(["rev-parse", "HEAD"]);
    const sha = trim(result.stdout);
    return result.status === 0 && isSafeSha(sha) ? sha : undefined;
  };

  const readBranchHead = async (branch: string): Promise<string | undefined> => {
    if (!isSafeRef(branch)) return undefined;
    const result = await git(["rev-parse", "--verify", `refs/heads/${branch}`]);
    const sha = trim(result.stdout);
    return result.status === 0 && isSafeSha(sha) ? sha : undefined;
  };

  const isContained = async (sha: string, ref: string): Promise<boolean | "failed"> => {
    if (!isSafeSha(sha) || !isSafeRef(ref)) return "failed";
    const result = await git(["merge-base", "--is-ancestor", sha, ref]);
    if (result.status === 0) return true;
    if (result.status === 1) return false;
    return "failed";
  };

  const refresh: GitMergeSeam["refresh"] = async (input) => {
    if (!isSafeRef(input.branch) || !isSafeRef(input.baseRef)) {
      return { outcome: "failed", code: "plan-restriction" };
    }
    const before = await readBranchHead(input.branch);
    if (before === undefined) return { outcome: "failed", code: "branch-unresolved" };
    const checkout = await git(["checkout", input.branch]);
    if (checkout.status !== 0) return { outcome: "failed", code: "checkout-failed" };
    const rebase = await git(["rebase", input.baseRef]);
    if (rebase.status !== 0) {
      const conflicts = await git(["diff", "--name-only", "--diff-filter=U"]);
      const paths = conflicts.stdout
        .split("\n")
        .map((path) => trim(path))
        .filter((path) => path.length > 0);
      await git(["rebase", "--abort"]);
      return paths.length > 0
        ? { outcome: "conflicted", paths }
        : { outcome: "failed", code: "refresh-failed" };
    }
    const after = await readBranchHead(input.branch);
    return after === undefined
      ? { outcome: "failed", code: "branch-unresolved" }
      : { outcome: "succeeded", oldSha: before, newSha: after };
  };

  const squashLand: GitMergeSeam["squashLand"] = async (input) => {
    if (!isSafeRef(input.branch) || !isSafeRef(input.baseRef)) {
      return { ok: false, code: "plan-restriction" };
    }
    const baseBefore = await readBranchHead(input.baseRef);
    if (baseBefore === undefined) return { ok: false, code: "base-unresolved" };
    const checkout = await git(["checkout", input.baseRef]);
    if (checkout.status !== 0) return { ok: false, code: "checkout-failed" };
    const merge = await git(["merge", "--squash", input.branch]);
    if (merge.status !== 0) return { ok: false, code: "squash-failed" };
    const commit = await git([
      "commit",
      "--no-verify",
      "--no-gpg-sign",
      "-m",
      input.message.length === 0 ? "Squash merge" : input.message,
    ]);
    if (commit.status !== 0) return { ok: false, code: "commit-failed" };
    const squashSha = await head();
    if (squashSha === undefined) return { ok: false, code: "landing-unresolved" };
    const contained = await isContained(squashSha, input.baseRef);
    return {
      ok: true,
      squashSha,
      requestState: "merged",
      containedOnBase: contained,
    };
  };

  const deleteBranch: GitMergeSeam["deleteBranch"] = async (input) => {
    if (!isSafeRef(input.branch)) return "failed";
    if ((PROTECTED_REF_NAMES as readonly string[]).includes(input.branch)) return "failed";
    if (input.expectedHead !== undefined) {
      const current = await readBranchHead(input.branch);
      if (current === undefined || current !== input.expectedHead) return "failed";
    }
    const result = await git(["branch", "-D", input.branch]);
    return result.status === 0 ? "ok" : "failed";
  };

  return {
    head,
    resolveRef: async (ref) => {
      if (!isSafeRef(ref)) return false;
      const result = await git(["rev-parse", "--verify", ref]);
      return result.status === 0;
    },
    readBranchHead,
    isContained,
    commitCount: async (ref) => {
      const result = await git(["rev-list", "--count", ref]);
      const value = Number.parseInt(trim(result.stdout), 10);
      return result.status === 0 && Number.isFinite(value) ? value : undefined;
    },
    parentOf: async (sha) => {
      if (!isSafeSha(sha)) return undefined;
      const result = await git(["rev-parse", `${sha}^`]);
      const parent = trim(result.stdout);
      return result.status === 0 && isSafeSha(parent) ? parent : undefined;
    },
    treeOf: async (sha) => {
      if (!isSafeSha(sha)) return undefined;
      const result = await git(["rev-parse", `${sha}^{tree}`]);
      const tree = trim(result.stdout);
      return result.status === 0 && tree.length > 0 ? tree : undefined;
    },
    refresh,
    squashLand,
    deleteBranch,
  };
};

/** The declared operation union (no force variant exists). */
export const MERGE_SEAM_OPERATIONS: readonly MergeGitOperation[] = MERGE_GIT_OPERATIONS;
