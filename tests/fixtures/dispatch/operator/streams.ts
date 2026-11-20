/**
 * The scripted streaming starter and its first-pull probe (GH-354 §6.1, §6.2).
 *
 * The starter is pull-based, so the generator's FIRST pull happens after the
 * adapter has already created that stream's artifact file. The probe records the
 * family listing at that instant, which is the executable form of "the file
 * exists before the stream's first yielded value" (AC-F7-1).
 */
import type {
  HarnessSpawnRunnerResult,
  HarnessSpawnStarter,
  HarnessSpawnStream,
  HarnessSpawnStreamOptions,
} from "../../../../packages/core/src/contracts/index";

/** One scripted stream: the values it yields, in order. */
export type ScriptedStream = {
  readonly values: readonly string[];
  readonly status?: number;
  readonly timedOut?: boolean;
};

export type StreamsFixtureOptions = {
  /** One script per invocation, in call order; the last script repeats. */
  readonly scripts: readonly ScriptedStream[];
  /** Called at each stream's FIRST pull, before the first value is handed out. */
  readonly onFirstPull?: (invocation: {
    readonly index: number;
    readonly args: readonly string[];
  }) => void;
};

export type StartedStream = {
  readonly index: number;
  readonly args: readonly string[];
  readonly options: HarnessSpawnStreamOptions;
  readonly pulls: number;
};

export type StreamsFixture = {
  readonly starter: HarnessSpawnStarter;
  readonly streams: readonly StartedStream[];
  readonly firstPullCount: number;
};

/** Build a deterministic, pull-based scripted streaming starter. */
export const createScriptedStreams = (options: StreamsFixtureOptions): StreamsFixture => {
  const streams: StartedStream[] = [];
  let firstPullCount = 0;
  const starter: HarnessSpawnStarter = (file, args, streamOptions) => {
    const index = streams.length;
    const script = options.scripts[Math.min(index, options.scripts.length - 1)] ?? {
      values: [],
    };
    const state: StartedStream = { index, args: [...args], options: streamOptions, pulls: 0 };
    streams.push(state);
    let resolveCompletion: ((result: HarnessSpawnRunnerResult) => void) | undefined;
    const completion = new Promise<HarnessSpawnRunnerResult>((resolve) => {
      resolveCompletion = resolve;
    });
    let settled = false;
    const settle = (): void => {
      if (settled) return;
      settled = true;
      resolveCompletion?.({
        stdout: script.values.join("\n"),
        stderr: "",
        status: script.status ?? 0,
        timedOut: script.timedOut ?? false,
      });
    };
    const lines: AsyncIterable<string> = {
      [Symbol.asyncIterator]: (): AsyncIterator<string> => {
        let cursor = 0;
        return {
          next: async (): Promise<IteratorResult<string>> => {
            if (state.pulls === 0) {
              firstPullCount += 1;
              options.onFirstPull?.({ index, args: state.args });
            }
            state.pulls += 1;
            const value = script.values[cursor];
            if (value === undefined) {
              settle();
              return { done: true, value: undefined };
            }
            cursor += 1;
            return { done: false, value };
          },
        };
      },
    };
    void file;
    return {
      lines,
      completion,
      acquired: () => undefined,
      kill: () => settle(),
    } satisfies HarnessSpawnStream;
  };
  return {
    starter,
    streams,
    get firstPullCount() {
      return firstPullCount;
    },
  };
};

/** A one-shot runner double: a bounded invocation that yields no stream. */
export const createOneShotRunner =
  (result: Partial<HarnessSpawnRunnerResult> = {}) =>
  async (): Promise<HarnessSpawnRunnerResult> => ({
    stdout: "",
    stderr: "",
    status: 0,
    timedOut: false,
    ...result,
  });

/** One opencode session line (the acquisition-settling line). */
export const sessionLine = (sessionId: string): string =>
  JSON.stringify({ sessionID: sessionId, type: "session" });

/** One decoded step-finish line that marks a clean completion. */
export const stepFinishLine = (): string =>
  JSON.stringify({ type: "step_finish", part: { reason: "stop" } });
