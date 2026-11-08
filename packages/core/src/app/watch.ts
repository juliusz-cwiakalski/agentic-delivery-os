/**
 * The watch use case (GH-238 F-13; DM-7, DM-14; AC-F13-1, AC-F13-2).
 *
 * With a reachable daemon the invocation opens one transport connection, sends
 * a `subscribe` request frame, and streams bounded events; without one it enters
 * declared degraded polling at `daemon.watch-poll-interval` and prints only
 * changed snapshots. Unreadable state exits through the caller's classified
 * failure. It never emits a silent empty stream and never reports an all-clear.
 */
import {
  CONTROL_PROTOCOL_CURRENT,
  type ControlConnection,
  type ControlDegradedReason,
  type ControlFrame,
  type ControlTopic,
  type ControlTransport,
  type DaemonClockPort,
  LOCAL_CALLER_PRINCIPAL,
} from "#contracts";
import { decodeControlLine, encodeControlFrame } from "../domain/control-codec.js";
import { createWatchProjection } from "../domain/watch-stream.js";

export type WatchRead =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly code: string };

export type WatchInput = {
  readonly topic: ControlTopic;
  readonly read: () => WatchRead;
  readonly clock: DaemonClockPort;
  readonly intervalMs: number;
  /**
   * The configured control transport. When present the watch actually connects
   * and subscribes; absence (or an explicit `reachable: false`) keeps the
   * declared degraded polling path for tests and transport-less compositions.
   */
  readonly transport?: ControlTransport;
  /** Explicit opt-out for the polling path; production omits it. */
  readonly reachable?: boolean;
  readonly signal: { readonly interrupted: () => boolean };
  /** Injected cap so a test terminates; production omits it. */
  readonly maxIterations?: number;
  /** Injected overflow marker for the mid-stream fallback case. */
  readonly overflow?: boolean;
};

type FrameWaiter = {
  readonly resolve: (frame: ControlFrame | undefined) => void;
};

type FrameQueue = {
  readonly push: (frame: ControlFrame) => void;
  readonly next: (timeoutMs: number) => Promise<ControlFrame | undefined>;
  readonly close: () => void;
};

const createFrameQueue = (clock: DaemonClockPort): FrameQueue => {
  const queued: ControlFrame[] = [];
  const waiters: FrameWaiter[] = [];
  let closed = false;
  const push = (frame: ControlFrame): void => {
    if (closed) return;
    const waiter = waiters.shift();
    if (waiter === undefined) {
      queued.push(frame);
      return;
    }
    waiter.resolve(frame);
  };
  const next = (timeoutMs: number): Promise<ControlFrame | undefined> => {
    if (queued.length > 0) return Promise.resolve(queued.shift());
    if (closed) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      const waiter: FrameWaiter = {
        resolve: (frame) => {
          timedOut = false;
          resolve(frame);
        },
      };
      let timedOut = false;
      waiters.push(waiter);
      void clock.sleep(timeoutMs).then(() => {
        if (timedOut) return;
        const index = waiters.indexOf(waiter);
        if (index >= 0) {
          waiters.splice(index, 1);
          resolve(undefined);
        }
      });
    });
  };
  const close = (): void => {
    closed = true;
    for (const waiter of waiters.splice(0)) waiter.resolve(undefined);
  };
  return { push, next, close };
};

const subscriptionFrame = (topic: ControlTopic, id: string): string =>
  encodeControlFrame({
    v: CONTROL_PROTOCOL_CURRENT,
    kind: "request",
    type: "subscribe",
    id,
    payload: { topic },
    callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  });

const degradedOf = (frame: ControlFrame): ControlDegradedReason | undefined => {
  if (frame.kind !== "event") return undefined;
  const degraded = (frame.data as { degraded?: unknown }).degraded;
  return typeof degraded === "string" ? (degraded as ControlDegradedReason) : undefined;
};

const runSubscription = async function* (
  input: WatchInput,
  connection: ControlConnection,
  firstData: unknown,
): AsyncGenerator<string, "interrupted" | "poll", unknown> {
  const projection = createWatchProjection(input.topic);
  const queue = createFrameQueue(input.clock);
  let yielded = false;
  connection.onLine((line) => {
    const decoded = decodeControlLine(line);
    if (decoded.ok) queue.push(decoded.frame);
  });
  connection.onClose(() => queue.close());
  try {
    connection.write(subscriptionFrame(input.topic, `watch-${input.topic}`));
    let iterations = 0;
    while (!input.signal.interrupted()) {
      if (input.maxIterations !== undefined && iterations >= input.maxIterations) {
        return "interrupted";
      }
      iterations += 1;
      const frame = await queue.next(input.intervalMs);
      if (input.signal.interrupted()) return "interrupted";
      if (frame === undefined) {
        if (!yielded) {
          const initial = projection.snapshot(firstData);
          if (initial !== undefined) {
            yielded = true;
            yield initial.text;
          }
        }
        continue;
      }
      if (frame.kind === "error") {
        if (frame.error.code === "daemon.subscriber-degraded") throw frame.error;
        if (frame.error.code === "daemon.socket-unreachable") return "poll";
        throw frame.error;
      }
      if (frame.kind !== "event") continue;
      const degraded = degradedOf(frame);
      if (degraded === "subscriber-overflow") {
        yield projection.overflow(input.topic).text;
        return "poll";
      }
      if (degraded !== undefined) {
        const snapshot = projection.snapshot(firstData, [degraded]);
        if (snapshot !== undefined) {
          yielded = true;
          yield snapshot.text;
        }
        continue;
      }
      const eventData = frame.data as {
        readonly cursor?: unknown;
        readonly snapshot?: unknown;
      };
      const cursor =
        typeof eventData.cursor === "number" && Number.isInteger(eventData.cursor)
          ? eventData.cursor
          : 0;
      const line = projection.event(eventData.snapshot ?? eventData, cursor);
      if (line !== undefined) {
        yielded = true;
        yield line.text;
      }
    }
    return "interrupted";
  } finally {
    connection.close();
    queue.close();
  }
};

const runPolling = async function* (
  input: WatchInput,
  firstData: unknown,
): AsyncGenerator<string, void, unknown> {
  const projection = createWatchProjection(input.topic);
  const degraded: readonly ControlDegradedReason[] =
    input.reachable === true ? [] : ["daemon-unreachable"];
  const initial = projection.snapshot(firstData, degraded);
  if (initial !== undefined) yield initial.text;
  if (input.overflow === true) {
    yield projection.overflow(input.topic).text;
  }
  let previous = JSON.stringify(firstData);
  let cursor = 0;
  let iterations = 0;
  while (!input.signal.interrupted()) {
    if (input.maxIterations !== undefined && iterations >= input.maxIterations) return;
    iterations += 1;
    await input.clock.sleep(input.intervalMs, { cancelled: () => input.signal.interrupted() });
    if (input.signal.interrupted()) return;
    const next = input.read();
    if (!next.ok) throw { kind: "state", code: next.code };
    const serialized = JSON.stringify(next.data);
    if (serialized === previous) continue;
    previous = serialized;
    cursor += 1;
    const line = projection.event(next.data, cursor, degraded);
    if (line !== undefined) yield line.text;
  }
};

export async function* watchLines(input: WatchInput): AsyncGenerator<string, void, unknown> {
  const first = input.read();
  if (!first.ok) throw { kind: "state", code: first.code };
  if (input.transport !== undefined && input.reachable !== false) {
    let connection: ControlConnection | undefined;
    try {
      connection = await input.transport.connect();
    } catch {
      connection = undefined;
    }
    if (connection !== undefined) {
      const outcome = yield* runSubscription(input, connection, first.data);
      if (outcome === "interrupted") return;
    }
  }
  yield* runPolling(input, first.data);
}
