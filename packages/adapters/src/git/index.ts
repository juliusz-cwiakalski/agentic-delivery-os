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
import { CLOSEOUT_OPERATION_TIMEOUT_MS, PROTECTED_REF_NAMES } from "@delivery-os/core/contracts";

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
): Promise<GitChildRunnerResult> => {
  const operation = runner(file, args, {
    timeout,
    killSignal: "SIGKILL",
    ...(cwd === undefined ? {} : { cwd }),
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

  const git = async (args: readonly string[]): Promise<GitChildRunnerResult> =>
    withTimeout(runner, "git", args, timeoutMs, options.cwd);

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
