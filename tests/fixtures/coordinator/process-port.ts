/**
 * The recording process-port fake (GH-241) — a `DaemonProcessPort` that records
 * every capability probe and never touches a real process.
 *
 * It is the shared fake for the domain, state, and CLI suites: declared vs
 * missing capabilities, a controllable `alive` answer (`true`/`false`/no
 * answer), matching or mismatched pid + start-time identity, a handle-only
 * TERM/KILL phase log, and positive/zero/absent progress readings.
 */
import type {
  CoordinatorKillResult,
  CoordinatorProcessPortCapabilities,
  DaemonProcessPort,
  HarnessLivenessReading,
  HarnessLivenessReport,
} from "../../../packages/core/src/contracts/index";

export type FakeAliveAnswer = boolean | null;

export type FakeProcessPortOptions = {
  /** Declared capabilities; omitted members default to declared. */
  readonly declared?: Partial<CoordinatorProcessPortCapabilities>;
  /** Per-pid alive answers; an absent pid answers `false`. Use `null` for no answer. */
  readonly alive?: Readonly<Record<number, FakeAliveAnswer>>;
  /** Per-pid live start times; an absent pid cannot be identified. */
  readonly startTimes?: Readonly<Record<number, number>>;
  /** The closed kill outcome the fake composes. */
  readonly killOutcome?: "terminated" | "forced" | "failed";
  /** The declared progress source values; `null` means the source is absent. */
  readonly progress?: { readonly tokenDelta: number | null; readonly traffic: number | null };
  /** Whether `signal` itself fails (a refused kill). */
  readonly signalFails?: boolean;
};

export type RecordingProcessPort = {
  readonly port: DaemonProcessPort;
  readonly capabilities: CoordinatorProcessPortCapabilities;
  readonly signals: { readonly pid: number; readonly signal: string }[];
  readonly calls: {
    alive: number;
    signal: number;
    startTime: number;
    progress: number;
    spawn: number;
  };
  /** The declared probe answer (`null` = declared but no answer). */
  aliveAnswer(pid: number): FakeAliveAnswer;
  /** The composed kill-with-grace result (the adapter half is Phase 5). */
  killWithGrace(pid: number, processStartTimeMs: number): CoordinatorKillResult;
  /** The delivered liveness report mapped from the fake's progress values. */
  livenessReport(): HarnessLivenessReport;
};

const reading = (
  kind: HarnessLivenessReading["kind"],
  value: number | null,
): HarnessLivenessReading =>
  value === null
    ? { kind, status: "absent", reason: "harness-unsupported" }
    : { kind, status: "sourced", value, observedAt: "2026-11-09T00:00:00.000Z" };

export const createRecordingProcessPort = (
  options: FakeProcessPortOptions = {},
): RecordingProcessPort => {
  const capabilities: CoordinatorProcessPortCapabilities = {
    alive: options.declared?.alive ?? true,
    killWithGrace: options.declared?.killWithGrace ?? true,
    startTimeIdentity: options.declared?.startTimeIdentity ?? true,
  };
  const signals: { pid: number; signal: string }[] = [];
  const calls = { alive: 0, signal: 0, startTime: 0, progress: 0, spawn: 0 };

  const aliveAnswer = (pid: number): FakeAliveAnswer => {
    if (!capabilities.alive) return false;
    const answer = options.alive?.[pid];
    return answer === undefined ? false : answer;
  };

  const port: DaemonProcessPort = {
    spawnDetached: () => {
      calls.spawn += 1;
      return { code: "daemon.state-recovery-failed" };
    },
    signal: (pid, signal) => {
      calls.signal += 1;
      if (options.signalFails === true) return { ok: false, detail: "signal-failed" };
      signals.push({ pid, signal });
      return { ok: true };
    },
    isAlive: (pid) => {
      calls.alive += 1;
      return aliveAnswer(pid) === true;
    },
    ...(capabilities.startTimeIdentity
      ? {
          startTimeMs: (pid: number) => {
            calls.startTime += 1;
            return options.startTimes?.[pid];
          },
        }
      : {}),
  };

  return {
    port,
    capabilities,
    signals,
    calls,
    aliveAnswer,
    killWithGrace: (pid, processStartTimeMs) => {
      if (!capabilities.killWithGrace)
        return { outcome: "capability-gap", missing: "kill-with-grace" };
      if (!capabilities.startTimeIdentity) {
        return { outcome: "capability-gap", missing: "start-time-identity" };
      }
      const live = options.startTimes?.[pid];
      if (live === undefined || live !== processStartTimeMs) {
        return { outcome: "failed", failureReason: "identity-mismatch" };
      }
      if (options.signalFails === true) return { outcome: "failed", failureReason: null };
      port.signal(pid, "SIGTERM");
      const outcome = options.killOutcome ?? "terminated";
      if (outcome === "forced") port.signal(pid, "SIGKILL");
      if (outcome === "failed") return { outcome: "failed", failureReason: null };
      return { outcome };
    },
    livenessReport: () => {
      calls.progress += 1;
      return {
        readings: [
          reading("session-traffic", options.progress?.traffic ?? null),
          reading("worktree-activity", null),
          reading("process", null),
        ],
        sourcedSignals: [
          {
            kind: "token-delta",
            ...(options.progress?.tokenDelta === null || options.progress?.tokenDelta === undefined
              ? { status: "absent" as const, reason: "harness-unsupported" as const }
              : {
                  status: "sourced" as const,
                  value: options.progress.tokenDelta,
                  observedAt: "2026-11-09T00:00:00.000Z",
                }),
          },
          {
            kind: "heartbeat-age",
            status: "absent" as const,
            reason: "harness-unsupported" as const,
          },
        ],
      };
    },
  };
};
