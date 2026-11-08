/**
 * Control protocol v1 vocabulary (GH-238 F-4, F-5, F-6; DM-6, DM-7; EVT-8, EVT-9).
 *
 * Runtime-neutral: types and `as const` data only. Wire `type` values are
 * exactly Appendix B; interaction classes are derived, never wire values.
 * Codec, session, dispatcher, and transports consume these declarations.
 */
import type { ErrorTableEntry } from "./error-table.js";
import type { CallerPrincipal } from "./principal.js";

/** The served major version and the declared compatibility floor. */
export const CONTROL_PROTOCOL_CURRENT = 1 as const;
export const CONTROL_PROTOCOL_FLOOR = 0 as const;
export const CONTROL_PROTOCOL_OFFERED = [1, 0] as const;

/** The closed frame kinds. */
export const CONTROL_FRAME_KINDS = ["request", "response", "event", "error"] as const;
export type ControlFrameKind = (typeof CONTROL_FRAME_KINDS)[number];

/** The closed interaction classes (derived from the wire type). */
export const CONTROL_INTERACTION_CLASSES = ["poke", "query", "subscribe", "control"] as const;
export type ControlInteractionClass = (typeof CONTROL_INTERACTION_CLASSES)[number];

/** The wire `type` values, verbatim from Appendix B. */
export const CONTROL_WIRE_TYPES = [
  "poke",
  "status",
  "lane",
  "subscribe",
  "drain",
  "stop",
  "takeover",
  "frame",
  "degraded",
] as const;
export type ControlWireType = (typeof CONTROL_WIRE_TYPES)[number];

/** The closed subscription topics. */
export const CONTROL_TOPICS = ["queue", "lanes"] as const;
export type ControlTopic = (typeof CONTROL_TOPICS)[number];

/** The closed degraded-event reasons. */
export const CONTROL_DEGRADED_REASONS = [
  "subscriber-overflow",
  "daemon-unreachable",
  "daemon-heartbeat-stale",
] as const;
export type ControlDegradedReason = (typeof CONTROL_DEGRADED_REASONS)[number];

/** The closed stop modes. */
export const CONTROL_STOP_MODES = ["drain", "immediate"] as const;
export type ControlStopMode = (typeof CONTROL_STOP_MODES)[number];

/** The interaction class for a wire type (request directions only). */
export const controlInteractionClass = (
  type: ControlWireType,
): ControlInteractionClass | undefined => {
  if (type === "poke") return "poke";
  if (type === "status" || type === "lane") return "query";
  if (type === "subscribe") return "subscribe";
  if (type === "drain" || type === "stop" || type === "takeover") return "control";
  return undefined;
};

/** The v1 payload shapes. */
export type ControlPokePayload = { readonly cursor: number };
export type ControlStatusPayload = Record<string, never>;
export type ControlLanePayload = { readonly ref: string };
export type ControlSubscribePayload = {
  readonly topic: ControlTopic;
  readonly since?: number;
};
export type ControlControlPayload = {
  readonly lockToken: string;
  readonly mode?: ControlStopMode;
  readonly evidence?: readonly string[];
};

export type ControlRequestPayload =
  | ControlPokePayload
  | ControlStatusPayload
  | ControlLanePayload
  | ControlSubscribePayload
  | ControlControlPayload;

/** The response data shapes. */
export type ControlPokeData = { readonly applied: true };
export type ControlStatusData = {
  readonly live: true;
  readonly instance: unknown;
  readonly queueDepth: number;
  readonly lanes: readonly unknown[];
};
export type ControlLaneData = { readonly live: true; readonly lane: unknown };
export type ControlSubscribeData = { readonly ok: true; readonly subscriptionId?: string };
export type ControlDrainData = { readonly draining: true; readonly lanes: readonly unknown[] };
export type ControlStopData = { readonly stopping: true };
export type ControlTakeoverData = { readonly takenOver: true };

/** One unsolicited event body. */
export type ControlEventData =
  | { readonly topic: ControlTopic; readonly cursor: number; readonly snapshot?: unknown }
  | { readonly degraded: ControlDegradedReason; readonly topic?: ControlTopic };

/** The delivered error-object field set carried by an error frame. */
export type ControlErrorData = Pick<
  ErrorTableEntry,
  "code" | "category" | "retryable" | "consequence" | "remediationHint" | "summary"
>;

/** The frame envelope: exactly one of payload/data/error is present. */
type ControlBaseFrame = {
  readonly v: number;
  readonly kind: ControlFrameKind;
  readonly type: ControlWireType;
};

export type ControlRequestFrame = ControlBaseFrame & {
  readonly kind: "request";
  readonly id: string;
  readonly payload: ControlRequestPayload;
  readonly callerPrincipal?: CallerPrincipal;
};

export type ControlResponseFrame = ControlBaseFrame & {
  readonly kind: "response";
  readonly id: string;
  readonly data:
    | ControlPokeData
    | ControlStatusData
    | ControlLaneData
    | ControlSubscribeData
    | ControlDrainData
    | ControlStopData
    | ControlTakeoverData;
  readonly callerPrincipal?: CallerPrincipal;
};

export type ControlEventFrame = ControlBaseFrame & {
  readonly kind: "event";
  readonly data: ControlEventData;
  readonly callerPrincipal?: CallerPrincipal;
};

export type ControlErrorFrame = ControlBaseFrame & {
  readonly kind: "error";
  readonly id?: string;
  readonly error: ControlErrorData;
  readonly callerPrincipal?: CallerPrincipal;
};

export type ControlFrame =
  | ControlRequestFrame
  | ControlResponseFrame
  | ControlEventFrame
  | ControlErrorFrame;

/** One decoded, validated frame with the raw line for round-trip proof. */
export type ControlDecodeResult =
  | { readonly ok: true; readonly frame: ControlFrame; readonly line: string }
  | { readonly ok: false; readonly code: string; readonly path?: string };

/** The control store used for at-most-once dedupe. */
export type ControlDedupeKey = {
  readonly connectionId: string;
  readonly id: string;
  readonly lockToken: string | null;
};

/** The at-most-once control action outcome. */
export type ControlActionResult =
  | { readonly ok: true; readonly replayed: boolean; readonly data: ControlResponseFrame["data"] }
  | { readonly ok: false; readonly code: string };

/** The injected at-most-once control store (keyed on connection, id, token). */
export type ControlStorePort = {
  readonly lookup: (key: ControlDedupeKey) => ControlActionResult | undefined;
  readonly record: (key: ControlDedupeKey, result: ControlActionResult) => void;
};

/** The session port the dispatcher drives (frames, not bytes). */
export type ControlSession = {
  readonly connectionId: string;
  readonly offeredVersion: number;
  readonly send: (frame: ControlFrame) => void;
  readonly receive: (frame: ControlFrame) => ControlFrame[];
  readonly close: () => void;
  readonly closed: () => boolean;
};

/** A line-oriented connection: one JSON frame per line. */
export type ControlConnection = {
  readonly id: string;
  readonly write: (line: string) => void | Promise<void>;
  readonly onLine: (handler: (line: string) => void) => void;
  readonly onClose: (handler: () => void) => void;
  readonly close: () => void;
};

/** A transport listener and connector over an ordered byte stream. */
export type ControlListener = {
  readonly close: () => void | Promise<void>;
};

export type ControlTransport = {
  readonly listen: (
    onConnection: (connection: ControlConnection) => void,
  ) => Promise<ControlListener>;
  readonly connect: () => Promise<ControlConnection>;
};

/** The in-memory transport pair the conformance suite exercises. */
export type ControlTransportPair = {
  readonly server: ControlTransport;
  readonly client: ControlTransport;
};
