/**
 * The transport-free NDJSON control codec (GH-238 F-4, F-5; EVT-8; DM-6).
 *
 * Knows nothing about sockets, files, or processes. Encodes exactly one JSON
 * object plus one trailing newline, refuses an unknown kind/type/version or a
 * frame over the byte bound before any action, and maps every refusal to the
 * delivered error table.
 */
import {
  CONTROL_FRAME_KINDS,
  CONTROL_PROTOCOL_CURRENT,
  CONTROL_PROTOCOL_FLOOR,
  CONTROL_PROTOCOL_OFFERED,
  CONTROL_WIRE_TYPES,
  CALLER_PRINCIPAL_KINDS,
  CALLER_PRINCIPAL_MAX_ID_CHARS,
  DAEMON_MAX_FRAME_BYTES,
  type ControlDecodeResult,
  type ControlErrorData,
  type ControlFrame,
  type ControlFrameKind,
  type ControlWireType,
} from "#contracts";
import { ERROR_TABLE } from "#contracts";

const errorData = (code: string): ControlErrorData => {
  const entry = ERROR_TABLE.find((candidate) => candidate.code === code);
  if (entry === undefined) {
    return {
      code: "fallback.internal",
      category: "platform",
      retryable: false,
      consequence: "unknown",
      remediationHint: "Inspect the diagnostics stream and report the failure if it persists.",
      summary: "The failure could not be classified.",
    };
  }
  return {
    code: entry.code,
    category: entry.category,
    retryable: entry.retryable,
    consequence: entry.consequence,
    remediationHint: entry.remediationHint,
    ...(entry.summary === undefined ? {} : { summary: entry.summary }),
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isVersion = (value: unknown): value is number =>
  value === CONTROL_PROTOCOL_CURRENT || value === CONTROL_PROTOCOL_FLOOR;

const isKind = (value: unknown): value is ControlFrameKind =>
  typeof value === "string" && (CONTROL_FRAME_KINDS as readonly string[]).includes(value);

const isWireType = (value: unknown): value is ControlWireType =>
  typeof value === "string" && (CONTROL_WIRE_TYPES as readonly string[]).includes(value);

const isPrincipal = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.kind === "string" &&
  (CALLER_PRINCIPAL_KINDS as readonly string[]).includes(value.kind) &&
  (value.id === null ||
    (typeof value.id === "string" && value.id.length <= CALLER_PRINCIPAL_MAX_ID_CHARS));

/** Encode one frame as exactly one JSON line. */
export const encodeControlFrame = (frame: ControlFrame): string => `${JSON.stringify(frame)}\n`;

/** The offered version set as a data value for error evidence. */
export const controlOfferedVersions = (): readonly number[] => [...CONTROL_PROTOCOL_OFFERED];

/**
 * Decode and validate one line. The byte bound is checked before JSON parsing;
 * a frame missing a field its own version requires is refused.
 */
export const decodeControlLine = (
  line: string,
  options: { readonly maxBytes?: number } = {},
): ControlDecodeResult => {
  const maxBytes = options.maxBytes ?? DAEMON_MAX_FRAME_BYTES;
  const bytes = new TextEncoder().encode(line).length;
  if (bytes > maxBytes) return { ok: false, code: "fallback.invocation", path: "frame-max-bytes" };
  if (line.includes("\n") || line.includes("\r")) {
    return { ok: false, code: "fallback.invocation", path: "multiple-frames" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { ok: false, code: "fallback.invocation", path: "json" };
  }
  if (!isRecord(parsed)) return { ok: false, code: "fallback.invocation", path: "object" };
  if (!isVersion(parsed.v)) return { ok: false, code: "daemon.protocol.unsupported" };
  if (!isKind(parsed.kind)) return { ok: false, code: "fallback.invocation", path: "kind" };
  if (!isWireType(parsed.type)) return { ok: false, code: "fallback.invocation", path: "type" };
  if (parsed.v === CONTROL_PROTOCOL_CURRENT && !isPrincipal(parsed.callerPrincipal)) {
    return { ok: false, code: "fallback.invocation", path: "callerPrincipal" };
  }
  if (parsed.v === CONTROL_PROTOCOL_FLOOR && Object.hasOwn(parsed, "callerPrincipal")) {
    return { ok: false, code: "fallback.invocation", path: "v0-callerPrincipal" };
  }
  const bodies = ["payload", "data", "error"].filter((field) => Object.hasOwn(parsed, field));
  if (bodies.length !== 1) return { ok: false, code: "fallback.invocation", path: "body" };
  const body = bodies[0] as string;
  const expectedBody =
    parsed.kind === "request"
      ? "payload"
      : parsed.kind === "response"
        ? "data"
        : parsed.kind === "event"
          ? "data"
          : "error";
  if (body !== expectedBody) return { ok: false, code: "fallback.invocation", path: "body-kind" };
  if (parsed.kind === "event" && Object.hasOwn(parsed, "id")) {
    return { ok: false, code: "fallback.invocation", path: "event-id" };
  }
  if ((parsed.kind === "request" || parsed.kind === "response") && typeof parsed.id !== "string") {
    return { ok: false, code: "fallback.invocation", path: "id" };
  }
  if (parsed.kind === "error" && parsed.id !== undefined && typeof parsed.id !== "string") {
    return { ok: false, code: "fallback.invocation", path: "id" };
  }
  return { ok: true, frame: parsed as unknown as ControlFrame, line };
};

/** Build the unsupported-version error data including the offered set. */
export const unsupportedVersionError = (): ControlErrorData => ({
  ...errorData("daemon.protocol.unsupported"),
  summary: `Unsupported protocol version; offered ${JSON.stringify(controlOfferedVersions())}.`,
});
