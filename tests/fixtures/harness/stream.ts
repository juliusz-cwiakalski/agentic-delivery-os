/**
 * The fake streaming-starter fixture (GH-275 test plan §6.1).
 *
 * `createFakeStreamStarter` returns a `HarnessSpawnStarter` plus a control
 * object. Every adapter fact is injected: the fixture has no file system, no
 * process, no network, no timer, and no wall clock. A scripted stream can gate
 * its completion indefinitely, so a completion-gated adapter regression fails a
 * bounded assertion instead of hanging.
 */
import type {
  HarnessSpawnRunner,
  HarnessSpawnRunnerResult,
  HarnessSpawnStarter,
  HarnessSpawnStream,
  HarnessSpawnStreamOptions,
} from "../../../packages/core/src/contracts/index";
import type { RecordedInvocation } from "./harness-io";

/** One scripted stream: pre-queued lines, a completion result, and an auto-end flag. */
export type StreamScript = {
  readonly lines?: readonly string[];
  readonly result?: Partial<HarnessSpawnRunnerResult>;
  /**
   * End the stream and resolve completion once the pre-queued lines have been
   * delivered (for the no-identifier cases whose spawn awaits the stream end).
   */
  readonly autoEnd?: boolean;
};

const DEFAULT_RESULT: HarnessSpawnRunnerResult = {
  stdout: "",
  stderr: "",
  status: 0,
  timedOut: false,
};

/** A deterministic virtual clock: plain data plus listeners, never a real timer. */
export type VirtualClock = {
  readonly now: number;
  readonly advance: (milliseconds: number) => void;
  readonly onAdvance: (listener: (now: number) => void) => () => void;
};

export const createVirtualClock = (): VirtualClock => {
  let now = 0;
  const listeners = new Set<(instant: number) => void>();
  return {
    get now() {
      return now;
    },
    advance: (milliseconds) => {
      now += milliseconds;
      for (const listener of [...listeners]) listener(now);
    },
    onAdvance: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/** One bounded microtask flush: no timers, no sleeps, no wall clock. */
export const flushUntil = async (predicate: () => boolean, turns = 64): Promise<boolean> => {
  for (let index = 0; index < turns; index += 1) {
    if (predicate()) {
      // Drain one final turn so a promise settled in the same turn is observed.
      await Promise.resolve();
      return predicate();
    }
    await Promise.resolve();
  }
  return predicate();
};

export type FakeStreamControl = {
  readonly options: HarnessSpawnStreamOptions;
  readonly push: (line: string) => void;
  readonly endLines: () => void;
  readonly finish: (result?: Partial<HarnessSpawnRunnerResult>) => void;
  readonly expireHandleBound: () => void;
  readonly kills: number;
  readonly acquiredCalls: number;
  readonly completionSettled: boolean;
  readonly delivered: number;
  readonly queued: number;
};

export type FakeStreamStarter = {
  readonly starter: HarnessSpawnStarter;
  readonly invocations: readonly RecordedInvocation[];
  readonly streams: readonly FakeStreamControl[];
  readonly kills: number;
  readonly acquiredCalls: number;
  readonly delivered: number;
  readonly completionSettled: boolean;
  readonly options: HarnessSpawnStreamOptions | undefined;
  readonly liveStreams: number;
  readonly push: (line: string) => void;
  readonly endLines: () => void;
  readonly finish: (result?: Partial<HarnessSpawnRunnerResult>) => void;
  readonly expireHandleBound: () => void;
};

type MutableFakeStream = {
  readonly options: HarnessSpawnStreamOptions;
  readonly lines: AsyncIterable<string>;
  readonly completion: Promise<HarnessSpawnRunnerResult>;
  readonly acquired: () => void;
  readonly kill: () => void;
  readonly control: FakeStreamControl;
};

const createFakeStream = (
  file: string,
  args: readonly string[],
  options: HarnessSpawnStreamOptions,
  script: StreamScript,
  clock: VirtualClock | undefined,
): MutableFakeStream => {
  const queue: string[] = [];
  const deliveredLines: string[] = [];
  let ended = false;
  let settled = false;
  let killCount = 0;
  let acquiredCount = 0;
  let notify: (() => void) | undefined;
  let resolveCompletion: ((result: HarnessSpawnRunnerResult) => void) | undefined;
  let unsubscribe: (() => void) | undefined;
  const startedAt = clock?.now ?? 0;

  const completion = new Promise<HarnessSpawnRunnerResult>((resolve) => {
    resolveCompletion = resolve;
  });

  const wake = (): void => {
    const pending = notify;
    notify = undefined;
    pending?.();
  };

  const finishInternal = (overrides: Partial<HarnessSpawnRunnerResult>): void => {
    if (!settled) {
      settled = true;
      unsubscribe?.();
      resolveCompletion?.({
        ...DEFAULT_RESULT,
        stdout: deliveredLines.join("\n"),
        ...script.result,
        ...overrides,
      });
    }
    ended = true;
    wake();
  };

  const push = (line: string): void => {
    if (ended) return;
    queue.push(line);
    wake();
  };

  const registerKill = (): boolean => {
    if (killCount > 0) return false;
    killCount = 1;
    return true;
  };

  const kill = (): void => {
    if (registerKill()) finishInternal({ status: 1, timedOut: false });
  };

  const expireHandleBound = (): void => {
    registerKill();
    finishInternal({ status: 1, timedOut: true });
  };

  const finish = (overrides: Partial<HarnessSpawnRunnerResult> = {}): void => {
    finishInternal(overrides);
  };

  if (clock !== undefined) {
    unsubscribe = clock.onAdvance(() => {
      const bound = options.sessionTimeoutMs;
      if (bound === undefined || bound <= 0) return;
      if (clock.now - startedAt >= bound) {
        registerKill();
        finishInternal({ status: 1, timedOut: true });
      }
    });
  }

  const throughScriptLines = (): void => {
    for (const line of script.lines ?? []) push(line);
    if (script.autoEnd === true && (script.lines ?? []).length === 0) {
      finishInternal({});
    }
  };

  const lines: AsyncIterable<string> = {
    [Symbol.asyncIterator]: (): AsyncIterator<string> => ({
      next: async (): Promise<IteratorResult<string>> => {
        for (;;) {
          const value = queue.shift();
          if (value !== undefined) {
            deliveredLines.push(value);
            if (script.autoEnd === true && queue.length === 0) finishInternal({});
            return { done: false, value };
          }
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
  };

  const control: FakeStreamControl = {
    options,
    push,
    endLines: () => {
      ended = true;
      wake();
    },
    finish,
    expireHandleBound,
    get kills() {
      return killCount;
    },
    get acquiredCalls() {
      return acquiredCount;
    },
    get completionSettled() {
      return settled;
    },
    get delivered() {
      return deliveredLines.length;
    },
    get queued() {
      return queue.length;
    },
  };

  const stream: HarnessSpawnStream = {
    lines,
    completion,
    acquired: () => {
      acquiredCount += 1;
    },
    kill,
  };

  throughScriptLines();
  void file;
  void args;
  return { options, lines, completion, acquired: stream.acquired, kill, control };
};

/**
 * Create a scripted fake starter. Each invocation gets a fresh stream; the
 * aggregate getters describe every stream the fake created.
 */
export const createFakeStreamStarter = (
  script: StreamScript | readonly StreamScript[] = {},
  clock?: VirtualClock,
): FakeStreamStarter => {
  const scripts: readonly StreamScript[] = Array.isArray(script) ? script : [script];
  const streams: MutableFakeStream[] = [];
  const invocations: RecordedInvocation[] = [];

  const starter: HarnessSpawnStarter = (file, args, options) => {
    const index = invocations.length;
    invocations.push({
      file,
      args: [...args],
      options: {
        cwd: options.cwd,
        env: options.env,
        timeout: options.handleTimeoutMs,
        ...(options.stdin === undefined ? {} : { stdin: options.stdin }),
      },
    });
    const selected = scripts[index] ?? scripts[scripts.length - 1] ?? {};
    const mutable = createFakeStream(file, args, options, selected, clock);
    streams.push(mutable);
    return {
      lines: mutable.lines,
      completion: mutable.completion,
      acquired: mutable.acquired,
      kill: mutable.kill,
    };
  };

  const latest = (): MutableFakeStream => {
    const last = streams[streams.length - 1];
    if (last === undefined) throw new Error("no fake stream invocation has happened yet");
    return last;
  };

  const sum = (read: (control: FakeStreamControl) => number): number =>
    streams.reduce((total, stream) => total + read(stream.control), 0);

  return {
    starter,
    invocations,
    get streams() {
      return streams.map((stream) => stream.control);
    },
    get kills() {
      return sum((control) => control.kills);
    },
    get acquiredCalls() {
      return sum((control) => control.acquiredCalls);
    },
    get delivered() {
      return sum((control) => control.delivered);
    },
    get completionSettled() {
      return latest().control.completionSettled;
    },
    get options() {
      return streams[streams.length - 1]?.options;
    },
    get liveStreams() {
      return streams.filter((stream) => !stream.control.completionSettled).length;
    },
    push: (line) => latest().control.push(line),
    endLines: () => latest().control.endLines(),
    finish: (result) => latest().control.finish(result),
    expireHandleBound: () => latest().control.expireHandleBound(),
  };
};

/**
 * Model the delivered one-shot runner as a degenerate single-line stream so a
 * migrated construction site keeps its assertions and never reaches a child.
 */
export const streamStarterFromRunner = (runner: HarnessSpawnRunner): HarnessSpawnStarter => {
  return (file, args, options) => {
    const queue: string[] = [];
    let ended = false;
    let notify: (() => void) | undefined;
    let resolveCompletion: ((result: HarnessSpawnRunnerResult) => void) | undefined;
    const completion = new Promise<HarnessSpawnRunnerResult>((resolve) => {
      resolveCompletion = resolve;
    });
    const wake = (): void => {
      const pending = notify;
      notify = undefined;
      pending?.();
    };
    const push = (line: string): void => {
      queue.push(line);
      wake();
    };
    const end = (): void => {
      ended = true;
      wake();
    };

    void runner(file, args, {
      cwd: options.cwd,
      env: options.env,
      timeout: options.sessionTimeoutMs ?? 0,
      ...(options.stdin === undefined ? {} : { stdin: options.stdin }),
    }).then((result) => {
      for (const line of result.stdout.split("\n")) {
        if (line.length > 0) push(line);
      }
      resolveCompletion?.(result);
      end();
    });

    return {
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
        }),
      },
      completion,
      acquired: () => undefined,
      kill: () => undefined,
    };
  };
};
