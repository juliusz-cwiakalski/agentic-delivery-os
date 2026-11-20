/**
 * The bounded operational-log line renderer and retention arithmetic (GH-348
 * F-7, DM-7; NFR-3, NFR-10).
 *
 * Pure: one single-line, ANSI-free, identifier-only record per supervision
 * event, `"<ISO-8601 UTC> event=<name>"` followed by bounded `key=value` pairs.
 * Whole pairs are dropped rather than cut at the byte bound, a value can never
 * carry a control character or a line break, and the retention arithmetic is a
 * pure decision so the file-system double and the real sink agree.
 */
import {
  LOOP_LOG_EVENTS,
  LOOP_MAX_LOG_ACTIVE_BYTES,
  LOOP_MAX_LOG_LINE_BYTES,
  type LoopLogEvent,
} from "#contracts";

/**
 * Strip ANSI escape sequences and every control character, and trim the value.
 *
 * A character-wise scan instead of a regex: the source stays free of literal
 * control characters, and the result can never carry a line break.
 */
const sanitize = (value: string): string => {
  let out = "";
  let inEscape = false;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (inEscape) {
      // A CSI sequence ends at its final byte (0x40-0x7e).
      if (code >= 0x40 && code <= 0x7e) inEscape = false;
      continue;
    }
    if (code === 0x1b) {
      inEscape = true;
      continue;
    }
    out += code < 0x20 || code === 0x7f ? " " : character;
  }
  return out.trim();
};

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

/** One rendered log line, or `null` when even the header exceeds the bound. */
export const renderLogLine = (input: {
  readonly recordedAt: string;
  readonly event: LoopLogEvent;
  readonly pairs?: Readonly<Record<string, string | number | boolean | null>>;
}): string | null => {
  if (!(LOOP_LOG_EVENTS as readonly string[]).includes(input.event)) return null;
  const header = `${sanitize(input.recordedAt)} event=${input.event}`;
  if (byteLength(header) > LOOP_MAX_LOG_LINE_BYTES) return null;
  let line = header;
  for (const [key, raw] of Object.entries(input.pairs ?? {})) {
    if (raw === null) continue;
    const value = sanitize(String(raw));
    if (value.length === 0) continue;
    const pair = ` ${sanitize(key)}=${value}`;
    if (byteLength(`${line}${pair}`) > LOOP_MAX_LOG_LINE_BYTES) continue;
    line = `${line}${pair}`;
  }
  return line;
};

/** One append decision over the declared retention bounds. */
export type LoopLogAppendPlan = {
  /** Whether the active file retires into the single retained generation first. */
  readonly rotate: boolean;
  /** Whether the incoming line cannot fit and must be dropped. */
  readonly drop: boolean;
  /** The active byte count after the plan is applied. */
  readonly activeBytes: number;
};

/**
 * Decide one append (DM-7, AC-F7-2): an append that would pass the active bound
 * rotates first (the previous generation is discarded), and a single line
 * larger than the active bound is dropped rather than truncated.
 */
export const planLogAppend = (input: {
  readonly activeBytes: number;
  readonly lineBytes: number;
  readonly maxActiveBytes?: number;
}): LoopLogAppendPlan => {
  const maxActive = input.maxActiveBytes ?? LOOP_MAX_LOG_ACTIVE_BYTES;
  if (input.lineBytes > maxActive) {
    return { rotate: false, drop: true, activeBytes: input.activeBytes };
  }
  if (input.activeBytes + input.lineBytes > maxActive) {
    return { rotate: true, drop: false, activeBytes: input.lineBytes };
  }
  return { rotate: false, drop: false, activeBytes: input.activeBytes + input.lineBytes };
};

/** The public byte-length helper the sink and the read projection share. */
export const logByteLength = (text: string): number => byteLength(text);
