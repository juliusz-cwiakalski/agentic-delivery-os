/**
 * GH-221 watchdog harness: an in-process `runCli` over the real watchdog command,
 * a recording git child runner, a recording lane runtime, injected
 * clock/run-id/brand, and buffer sinks. No real streams, no network, no host
 * state; checkout state is always a real temporary repository.
 */
import { execFile } from "node:child_process";
import type {
  GitChildRunner,
  GitChildRunnerResult,
} from "../../../packages/adapters/src/git/index";
import { createWatchdogGitSeam } from "../../../packages/adapters/src/git/watchdog";
import { createWatchdogCommandDefinition } from "../../../packages/cli/src/commands/watchdog";
import { type CliDependencies, type CommandProgram, runCli } from "../../../packages/cli/src/index";
import type {
  BrandIdentity,
  WatchdogGitPort,
  WatchdogLaneRead,
  WatchdogLaneRecord,
  WatchdogSignalSource,
} from "../../../packages/core/src/contracts/index";
import { bufferSink, SYNTHETIC_BRAND } from "../../golden/helpers";
import { laneRecord as defaultLaneRecord, type WatchdogTempRepository } from "./temp-git";

export type WatchdogRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly runtimeCalls: readonly string[];
  readonly gitCalls: readonly (readonly string[])[];
};

export type HarnessOptions = {
  readonly repo: WatchdogTempRepository | string;
  readonly lane?: WatchdogLaneRecord;
  readonly laneRead?: WatchdogLaneRead | ((lane: string) => WatchdogLaneRead);
  readonly git?: Partial<WatchdogGitPort>;
  readonly signalSources?: readonly WatchdogSignalSource[];
  readonly ticks?: readonly [number, number];
  readonly runId?: string;
  readonly brand?: BrandIdentity;
};

const execFileRunner: GitChildRunner = (file, args, options) =>
  new Promise<GitChildRunnerResult>((resolve) => {
    execFile(
      file,
      [...args],
      {
        timeout: options.timeout,
        killSignal: options.killSignal,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
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

const repoDirectory = (repo: WatchdogTempRepository | string): string =>
  typeof repo === "string" ? repo : repo.directory;

export type HarnessRuntime = { readonly calls: string[] };

/**
 * Build the recording runtime and run one watchdog invocation. Every lane read
 * and git-port call is logged; the git child runner logs every argv so tests can
 * prove nothing destroys memory publications.
 */
export const runWatchdogCli = async (
  argv: readonly string[],
  options: HarnessOptions,
): Promise<WatchdogRun> => {
  const calls: string[] = [];
  const gitCalls: string[][] = [];
  const cwd = repoDirectory(options.repo);
  const recordingRunner: GitChildRunner = (file, args, runnerOptions) => {
    gitCalls.push([file, ...args]);
    return execFileRunner(file, args, runnerOptions);
  };
  const seam = createWatchdogGitSeam({ timeoutMs: 5_000, cwd, childRunner: recordingRunner });
  const overrides = options.git ?? {};
  const git: WatchdogGitPort = {
    readCheckoutFacts: async (input) => {
      calls.push("git.readCheckoutFacts");
      return (overrides.readCheckoutFacts ?? seam.readCheckoutFacts)(input);
    },
    restoreCheckout: async (input) => {
      calls.push("git.restoreCheckout");
      return (overrides.restoreCheckout ?? seam.restoreCheckout)(input);
    },
    removePath: async (input) => {
      calls.push("git.removePath");
      return (overrides.removePath ?? seam.removePath)(input);
    },
    preserveCommit: async (input) => {
      calls.push("git.preserveCommit");
      return (overrides.preserveCommit ?? seam.preserveCommit)(input);
    },
  };
  const readLane = (lane: string): WatchdogLaneRead => {
    calls.push(`readLane:${lane}`);
    const laneRead = options.laneRead;
    if (typeof laneRead === "function") return laneRead(lane);
    if (laneRead !== undefined) return laneRead;
    return { ok: true, record: options.lane ?? defaultLaneRecord() };
  };
  const runtime = {
    readLane,
    git,
    signalSources: options.signalSources ?? [],
  };

  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = options.ticks ?? [100, 110];
  let tick = 0;
  const program: CommandProgram = {
    commands: { watchdog: createWatchdogCommandDefinition(runtime) },
  };
  const deps: CliDependencies = {
    brand: options.brand ?? SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => options.runId ?? "run-watchdog-fixture",
    secrets: [],
    program,
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  return {
    exitCode,
    stdout: stdout.value,
    stderr: stderr.value,
    runtimeCalls: calls,
    gitCalls,
  };
};

export type ParsedEnvelope = Record<string, unknown>;

export const parseEnvelope = (run: WatchdogRun): ParsedEnvelope =>
  JSON.parse(run.stdout) as ParsedEnvelope;

export const errorOf = (envelope: ParsedEnvelope): Record<string, unknown> => {
  const error = envelope.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) return {};
  return error as Record<string, unknown>;
};

export const dataOf = (envelope: ParsedEnvelope): Record<string, unknown> => {
  const data = envelope.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
  return data as Record<string, unknown>;
};

const READ_METHODS = new Set(["git.readCheckoutFacts"]);

/** Runtime calls that mutate state; preflight must record none of them. */
export const mutationCalls = (calls: readonly string[]): string[] =>
  calls.filter((call) => call.startsWith("git.") && !READ_METHODS.has(call));

/** Runtime calls that would mean the surface runs lanes or sessions. */
const RUNNER_METHODS = ["dispatch", "spawnSession", "spawn", "kill", "restart", "supervise"];

export const runnerSideEffectCalls = (calls: readonly string[]): string[] =>
  calls.filter((call) => RUNNER_METHODS.some((method) => call.toLowerCase().includes(method)));

const DESTRUCTIVE_GIT = ["checkout", "clean", "reset", "stash", "rm", "restore"];

/**
 * Destructive git invocations scoped to `.ai/memory` (never expected). A
 * whole-tree `checkout <base>` is not scoped to memory and is the restore
 * mechanism.
 */
export const destructiveMemoryGitCalls = (
  calls: readonly (readonly string[])[],
): (readonly string[])[] =>
  calls.filter((call) => {
    const args = call.slice(1);
    const mentionsMemory = args.some((arg) => arg.includes(".ai/memory"));
    const destructive = args.some((arg) => DESTRUCTIVE_GIT.includes(arg));
    return mentionsMemory && destructive;
  });

export type RestoredRun = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/** Run twice and normalize both outputs (deterministic replay). */
export const replay = async (
  run: () => Promise<WatchdogRun>,
  repoRoot: string,
): Promise<{ readonly first: RestoredRun; readonly second: RestoredRun }> => {
  const first = await run();
  const second = await run();
  return {
    first: {
      exitCode: first.exitCode,
      stdout: normalizeText(first.stdout, repoRoot),
      stderr: normalizeText(first.stderr, repoRoot),
    },
    second: {
      exitCode: second.exitCode,
      stdout: normalizeText(second.stdout, repoRoot),
      stderr: normalizeText(second.stderr, repoRoot),
    },
  };
};

/** Replace volatile facts (temp root, run id, timing) without erasing meaning. */
export const normalizeText = (text: string, repoRoot: string): string =>
  text.split(repoRoot).join("<repo>");

export const normalizeEnvelopeText = (run: WatchdogRun, repoRoot: string): ParsedEnvelope => {
  const envelope = parseEnvelope(run);
  const normalized: ParsedEnvelope = { ...envelope };
  normalized.runId = "<run-id>";
  const timing = normalized.timing;
  if (typeof timing === "object" && timing !== null && !Array.isArray(timing)) {
    normalized.timing = { ...(timing as Record<string, unknown>), totalMs: 0 };
  }
  const serialized = JSON.stringify(normalized, null, 2);
  return JSON.parse(normalizeText(serialized, repoRoot)) as ParsedEnvelope;
};

export const memoryPathsOf = (calls: readonly (readonly string[])[]): string[] =>
  calls.flatMap((call) => call.slice(1).filter((arg) => arg.includes(".ai/memory")));
