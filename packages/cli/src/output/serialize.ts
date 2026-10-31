/**
 * Serialization and the single redaction chokepoint (F-7, D1).
 *
 * This is the only module in the delivered surface that writes to a stream. The
 * envelope is fully assembled before the one write; redaction runs first, so no
 * byte reaches a stream before the chokepoint has transformed registered values.
 */
import type { CommandResult } from "@delivery-os/core/contracts";

/** A minimal injected sink (the real process streams are never touched). */
export type CliSink = { write(chunk: string): void };

/** Injected standard output and error streams. */
export type CliStreams = {
  readonly stdout: CliSink;
  readonly stderr: CliSink;
};

const REDACTED = "[redacted]";

const redactString = (value: string, secrets: readonly string[]): string =>
  secrets.reduce(
    (text, secret) => (secret.length === 0 ? text : text.split(secret).join(REDACTED)),
    value,
  );

const redactValue = (value: unknown, secrets: readonly string[]): unknown => {
  if (typeof value === "string") return redactString(value, secrets);
  if (Array.isArray(value)) return value.map((entry) => redactValue(entry, secrets));
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[redactString(key, secrets)] = redactValue(entry, secrets);
    }
    return result;
  }
  return value;
};

/** Replace every registered value occurrence with `[redacted]` (contiguous, recursive). */
export function redact<T>(value: T, secrets: readonly string[]): T {
  return redactValue(value, secrets) as T;
}

/** Serialize an envelope to exactly one JSON document with one trailing newline. */
export function serializeEnvelope(envelope: CommandResult, secrets: readonly string[]): string {
  const redacted = redact(envelope, secrets);
  return `${JSON.stringify(redacted, null, 2)}\n`;
}

const writeText = (stream: CliSink, text: string): void => {
  stream.write(text);
};

export type WriteOutputOptions = {
  /** Opt-in human success JSON; machine mode always uses the envelope instead. */
  readonly humanJson?: unknown;
  /** Opt-in pre-rendered human text; takes precedence over `humanJson`. */
  readonly humanText?: string;
  /** Safe structured notices, emitted once each on stderr in every mode. */
  readonly warnings?: readonly string[];
};

/**
 * Write the machine envelope (when requested), opt-in human success JSON, the
 * human diagnostic and safe warnings. Every path goes through redaction; the
 * write helper remains the single stream-write call site.
 */
export function writeOutput(
  streams: CliStreams,
  envelope: CommandResult,
  diagnostic: string | undefined,
  secrets: readonly string[],
  emitEnvelope: boolean,
  options: WriteOutputOptions = {},
): void {
  if (emitEnvelope) {
    const text = serializeEnvelope(envelope, secrets);
    writeText(streams.stdout, text);
  } else if (options.humanText !== undefined) {
    writeText(streams.stdout, redact(options.humanText, secrets));
  } else if (options.humanJson !== undefined) {
    const redacted = redact(options.humanJson, secrets);
    const text = JSON.stringify(redacted, null, 2);
    writeText(streams.stdout, `${text ?? "null"}\n`);
  }
  if (diagnostic !== undefined) {
    const redactedDiagnostic = redact(diagnostic, secrets);
    writeText(streams.stderr, redactedDiagnostic);
  }
  for (const warning of options.warnings ?? []) {
    writeText(streams.stderr, `${redact(warning, secrets)}\n`);
  }
}
