/**
 * The detached process supervisor edge (GH-238 F-1, F-3, F-9; DEC-6; DM-14).
 *
 * Spawns the CLI daemon entry detached with a deny-by-default environment,
 * signals only the recorded daemon process identity (never a lane session), and
 * performs a liveness check. No shell evaluation.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import type {
  CoordinatorKillResult,
  CoordinatorProcessIdentity,
  CoordinatorProcessPortCapabilities,
  DaemonProcessPort,
} from "@delivery-os/core/contracts";

export type NodeProcessPortOptions = {
  readonly spawnImpl?: typeof spawn;
  readonly killImpl?: (pid: number, signal?: NodeJS.Signals | 0) => boolean;
  /** The platform start-time reader; defaults to `/proc` on Linux. */
  readonly startTimeMsImpl?: (pid: number) => number | undefined;
};

/** The Linux userspace clock-tick constant used by `/proc/<pid>/stat`. */
const LINUX_CLOCK_TICKS_PER_SECOND = 100;

/**
 * Read the process start time from the Linux `/proc` filesystem.
 *
 * `/proc/<pid>/stat` field 22 is the start time in clock ticks since boot; the
 * commit epoch is `/proc/stat`'s `btime` plus that tick offset. The comm field
 * may contain spaces and parentheses, so parsing resumes after the final `)`.
 * Off Linux, or when either file is unreadable, the capability returns
 * `undefined` and the kill path discloses `identity-mismatch` rather than
 * signalling an unverified pid.
 */
const readLinuxProcessStartTimeMs = (pid: number): number | undefined => {
  if (process.platform !== "linux") return undefined;
  try {
    const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) return undefined;
    const fields = stat.slice(close + 2).split(" ");
    const startTicks = Number(fields[19]);
    if (!Number.isFinite(startTicks)) return undefined;
    const procStat = readFileSync("/proc/stat", "utf8");
    const bootLine = procStat.split("\n").find((line) => line.startsWith("btime "));
    if (bootLine === undefined) return undefined;
    const bootSeconds = Number(bootLine.slice("btime ".length).trim());
    if (!Number.isFinite(bootSeconds)) return undefined;
    return Math.round(bootSeconds * 1000 + (startTicks * 1000) / LINUX_CLOCK_TICKS_PER_SECOND);
  } catch {
    return undefined;
  }
};

export const createNodeProcessPort = (options: NodeProcessPortOptions = {}): DaemonProcessPort => {
  const spawnImpl = options.spawnImpl ?? spawn;
  const startTimeMsImpl = options.startTimeMsImpl ?? readLinuxProcessStartTimeMs;
  const killImpl =
    options.killImpl ??
    ((pid: number, signal?: NodeJS.Signals | 0): boolean => {
      try {
        process.kill(pid, signal);
        return true;
      } catch {
        return false;
      }
    });
  return {
    spawnDetached: ({ entry, args, environment }) => {
      try {
        const child = spawnImpl(entry, [...args], {
          detached: true,
          stdio: ["ignore", "ignore", "ignore"],
          env: { ...environment },
        });
        if (child.pid === undefined) return { code: "daemon.state-recovery-failed" };
        child.unref();
        return { pid: child.pid };
      } catch {
        return { code: "daemon.state-recovery-failed" };
      }
    },
    signal: (pid, signal) =>
      killImpl(pid, signal) ? { ok: true } : { ok: false, detail: "signal-failed" },
    isAlive: (pid) => killImpl(pid, 0),
    startTimeMs: (pid) => startTimeMsImpl(pid),
  };
};

/* ---------------------- coordinator kill-with-grace ---------------------- */

export type KillCoordinatorProcessInput = {
  readonly port: DaemonProcessPort;
  readonly identity: CoordinatorProcessIdentity;
  /** The resolved `coordinator.kill-grace` value in milliseconds. */
  readonly graceMs: number;
  /** A bounded, injected wait; the helper never reads a wall clock itself. */
  readonly wait: (ms: number) => Promise<void>;
  /** Injected capability declaration; start-time identity defaults to presence. */
  readonly capabilities?: Partial<CoordinatorProcessPortCapabilities>;
};

/**
 * Identity-verified kill-with-grace over the delivered `DaemonProcessPort`
 * (GH-241 F-4, AC-F4-1..4, AC-F10-4).
 *
 * The helper verifies the recorded pid plus process start time before any
 * signal, sends TERM, waits the configured grace through the injected wait, then
 * sends SIGKILL only when the tree is still alive. An absent start-time identity
 * capability sends no signal and returns the closed capability-gap outcome. It
 * appends no coordinator record and runs no budget check: the supervisor
 * composes both. The target is the recorded pid only; no name, pattern, or shell
 * interpolation exists on this path.
 */
export const killCoordinatorProcess = async (
  input: KillCoordinatorProcessInput,
): Promise<CoordinatorKillResult> => {
  const capabilities: CoordinatorProcessPortCapabilities = {
    alive: input.capabilities?.alive ?? true,
    killWithGrace: input.capabilities?.killWithGrace ?? true,
    startTimeIdentity:
      input.capabilities?.startTimeIdentity ?? typeof input.port.startTimeMs === "function",
  };
  if (!capabilities.alive) return { outcome: "capability-gap", missing: "alive" };
  if (!capabilities.killWithGrace) {
    return { outcome: "capability-gap", missing: "kill-with-grace" };
  }
  if (!capabilities.startTimeIdentity || input.port.startTimeMs === undefined) {
    return { outcome: "capability-gap", missing: "start-time-identity" };
  }
  const liveStartTimeMs = input.port.startTimeMs(input.identity.pid);
  if (liveStartTimeMs === undefined || liveStartTimeMs !== input.identity.processStartTimeMs) {
    return { outcome: "failed", failureReason: "identity-mismatch" };
  }
  const term = input.port.signal(input.identity.pid, "SIGTERM");
  if (!term.ok) return { outcome: "failed", failureReason: null };
  await input.wait(input.graceMs);
  if (input.port.isAlive(input.identity.pid)) {
    const kill = input.port.signal(input.identity.pid, "SIGKILL");
    if (!kill.ok) return { outcome: "failed", failureReason: null };
    return { outcome: "forced" };
  }
  return { outcome: "terminated" };
};
