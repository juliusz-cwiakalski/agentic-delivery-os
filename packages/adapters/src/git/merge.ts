/**
 * `@delivery-os/adapters/git` merge seam (GH-225 F-7, F-8, GAP-14).
 *
 * The only spawn surface for the merge transaction's git mutations: local
 * bounded reads, exactly one rebase-refresh attempt, one squash landing, and
 * branch deletion. Fixed argv, no shell, no network, no remotes. The operation
 * union is the declared contract set and contains no force-capable variant.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
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

/**
 * One bounded local change-record read at a head (F-1 step 4, GH-366): at most
 * two fixed-argv git invocations — a `ls-tree -r --name-only` locate, then one
 * blob read — honouring the record byte cap, with no shell, no retry, no
 * network and no fetch. A head object the checkout does not hold is
 * `record-unreadable`, and no fetch runs on this path (NG-7).
 */
export type MergeGitRecordRead =
  | { readonly ok: true; readonly path: string; readonly text: string }
  | {
      readonly ok: false;
      readonly reason: "record-missing" | "record-unreadable";
      readonly detail?: string;
    };

/** The bounded git merge seam. */
export type GitMergeSeam = {
  readonly head: () => Promise<string | undefined>;
  readonly resolveRef: (ref: string) => Promise<boolean>;
  readonly readBranchHead: (branch: string) => Promise<string | undefined>;
  readonly isContained: (sha: string, ref: string) => Promise<boolean | "failed">;
  readonly commitCount: (ref: string) => Promise<number | undefined>;
  readonly parentOf: (sha: string) => Promise<string | undefined>;
  readonly treeOf: (sha: string) => Promise<string | undefined>;
  /**
   * The bounded change-record read at a candidate's asserted head (GH-366 F-1
   * step 4): locates the change record under the change-artifact root at that
   * head, then reads one bounded blob. At most two fixed-argv invocations, no
   * shell, no retry and no fetch: a missing record is `record-missing` and a head
   * object the checkout does not hold is `record-unreadable`.
   */
  readonly readChangeRecord: (input: {
    readonly headSha: string;
    readonly workItemRef: string;
    readonly maxBytes: number;
  }) => Promise<MergeGitRecordRead>;
  readonly refresh: (input: {
    readonly branch: string;
    readonly baseRef: string;
  }) => Promise<MergeGitRefreshResult>;
  /**
   * Whether the resolved branch is checked out in a LINKED worktree (review
   * F-3, Decision 2): the post-landing deletion defers as satisfied-by-
   * closeout when it is — closeout's delivered order removes the worktree,
   * then deletes the branch. A structural worktree-list read; false when the
   * listing is unavailable.
   */
  readonly isBranchCheckedOutInLinkedWorktree: (input: {
    readonly branch: string;
  }) => Promise<boolean>;
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

  const isBranchCheckedOutInLinkedWorktree: GitMergeSeam["isBranchCheckedOutInLinkedWorktree"] =
    async (input) => {
      const porcelain = await git(["worktree", "list", "--porcelain"]);
      if (porcelain.status !== 0) return false;
      const common = await git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
      if (common.status !== 0) return false;
      const commonDir = common.stdout.trim().replace(/\/+$/u, "");
      for (const block of porcelain.stdout.split("\n\n")) {
        const path = block
          .split("\n")
          .find((line) => line.startsWith("worktree "))
          ?.slice("worktree ".length);
        if (path === undefined || path.trim().length === 0) continue;
        // GH-404 F-29: a prunable block (its directory is gone) holds no
        // branch — its stale registration must never defer a deletion.
        if (block.split("\n").includes("prunable") || !existsSync(path.trim())) continue;
        // The main checkout is the block whose OWN git directory equals the
        // common directory (review F-3 with F-12's resolved-equality rule);
        // every other block is linked. A resolution failure falls back to the
        // standard `<worktree>/.git` layout.
        const resolved = await git(["-C", path.trim(), "rev-parse", "--absolute-git-dir"]);
        const ownGitDir = (
          resolved.status === 0 ? resolved.stdout.trim() : `${path.replace(/\/+$/u, "")}/.git`
        ).replace(/\/+$/u, "");
        if (ownGitDir === commonDir) continue;
        // GH-404 F-29: the EXACT ref line, never a substring — a parked
        // `feat/GH-1/ab` must not defer the deletion of `feat/GH-1/a`.
        const branchLine = block
          .split("\n")
          .find((line) => line.startsWith("branch "))
          ?.slice("branch ".length);
        if (branchLine === `refs/heads/${input.branch}`) return true;
      }
      return false;
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
    isBranchCheckedOutInLinkedWorktree,
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
    readChangeRecord: async (input) => {
      if (!isSafeSha(input.headSha) || !isSafeRef(input.workItemRef)) {
        return { ok: false, reason: "record-unreadable", detail: "unsafe-head-or-ref" };
      }
      // Invocation 1 of 2: locate the change record for the ref at this head.
      // The tree walk is scoped to the change-artifact root and the name filter
      // is the delivered change convention; no shell and no glob expansion.
      const listing = await git(["ls-tree", "-r", "--name-only", input.headSha, "doc/changes"]);
      if (listing.status !== 0) {
        return {
          ok: false,
          reason: "record-unreadable",
          detail: `ls-tree-exit-${String(listing.status)}`,
        };
      }
      const suffix = `chg-${input.workItemRef}-pm-notes.yaml`;
      const path = listing.stdout
        .split("\n")
        .map((entry) => trim(entry))
        .find((entry) => entry.endsWith(suffix) && entry.includes(`--${input.workItemRef}--`));
      if (path === undefined) return { ok: false, reason: "record-missing" };
      // Invocation 2 of 2: one bounded blob read; the byte cap is honoured by
      // refusing the record, never by truncating it.
      const blob = await git(["cat-file", "blob", `${input.headSha}:${path}`]);
      if (blob.status !== 0) {
        return {
          ok: false,
          reason: "record-unreadable",
          detail: `cat-file-exit-${String(blob.status)}`,
        };
      }
      if (blob.stdout.length > input.maxBytes) {
        return {
          ok: false,
          reason: "record-unreadable",
          detail: "record-exceeds-declared-byte-cap",
        };
      }
      return { ok: true, path, text: blob.stdout };
    },
    refresh,
    squashLand,
    deleteBranch,
  };
};

/** The declared operation union (no force variant exists). */
export const MERGE_SEAM_OPERATIONS: readonly MergeGitOperation[] = MERGE_GIT_OPERATIONS;
