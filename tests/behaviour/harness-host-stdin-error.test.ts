/**
 * TC-HDA-036 — the host seams' non-`EPIPE` stdin-error classification.
 *
 * `mock.module("node:child_process")` is process-global and sticky, so this leg
 * lives in its own file (`.ai/rules/typescript.md` §9) and is restored in
 * `afterEach`; no real-child suite imports it. A coded `EIO` from the child's
 * stdin is a delivery failure, not an early exit, so both seams must resolve
 * `{ status: 127 }` exactly like the delivered spawn-error path.
 */
import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import * as realChildProcess from "node:child_process";
import { EventEmitter } from "node:events";

type FakeStream = EventEmitter & { readonly setEncoding: (encoding: string) => void };
type FakeStdin = EventEmitter & {
  readonly end: (data?: string, encoding?: string) => void;
};
type FakeChild = EventEmitter & {
  readonly stdin: FakeStdin;
  readonly stdout: FakeStream;
  readonly stderr: FakeStream;
  killed: boolean;
  readonly kill: (signal?: string) => void;
};

const stream = (): FakeStream =>
  Object.assign(new EventEmitter(), { setEncoding: (_encoding: string): void => {} });

const codedError = (code: string): Error => Object.assign(new Error(code), { code });

/**
 * One fake child whose stdin emits a coded error after `end()`, then closes
 * cleanly: the close must not overwrite the classified status.
 */
const fakeChild = (): FakeChild => {
  const stdin: FakeStdin = Object.assign(new EventEmitter(), {
    end: (_data?: string, _encoding?: string): void => {
      setTimeout(() => {
        stdin.emit("error", codedError("EIO"));
        child.emit("close", 0, null);
      }, 0);
    },
  });
  const child: FakeChild = Object.assign(new EventEmitter(), {
    stdin,
    stdout: stream(),
    stderr: stream(),
    killed: false,
    kill: (_signal?: string): void => {
      child.killed = true;
    },
  });
  return child;
};

/** A fake `ChildProcess` at the mocked third-party edge. */
const asChildProcess = (child: FakeChild): ChildProcess => child as unknown as ChildProcess;

type HostModule = typeof import("../../packages/adapters/src/host/index");

let createHostSpawnRunner: HostModule["createHostSpawnRunner"];
let createHostSpawnStarter: HostModule["createHostSpawnStarter"];

beforeAll(async () => {
  mock.module("node:child_process", () => ({
    ...realChildProcess,
    spawn: (): ChildProcess => asChildProcess(fakeChild()),
  }));
  const host: HostModule = await import("../../packages/adapters/src/host/index");
  createHostSpawnRunner = host.createHostSpawnRunner;
  createHostSpawnStarter = host.createHostSpawnStarter;
});

afterEach(() => {
  mock.module("node:child_process", () => realChildProcess);
  mock.restore();
});

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
    await new Promise((resolve) => setTimeout(resolve, 25));
  } finally {
    process.off("uncaughtException", onUncaught);
    process.off("unhandledRejection", onRejection);
  }
  return { uncaught, rejections };
};

describe("TC-HDA-036 non-EPIPE stdin error", () => {
  test("the one-shot runner classifies a coded stdin error as status 127", async () => {
    const evidence = await withErrorCollectors(async () => {
      const runner = createHostSpawnRunner();
      const result = await runner("synthetic-child", [], {
        cwd: process.cwd(),
        env: {},
        timeout: 0,
        stdin: "prompt",
      });
      expect(result).toEqual({ stdout: "", stderr: "", status: 127, timedOut: false });
    });
    expect(evidence.uncaught).toEqual([]);
    expect(evidence.rejections).toEqual([]);
  });

  test("the streaming starter resolves once with status 127 on the same error", async () => {
    const evidence = await withErrorCollectors(async () => {
      const starter = createHostSpawnStarter();
      const streamHandle = starter("synthetic-child", [], {
        cwd: process.cwd(),
        env: {},
        handleTimeoutMs: 5_000,
        stdin: "prompt",
      });
      const lines: string[] = [];
      for await (const line of streamHandle.lines) lines.push(line);
      const result = await streamHandle.completion;
      expect(lines).toEqual([]);
      expect(result.status).toBe(127);
      expect(result.timedOut).toBe(false);
      // Awaiting the same promise again proves a single settled resolution.
      const repeated = await streamHandle.completion;
      expect(repeated.status).toBe(127);
    });
    expect(evidence.uncaught).toEqual([]);
    expect(evidence.rejections).toEqual([]);
  });
});
