/**
 * The artifact-family naming, segmentation, retention, and read arithmetic
 * (GH-354 F-7, F-2; DM-2, DM-6; TDR-0056 DR-4, DC-2, DC-3).
 *
 * Pure: no I/O, no clock, no counters. The writer holds no state beyond the
 * stream's own segment size, so nothing here can become a shared counter.
 *
 * ONE WRITER RULE: every yielded value is written followed by exactly one LF,
 * so the concatenation of one stream's files in name order reproduces that
 * stream's value stream exactly — with the sole exception that a file filled by
 * a value longer than the cap ends mid-value and continues in the next file.
 * ONE TEAR RULE: an unterminated tail is a torn write and the reader drops it.
 */
import {
  DISPATCH_LOG_FILE_CAP_BYTES,
  DISPATCH_LOG_RETAINED_FILES,
  DISPATCH_LOG_SEGMENT_WIDTH,
  DISPATCH_LOG_STREAM_ORDINALS,
  DISPATCH_LOG_STREAM_WIDTH,
  type DispatchLogStreamKind,
  type DispatchOperatorTruncation,
} from "#contracts";

/** The UTF-8 byte length of a text without a runtime buffer. */
export const dispatchLogByteLength = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

/**
 * Cut `text` so the returned prefix is at most `capBytes` UTF-8 bytes without
 * splitting a code point. Returns the prefix and the remainder.
 */
export const cutAtByteCap = (
  text: string,
  capBytes: number,
): { readonly head: string; readonly rest: string } => {
  let bytes = 0;
  let index = 0;
  for (const character of text) {
    const size = dispatchLogByteLength(character);
    if (bytes + size > capBytes) break;
    bytes += size;
    index += character.length;
  }
  return { head: text.slice(0, index), rest: text.slice(index) };
};

/** The filesystem-safe compact form of a recorded instant (lexically ordered). */
export const dispatchLogTimestamp = (recordedAt: string): string =>
  recordedAt.replace(/[^0-9A-Za-z]/gu, "");

const pad = (value: number, width: number): string => String(value).padStart(width, "0");

/** The declared inputs one file name is derived from. */
export type DispatchLogNameInput = {
  readonly recordedAt: string;
  readonly attemptId?: string;
  readonly iterationOrdinal?: number;
  readonly streamKind: DispatchLogStreamKind;
  readonly segmentOrdinal: number;
};

/**
 * One file name.
 *
 * Order of the components is the order the sort must follow: recorded time,
 * attempt identity, iteration ordinal, stream ordinal, segment ordinal. The
 * stream ordinal is a property of the declared stream kind, so a spawn, a
 * resume, and a deliver of one attempt and iteration never collide.
 */
export const dispatchLogFileName = (input: DispatchLogNameInput): string => {
  const attempt = (input.attemptId ?? "attempt").replace(/[^0-9A-Za-z_-]/gu, "-");
  const iteration = pad(input.iterationOrdinal ?? 1, 4);
  const stream = pad(DISPATCH_LOG_STREAM_ORDINALS[input.streamKind], DISPATCH_LOG_STREAM_WIDTH);
  const segment = pad(input.segmentOrdinal, DISPATCH_LOG_SEGMENT_WIDTH);
  return `${dispatchLogTimestamp(input.recordedAt)}_${attempt}_i${iteration}_s${stream}_p${segment}.log`;
};

/** One planned append: the text to write and whether it starts a new segment. */
export type DispatchLogWrite = {
  readonly text: string;
  readonly startsSegment: boolean;
};

/**
 * Plan the appends for one yielded value.
 *
 * `currentSizeBytes` is the size of the stream's current segment. A record that
 * fits the remaining room is one append; a record shorter than the cap that
 * does not fit starts the next segment write whole; a record longer than the cap
 * fills the remaining room to exactly the cap and continues its remainder at the
 * start of the next segment, repeating as needed. No value is ever dropped.
 */
export const planDispatchLogWrites = (input: {
  readonly value: string;
  readonly currentSizeBytes: number;
  readonly capBytes?: number;
}): readonly DispatchLogWrite[] => {
  const cap = input.capBytes ?? DISPATCH_LOG_FILE_CAP_BYTES;
  const record = `${input.value}\n`;
  const recordBytes = dispatchLogByteLength(record);
  const room = Math.max(0, cap - input.currentSizeBytes);

  if (recordBytes <= room) return [{ text: record, startsSegment: false }];
  if (recordBytes <= cap) return [{ text: record, startsSegment: true }];

  const writes: DispatchLogWrite[] = [];
  let rest = record;
  let size = input.currentSizeBytes;
  let first = true;
  while (rest.length > 0) {
    const capacity = Math.max(0, cap - size);
    if (capacity === 0) {
      // The current segment is full: the remainder starts the next one.
      size = 0;
      first = false;
      continue;
    }
    if (dispatchLogByteLength(rest) <= capacity) {
      writes.push({ text: rest, startsSegment: !first });
      break;
    }
    const cut = cutAtByteCap(rest, capacity);
    if (cut.head.length > 0) writes.push({ text: cut.head, startsSegment: !first });
    rest = cut.rest;
    size = cap;
    first = false;
    if (rest.length > 0) size = 0;
  }
  return writes;
};

/** The retained set: the newest `retained` names by lexical order. */
export const retainedDispatchLogNames = (
  names: readonly string[],
  retained: number = DISPATCH_LOG_RETAINED_FILES,
): { readonly keep: readonly string[]; readonly remove: readonly string[] } => {
  const sorted = [...names].sort((left, right) => left.localeCompare(right, "en"));
  if (sorted.length <= retained) return { keep: sorted, remove: [] };
  return {
    keep: sorted.slice(sorted.length - retained),
    remove: sorted.slice(0, sorted.length - retained),
  };
};

/**
 * Stitch the retained files in NAME order, drop an unterminated tail, and split
 * on LF only after the stitch (TDR-0056 DC-3).
 *
 * A returned value continued across a segment boundary is therefore whole; a
 * torn write is never returned as content.
 */
export const stitchDispatchLogLines = (
  files: readonly { readonly name: string; readonly text: string }[],
): readonly string[] => {
  const ordered = [...files].sort((left, right) => left.name.localeCompare(right.name, "en"));
  const stitched = ordered.map((file) => file.text).join("");
  const lastBreak = stitched.lastIndexOf("\n");
  if (lastBreak < 0) return [];
  return stitched.slice(0, lastBreak).split("\n");
};

/**
 * Select and bound the tail lines (API-2, AC-F2-5, AC-F2-6).
 *
 * Precedence, declared so only one fact is ever emitted: the line bound is
 * applied first (the requested tail, the human 200-line bound, or a shorter
 * retained window); the byte bound is then applied over the selected lines. A
 * binding byte bound therefore yields `scope: "bytes"`; otherwise a shorter line
 * count yields `scope: "tail"`, whose `bound` names the binding line bound (the
 * human line bound, the request, or the retained window).
 */
export const boundDispatchLogLines = (input: {
  readonly lines: readonly string[];
  readonly requested: number;
  readonly maxLines?: number;
  readonly maxBytes?: number;
  /** The byte cost of a candidate line list in the caller's rendered shape. */
  readonly measureBytes?: (lines: readonly string[]) => number;
}): {
  readonly lines: readonly string[];
  readonly truncation?: DispatchOperatorTruncation;
} => {
  const all = [...input.lines];
  const requested = Math.max(0, input.requested);
  const lineBound = Math.min(requested, input.maxLines ?? Number.MAX_SAFE_INTEGER);
  const selected = all.slice(Math.max(0, all.length - lineBound));

  const measure = input.measureBytes ?? ((lines: readonly string[]) => lines.length);
  const byteBound = input.maxBytes ?? Number.MAX_SAFE_INTEGER;
  const kept = [...selected];
  while (kept.length > 0 && measure(kept) > byteBound) kept.shift();
  const byteBounded = kept.length < selected.length;
  const omitted = all.length - kept.length;

  if (omitted === 0) return { lines: kept };
  if (byteBounded) {
    return { lines: kept, truncation: { scope: "bytes", bound: byteBound, omittedLines: omitted } };
  }
  // The line bound that actually bound: the human line bound when it is the
  // smaller one, otherwise the request, otherwise the retained window length.
  const tailBound =
    input.maxLines !== undefined && lineBound === input.maxLines && input.maxLines < requested
      ? input.maxLines
      : all.length < requested
        ? all.length
        : requested;
  return {
    lines: kept,
    truncation: { scope: "tail", bound: tailBound, omittedLines: omitted },
  };
};
