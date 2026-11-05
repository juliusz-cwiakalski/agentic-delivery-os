/**
 * `@delivery-os/adapters/git` — the bounded watchdog checkout seam (GH-221
 * PIN-3, PIN-4).
 *
 * Reads checkout facts and performs the restoration mutations the probes need.
 * Fixed argv, no shell, no network, local-only; every child process is bounded
 * by the closeout operation timeout (or an injected short override) with
 * `SIGKILL`. Mutations never target a `.ai/memory` path: memory publications are
 * reported, never staged, committed, reverted, cleaned, or deleted.
 */
import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { isAbsolute, normalize, resolve, sep } from "node:path";
import type {
  WatchdogGitMutationResult,
  WatchdogGitPort,
  WatchdogMemoryFact,
  WatchdogWorktreeEntry,
} from "@delivery-os/core/contracts";
import { CLOSEOUT_OPERATION_TIMEOUT_MS } from "@delivery-os/core/contracts";
import type { GitChildRunner, GitChildRunnerResult } from "./index.js";

const MEMORY_ROOT = ".ai/memory";
const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const FORBIDDEN_REF = /(\.\.|~|\^|:|\?|\*|\[|\\|\s)/;
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/;

const isSafeRef = (value: string): boolean =>
  REF_PATTERN.test(value) && !FORBIDDEN_REF.test(value) && !value.startsWith("-");

const isMemoryPath = (path: string): boolean =>
  path === MEMORY_ROOT || path.startsWith(`${MEMORY_ROOT}/`);

const isSafeRelativePath = (path: string): boolean => {
  if (path.length === 0 || isAbsolute(path) || path.includes("\0")) return false;
  const normalized = normalize(path).replaceAll(sep, "/");
  return normalized === path && !path.split("/").includes("..");
};

const timeoutResult = (): GitChildRunnerResult => ({
  stdout: "",
  stderr: "git operation timed out",
  status: 124,
  timedOut: true,
});

const execFileWatchdogRunner: GitChildRunner = (file, args, options) =>
  new Promise((resolveRun) => {
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
        resolveRun({
          stdout,
          stderr,
          status,
          timedOut: error !== null && (error as { readonly killed?: boolean }).killed === true,
        });
      },
    );
  });

const withTimeout = async (
  runner: GitChildRunner,
  args: readonly string[],
  timeout: number,
  cwd: string | undefined,
): Promise<GitChildRunnerResult> => {
  const operation = runner("git", args, {
    timeout,
    killSignal: "SIGKILL",
    ...(cwd === undefined ? {} : { cwd }),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<GitChildRunnerResult>((resolveDeadline) => {
    timer = setTimeout(() => resolveDeadline(timeoutResult()), timeout);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/** Parse `git status --porcelain` into evidence-grade entries. */
export const parseWatchdogStatus = (text: string): WatchdogWorktreeEntry[] => {
  const entries: WatchdogWorktreeEntry[] = [];
  for (const line of text.split("\n")) {
    if (line.length < 4) continue;
    const index = line[0] ?? " ";
    const worktree = line[1] ?? " ";
    const path = line.slice(3).trim();
    if (path.length === 0) continue;
    const change =
      index === "?" && worktree === "?"
        ? "untracked"
        : index !== " " && index !== "?"
          ? "staged"
          : worktree !== " "
            ? "modified"
            : "untracked";
    entries.push({ path, change });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
};

/** Construction input for the watchdog git seam. */
export type WatchdogGitSeamOptions = {
  readonly timeoutMs?: number;
  readonly cwd?: string;
  readonly childRunner?: GitChildRunner;
};

/** The bounded watchdog git seam (`WatchdogGitPort`). */
export type WatchdogGitSeam = WatchdogGitPort;

const failure = (detail: string): WatchdogGitMutationResult => ({ ok: false, detail });

/** Build the bounded watchdog checkout seam over an injected child runner. */
export const createWatchdogGitSeam = (options: WatchdogGitSeamOptions = {}): WatchdogGitSeam => {
  const timeoutMs = options.timeoutMs ?? CLOSEOUT_OPERATION_TIMEOUT_MS;
  const runner = options.childRunner ?? execFileWatchdogRunner;
  const cwd = options.cwd;

  const git = (args: readonly string[]): Promise<GitChildRunnerResult> =>
    withTimeout(runner, args, timeoutMs, cwd);

  const memoryFacts = async (
    entries: readonly WatchdogWorktreeEntry[],
  ): Promise<readonly WatchdogMemoryFact[] | undefined> => {
    const listed = await git(["ls-files", "-z", "--", MEMORY_ROOT]);
    if (listed.status !== 0) return undefined;
    const tracked = listed.stdout.split("\0").filter((path) => path.length > 0);
    const dirty = new Map(
      entries
        .filter((entry) => isMemoryPath(entry.path))
        .map((entry) => [entry.path, entry.change] as const),
    );
    const facts: WatchdogMemoryFact[] = [];
    for (const path of tracked) {
      const change = dirty.get(path);
      if (change !== undefined) {
        facts.push({ path, state: change });
        continue;
      }
      const log = await git(["log", "-1", "--format=%H", "--", path]);
      if (log.status !== 0) return undefined;
      const commit = log.stdout.trim();
      facts.push(
        commit.length > 0 ? { path, state: "committed", commit } : { path, state: "committed" },
      );
    }
    for (const [path, state] of dirty) {
      if (!tracked.includes(path)) facts.push({ path, state });
    }
    return facts.sort((left, right) => left.path.localeCompare(right.path));
  };

  const readCheckoutFacts: WatchdogGitPort["readCheckoutFacts"] = async (input) => {
    if (!isSafeRef(input.baseRef)) {
      return { kind: "unreadable", detail: `unsafe base ref ${input.baseRef}` };
    }
    const branchResult = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branchResult.status !== 0) {
      return { kind: "unreadable", detail: `HEAD unreadable (${branchResult.status})` };
    }
    const headResult = await git(["rev-parse", "HEAD"]);
    if (headResult.status !== 0) {
      return { kind: "unreadable", detail: `HEAD commit unreadable (${headResult.status})` };
    }
    const statusResult = await git(["status", "--porcelain=v1", "--untracked-files=all"]);
    if (statusResult.status !== 0) {
      return { kind: "unreadable", detail: `status unreadable (${statusResult.status})` };
    }
    const branchValue = branchResult.stdout.trim();
    const detached = branchValue === "HEAD" || branchValue.length === 0;
    const head = headResult.stdout.trim();
    const entries = parseWatchdogStatus(statusResult.stdout);
    const baseResult = await git(["rev-parse", "--verify", `refs/heads/${input.baseRef}`]);
    const baseResolves = baseResult.status === 0;

    let branchHead: string | undefined;
    if (!detached) {
      const branchFact = await git(["rev-parse", "--verify", `refs/heads/${branchValue}`]);
      if (branchFact.status === 0) branchHead = branchFact.stdout.trim();
    }

    let strandedCommit: string | undefined;
    if (detached) {
      const containing = await git([
        "for-each-ref",
        "--contains",
        "HEAD",
        "--format=%(refname:short)",
        "refs/heads",
      ]);
      if (containing.status !== 0) {
        return {
          kind: "unreadable",
          detail: `branch containment unreadable (${containing.status})`,
        };
      }
      if (containing.stdout.trim().length === 0) strandedCommit = head;
    }

    const memory = await memoryFacts(entries);
    if (memory === undefined) {
      return { kind: "unreadable", detail: "agent-memory facts unreadable" };
    }

    return {
      kind: "facts",
      baseResolves,
      ...(detached ? {} : { branch: branchValue }),
      detached,
      head,
      clean: entries.length === 0,
      entries,
      memory,
      ...(strandedCommit === undefined ? {} : { strandedCommit }),
      ...(branchHead === undefined ? {} : { branchHead }),
    };
  };

  const restoreCheckout: WatchdogGitPort["restoreCheckout"] = async (input) => {
    if (!isSafeRef(input.baseRef)) return failure(`unsafe base ref ${input.baseRef}`);
    const result = await git(["checkout", input.baseRef]);
    if (result.status === 0) return { ok: true };
    return failure(
      result.timedOut
        ? `checkout ${input.baseRef} timed out`
        : `checkout ${input.baseRef} failed (${result.status})`,
    );
  };

  const removePath: WatchdogGitPort["removePath"] = async (input) => {
    if (!isSafeRelativePath(input.path)) return failure(`unsafe removal path ${input.path}`);
    if (isMemoryPath(input.path)) {
      return failure(`refusing to remove agent-memory path ${input.path}`);
    }
    const root = cwd === undefined ? process.cwd() : resolve(cwd);
    const absolute = resolve(root, input.path);
    const withinRoot = absolute === root || absolute.startsWith(`${root}${sep}`);
    if (!withinRoot) return failure(`removal path ${input.path} escapes the repository`);
    await rm(absolute, { recursive: true, force: true });
    return { ok: true };
  };

  const preserveCommit: WatchdogGitPort["preserveCommit"] = async (input) => {
    if (!isSafeRef(input.ref)) return failure(`unsafe preservation ref ${input.ref}`);
    if (!COMMIT_PATTERN.test(input.commit)) return failure(`unsafe commit ${input.commit}`);
    const result = await git(["update-ref", `refs/heads/${input.ref}`, input.commit]);
    if (result.status === 0) return { ok: true };
    return failure(
      result.timedOut
        ? `preserve ${input.ref} timed out`
        : `preserve ${input.ref} failed (${result.status})`,
    );
  };

  return { readCheckoutFacts, restoreCheckout, removePath, preserveCommit };
};
