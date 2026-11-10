/**
 * TC-OCS-052 — the host streaming starter over a real synthetic child.
 *
 * The child is the Bun runtime running a test-supplied script
 * (`process.execPath -e '<script>'`), never `opencode` or `claude`. This is the
 * only harness suite allowed `process.execPath` (test plan TC-OCS-071).
 */
import { describe, expect, test } from "bun:test";
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createHostSpawnRunner,
  createHostSpawnStarter,
} from "../../packages/adapters/src/host/index";

const ROOT = process.cwd();
const BASE = join(ROOT, "tmp", "tmpdir");
const LEG_BOUND_MS = 5_000;
/** A prompt larger than the OS pipe buffer: a child that never reads closes mid-write. */
const OVERSIZED_PROMPT = "x".repeat(2 * 1024 * 1024);

const withRoot = async (run: (root: string) => Promise<void>): Promise<void> => {
  mkdirSync(BASE, { recursive: true });
  const root = mkdtempSync(join(BASE, "gh275-host-"));
  try {
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

/** The host-suite mkdtemp roots currently under `tmp/tmpdir`. */
const hostRoots = (): string[] =>
  existsSync(BASE)
    ? readdirSync(BASE)
        .filter((name) => name.startsWith("gh275-host-"))
        .sort()
    : [];

/** Collect uncaught exceptions and unhandled rejections for one bounded leg. */
const withErrorCollectors = async (
  run: () => Promise<void>,
): Promise<{
  readonly uncaught: readonly unknown[];
  readonly rejections: readonly unknown[];
}> => {
  const uncaught: unknown[] = [];
  const rejections: unknown[] = [];
  const onUncaught = (error: unknown): void => {
    uncaught.push(error);
  };
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  process.on("uncaughtException", onUncaught);
  process.on("unhandledRejection", onRejection);
  try {
    await run();
    // A stream error can be emitted after `close`; let one macrotask drain.
    await new Promise((resolve) => setTimeout(resolve, 25));
  } finally {
    process.off("uncaughtException", onUncaught);
    process.off("unhandledRejection", onRejection);
  }
  return { uncaught, rejections };
};

const pidOf = (stdout: string): number | undefined => {
  const match = /pid:(\d+)/.exec(stdout);
  return match === null ? undefined : Number(match[1]);
};

/** Poll until the process is gone; the early-exit child must not survive. */
const waitUntilGone = async (pid: number): Promise<boolean> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
};

const collectLines = async (lines: AsyncIterable<string>): Promise<string[]> => {
  const collected: string[] = [];
  for await (const line of lines) collected.push(line);
  return collected;
};

/** A self-explanatory spawn diagnostic so a CI-only child failure names its cause. */
const spawnDiagnostic = (result: { readonly status: number; readonly stderr: string }): string =>
  `child=${process.execPath} status=${result.status} stderr=${JSON.stringify(result.stderr)}`;

describe("TC-OCS-052 host streaming starter", () => {
  test("streams lines and resolves completion on close with the accumulated stdout", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = [
        'process.stdout.write(JSON.stringify({type:"step_start",sessionID:"ses_host_1"})+"\\n");',
        'setTimeout(() => { process.stdout.write(JSON.stringify({type:"step_finish",sessionID:"ses_host_1",part:{reason:"stop"}})+"\\n"); }, 40);',
      ].join("\n");
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 5_000,
      });
      const lines = await collectLines(stream.lines);
      const result = await stream.completion;
      console.error(
        "[GH-277][spawn-diag]",
        JSON.stringify({
          exec: process.execPath,
          execExists: existsSync(process.execPath),
          status: result.status,
          timedOut: result.timedOut,
          stdoutLen: result.stdout.length,
          stderr: result.stderr,
        }),
      );
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain("step_start");
      expect(lines[1]).toContain("step_finish");
      expect(result.status, spawnDiagnostic(result)).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout).toContain("step_finish");
    });
  });

  test("acquired() cancels the handle bound so a later close is not a timeout", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = [
        'process.stdout.write(JSON.stringify({sessionID:"ses_host_2"})+"\\n");',
        "setTimeout(() => process.exit(0), 400);",
      ].join("\n");
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 100,
      });
      const iterator = stream.lines[Symbol.asyncIterator]();
      const first = await iterator.next();
      expect(first.done).toBe(false);
      stream.acquired();
      const result = await stream.completion;
      expect(result.timedOut).toBe(false);
      expect(result.status, spawnDiagnostic(result)).toBe(0);
    });
  });

  test("handle-bound expiry kills the child and reports timedOut", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = ['process.on("SIGTERM", () => {});', "setInterval(() => {}, 1000);"].join(
        "\n",
      );
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 50,
      });
      const lines = await collectLines(stream.lines);
      const result = await stream.completion;
      expect(lines).toEqual([]);
      expect(result.timedOut).toBe(true);
      expect(result.status).not.toBe(0);
    });
  });

  test("kill is idempotent and resolves completion", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = ['process.stdout.write("ready\\n");', "setInterval(() => {}, 1000);"].join(
        "\n",
      );
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 5_000,
      });
      const iterator = stream.lines[Symbol.asyncIterator]();
      await iterator.next();
      stream.kill();
      stream.kill();
      const result = await stream.completion;
      expect(result.status).not.toBe(0);
    });
  });

  test("a child that ignores SIGTERM is escalated to SIGKILL and closes", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = [
        'process.on("SIGTERM", () => {});',
        'process.stdout.write("ready\\n");',
        "setInterval(() => {}, 1000);",
      ].join("\n");
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 5_000,
      });
      const iterator = stream.lines[Symbol.asyncIterator]();
      const ready = await iterator.next();
      expect(ready.done ? "" : ready.value).toBe("ready");
      stream.kill();
      const result = await stream.completion;
      expect(result.status).not.toBe(0);
    });
  });

  test("no orphan survives once completion resolves", async () => {
    await withRoot(async (root) => {
      const starter = createHostSpawnStarter();
      const script = [
        'process.stdout.write("pid:" + process.pid + "\\n");',
        'process.on("SIGTERM", () => {});',
        "setInterval(() => {}, 1000);",
      ].join("\n");
      const stream = starter(process.execPath, ["-e", script], {
        cwd: root,
        env: {},
        handleTimeoutMs: 5_000,
      });
      const iterator = stream.lines[Symbol.asyncIterator]();
      const first = await iterator.next();
      const pidLine = first.done ? "" : first.value;
      const pid = Number(pidLine.replace("pid:", ""));
      expect(Number.isInteger(pid)).toBe(true);
      stream.kill();
      await stream.completion;
      let gone = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
          process.kill(pid, 0);
        } catch {
          gone = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(gone).toBe(true);
    });
  });

  test("the host source keeps the 16 MiB bound and the truncation marker", () => {
    const source = readFileSync(join(ROOT, "packages/adapters/src/host/index.ts"), "utf8");
    expect(source).toContain("16 * 1024 * 1024");
    expect(source).toContain("output truncated");
  });
});

/**
 * TC-HDA-036 — the child-stdin early-close guard on both host seams.
 *
 * A child that exits without reading a prompt larger than the pipe buffer makes
 * the parent's write fail with `EPIPE`. The seam must observe stdin before the
 * write, ignore the benign `EPIPE`, and still resolve the close-classified
 * result. The uncaught-error collectors make the pre-guard failure explicit
 * instead of a crashed worker.
 */
describe("TC-HDA-036 host child-stdin early close", () => {
  const earlyExitScript =
    'process.stdout.write("pid:" + process.pid + "\\n", () => process.exit(0));';

  test(
    "the streaming starter resolves the close-classified result on an early-exit EPIPE",
    async () => {
      const rootsBefore = hostRoots();
      const startedAt = Date.now();
      try {
        await withRoot(async (root) => {
          const evidence = await withErrorCollectors(async () => {
            const starter = createHostSpawnStarter();
            const stream = starter(process.execPath, ["-e", earlyExitScript], {
              cwd: root,
              env: {},
              handleTimeoutMs: LEG_BOUND_MS,
              sessionTimeoutMs: LEG_BOUND_MS,
              stdin: OVERSIZED_PROMPT,
            });
            const lines = await collectLines(stream.lines);
            const result = await stream.completion;
            console.error(
              "[GH-277][spawn-diag]",
              JSON.stringify({
                exec: process.execPath,
                execExists: existsSync(process.execPath),
                status: result.status,
                timedOut: result.timedOut,
                stdoutLen: result.stdout.length,
                stderr: result.stderr,
              }),
            );
            expect(result.status, spawnDiagnostic(result)).toBe(0);
            expect(result.timedOut).toBe(false);
            const pid = pidOf(result.stdout) ?? pidOf(lines.join("\n"));
            expect(pid).toBeDefined();
            if (pid !== undefined) expect(await waitUntilGone(pid)).toBe(true);
          });
          expect(evidence.uncaught).toEqual([]);
          expect(evidence.rejections).toEqual([]);
        });
      } finally {
        expect(Date.now() - startedAt).toBeLessThan(LEG_BOUND_MS);
      }
      expect(hostRoots()).toEqual(rootsBefore);
    },
    LEG_BOUND_MS,
  );

  test(
    "the one-shot runner resolves the close-classified result on an early-exit EPIPE",
    async () => {
      const rootsBefore = hostRoots();
      const startedAt = Date.now();
      try {
        await withRoot(async (root) => {
          const evidence = await withErrorCollectors(async () => {
            const runner = createHostSpawnRunner();
            const result = await runner(process.execPath, ["-e", earlyExitScript], {
              cwd: root,
              env: {},
              timeout: 0,
              stdin: OVERSIZED_PROMPT,
            });
            console.error(
              "[GH-277][spawn-diag]",
              JSON.stringify({
                exec: process.execPath,
                execExists: existsSync(process.execPath),
                status: result.status,
                timedOut: result.timedOut,
                stdoutLen: result.stdout.length,
                stderr: result.stderr,
              }),
            );
            expect(result.status, spawnDiagnostic(result)).toBe(0);
            expect(result.timedOut).toBe(false);
            const pid = pidOf(result.stdout);
            expect(pid).toBeDefined();
            if (pid !== undefined) expect(await waitUntilGone(pid)).toBe(true);
          });
          expect(evidence.uncaught).toEqual([]);
          expect(evidence.rejections).toEqual([]);
        });
      } finally {
        expect(Date.now() - startedAt).toBeLessThan(LEG_BOUND_MS);
      }
      expect(hostRoots()).toEqual(rootsBefore);
    },
    LEG_BOUND_MS,
  );
});

const MATRIX_BOUND_MS = 5_000;

type MatrixOutcome = {
  readonly variant: string;
  readonly form: string;
  readonly code: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly mark: boolean;
  readonly timedOut: boolean;
  readonly error?: string;
};

type MatrixEntry = {
  readonly variant: string;
  readonly form: string;
  readonly run: () => Promise<MatrixOutcome>;
};

const matrixScript = (variant: string): string => `process.stdout.write("MARK_${variant}")`;

const toOutcome = (
  variant: string,
  form: string,
  fields: Omit<MatrixOutcome, "variant" | "form" | "mark">,
): MatrixOutcome => ({
  variant,
  form,
  ...fields,
  mark: fields.stdout.includes(`MARK_${variant}`),
});

const reportMatrix = (outcome: MatrixOutcome): void => {
  console.error(
    "[GH-277][matrix]",
    JSON.stringify({ bun: process.versions.bun, exec: process.execPath, ...outcome }),
  );
};

/** Collect one bounded `node:child_process` child; never rejects. */
const collectSpawn = (
  variant: string,
  form: string,
  child: ChildProcess,
  options: { readonly resumeStdout?: boolean } = {},
): Promise<MatrixOutcome> =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (code: number | null, signal: string | null, error?: string): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(
        toOutcome(variant, form, {
          code,
          signal,
          stdout,
          stderr,
          timedOut,
          ...(error === undefined ? {} : { error }),
        }),
      );
    };
    timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, MATRIX_BOUND_MS);
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    if (options.resumeStdout === true) child.stdout?.resume();
    child.on("error", (error) => finish(null, null, error.message));
    child.on("close", (code, signal) => finish(code, signal));
    child.stdin?.on("error", () => {});
    child.stdin?.end();
  });

const spawnEntry = (
  variant: string,
  form: string,
  start: () => ChildProcess,
  options: { readonly resumeStdout?: boolean } = {},
): MatrixEntry => ({
  variant,
  form,
  run: () => collectSpawn(variant, form, start(), options),
});

const execFileCode = (error: Error | null): number | null => {
  if (error === null) return 0;
  if (!("code" in error)) return null;
  const raw: unknown = error.code;
  return typeof raw === "number" ? raw : null;
};

const execFileSignal = (error: Error | null): string | null => {
  if (error === null || !("signal" in error)) return null;
  const raw: unknown = error.signal;
  return typeof raw === "string" ? raw : null;
};

const execFileTimedOut = (error: Error | null): boolean =>
  error !== null && "killed" in error && error.killed === true;

describe("ZZ spawn matrix (temporary diagnostic)", () => {
  test("which async child-spawn form delivers stdout on this runner", async () => {
    const exec = process.execPath;
    const cwd = process.cwd();
    const bunSpawnForm =
      'Bun.spawn([exec, "-e", script], { env: {}, stdout: "pipe", stderr: "pipe" })';
    const entries: readonly MatrixEntry[] = [
      spawnEntry("A", 'spawn(exec, ["-e", script], {}) — inherited env, default stdio', () =>
        spawn(exec, ["-e", matrixScript("A")], { cwd }),
      ),
      spawnEntry("B", 'spawn(exec, ["-e", script], { env: {} }) — empty env, default stdio', () =>
        spawn(exec, ["-e", matrixScript("B")], { cwd, env: {} }),
      ),
      spawnEntry("C", 'spawn(..., { env: {}, stdio: ["pipe","pipe","pipe"] })', () =>
        spawn(exec, ["-e", matrixScript("C")], { cwd, env: {}, stdio: ["pipe", "pipe", "pipe"] }),
      ),
      spawnEntry(
        "D",
        'spawn(..., { env: {} }) + stdout.on("data") + stdout.resume()',
        () => spawn(exec, ["-e", matrixScript("D")], { cwd, env: {} }),
        { resumeStdout: true },
      ),
      spawnEntry("E", 'spawn(..., { env: {}, stdio: ["ignore","pipe","pipe"] })', () =>
        spawn(exec, ["-e", matrixScript("E")], {
          cwd,
          env: {},
          stdio: ["ignore", "pipe", "pipe"],
        }),
      ),
      {
        variant: "F",
        form: 'execFile(exec, ["-e", script], { env: {} }, cb)',
        run: () =>
          new Promise<MatrixOutcome>((resolve) => {
            const child = execFile(
              exec,
              ["-e", matrixScript("F")],
              { cwd, env: {}, encoding: "utf8", timeout: MATRIX_BOUND_MS },
              (error, stdout, stderr) => {
                resolve(
                  toOutcome("F", 'execFile(exec, ["-e", script], { env: {} }, cb)', {
                    code: execFileCode(error),
                    signal: execFileSignal(error),
                    stdout,
                    stderr,
                    timedOut: execFileTimedOut(error),
                  }),
                );
              },
            );
            child.on("error", () => {});
          }),
      },
      {
        variant: "G",
        form: bunSpawnForm,
        run: async () => {
          let timedOut = false;
          const proc = Bun.spawn([exec, "-e", matrixScript("G")], {
            cwd,
            env: {},
            stdout: "pipe",
            stderr: "pipe",
          });
          const timer = setTimeout(() => {
            timedOut = true;
            proc.kill("SIGKILL");
          }, MATRIX_BOUND_MS);
          const stdout = await new Response(proc.stdout).text();
          const stderr = await new Response(proc.stderr).text();
          const code = await proc.exited;
          clearTimeout(timer);
          return toOutcome("G", bunSpawnForm, {
            code,
            signal: null,
            stdout,
            stderr,
            timedOut,
          });
        },
      },
      spawnEntry(
        "H",
        'spawn(..., { env: {}, detached: true, stdio: ["pipe","pipe","pipe"] })',
        () =>
          spawn(exec, ["-e", matrixScript("H")], {
            cwd,
            env: {},
            detached: true,
            stdio: ["pipe", "pipe", "pipe"],
          }),
      ),
    ];
    for (const entry of entries) reportMatrix(await entry.run());
  }, 90_000);
});
