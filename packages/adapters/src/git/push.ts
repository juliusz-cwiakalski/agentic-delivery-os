/**
 * `@delivery-os/adapters/git` push seam (GH-386 F-1, NFR-1; TDR-0076).
 *
 * The typed stack's first remote-write act: one fast-forward-only push of the
 * change branch to its configured upstream. Fixed argv, a literal non-shell
 * child process over an injectable child runner, and a 60 000 ms default
 * timeout injectable through the seam options with no new configuration key.
 * The outcome union is the declared contract set and contains no force-capable
 * variant and no ref beyond the change branch; the act is one attempt with no
 * retry — the next dispatch or an operator resume resolves a failed act.
 */
import { spawn } from "node:child_process";
import {
  DISPATCH_PUSH_RECORDABLE_CAUSES,
  type DispatchPushRecordableCause,
  isSafeRef,
  PROTECTED_REF_NAMES,
} from "@delivery-os/core/contracts";

/** One child-runner result; a non-zero exit is data, not a throw. */
export type GitPushRunnerResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
  readonly timedOut: boolean;
  /**
   * True when the child could not be started at all (the git binary is missing
   * or failed to launch). A spawn-level act failure is the `failed` outcome —
   * the same one typed failure as every other non-successful act (spec OQ-1
   * reading; DEC-4).
   */
  readonly spawnFailed?: boolean;
};

/** The injectable child-process seam (production default: the local runner). */
export type GitPushChildRunner = (
  file: string,
  args: readonly string[],
  options: {
    readonly timeout: number;
    readonly killSignal: "SIGKILL";
    readonly cwd?: string;
  },
) => Promise<GitPushRunnerResult>;

/** Construction input for the push seam. */
export type GitPushSeamOptions = {
  /** Production default is the declared 60 000 ms act budget; tests may shorten it. */
  readonly timeoutMs?: number;
  /** The repository working directory; production omits it (process cwd). */
  readonly cwd?: string;
  /** Test-only child-process injection; never changes the fixed argv. */
  readonly childRunner?: GitPushChildRunner;
};

/**
 * The bounded push outcome. One attempt, no retry; no force-capable variant
 * exists and no ref beyond the change branch is ever named.
 */
export type GitPushOutcome =
  | { readonly outcome: "accepted" }
  | { readonly outcome: "rejected"; readonly detail: string }
  | { readonly outcome: "failed"; readonly detail: string }
  | { readonly outcome: "timed-out" };

/** The bounded git push seam. */
export type GitPushSeam = {
  /**
   * One fast-forward-only push of the change branch to its configured
   * upstream. The argv is fixed and literal; the destination resolves through
   * the checkout's own branch configuration, so the act never discovers an
   * upstream and never names a second ref.
   */
  readonly pushChangeBranch: (input: { readonly branch: string }) => Promise<GitPushOutcome>;
};

/** The declared default act budget (NFR-1); injectable through the seam options. */
export const PUSH_DEFAULT_TIMEOUT_MS = 60_000;

const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

/**
 * The closed cause vocabulary read from the contracts home (DM-4), never
 * re-typed: the classification table below is the one place that maps git's
 * bounded failure text onto these tokens.
 */
const [
  NON_FAST_FORWARD,
  AUTH_REJECTED,
  REMOTE_UNAVAILABLE,
  ,
  ,
  PROTECTED_REF,
  UNCLASSIFIED,
] = DISPATCH_PUSH_RECORDABLE_CAUSES;

/**
 * The declared rejection classification table (DM-4, DEC-4). The patterns live
 * in this one module; the tokens are the imported closed-cause members. A
 * protection or hook decline git reports is `protected-ref` and nothing else;
 * an unrecognised rejection is the honest `unclassified` fallback.
 */
const REJECTION_CLASSES: readonly {
  readonly cause: DispatchPushRecordableCause;
  readonly pattern: RegExp;
}[] = [
  {
    cause: NON_FAST_FORWARD,
    pattern:
      /non-fast-forward|fetch first|updates were rejected because the (tip|remote contains work)|tip of your current branch is behind/i,
  },
  {
    cause: AUTH_REJECTED,
    pattern:
      /authentication failed|permission denied|could not read (username|password)|permission to .* denied|access denied|403 forbidden|invalid username or password/i,
  },
  {
    cause: REMOTE_UNAVAILABLE,
    pattern:
      /could not resolve host|unable to access|connection (refused|timed out|reset)|network is unreachable|could not read from remote repository|repository not found|host key verification failed/i,
  },
  {
    cause: PROTECTED_REF,
    pattern:
      /protected branch|hook declined|refusing to update checked out branch|pre-receive hook|policy prohibits/i,
  },
];

/**
 * Classify git's own bounded failure text into one closed cause token. The raw
 * text never leaves the seam: the outcome carries the token and nothing else.
 */
const classifyRejection = (result: GitPushRunnerResult): DispatchPushRecordableCause => {
  const text = `${result.stdout}\n${result.stderr}`;
  for (const rule of REJECTION_CLASSES) {
    if (rule.pattern.test(text)) return rule.cause;
  }
  return UNCLASSIFIED;
};

/**
 * The production default runner: a literal non-shell child process with the
 * declared `shell: false` spawn contract, bounded output, and the declared
 * SIGKILL timeout. A start failure is the runner's `spawnFailed` fact, never a
 * throw across the seam.
 */
const localRunner: GitPushChildRunner = (file, args, options) =>
  new Promise((resolve) => {
    const child = spawn(file, [...args], {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      timeout: options.timeout,
      killSignal: options.killSignal,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let truncated = false;
    const collect =
      (target: "stdout" | "stderr") =>
      (chunk: Buffer | string): void => {
        const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
        const current = target === "stdout" ? stdout : stderr;
        if (current.length + text.length > MAX_OUTPUT_BYTES) {
          truncated = true;
          return;
        }
        if (target === "stdout") stdout += text;
        else stderr += text;
      };
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", collect("stdout"));
    child.stderr?.on("data", collect("stderr"));
    child.on("error", () => {
      if (!child.killed) child.kill();
      resolve({ stdout, stderr, status: 1, timedOut: false, spawnFailed: true });
    });
    child.on("close", (code, signal) => {
      if (truncated) {
        resolve({ stdout, stderr, status: code ?? 1, timedOut: false, spawnFailed: false });
        return;
      }
      resolve({
        stdout,
        stderr,
        status: code ?? (signal === undefined ? 0 : 1),
        timedOut: signal === options.killSignal,
        spawnFailed: false,
      });
    });
  });

/** Build the push seam over an injected (or production) child runner. */
export const createGitPushSeam = (options: GitPushSeamOptions = {}): GitPushSeam => {
  const timeoutMs = options.timeoutMs ?? PUSH_DEFAULT_TIMEOUT_MS;
  const runner = options.childRunner ?? localRunner;

  return {
    pushChangeBranch: async (input) => {
      // Defense in depth: the protected set is never pushable from this seam,
      // and an unsafe branch name is refused before any child process starts.
      if (!isSafeRef(input.branch)) return { outcome: "rejected", detail: "unsafe-branch" };
      if ((PROTECTED_REF_NAMES as readonly string[]).includes(input.branch)) {
        return { outcome: "rejected", detail: "protected-ref" };
      }
      // Fixed argv: fast-forward-only, the change branch as the single refspec,
      // and no repository argument — the destination is the checkout's own
      // branch configuration, so the act never discovers an upstream.
      const result = await runner("git", ["push", "--ff-only", `HEAD:refs/heads/${input.branch}`], {
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      });
      if (result.timedOut) return { outcome: "timed-out" };
      if (result.spawnFailed === true) return { outcome: "failed", detail: "spawn-failed" };
      if (result.status === 0) return { outcome: "accepted" };
      return { outcome: "rejected", detail: classifyRejection(result) };
    },
  };
};
