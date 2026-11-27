/**
 * The guarded injected process runner (GH-347 §7.2(a), AC-F9-4, NFR-5).
 *
 * Wraps every injected child seam the parity battery composes
 * (`harnessSpawnRunner`, the streaming starter built from it, and the git
 * child runner). It records each invocation and fails the run BY NAME when the
 * executable is a shell or an argument is a script path. It never starts a real
 * process: `realChildStarts` is a LIVE counter of permitted starts, so a
 * composed run observes an intercepted start at 0 and a permitted-start control
 * observes 1.
 */

import type {
  GitChildRunner,
  GitPushChildRunner,
  GitPushRunnerResult,
} from "../../../../packages/adapters/src/git/index";
import type {
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
  HarnessSpawnStarter,
} from "../../../../packages/core/src/contracts/index";
import { streamStarterFromRunner } from "../../harness/harness-io";

/** The shell executables the guard refuses outright (basename match). */
const SHELL_EXECUTABLES = new Set(["bash", "sh", "zsh", "dash", "cmd", "powershell"]);

export type GuardedSeam = "harness" | "git" | "push";

export type GuardedInvocation = {
  readonly seam: GuardedSeam;
  readonly file: string;
  readonly args: readonly string[];
  readonly stdin?: string;
  /** The declared child timeout the push seam passed (the injectable budget). */
  readonly timeout?: number;
};

/** The delivered fixture head literal: the local parity fact every row shares. */
export const PARITY_FIXTURE_HEAD = "0123456789abcdef";

/** Whether an argv element is a script path the dispatch flow must never use. */
export const isScriptPath = (value: string): boolean =>
  value.endsWith(".sh") ||
  value.startsWith("scripts/") ||
  value.startsWith("tools/") ||
  value.includes("deliver-ticket");

const shellOf = (file: string): string => file.split("/").pop() ?? file;

export type SessionScript = {
  readonly sessionId: string;
  readonly stdout: string;
  readonly stderr?: string;
  readonly status: number;
  readonly timedOut: boolean;
};

export type GuardedRunnerOptions = {
  /**
   * The PLANTED CONTROL (GH-347 AC-F9-4, review M5): when true the guard
   * PERMITS the start and counts it, so `realChildStarts` is observed moving.
   * The battery never sets it, so its own count reads 0 because no start was
   * permitted — never because the field is a literal.
   */
  readonly permitStarts?: boolean;
  /**
   * The scripted session output per invocation. The default identifies the
   * session from the `--session <id>` resume marker and stays complete, so a
   * resume reports the caller's identity (the adapter refuses a different one).
   */
  readonly session?: (invocation: GuardedInvocation) => SessionScript;
  /** The scripted git facts; the default declares one change branch and 2 commits. */
  readonly git?: (invocation: GuardedInvocation) => HarnessSpawnRunnerResult;
  /**
   * The scripted push outcome (GH-386 F-1): the one remote-write act, recorded
   * with argv/count/call order under the `push` seam. The default refuses an
   * unexpected push loudly (status 1), so an act firing under equal heads is a
   * loud defect, never a silent pass.
   */
  readonly push?: (invocation: GuardedInvocation) => GitPushRunnerResult;
  /** The change branch the default git script declares. */
  readonly branch?: string;
  readonly ahead?: number;
  /** The full-hex head the default git script declares (the local parity fact). */
  readonly head?: string;
};

export type GuardedRunner = {
  readonly runner: HarnessSpawnRunner;
  readonly starter: HarnessSpawnStarter;
  readonly gitRunner: GitChildRunner;
  readonly pushRunner: GitPushChildRunner;
  readonly records: readonly GuardedInvocation[];
  readonly violations: readonly string[];
  readonly invocations: number;
  readonly spawns: number;
  readonly resumes: number;
  readonly pushes: number;
  readonly realChildStarts: number;
  readonly shellInvocations: number;
  readonly scriptPathInvocations: number;
  readonly reset: () => void;
};

const sessionIdOfResume = (args: readonly string[]): string | undefined => {
  const index = args.indexOf("--session");
  return index >= 0 ? args[index + 1] : undefined;
};

export const createGuardedRunner = (options: GuardedRunnerOptions = {}): GuardedRunner => {
  const records: GuardedInvocation[] = [];
  const violations: string[] = [];
  let spawns = 0;
  let resumes = 0;
  let pushes = 0;
  let childStarts = 0;

  const guard = (seam: GuardedSeam, file: string, args: readonly string[]): void => {
    const record: GuardedInvocation = { seam, file, args: [...args] };
    records.push(record);
    // The live start counter observes every start the guard PERMITS. The guard
    // never starts a process itself, so the battery's count is 0 only because no
    // start was permitted (the planted control permits one and reads 1).
    if (options.permitStarts === true) childStarts += 1;
    const shell = shellOf(file);
    if (SHELL_EXECUTABLES.has(shell)) {
      violations.push(`shell invocation recorded: ${file} ${args.join(" ")}`);
      throw new Error(`shell invocation recorded: ${file} ${args.join(" ")}`);
    }
    for (const arg of args) {
      if (isScriptPath(arg)) {
        violations.push(`script path recorded: ${arg} (seam ${seam})`);
        throw new Error(`script path recorded: ${arg} (seam ${seam})`);
      }
    }
  };

  const sessionFor = (invocation: GuardedInvocation): SessionScript => {
    if (options.session !== undefined) return options.session(invocation);
    const resumed = sessionIdOfResume(invocation.args);
    const sessionId = resumed ?? `ses-parity-${spawns + resumes + 1}`;
    return {
      sessionId,
      stdout: JSON.stringify({
        session: { id: sessionId },
        result: { completion: "complete" },
      }),
      status: 0,
      timedOut: false,
    };
  };

  const runner: HarnessSpawnRunner = async (file, args, runnerOptions) => {
    guard("harness", file, args);
    if (sessionIdOfResume(args) === undefined) spawns += 1;
    else resumes += 1;
    records[records.length - 1] = {
      seam: "harness",
      file,
      args: [...args],
      ...(runnerOptions.stdin === undefined ? {} : { stdin: runnerOptions.stdin }),
    };
    const script = sessionFor({ seam: "harness", file, args: [...args] });
    return {
      stdout: script.stdout,
      stderr: script.stderr ?? "",
      status: script.status,
      timedOut: script.timedOut,
    };
  };

  const gitRunner: GitChildRunner = async (file, args) => {
    guard("git", file, args);
    if (options.git !== undefined) {
      return options.git({ seam: "git", file, args: [...args] });
    }
    const [verb] = args;
    if (verb === "for-each-ref") {
      const branch = options.branch ?? "feat/GH-347/parity";
      const head = options.head ?? PARITY_FIXTURE_HEAD;
      return { stdout: `${branch} ${head}\n`, stderr: "", status: 0, timedOut: false };
    }
    if (verb === "rev-parse") {
      // GH-416: the lane-push command reads the invocation checkout's HEAD
      // through the delivered local checkout/head read.
      const target = args[1];
      if (target === "--abbrev-ref") {
        return {
          stdout: `${options.branch ?? "feat/GH-347/parity"}\n`,
          stderr: "",
          status: 0,
          timedOut: false,
        };
      }
      return {
        stdout: `${options.head ?? PARITY_FIXTURE_HEAD}\n`,
        stderr: "",
        status: 0,
        timedOut: false,
      };
    }
    if (verb === "rev-list") {
      return {
        stdout: `${options.ahead ?? 2}`,
        stderr: "",
        status: 0,
        timedOut: false,
      };
    }
    return { stdout: "", stderr: "unexpected git argv", status: 1, timedOut: false };
  };

  // The push double (GH-386 F-1): records argv, count, call order, and the
  // declared child timeout under the `push` seam, refuses a shell by name
  // through the same guard, and scripts the declared outcome classes. An
  // unexpected push is loud (status 1), so an act firing under equal heads can
  // never pass silently.
  const pushRunner: GitPushChildRunner = async (file, args, runnerOptions) => {
    guard("push", file, args);
    pushes += 1;
    const last = records[records.length - 1];
    if (last !== undefined) {
      records[records.length - 1] = { ...last, timeout: runnerOptions.timeout };
    }
    if (!options.push) {
      return {
        stdout: "",
        stderr: "unexpected push argv",
        status: 1,
        timedOut: false,
      };
    }
    return options.push({ seam: "push", file, args: [...args] });
  };

  return {
    runner,
    starter: streamStarterFromRunner(runner),
    gitRunner,
    pushRunner,
    get records() {
      return records;
    },
    get violations() {
      return violations;
    },
    get invocations() {
      return records.length;
    },
    get spawns() {
      return spawns;
    },
    get resumes() {
      return resumes;
    },
    get pushes() {
      return pushes;
    },
    get realChildStarts() {
      return childStarts;
    },
    get shellInvocations() {
      return violations.filter((entry) => entry.startsWith("shell invocation")).length;
    },
    get scriptPathInvocations() {
      return violations.filter((entry) => entry.startsWith("script path")).length;
    },
    reset: () => {
      records.length = 0;
      violations.length = 0;
      spawns = 0;
      resumes = 0;
      pushes = 0;
      childStarts = 0;
    },
  };
};
