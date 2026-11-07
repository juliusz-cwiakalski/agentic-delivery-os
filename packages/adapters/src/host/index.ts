/**
 * `@delivery-os/adapters/host` — the host execution-environment implementation
 * (GH-233 F-5, DM-2, DEC-8).
 *
 * The single production child-process site for the harness spawn path. It
 * receives the command, arguments, the constructed environment, the working
 * directory, and a bounded timeout as data; it reads no ambient environment.
 * The containerized-executor seam is the injected runner type, not this module.
 */
import { spawn } from "node:child_process";
import type { HarnessSpawnRunner, HarnessSpawnRunnerResult } from "@delivery-os/core/contracts";

const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

/** Build the host runner over `node:child_process`. */
export const createHostSpawnRunner = (): HarnessSpawnRunner => {
  return (file, args, options): Promise<HarnessSpawnRunnerResult> =>
    new Promise((resolve) => {
      const child = spawn(file, [...args], {
        cwd: options.cwd,
        env: { ...options.env },
        timeout: options.timeout,
        shell: false,
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      let truncated = false;
      let timedOut = false;
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        if (stdout.length + chunk.length > MAX_OUTPUT_BYTES) {
          truncated = true;
          return;
        }
        stdout += chunk;
      });
      child.stderr?.on("data", (chunk: string) => {
        if (stderr.length + chunk.length > MAX_OUTPUT_BYTES) return;
        stderr += chunk;
      });
      child.on("error", () => {
        if (!child.killed) child.kill();
        resolve({ stdout, stderr, status: 127, timedOut: false });
      });
      child.on("close", (code, signal) => {
        timedOut = timedOut || signal === "SIGTERM";
        resolve({
          stdout: truncated ? `${stdout}\n[output truncated]` : stdout,
          stderr,
          status: typeof code === "number" ? code : 1,
          timedOut,
        });
      });
      if (options.stdin === undefined) child.stdin?.end();
      else child.stdin?.end(options.stdin, "utf8");
      if (options.timeout > 0) {
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, options.timeout);
        timer.unref();
        child.on("close", () => clearTimeout(timer));
      }
    });
};
