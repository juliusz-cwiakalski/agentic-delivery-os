/**
 * The session layer over frames, not bytes (GH-238 F-4, F-6; DM-7; NFR-5, NFR-6).
 *
 * One connection owns its correlation ids. Version 1 and floor 0 are served;
 * anything else is refused with daemon.protocol.unsupported and the offered set
 * before any action. Every subscription has a bounded buffer and a last
 * delivered cursor; overflow emits exactly one degraded event and drops only
 * that subscription. Every request has a bounded timeout driven by the injected
 * clock.
 */
import {
  CONTROL_PROTOCOL_CURRENT,
  CONTROL_PROTOCOL_FLOOR,
  CONTROL_PROTOCOL_OFFERED,
  type ControlEnvelopeEventData,
  type ControlErrorData,
  type ControlErrorFrame,
  type ControlEventFrame,
  type ControlFrame,
  type ControlRequestFrame,
  type ControlResponseFrame,
  type ControlTopic,
  type DaemonClockPort,
  ERROR_TABLE,
  LOCAL_CALLER_PRINCIPAL,
  TAXONOMY_OVERFLOW,
  TAXONOMY_VERSION,
} from "#contracts";

const errorData = (code: string): ControlErrorData => {
  const entry = ERROR_TABLE.find((candidate) => candidate.code === code);
  return entry === undefined
    ? {
        code: "fallback.internal",
        category: "platform",
        retryable: false,
        consequence: "unknown",
        remediationHint: "Inspect the diagnostics stream and report the failure if it persists.",
      }
    : {
        code: entry.code,
        category: entry.category,
        retryable: entry.retryable,
        consequence: entry.consequence,
        remediationHint: entry.remediationHint,
        ...(entry.summary === undefined ? {} : { summary: entry.summary }),
      };
};

export type ControlSubscriptionView = {
  readonly id: string;
  readonly topic: ControlTopic;
  readonly buffered: number;
  readonly lastCursor: number;
};

export type ControlSessionOptions = {
  readonly connectionId: string;
  readonly clock: DaemonClockPort;
  readonly subscriptionBuffer: number;
  readonly responseTimeoutMs: number;
};

export type ControlSessionReceive =
  | {
      readonly ok: true;
      readonly replies: readonly ControlFrame[];
      readonly request?: ControlRequestFrame;
    }
  | { readonly ok: false; readonly replies: readonly ControlFrame[] };

export type ControlSessionApi = {
  readonly connectionId: string;
  readonly version: () => number | undefined;
  readonly receive: (frame: ControlFrame) => ControlSessionReceive;
  readonly respond: (
    request: ControlRequestFrame,
    data: ControlResponseFrame["data"],
  ) => ControlResponseFrame;
  readonly errorFor: (id: string | undefined, code: string) => ControlErrorFrame;
  readonly subscribe: (
    topic: ControlTopic,
    since?: number,
  ) => { readonly ok: true; readonly id: string } | { readonly ok: false; readonly code: string };
  readonly publish: (
    topic: ControlTopic,
    snapshot: unknown,
    cursor: number,
  ) => readonly ControlFrame[];
  /** Publish one event-topic frame (no cursor, no snapshot revision). */
  readonly publishEvent: (
    topic: ControlTopic,
    data: ControlEnvelopeEventData,
  ) => readonly ControlFrame[];
  readonly flush: (subscriptionId: string) => readonly ControlEventFrame[];
  readonly subscriptions: () => readonly ControlSubscriptionView[];
  readonly expire: () => readonly ControlErrorFrame[];
  readonly pending: () => number;
  readonly close: () => void;
  readonly closed: () => boolean;
};

type Subscription = {
  readonly id: string;
  readonly topic: ControlTopic;
  buffer: ControlEventFrame[];
  lastCursor: number;
};

export const createControlSession = (options: ControlSessionOptions): ControlSessionApi => {
  let version: number | undefined;
  let isClosed = false;
  const pending = new Map<
    string,
    { readonly deadlineMs: number; readonly request: ControlRequestFrame }
  >();
  const subscriptions = new Map<string, Subscription>();
  let subscriptionCounter = 0;

  const principal = (): typeof LOCAL_CALLER_PRINCIPAL | undefined =>
    version === CONTROL_PROTOCOL_CURRENT ? LOCAL_CALLER_PRINCIPAL : undefined;
  const withPrincipal = <T extends object>(
    frame: T,
  ): T & { callerPrincipal?: typeof LOCAL_CALLER_PRINCIPAL } => {
    const value = principal();
    return value === undefined ? frame : { ...frame, callerPrincipal: value };
  };

  const responseFrame = (
    request: ControlRequestFrame,
    data: ControlResponseFrame["data"],
  ): ControlResponseFrame =>
    withPrincipal({
      v: version ?? CONTROL_PROTOCOL_CURRENT,
      kind: "response" as const,
      type: request.type,
      id: request.id,
      data,
    });

  const errorFor = (id: string | undefined, code: string): ControlErrorFrame =>
    withPrincipal({
      v: version ?? CONTROL_PROTOCOL_CURRENT,
      kind: "error" as const,
      type: "status" as const,
      ...(id === undefined ? {} : { id }),
      error: errorData(code),
    });

  const unsupported = (): ControlSessionReceive => {
    const frame: ControlErrorFrame = {
      v: CONTROL_PROTOCOL_CURRENT,
      kind: "error",
      type: "status",
      error: {
        ...errorData("daemon.protocol.unsupported"),
        summary: `Unsupported protocol version; offered ${JSON.stringify([...CONTROL_PROTOCOL_OFFERED])}.`,
      },
      callerPrincipal: LOCAL_CALLER_PRINCIPAL,
    };
    isClosed = true;
    return { ok: false, replies: [frame] };
  };

  return {
    connectionId: options.connectionId,
    version: () => version,
    receive: (frame) => {
      if (isClosed) return { ok: false, replies: [] };
      if (version === undefined) {
        if (frame.v !== CONTROL_PROTOCOL_CURRENT && frame.v !== CONTROL_PROTOCOL_FLOOR) {
          return unsupported();
        }
        version = frame.v;
      }
      if (frame.kind !== "request") {
        return { ok: true, replies: [] };
      }
      if (frame.v !== version) {
        const mismatch = unsupported();
        return mismatch;
      }
      pending.set(frame.id, {
        deadlineMs: options.clock.nowMs() + options.responseTimeoutMs,
        request: frame,
      });
      return { ok: true, replies: [], request: frame };
    },
    respond: (request, data) => {
      pending.delete(request.id);
      return responseFrame(request, data);
    },
    errorFor,
    subscribe: (topic, since) => {
      if (subscriptions.size >= options.subscriptionBuffer) {
        return { ok: false, code: "daemon.subscriber-degraded" };
      }
      subscriptionCounter += 1;
      const id = `sub-${subscriptionCounter}`;
      subscriptions.set(id, { id, topic, buffer: [], lastCursor: since ?? 0 });
      return { ok: true, id };
    },
    publish: (topic, snapshot, cursor) => {
      const emitted: ControlFrame[] = [];
      for (const subscription of subscriptions.values()) {
        if (subscription.topic !== topic) continue;
        const frame: ControlEventFrame = withPrincipal({
          v: version ?? CONTROL_PROTOCOL_CURRENT,
          kind: "event" as const,
          type: "frame" as const,
          data: { topic, cursor, snapshot },
        });
        subscription.buffer.push(frame);
        subscription.lastCursor = cursor;
        if (subscription.buffer.length > options.subscriptionBuffer) {
          subscriptions.delete(subscription.id);
          emitted.push(
            withPrincipal({
              v: version ?? CONTROL_PROTOCOL_CURRENT,
              kind: "event" as const,
              type: "degraded" as const,
              data: {
                degraded: "subscriber-overflow" as const,
                topic,
                overflow: TAXONOMY_OVERFLOW,
                taxonomyVersion: TAXONOMY_VERSION,
              },
            }),
          );
        }
      }
      return emitted;
    },
    publishEvent: (topic, data) => {
      const emitted: ControlFrame[] = [];
      for (const subscription of subscriptions.values()) {
        if (subscription.topic !== topic) continue;
        const frame: ControlEventFrame = withPrincipal({
          v: version ?? CONTROL_PROTOCOL_CURRENT,
          kind: "event" as const,
          type: "frame" as const,
          data,
        });
        subscription.buffer.push(frame);
        if (subscription.buffer.length > options.subscriptionBuffer) {
          subscriptions.delete(subscription.id);
          emitted.push(
            withPrincipal({
              v: version ?? CONTROL_PROTOCOL_CURRENT,
              kind: "event" as const,
              type: "degraded" as const,
              data: {
                degraded: "subscriber-overflow" as const,
                topic,
                overflow: TAXONOMY_OVERFLOW,
                taxonomyVersion: TAXONOMY_VERSION,
              },
            }),
          );
        }
      }
      return emitted;
    },
    flush: (subscriptionId) => {
      const subscription = subscriptions.get(subscriptionId);
      if (subscription === undefined) return [];
      const buffered = subscription.buffer;
      subscription.buffer = [];
      return buffered;
    },
    subscriptions: () =>
      [...subscriptions.values()].map((subscription) => ({
        id: subscription.id,
        topic: subscription.topic,
        buffered: subscription.buffer.length,
        lastCursor: subscription.lastCursor,
      })),
    expire: () => {
      const now = options.clock.nowMs();
      const expired: ControlErrorFrame[] = [];
      for (const [id, entry] of pending) {
        if (now < entry.deadlineMs) continue;
        pending.delete(id);
        expired.push(errorFor(id, "daemon.socket-unreachable"));
      }
      return expired;
    },
    pending: () => pending.size,
    close: () => {
      isClosed = true;
      pending.clear();
      subscriptions.clear();
    },
    closed: () => isClosed,
  };
};
