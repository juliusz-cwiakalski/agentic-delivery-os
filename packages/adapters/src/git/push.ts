/**
 * `@delivery-os/adapters/git` push seam (GH-386 F-1, NFR-1; TDR-0076; GH-416
 * F-1, NFR-1, NFR-2, DM-4).
 *
 * The typed stack's first remote-write act: one non-force push of `HEAD` to the
 * change branch on the checkout's configured push remote. The push remote is
 * resolved by one bounded local configuration read, in the declared order
 * (`branch.<branch>.pushRemote`, `remote.pushDefault`, `branch.<branch>.remote`,
 * then `origin`); a missing or ambiguous destination is a typed
 * `remote-unavailable` refusal that starts no child, never a guess. The read is
 * bounded and total: a configuration file larger than 64 KiB, or a section header
 * the grammar cannot parse, makes the destination unresolvable rather than
 * partially read, and a header carrying trailing text git tolerates keeps its
 * keys. Fixed argv,
 * a literal non-shell child process over an injectable child runner, and a
 * 60 000 ms default timeout injectable through the seam options with no new
 * configuration key. Fast-forward-only semantics are git's own default for a
 * non-force push, so the seam passes no `--ff-only` (git has no such option for
 * `push`) and no force flag. The outcome union is the declared contract set and
 * contains no force-capable variant and no ref beyond the change branch; the act
 * is one attempt with no retry — the next dispatch or an operator resume
 * resolves a failed act.
 */
import { spawn } from "node:child_process";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
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
   * One non-force push of the change branch to the configured push remote. The
   * destination resolves from the checkout's own configuration read, the argv
   * is fixed and literal, and the act never discovers an upstream by other
   * means and never names a second ref.
   */
  readonly pushChangeBranch: (input: { readonly branch: string }) => Promise<GitPushOutcome>;
};

/** The declared default act budget (NFR-1); injectable through the seam options. */
export const PUSH_DEFAULT_TIMEOUT_MS = 60_000;

const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

/**
 * The bounded size of the one local configuration read (NFR-1, NFR-2). A larger
 * file is treated as unresolvable, so a key written past the bound can never
 * resolve from a lower-precedence position.
 */
const MAX_CONFIG_BYTES = 64 * 1024;
/** The bounded size of a `.git` pointer file or a `commondir` file. */
const MAX_POINTER_BYTES = 4 * 1024;
/** The bounded upward search for the checkout's git directory. */
const MAX_SEARCH_DEPTH = 64;
/**
 * A remote name the seam will pass as the repository argument. The accepted
 * alphabet is `[A-Za-z0-9._/-]` with no leading `-`: everything git itself
 * resolves as a remote nickname by repository path, plus the nested
 * `origin/main`-shaped spelling. Names git also accepts but this seam refuses
 * are `fork+oss`, `user@fork`, `a%b`, `a=b`, and non-ASCII names; a checkout
 * whose push remote is one of those is refused `remote-unavailable`, never
 * guessed at. A value outside this shape (a URL, a blank, or anything that could
 * read as an option) is a missing destination.
 */
const REMOTE_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/u;

/**
 * The closed cause vocabulary read from the contracts home (DM-4), never
 * re-typed: the classification table below is the one place that maps git's
 * bounded failure text onto these tokens.
 */
const [NON_FAST_FORWARD, AUTH_REJECTED, REMOTE_UNAVAILABLE, , , PROTECTED_REF, UNCLASSIFIED] =
  DISPATCH_PUSH_RECORDABLE_CAUSES;

/**
 * The declared rejection classification table (DM-4, DEC-4). The patterns live
 * in this one module; the tokens are the imported closed-cause members. A
 * protection or hook decline git reports is `protected-ref` and nothing else;
 * a missing destination or a path that is no repository is `remote-unavailable`;
 * an HTTP 403 or a not-granted write is `auth-rejected` (matched before the
 * unavailable row); an unrecognised rejection is the honest `unclassified`
 * fallback.
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
      /authentication failed|permission denied|could not read (username|password)|permission to .* denied|access denied|403 forbidden|returned error:\s*403|write access .*not granted|invalid username or password/i,
  },
  {
    cause: REMOTE_UNAVAILABLE,
    pattern:
      /could not resolve host|unable to access|no configured push destination|does not appear to be a git repository|connection (refused|timed out|reset)|network is unreachable|could not read from remote repository|repository not found|host key verification failed/i,
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

/** One parsed configuration entry: the section, its optional subsection, and the value. */
type GitConfigEntry = {
  readonly section: string;
  readonly subsection: string | undefined;
  readonly key: string;
  readonly value: string;
};

/**
 * One section-header line. The closing bracket ends the grammar, and git
 * tolerates arbitrary text after it (an annotation such as `[branch "x"] # lane`,
 * probed against git 2.53.0), so this grammar tolerates it too and the keys
 * below the header stay in that section. A `[`-starting line that does not match
 * is a parse failure, never a silent continuation of the previous section.
 */
const SECTION_HEADER = /^\[\s*([A-Za-z0-9.-]+)\s*(?:"((?:[^"\\]|\\.)*)")?\s*\].*$/u;

/** Strip the quoting and the trailing comment git allows on one value. */
const unquoted = (value: string): string => {
  if (value.startsWith('"')) {
    const end = value.lastIndexOf('"');
    if (end > 0) return value.slice(1, end).replace(/\\(.)/gu, "$1");
  }
  const comment = value.search(/[#;]/u);
  return (comment < 0 ? value : value.slice(0, comment)).trim();
};

/**
 * Parse the subset of the git configuration grammar the resolution needs:
 * section headers (with an optional quoted subsection and git's tolerated
 * trailing text), `key = value` pairs, comments, and quoting. Keys and section
 * names fold to lower case, as git's own configuration reader does; a subsection
 * (the branch or remote name) stays case sensitive. Returns `undefined` when a
 * line starts a section header this grammar cannot parse: an unparsed header
 * would otherwise hand its keys to the previous section, so the whole read fails
 * closed instead.
 */
const parseGitConfig = (text: string): readonly GitConfigEntry[] | undefined => {
  const entries: GitConfigEntry[] = [];
  let section = "";
  let subsection: string | undefined;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#") || line.startsWith(";")) continue;
    if (line.startsWith("[")) {
      const header = SECTION_HEADER.exec(line);
      if (header === null) return undefined;
      section = (header[1] ?? "").toLowerCase();
      const name = header[2];
      subsection = name === undefined ? undefined : name.replace(/\\(.)/gu, "$1");
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    if (key.length === 0) continue;
    entries.push({
      section,
      subsection,
      key,
      value: unquoted(line.slice(separator + 1).trim()),
    });
  }
  return entries;
};

/** The distinct non-empty values of one configuration key, in declaration order. */
const valuesOf = (
  entries: readonly GitConfigEntry[],
  matches: (entry: GitConfigEntry) => boolean,
): readonly string[] => [
  ...new Set(
    entries
      .filter(matches)
      .map((entry) => entry.value)
      .filter((value) => value.length > 0),
  ),
];

const branchValue = (
  entries: readonly GitConfigEntry[],
  branch: string,
  key: string,
): readonly string[] =>
  valuesOf(
    entries,
    (entry) => entry.section === "branch" && entry.subsection === branch && entry.key === key,
  );

/** A push destination outside the declared shape is no destination at all. */
const isDestinationName = (value: string): boolean =>
  REMOTE_NAME_PATTERN.test(value) && !value.startsWith("-");

/** One resolution attempt: exactly one push remote, or a typed absence. */
type PushRemoteResolution = { readonly ok: true; readonly remote: string } | { readonly ok: false };

/**
 * Resolve the push remote from the parsed configuration, in the declared order:
 * `branch.<branch>.pushRemote`, `remote.pushDefault`, `branch.<branch>.remote`,
 * then `origin`. The first stage that carries a value decides; more than one
 * distinct value at that stage is ambiguous, and no value anywhere (with no
 * `origin` remote declared) is missing. Both are the same typed absence.
 */
const resolvePushRemote = (
  entries: readonly GitConfigEntry[],
  branch: string,
): PushRemoteResolution => {
  const stages: readonly (readonly string[])[] = [
    branchValue(entries, branch, "pushremote"),
    valuesOf(
      entries,
      (entry) =>
        entry.section === "remote" && entry.subsection === undefined && entry.key === "pushdefault",
    ),
    branchValue(entries, branch, "remote"),
  ];
  for (const values of stages) {
    if (values.length === 0) continue;
    if (values.length > 1) return { ok: false };
    const value = values[0];
    if (value === undefined || !isDestinationName(value)) return { ok: false };
    return { ok: true, remote: value };
  }
  const originDeclared = entries.some(
    (entry) => entry.section === "remote" && entry.subsection === "origin",
  );
  return originDeclared ? { ok: true, remote: "origin" } : { ok: false };
};

/** Read at most `cap` bytes of a file; an absent or unreadable file is `undefined`. */
const readBoundedText = (path: string, cap: number): string | undefined => {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, "r");
    const buffer = new Uint8Array(cap);
    let total = 0;
    while (total < cap) {
      const bytes = readSync(descriptor, buffer, total, cap - total, total);
      if (bytes <= 0) break;
      total += bytes;
    }
    return new TextDecoder().decode(buffer.subarray(0, total));
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The descriptor is already closed; absence of a read is the answer.
      }
    }
  }
};

/**
 * Read a file that must fit inside `cap` bytes. One byte past the cap is read so
 * an oversized file is `undefined` instead of a silent prefix: a partially read
 * configuration would answer from the wrong precedence position.
 */
const readBoundedTextExact = (path: string, cap: number): string | undefined => {
  let descriptor: number | undefined;
  try {
    descriptor = openSync(path, "r");
    const buffer = new Uint8Array(cap + 1);
    let total = 0;
    while (total < cap + 1) {
      const bytes = readSync(descriptor, buffer, total, cap + 1 - total, total);
      if (bytes <= 0) break;
      total += bytes;
    }
    if (total > cap) return undefined;
    return new TextDecoder().decode(buffer.subarray(0, total));
  } catch {
    return undefined;
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The descriptor is already closed; absence of a read is the answer.
      }
    }
  }
};

/** The filesystem kind of one path, without throwing on absence. */
const kindOf = (path: string): "file" | "directory" | undefined => {
  try {
    const stats = statSync(path, { throwIfNoEntry: false });
    if (stats === undefined) return undefined;
    if (stats.isDirectory()) return "directory";
    if (stats.isFile()) return "file";
    return undefined;
  } catch {
    return undefined;
  }
};

/** Follow one `.git` pointer file (a linked worktree) to its git directory. */
const linkedGitDirectory = (pointerFile: string, base: string): string | undefined => {
  const text = readBoundedText(pointerFile, MAX_POINTER_BYTES);
  if (text === undefined) return undefined;
  const match = /^\s*gitdir:\s*(.+?)\s*$/mu.exec(text);
  const target = match?.[1];
  if (target === undefined || target.length === 0) return undefined;
  const gitDirectory = isAbsolute(target) ? target : resolve(base, target);
  const common = readBoundedText(join(gitDirectory, "commondir"), MAX_POINTER_BYTES);
  if (common === undefined) return gitDirectory;
  const trimmed = common.trim();
  return trimmed.length === 0 ? gitDirectory : resolve(gitDirectory, trimmed);
};

/**
 * The checkout's git directory, found by one bounded upward search from the
 * working directory. A linked worktree resolves through its `.git` pointer and
 * its `commondir`; a bare repository is its own git directory.
 */
const gitDirectoryOf = (start: string): string | undefined => {
  let current = resolve(start);
  for (let depth = 0; depth < MAX_SEARCH_DEPTH; depth += 1) {
    const entry = join(current, ".git");
    const kind = kindOf(entry);
    if (kind === "directory") return entry;
    if (kind === "file") return linkedGitDirectory(entry, current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return kindOf(join(start, "objects")) === "directory" && kindOf(join(start, "HEAD")) === "file"
    ? resolve(start)
    : undefined;
};

/**
 * The one bounded local configuration read (NFR-2): resolve the change branch's
 * push remote, or report the destination missing. It runs no child process and
 * never consults a global or system configuration, so the destination is a
 * property of the checkout alone. The bound is 64 KiB: a larger configuration
 * file, or a header the parser cannot read, is a missing destination.
 */
const resolvePushRemoteFor = (branch: string, cwd: string | undefined): string | undefined => {
  const gitDirectory = gitDirectoryOf(cwd ?? process.cwd());
  if (gitDirectory === undefined) return undefined;
  const text = readBoundedTextExact(join(gitDirectory, "config"), MAX_CONFIG_BYTES);
  if (text === undefined) return undefined;
  const entries = parseGitConfig(text);
  if (entries === undefined) return undefined;
  const resolution = resolvePushRemote(entries, branch);
  return resolution.ok ? resolution.remote : undefined;
};

/**
 * The production default runner: a literal non-shell child process with the
 * declared `shell: false` spawn contract, bounded output, and the declared
 * SIGKILL timeout. A start failure is the runner's `spawnFailed` fact, never a
 * throw across the seam.
 */
const localRunner: GitPushChildRunner = (file, args, options) =>
  new Promise((resolvePromise) => {
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
      resolvePromise({ stdout, stderr, status: 1, timedOut: false, spawnFailed: true });
    });
    child.on("close", (code, signal) => {
      if (truncated) {
        resolvePromise({ stdout, stderr, status: code ?? 1, timedOut: false, spawnFailed: false });
        return;
      }
      resolvePromise({
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
      // The one bounded configuration read runs after both guards; a missing or
      // ambiguous destination is a typed refusal that starts no child.
      const remote = resolvePushRemoteFor(input.branch, options.cwd);
      if (remote === undefined) return { outcome: "rejected", detail: REMOTE_UNAVAILABLE };
      // Fixed argv: one repository argument (the resolved push remote), one
      // refspec (HEAD to the change branch), no force flag and no `+` prefix.
      // Fast-forward-only semantics are git's own default for a non-force push.
      const result = await runner("git", ["push", remote, `HEAD:refs/heads/${input.branch}`], {
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
