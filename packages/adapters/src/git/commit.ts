/**
 * `@delivery-os/adapters/git` commit seam (GH-227 F-5, NG-4).
 *
 * The only spawn surface for staging and commit-object creation. Fixed argv, no
 * shell, no network, local only. Every child process is bounded and the seam
 * reports facts, never throws across its port.
 */
import { execFile } from "node:child_process";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COMMIT_DIFF_PER_FILE_CAP,
  type CommitCandidateFile,
  type CommitFileStatus,
  type CommitGitPort,
  type CommitMessageDraft,
  type CommitTreeFacts,
} from "@delivery-os/core/contracts";

/** One child-runner result; a non-zero exit is data, not a throw. */
export type CommitChildRunnerResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
  readonly timedOut: boolean;
};

/** The injectable child-process seam (production default: `execFile`). */
export type CommitChildRunner = (
  file: string,
  args: readonly string[],
  options: {
    readonly timeout: number;
    readonly killSignal: "SIGKILL";
    readonly cwd?: string;
  },
) => Promise<CommitChildRunnerResult>;

/** Construction input for the commit seam. */
export type GitCommitSeamOptions = {
  readonly timeoutMs?: number;
  readonly cwd?: string;
  readonly childRunner?: CommitChildRunner;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const BINARY_PROBE_BYTES = 8000;
const SAFE_SHA = /^[0-9a-f]{7,64}$/;

const execFileRunner: CommitChildRunner = (file, args, options) =>
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

const statusFor = (code: string): CommitFileStatus => {
  const x = code[0] ?? " ";
  const y = code[1] ?? " ";
  if (code === "??") return "untracked";
  if (x === "R" || y === "R") return "renamed";
  if (x === "C" || y === "C") return "renamed";
  if (x === "A" || y === "A") return "added";
  if (x === "D" || y === "D") return "deleted";
  return "modified";
};

type PorcelainEntry = { readonly code: string; readonly path: string };

/** Parse `git status --porcelain=v1 -z` into path/status entries. */
export const parsePorcelainStatus = (stdout: string): PorcelainEntry[] => {
  const tokens = stdout.split("\0");
  const entries: PorcelainEntry[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || token.length < 4) continue;
    const code = token.slice(0, 2);
    const path = token.slice(3);
    entries.push({ code, path });
    if (code[0] === "R" || code[0] === "C") index += 1;
  }
  return entries;
};

const isBinaryContent = (path: string): boolean => {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, "r");
    const buffer = new Uint8Array(BINARY_PROBE_BYTES);
    const bytes = readSync(descriptor, buffer, 0, BINARY_PROBE_BYTES, 0);
    return buffer.subarray(0, bytes).includes(0);
  } catch {
    return false;
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The descriptor is already gone; the probe answer stands.
      }
    }
  }
};

/** Split one multi-path `git diff` into per-path chunks by their headers. */
const splitDiffByPath = (stdout: string): Map<string, string> => {
  const chunks = new Map<string, string>();
  for (const part of stdout.split(/^(?=diff --git )/m)) {
    if (!part.startsWith("diff --git ")) continue;
    const headerEnd = part.indexOf("\n");
    const header = headerEnd < 0 ? part : part.slice(0, headerEnd);
    const marker = " b/";
    const middle = header.lastIndexOf(marker);
    if (middle < 0) continue;
    const path = header.slice(middle + marker.length);
    if (path.length === 0 || chunks.has(path)) continue;
    chunks.set(path, part);
  }
  return chunks;
};

const fileSize = (path: string): number => {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
};

/** Build the commit seam over an injected (or production) child runner. */
export const createGitCommitSeam = (options: GitCommitSeamOptions = {}): CommitGitPort => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const runner = options.childRunner ?? execFileRunner;

  const git = (args: readonly string[]): Promise<CommitChildRunnerResult> =>
    runner("git", args, {
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    });

  const absolute = (path: string): string =>
    options.cwd === undefined ? path : join(options.cwd, path);

  const readTree = async (): Promise<CommitTreeFacts> => {
    const [branchResult, headResult, countResult, logResult, statusResult] = await Promise.all([
      git(["rev-parse", "--abbrev-ref", "HEAD"]),
      git(["rev-parse", "HEAD"]),
      git(["rev-list", "--count", "HEAD"]),
      git(["log", "-5", "--format=%s"]),
      git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    ]);
    const branch = branchResult.stdout.trim();
    const head = headResult.stdout.trim();
    const commitCount = Number.parseInt(countResult.stdout.trim(), 10);
    const lastCommitSubjects = logResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const entries = parsePorcelainStatus(statusResult.stdout);
    const candidates = entries.map((entry) => {
      const absolutePath = absolute(entry.path);
      return {
        entry,
        tracked: entry.code !== "??",
        binary: isBinaryContent(absolutePath),
        sizeBytes: fileSize(absolutePath),
      };
    });
    const trackedDiffPaths = candidates
      .filter((candidate) => candidate.tracked && !candidate.binary)
      .map((candidate) => candidate.entry.path);
    const batched =
      trackedDiffPaths.length > 1
        ? splitDiffByPath(
            (await git(["diff", "--no-color", "--unified=3", "--", ...trackedDiffPaths])).stdout,
          )
        : new Map<string, string>();
    const files: CommitCandidateFile[] = [];
    for (const candidate of candidates) {
      const { entry, tracked, binary, sizeBytes } = candidate;
      let diffText: string | undefined;
      let overCap = false;
      if (!binary) {
        const single = async (): Promise<string> =>
          (
            await git(
              tracked
                ? ["diff", "--no-color", "--unified=3", "--", entry.path]
                : ["diff", "--no-color", "--no-index", "--", "/dev/null", entry.path],
            )
          ).stdout;
        const diffTextCandidate = tracked
          ? (batched.get(entry.path) ?? (await single()))
          : await single();
        if (diffTextCandidate.length > COMMIT_DIFF_PER_FILE_CAP) {
          overCap = true;
        } else if (diffTextCandidate.length > 0) {
          diffText = diffTextCandidate;
        }
      }
      files.push({
        path: entry.path,
        status: statusFor(entry.code),
        tracked,
        binary,
        sizeBytes,
        ...(diffText === undefined ? {} : { diffText }),
        overCap,
      });
    }
    return {
      branch: branch.length === 0 ? "HEAD" : branch,
      files: files.sort((left, right) => left.path.localeCompare(right.path, "en")),
      lastCommitSubjects,
      head,
      commitCount: Number.isFinite(commitCount) ? commitCount : 0,
    };
  };

  return {
    readTree,
    stage: async (paths) => {
      if (paths.length === 0) return true;
      const result = await git(["add", "-A", "--", ...paths]);
      return result.status === 0;
    },
    commit: async (message: CommitMessageDraft) => {
      const args = [
        "commit",
        "--no-verify",
        "--no-gpg-sign",
        "-m",
        message.subject,
        ...(message.body === undefined || message.body.length === 0 ? [] : ["-m", message.body]),
      ];
      const result = await git(args);
      if (result.status !== 0) {
        return { ok: false, detail: result.timedOut ? "commit timed out" : "commit failed" };
      }
      const head = await git(["rev-parse", "HEAD"]);
      const sha = head.stdout.trim();
      return sha.length === 0
        ? { ok: false, detail: "commit object did not resolve" }
        : { ok: true, sha };
    },
    head: async () => {
      const result = await git(["rev-parse", "HEAD"]);
      const sha = result.stdout.trim();
      return result.status === 0 && sha.length > 0 ? sha : undefined;
    },
    resetTo: async (sha) => {
      if (!SAFE_SHA.test(sha)) return false;
      const result = await git(["reset", "--mixed", sha]);
      return result.status === 0;
    },
  };
};
