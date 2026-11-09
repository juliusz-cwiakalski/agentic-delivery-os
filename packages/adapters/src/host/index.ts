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
import type {
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
  HarnessSpawnStarter,
  HarnessSpawnStream,
  HarnessSpawnStreamOptions,
} from "@delivery-os/core/contracts";

const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const TRUNCATION_MARKER = "[output truncated]";
/** The kill escalation grace: SIGTERM first, SIGKILL if the child ignores it. */
const KILL_GRACE_MS = 100;

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

/** One bounded line channel fed by the child's stdout and drained by the adapter. */
type LineChannel = {
  readonly lines: AsyncIterable<string>;
  readonly push: (chunk: string) => void;
  readonly end: () => void;
};

const createLineChannel = (): LineChannel => {
  const queue: string[] = [];
  let ended = false;
  let notify: (() => void) | undefined;
  const wake = (): void => {
    const pending = notify;
    notify = undefined;
    pending?.();
  };
  return {
    push: (chunk) => {
      if (chunk.length === 0) return;
      queue.push(chunk);
      wake();
    },
    end: () => {
      ended = true;
      wake();
    },
    lines: {
      [Symbol.asyncIterator]: (): AsyncIterator<string> => ({
        next: async (): Promise<IteratorResult<string>> => {
          for (;;) {
            const value = queue.shift();
            if (value !== undefined) return { done: false, value };
            if (ended) return { done: true, value: undefined };
            await new Promise<void>((resolve) => {
              notify = resolve;
            });
          }
        },
        return: async (): Promise<IteratorResult<string>> => {
          ended = true;
          return { done: true, value: undefined };
        },
      }),
    },
  };
};

/**
 * Build the host streaming starter over `node:child_process` (GH-275 DEC-1).
 *
 * It is the only other child-process seam in the repository and lives beside
 * the unchanged one-shot runner. It streams stdout as lines while continuing to
 * buffer the full output up to the shared 16 MiB bound, resolves `completion` on
 * close or error and never rejects, honours `handleTimeoutMs` (kills on expiry
 * and reports `timedOut: true`) until `acquired()` cancels it, accepts an
 * optional `sessionTimeoutMs` where absent or `0` is unbounded, and exposes an
 * idempotent `kill` that sends SIGTERM and escalates to SIGKILL.
 */
export const createHostSpawnStarter = (): HarnessSpawnStarter => {
  return (file, args, options: HarnessSpawnStreamOptions): HarnessSpawnStream => {
    const child = spawn(file, [...args], {
      cwd: options.cwd,
      env: { ...options.env },
      shell: false,
      windowsHide: true,
    });
    const channel = createLineChannel();
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let lineBuffer = "";
    let completed = false;
    let killCount = 0;
    let resolveCompletion: ((result: HarnessSpawnRunnerResult) => void) | undefined;
    const completion = new Promise<HarnessSpawnRunnerResult>((resolve) => {
      resolveCompletion = resolve;
    });

    const complete = (result: HarnessSpawnRunnerResult): void => {
      if (completed) return;
      completed = true;
      if (handleTimer !== undefined) clearTimeout(handleTimer);
      if (sessionTimer !== undefined) clearTimeout(sessionTimer);
      resolveCompletion?.(result);
    };

    const splitLines = (chunk: string): void => {
      lineBuffer += chunk;
      let boundary = lineBuffer.indexOf("\n");
      while (boundary !== -1) {
        channel.push(lineBuffer.slice(0, boundary));
        lineBuffer = lineBuffer.slice(boundary + 1);
        boundary = lineBuffer.indexOf("\n");
      }
    };

    const kill = (): void => {
      killCount += 1;
      if (killCount > 1) return;
      try {
        child.kill("SIGTERM");
      } catch {
        return;
      }
      const grace = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* the child already exited */
        }
      }, KILL_GRACE_MS);
      grace.unref();
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      splitLines(chunk);
      if (stdout.length + chunk.length > MAX_OUTPUT_BYTES) {
        truncated = true;
        return;
      }
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk;
    });

    child.on("error", () => {
      channel.end();
      complete({ stdout, stderr, status: 127, timedOut });
    });
    child.on("close", (code) => {
      if (lineBuffer.length > 0) {
        channel.push(lineBuffer);
        lineBuffer = "";
      }
      channel.end();
      const status = typeof code === "number" ? code : 1;
      complete({
        stdout: truncated ? `${stdout}\n${TRUNCATION_MARKER}` : stdout,
        stderr,
        status,
        timedOut,
      });
    });

    let handleTimer: ReturnType<typeof setTimeout> | undefined;
    if (options.handleTimeoutMs > 0) {
      handleTimer = setTimeout(() => {
        timedOut = true;
        kill();
      }, options.handleTimeoutMs);
      handleTimer.unref();
    }
    let sessionTimer: ReturnType<typeof setTimeout> | undefined;
    const sessionBound = options.sessionTimeoutMs;
    if (sessionBound !== undefined && sessionBound > 0) {
      sessionTimer = setTimeout(() => {
        timedOut = true;
        kill();
      }, sessionBound);
      sessionTimer.unref();
    }

    const acquired = (): void => {
      if (handleTimer !== undefined) {
        clearTimeout(handleTimer);
        handleTimer = undefined;
      }
    };

    if (options.stdin === undefined) child.stdin?.end();
    else child.stdin?.end(options.stdin, "utf8");

    return { lines: channel.lines, completion, acquired, kill };
  };
};
