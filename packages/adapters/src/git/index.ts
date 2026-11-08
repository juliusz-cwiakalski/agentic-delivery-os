/**
 * `@delivery-os/adapters/git` — the dedicated branch/checkout seam (GH-183 F-9/
 * F-10, PIN-16).
 *
 * The only spawn surface for closeout branch and checkout operations. Fixed
 * argv, no shell, no network, local-only; every child process is bounded by
 * `CLOSEOUT_OPERATION_TIMEOUT_MS` (or an injected short override) with
 * `SIGKILL`. The read-only `repo` metadata reader is untouched and never gains
 * a spawn surface.
 */
import { execFile } from "node:child_process";
import {
  CAPSULE_MAX_DIFF_BYTES as CLOSEOUT_DIFF_MAX_BYTES,
  CLOSEOUT_OPERATION_TIMEOUT_MS,
  PROTECTED_REF_NAMES,
} from "@delivery-os/core/contracts";

/** One child-runner result; a non-zero exit is data, not a throw. */
export type GitChildRunnerResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
  readonly timedOut: boolean;
};

/** The injectable child-process seam (production default: `execFile`). */
export type GitChildRunner = (
  file: string,
  args: readonly string[],
  options: {
    readonly timeout: number;
    readonly killSignal: "SIGKILL";
    readonly cwd?: string;
    readonly maxBuffer?: number;
  },
) => Promise<GitChildRunnerResult>;

/** The checkout classification (F-9). */
export type GitCheckoutFacts = {
  readonly state:
    | "delivery-branch"
    | "detached-at-delivery-head"
    | "base"
    | "unrelated"
    | "missing";
  readonly branch?: string;
  readonly head?: string;
};

/** One local branch fact. */
export type GitBranchFacts = {
  readonly name: string;
  readonly head: string;
};

/** The safety facts the plan queries. */
export type GitSafetyFacts = {
  readonly clean: boolean;
  readonly baseRefResolves: boolean;
  readonly checkedOutElsewhere: boolean;
};

/** A local mutation outcome (never a throw across the port). */
export type GitMutationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "plan-restriction" | "closeout.branch.unsafe";
      readonly detail: string;
    };

/** One bounded merged-diff read (GH-240 F-5). */
export type GitMergedDiffRead = {
  readonly text: string;
  readonly files: number;
  readonly truncated: boolean;
};

/** Construction input for the git seam. */
export type GitBranchSeamOptions = {
  /** Production default is the closeout operation timeout; tests may shorten it. */
  readonly timeoutMs?: number;
  /** The repository working directory; production omits it (process cwd). */
  readonly cwd?: string;
  /** Test-only child-process injection; never changes the fixed argv allowlist. */
  readonly childRunner?: GitChildRunner;
};

/** The bounded git branch/checkout seam. */
export type GitWorktreeFact = {
  readonly path: string;
  readonly branch?: string;
  readonly head?: string;
  readonly locked: boolean;
};

export type GitBranchSeam = {
  readonly readCheckout: (input: {
    readonly deliveryBranch: string;
    readonly baseRef: string;
    readonly deliveryHead?: string;
  }) => Promise<GitCheckoutFacts>;
  readonly listBranches: (input: {
    readonly workItemRef: string;
  }) => Promise<readonly GitBranchFacts[]>;
  readonly readBranch: (input: { readonly branch: string }) => Promise<GitBranchFacts | undefined>;
  readonly isCheckedOutElsewhere: (input: { readonly branch: string }) => Promise<boolean>;
  /** List local worktrees from `worktree list --porcelain` (read-only). */
  readonly listWorktrees: () => Promise<readonly GitWorktreeFact[]>;
  /** The repository's top-level working directory (local read only). */
  readonly currentWorktreePath: () => Promise<string | undefined>;
  /** Whether one worktree path is clean (read-only, fixed argv). */
  readonly isWorktreeClean: (input: { readonly path: string }) => Promise<boolean>;
  /**
   * One bounded added-line read of a recorded squash landing: fixed argv,
   * no shell, local only. Absent refs are a classified absence, never a throw.
   */
  readonly readMergedDiff: (input: {
    readonly squashSha: string;
    readonly maxBytes?: number;
  }) => Promise<GitMergedDiffRead | undefined>;
  /**
   * Remove one local worktree with a fixed argv array: no shell string, no
   * force flag, and local-only. A git refusal is a refusal.
   */
  readonly removeWorktree: (input: {
    readonly path: string;
    readonly expectedHead?: string;
  }) => Promise<GitMutationResult>;
  readonly isClean: () => Promise<boolean>;
  readonly resolveRef: (input: { readonly ref: string }) => Promise<boolean>;
  readonly restoreCheckout: (input: { readonly baseRef: string }) => Promise<GitMutationResult>;
  readonly deleteBranch: (input: {
    readonly branch: string;
    /** When supplied, the branch head is re-read and must still match. */
    readonly expectedHead?: string;
  }) => Promise<GitMutationResult>;
};

const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const FORBIDDEN_REF = /(\.\.|~|\^|:|\?|\*|\[|\\|\s)/;

const isSafeRef = (value: string): boolean =>
  REF_PATTERN.test(value) && !FORBIDDEN_REF.test(value) && !value.startsWith("-");

const execFileRunner: GitChildRunner = (file, args, options) =>
  new Promise((resolve) => {
    execFile(
      file,
      [...args],
      {
        timeout: options.timeout,
        killSignal: options.killSignal,
        encoding: "utf8",
        ...(options.maxBuffer === undefined ? {} : { maxBuffer: options.maxBuffer }),
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

const timeoutFailure = (): GitChildRunnerResult => ({
  stdout: "",
  stderr: "git operation timed out",
  status: 124,
  timedOut: true,
});

const withTimeout = async (
  runner: GitChildRunner,
  file: string,
  args: readonly string[],
  timeout: number,
  cwd: string | undefined,
  maxBuffer?: number,
): Promise<GitChildRunnerResult> => {
  const operation = runner(file, args, {
    timeout,
    killSignal: "SIGKILL",
    ...(cwd === undefined ? {} : { cwd }),
    ...(maxBuffer === undefined ? {} : { maxBuffer }),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<GitChildRunnerResult>((resolve) => {
    timer = setTimeout(() => resolve(timeoutFailure()), timeout);
  });
  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

const branchConvention = (workItemRef: string): RegExp =>
  new RegExp(`^[a-z][a-z0-9-]*/${workItemRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/.+$`);

/** Build the bounded git seam over an injected (or production) child runner. */
export const createGitBranchSeam = (options: GitBranchSeamOptions = {}): GitBranchSeam => {
  const timeoutMs = options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS;
  const runner = options.childRunner ?? execFileRunner;

  const git = async (args: readonly string[], maxBuffer?: number): Promise<GitChildRunnerResult> =>
    withTimeout(runner, "git", args, timeoutMs, options.cwd, maxBuffer);

  const stdoutOrThrow = async (args: readonly string[], operation: string): Promise<string> => {
    const result = await git(args);
    if (result.status !== 0) {
      throw new Error(`git ${operation} failed (${result.timedOut ? "timeout" : result.status})`);
    }
    return result.stdout;
  };

  const restore = async (value: string): Promise<GitMutationResult> => {
    if (!isSafeRef(value)) {
      return { ok: false, code: "plan-restriction", detail: "unsafe base ref" };
    }
    const result = await git(["checkout", value]);
    if (result.status === 0) return { ok: true };
    return {
      ok: false,
      code: result.timedOut ? "closeout.branch.unsafe" : "plan-restriction",
      detail: result.timedOut ? "checkout timed out" : `checkout failed (${result.status})`,
    };
  };

  const readBranchFact = async (branch: string): Promise<GitBranchFacts | undefined> => {
    if (!isSafeRef(branch)) return undefined;
    const result = await git(["rev-parse", "--verify", `refs/heads/${branch}`]);
    if (result.status !== 0) return undefined;
    return { name: branch, head: result.stdout.trim() };
  };

  const remove = async (branch: string, expectedHead?: string): Promise<GitMutationResult> => {
    if (!isSafeRef(branch)) {
      return { ok: false, code: "plan-restriction", detail: "unsafe branch name" };
    }
    // Defense in depth: the protected set is never deletable even if a caller
    // bypasses the planner's predicate.
    if ((PROTECTED_REF_NAMES as readonly string[]).includes(branch)) {
      return { ok: false, code: "closeout.branch.unsafe", detail: "protected ref" };
    }
    // Re-read the local head immediately before the destructive command. A head
    // that moved after planning must never be force-deleted.
    if (expectedHead !== undefined) {
      const current = await readBranchFact(branch);
      if (current === undefined || current.head !== expectedHead) {
        return {
          ok: false,
          code: "closeout.branch.unsafe",
          detail: "branch head changed before deletion",
        };
      }
    }
    const result = await git(["branch", "-D", branch]);
    if (result.status === 0) return { ok: true };
    return {
      ok: false,
      code: result.timedOut ? "closeout.branch.unsafe" : "plan-restriction",
      detail: result.timedOut
        ? "branch delete timed out"
        : `branch delete failed (${result.status})`,
    };
  };

  return {
    readCheckout: async (input) => {
      try {
        const branch = (
          await stdoutOrThrow(["rev-parse", "--abbrev-ref", "HEAD"], "read-checkout")
        ).trim();
        const head = (await stdoutOrThrow(["rev-parse", "HEAD"], "read-head")).trim();
        if (branch === input.baseRef) return { state: "base", head };
        if (branch === input.deliveryBranch) {
          return { state: "delivery-branch", branch, head };
        }
        if (branch === "HEAD") {
          return input.deliveryHead !== undefined && head === input.deliveryHead
            ? { state: "detached-at-delivery-head", head }
            : { state: "unrelated", head };
        }
        return { state: "unrelated", branch, head };
      } catch {
        return { state: "missing" };
      }
    },
    listBranches: async (input) => {
      const output = await stdoutOrThrow(
        ["for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads"],
        "list-branches",
      );
      const pattern = branchConvention(input.workItemRef);
      return output
        .split("\n")
        .flatMap((line) => {
          const [name, head] = line.trim().split(" ");
          if (name === undefined || head === undefined || !pattern.test(name)) return [];
          return [{ name, head }];
        })
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    readBranch: (input) => readBranchFact(input.branch),
    isCheckedOutElsewhere: async (input) => {
      if (!isSafeRef(input.branch)) return false;
      const output = await stdoutOrThrow(["worktree", "list", "--porcelain"], "worktrees");
      const worktrees = output.split("\n\n");
      return worktrees
        .slice(1)
        .some((block) => block.includes(`branch refs/heads/${input.branch}`));
    },
    currentWorktreePath: async () => {
      try {
        return (await stdoutOrThrow(["rev-parse", "--show-toplevel"], "top-level")).trim();
      } catch {
        return undefined;
      }
    },
    isWorktreeClean: async (input) => {
      if (!input.path.startsWith("/") || input.path.includes("\0")) return false;
      const result = await git(["-C", input.path, "status", "--porcelain"]);
      return result.status === 0 && result.stdout.trim().length === 0;
    },
    readMergedDiff: async (input) => {
      if (!/^[0-9a-f]{40}$/.test(input.squashSha)) return undefined;
      const maxBytes = input.maxBytes ?? CLOSEOUT_DIFF_MAX_BYTES;
      const result = await git(
        ["diff", "--no-color", "--unified=0", `${input.squashSha}^`, input.squashSha],
        maxBytes + 64 * 1024,
      );
      if (result.status !== 0 && result.stdout.length === 0) return undefined;
      const encoded = Buffer.from(result.stdout, "utf8");
      const truncated = encoded.length > maxBytes || result.status !== 0;
      const text = truncated ? encoded.subarray(0, maxBytes).toString("utf8") : result.stdout;
      const files = text.split("\n").filter((line) => line.startsWith("diff --git ")).length;
      return { text, files, truncated };
    },
    listWorktrees: async () => {
      const output = await stdoutOrThrow(["worktree", "list", "--porcelain"], "worktrees");
      return output
        .split("\n\n")
        .slice(1)
        .map((block) => {
          const lines = block.split("\n");
          const path = lines
            .find((line) => line.startsWith("worktree "))
            ?.slice("worktree ".length);
          const head = lines.find((line) => line.startsWith("HEAD "))?.slice("HEAD ".length);
          const branch = lines
            .find((line) => line.startsWith("branch refs/heads/"))
            ?.slice("branch refs/heads/".length);
          return {
            path: path ?? "",
            ...(branch === undefined ? {} : { branch }),
            ...(head === undefined ? {} : { head }),
            locked: lines.some((line) => line === "locked" || line.startsWith("locked ")),
          };
        })
        .filter((worktree) => worktree.path.length > 0);
    },
    removeWorktree: async (input) => {
      if (!input.path.startsWith("/") || input.path.includes("\0")) {
        return { ok: false, code: "closeout.branch.unsafe", detail: "unsafe worktree path" };
      }
      // Re-observe head and cleanliness immediately before the destructive argv.
      const worktrees = await git(["worktree", "list", "--porcelain"]);
      if (worktrees.status !== 0) {
        return { ok: false, code: "closeout.branch.unsafe", detail: "worktree list failed" };
      }
      const block = worktrees.stdout
        .split("\n\n")
        .find(
          (entry) =>
            entry.includes(`worktree ${input.path}\n`) || entry.endsWith(`worktree ${input.path}`),
        );
      const head = block
        ?.split("\n")
        .find((line) => line.startsWith("HEAD "))
        ?.slice("HEAD ".length);
      if (input.expectedHead !== undefined && head !== input.expectedHead) {
        return {
          ok: false,
          code: "closeout.branch.unsafe",
          detail: "worktree head changed before removal",
        };
      }
      const clean = await git(["-C", input.path, "status", "--porcelain"]);
      if (clean.status !== 0 || clean.stdout.trim().length > 0) {
        return {
          ok: false,
          code: "closeout.branch.unsafe",
          detail: "worktree is dirty or unreadable",
        };
      }
      const result = await git(["worktree", "remove", input.path]);
      return result.status === 0
        ? { ok: true }
        : { ok: false, code: "closeout.branch.unsafe", detail: "git refused the worktree removal" };
    },
    isClean: async () => {
      const output = await stdoutOrThrow(["status", "--porcelain"], "status");
      return output.trim().length === 0;
    },
    resolveRef: async (input) => {
      if (!isSafeRef(input.ref)) return false;
      const result = await git(["rev-parse", "--verify", input.ref]);
      return result.status === 0;
    },
    restoreCheckout: (input) => restore(input.baseRef),
    deleteBranch: (input) =>
      remove(input.branch, input.expectedHead === undefined ? undefined : input.expectedHead),
  };
};

export {
  type CommitChildRunner,
  type CommitChildRunnerResult,
  createGitCommitSeam,
  type GitCommitSeamOptions,
} from "./commit.js";
export {
  createGitMergeSeam,
  type GitMergeSeam,
  type GitMergeSeamOptions,
  MERGE_SEAM_OPERATIONS,
  type MergeChildRunner,
  type MergeChildRunnerResult,
  type MergeGitLandResult,
  type MergeGitRefreshResult,
} from "./merge.js";
export {
  createWatchdogGitSeam,
  parseWatchdogStatus,
  type WatchdogGitSeam,
  type WatchdogGitSeamOptions,
} from "./watchdog.js";
