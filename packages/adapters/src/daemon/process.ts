/**
 * The detached process supervisor edge (GH-238 F-1, F-3, F-9; DEC-6; DM-14).
 *
 * Spawns the CLI daemon entry detached with a deny-by-default environment,
 * signals only the recorded daemon process identity (never a lane session), and
 * performs a liveness check. No shell evaluation.
 */
import { spawn } from "node:child_process";
import type { DaemonProcessPort } from "@delivery-os/core/contracts";

export type NodeProcessPortOptions = {
  readonly spawnImpl?: typeof spawn;
  readonly killImpl?: (pid: number, signal?: NodeJS.Signals | 0) => boolean;
};

export const createNodeProcessPort = (options: NodeProcessPortOptions = {}): DaemonProcessPort => {
  const spawnImpl = options.spawnImpl ?? spawn;
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
  };
};
