/**
 * The multi-connection, single-event-loop control dispatcher (GH-238 F-4, F-6;
 * DM-6, DM-7, DM-9, DM-10).
 *
 * Accepts frames from every connection, mutates shared in-memory state only on
 * the loop, routes each response only to the asking connection, and serializes
 * control actions through an at-most-once store keyed on (connection identity,
 * frame id, lock token). A same-connection replay returns the prior
 * acknowledgement; an id reused on another connection is a distinct request.
 * No state write happens here.
 */
import {
  CONTROL_PROTOCOL_CURRENT,
  type ControlConnection,
  type ControlDrainData,
  type ControlErrorFrame,
  type ControlLaneData,
  type ControlLanePayload,
  type ControlPokeData,
  type ControlPokePayload,
  type ControlRequestFrame,
  type ControlStatusData,
  type ControlStatusPayload,
  type ControlStopData,
  type ControlSubscribePayload,
  type ControlTakeoverData,
  type ControlTopic,
  type ControlTransport,
  type DaemonClockPort,
  ERROR_TABLE,
  LOCAL_CALLER_PRINCIPAL,
} from "#contracts";
import { decodeControlLine, encodeControlFrame } from "../domain/control-codec.js";
import { type ControlSessionApi, createControlSession } from "../domain/control-session.js";

export type ControlHandlerResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly code: string };

export type ControlSubscribeAccept = {
  readonly topic: ControlTopic;
  readonly snapshot: unknown;
  readonly cursor: number;
};

export type ControlServerHandlers = {
  readonly poke: (payload: ControlPokePayload) => ControlHandlerResult<ControlPokeData>;
  readonly status: (payload: ControlStatusPayload) => ControlHandlerResult<ControlStatusData>;
  readonly lane: (payload: ControlLanePayload) => ControlHandlerResult<ControlLaneData>;
  readonly subscribe: (
    payload: ControlSubscribePayload,
  ) => ControlHandlerResult<ControlSubscribeAccept>;
  readonly drain: (payload: { lockToken: string }) => ControlHandlerResult<ControlDrainData>;
  readonly stop: (payload: {
    lockToken: string;
    mode?: "drain" | "immediate";
  }) => ControlHandlerResult<ControlStopData>;
  readonly takeover: (payload: {
    lockToken: string;
    evidence?: readonly string[];
  }) => ControlHandlerResult<ControlTakeoverData>;
};

export type ControlServerOptions = {
  readonly transport: ControlTransport;
  readonly clock: DaemonClockPort;
  readonly handlers: ControlServerHandlers;
  readonly subscriptionBuffer?: number;
  readonly responseTimeoutMs?: number;
  /**
   * Bounded state snapshots for live subscribers. When present, `publishState`
   * emits one deduplicated event per changed topic; absence keeps the server
   * snapshot-only (initial subscribe frame).
   */
  readonly stateChanges?: () => readonly ControlStateSnapshot[];
};

export type ControlStateSnapshot = {
  readonly topic: ControlTopic;
  readonly snapshot: unknown;
};

export type ControlServer = {
  readonly start: () => Promise<{ readonly close: () => void | Promise<void> }>;
  readonly expire: () => void;
  /** Publish changed bounded snapshots to subscribers; never blocks the loop. */
  readonly publishState: () => void;
  readonly connections: () => number;
  readonly stop: () => void;
};

const errorFrame = (code: string, id?: string): ControlErrorFrame => {
  const entry = ERROR_TABLE.find((candidate) => candidate.code === code);
  return {
    v: CONTROL_PROTOCOL_CURRENT,
    kind: "error",
    type: "status",
    ...(id === undefined ? {} : { id }),
    error:
      entry === undefined
        ? {
            code: "fallback.internal",
            category: "platform",
            retryable: false,
            consequence: "unknown",
            remediationHint:
              "Inspect the diagnostics stream and report the failure if it persists.",
          }
        : {
            code: entry.code,
            category: entry.category,
            retryable: entry.retryable,
            consequence: entry.consequence,
            remediationHint: entry.remediationHint,
            ...(entry.summary === undefined ? {} : { summary: entry.summary }),
          },
    callerPrincipal: LOCAL_CALLER_PRINCIPAL,
  };
};

type DedupeEntry = {
  readonly type: string;
  readonly digest: string;
  readonly data: ControlPokeData | ControlDrainData | ControlStopData | ControlTakeoverData;
};

/** Stable content digest: object keys are sorted so a reordering is not a change. */
const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalValue(record[key])]),
    );
  }
  return value;
};

const digestOf = (value: unknown): string => JSON.stringify(canonicalValue(value));

export const createControlServer = (options: ControlServerOptions): ControlServer => {
  const sessions = new Map<string, ControlSessionApi>();
  const connections = new Map<string, ControlConnection>();
  const dedupe = new Map<string, DedupeEntry>();
  const lastPublished = new Map<
    ControlTopic,
    { readonly serialized: string; readonly cursor: number }
  >();
  let listener: { close: () => void | Promise<void> } | undefined;

  const send = (connection: ControlConnection, frame: unknown): void => {
    void connection.write(encodeControlFrame(frame as never));
  };

  const handleControl = (
    connection: ControlConnection,
    request: ControlRequestFrame,
    lockToken: string,
  ):
    | { data: ControlPokeData | ControlDrainData | ControlStopData | ControlTakeoverData }
    | { code: string } => {
    const key = `${connection.id}|${request.id}|${lockToken}`;
    const digest = digestOf(request.payload);
    const prior = dedupe.get(key);
    if (prior !== undefined) {
      if (prior.type !== request.type || prior.digest !== digest) {
        return { code: "fallback.invocation" };
      }
      return { data: prior.data };
    }
    if (request.type === "drain") {
      const result = options.handlers.drain(request.payload as { lockToken: string });
      if (!result.ok) return { code: result.code };
      dedupe.set(key, { type: request.type, digest, data: result.data });
      return { data: result.data };
    }
    if (request.type === "stop") {
      const result = options.handlers.stop(
        request.payload as { lockToken: string; mode?: "drain" | "immediate" },
      );
      if (!result.ok) return { code: result.code };
      dedupe.set(key, { type: request.type, digest, data: result.data });
      return { data: result.data };
    }
    if (request.type === "takeover") {
      const result = options.handlers.takeover(
        request.payload as { lockToken: string; evidence?: readonly string[] },
      );
      if (!result.ok) return { code: result.code };
      dedupe.set(key, { type: request.type, digest, data: result.data });
      return { data: result.data };
    }
    return { code: "fallback.invocation" };
  };

  const dispatch = (
    session: ControlSessionApi,
    connection: ControlConnection,
    request: ControlRequestFrame,
  ): void => {
    switch (request.type) {
      case "poke": {
        const result = options.handlers.poke(request.payload as ControlPokePayload);
        send(
          connection,
          result.ok
            ? session.respond(request, result.data)
            : session.errorFor(request.id, result.code),
        );
        return;
      }
      case "status": {
        const result = options.handlers.status(request.payload as ControlStatusPayload);
        send(
          connection,
          result.ok
            ? session.respond(request, result.data)
            : session.errorFor(request.id, result.code),
        );
        return;
      }
      case "lane": {
        const result = options.handlers.lane(request.payload as ControlLanePayload);
        send(
          connection,
          result.ok
            ? session.respond(request, result.data)
            : session.errorFor(request.id, result.code),
        );
        return;
      }
      case "subscribe": {
        const payload = request.payload as ControlSubscribePayload;
        const accepted = options.handlers.subscribe(payload);
        if (!accepted.ok) {
          send(connection, session.errorFor(request.id, accepted.code));
          return;
        }
        const subscribed = session.subscribe(accepted.data.topic, payload.since);
        if (!subscribed.ok) {
          send(connection, session.errorFor(request.id, subscribed.code));
          return;
        }
        send(connection, session.respond(request, { ok: true, subscriptionId: subscribed.id }));
        const events = session.publish(
          accepted.data.topic,
          accepted.data.snapshot,
          accepted.data.cursor,
        );
        for (const event of events) send(connection, event);
        for (const event of session.flush(subscribed.id)) send(connection, event);
        return;
      }
      case "drain":
      case "stop":
      case "takeover": {
        const payload = request.payload as { lockToken?: unknown };
        if (typeof payload.lockToken !== "string" || payload.lockToken.length === 0) {
          send(connection, session.errorFor(request.id, "fallback.invocation"));
          return;
        }
        const result = handleControl(connection, request, payload.lockToken);
        if ("code" in result) {
          send(connection, session.errorFor(request.id, result.code));
          return;
        }
        send(connection, session.respond(request, result.data));
        return;
      }
      default:
        send(connection, session.errorFor(request.id, "fallback.invocation"));
    }
  };

  return {
    start: async () => {
      listener = await options.transport.listen((connection) => {
        connections.set(connection.id, connection);
        const session = createControlSession({
          connectionId: connection.id,
          clock: options.clock,
          subscriptionBuffer: options.subscriptionBuffer ?? 256,
          responseTimeoutMs: options.responseTimeoutMs ?? 2_000,
        });
        sessions.set(connection.id, session);
        connection.onClose(() => {
          sessions.delete(connection.id);
          connections.delete(connection.id);
        });
        connection.onLine((line) => {
          if (session.closed()) return;
          const decoded = decodeControlLine(line);
          if (!decoded.ok) {
            send(connection, errorFrame(decoded.code));
            return;
          }
          const received = session.receive(decoded.frame);
          for (const reply of received.replies) send(connection, reply);
          if (!received.ok) {
            connection.close();
            return;
          }
          if (received.request !== undefined) dispatch(session, connection, received.request);
        });
      });
      return listener;
    },
    expire: () => {
      for (const [connectionId, session] of sessions) {
        const connection = connections.get(connectionId);
        if (connection === undefined) continue;
        for (const frame of session.expire()) send(connection, frame);
      }
    },
    publishState: () => {
      if (options.stateChanges === undefined) return;
      for (const change of options.stateChanges()) {
        const serialized = digestOf(change.snapshot);
        const prior = lastPublished.get(change.topic);
        if (prior !== undefined && prior.serialized === serialized) continue;
        const cursor = (prior?.cursor ?? 0) + 1;
        lastPublished.set(change.topic, { serialized, cursor });
        for (const [connectionId, session] of sessions) {
          const connection = connections.get(connectionId);
          if (connection === undefined) continue;
          for (const frame of session.publish(change.topic, change.snapshot, cursor)) {
            send(connection, frame);
          }
          for (const view of session.subscriptions()) {
            if (view.topic !== change.topic) continue;
            for (const frame of session.flush(view.id)) send(connection, frame);
          }
        }
      }
    },
    connections: () => connections.size,
    stop: () => {
      void listener?.close();
      for (const connection of connections.values()) connection.close();
      sessions.clear();
      connections.clear();
      dedupe.clear();
    },
  };
};
