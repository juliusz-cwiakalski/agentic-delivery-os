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

/**
 * Serialize the scripted-mode projection (DEC-2): one minified line — success
 * carries exactly `data`; failure carries the full `error` object plus
 * `runId` as a top-level correlation key. No schemaVersion, exitCode, or
 * timing appears on a scripted line.
 */
export function serializeScriptedLine(envelope: CommandResult, secrets: readonly string[]): string {
  const redacted = redact(envelope, secrets);
  if ("error" in redacted) {
    return `${JSON.stringify({ error: redacted.error, runId: redacted.runId })}\n`;
  }
  return `${JSON.stringify({ data: redacted.data })}\n`;
}

const writeText = (stream: CliSink, text: string): void => {
  stream.write(text);
};

export type WriteOutputOptions = {
  /** The injected machine-output mode fact (DEC-2). */
  readonly mode?: "interactive" | "scripted";
  /** The documented full-envelope override. */
  readonly verbose?: boolean;
  /** Indentation-only flag (never re-expands the scripted trim). */
  readonly pretty?: boolean;
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
    const scripted = (options.mode ?? "interactive") === "scripted" && options.verbose !== true;
    const text = scripted
      ? serializeScriptedLine(envelope, secrets)
      : serializeEnvelope(envelope, secrets);
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

/**
 * Serialize one watch line through the single redaction chokepoint (GH-238 F-13).
 * A non-JSON line is never emitted in machine mode.
 */
export function serializeStreamLine(line: string, secrets: readonly string[]): string | undefined {
  try {
    const parsed: unknown = JSON.parse(line);
    return `${JSON.stringify(redact(parsed, secrets))}\n`;
  } catch {
    return undefined;
  }
}
