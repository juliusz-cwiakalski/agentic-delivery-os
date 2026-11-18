/**
 * The pure watch projection (GH-238 F-13; C-4; DM-7, DM-14, EVT-9; AC-F13-1).
 *
 * A bounded initial snapshot, one bounded event per line, deduplication by
 * cursor/finding identity, preserved finding codes, and explicit truncation.
 * No snapshot or event exceeds the frame bound.
 */
import { DAEMON_MAX_FRAME_BYTES, type ControlDegradedReason, type ControlTopic } from "#contracts";

export type WatchLine = { readonly text: string; readonly cursor: number };

const byteLength = (text: string): number => new TextEncoder().encode(text).length;

/** Serialize one line, truncating explicitly when the frame bound is reached. */
export const boundWatchLine = (value: unknown, maxBytes = DAEMON_MAX_FRAME_BYTES): WatchLine => {
  const text = JSON.stringify(value);
  if (byteLength(text) <= maxBytes) {
    return { text, cursor: cursorOf(value) };
  }
  const truncated = {
    ...(typeof value === "object" && value !== null ? value : { data: value }),
    truncated: true,
    truncationReason: "frame-max-bytes",
  };
  return { text: JSON.stringify(truncated), cursor: cursorOf(value) };
};

const cursorOf = (value: unknown): number => {
  if (typeof value !== "object" || value === null) return 0;
  const cursor = (value as { cursor?: unknown }).cursor;
  return typeof cursor === "number" && Number.isInteger(cursor) ? cursor : 0;
};

export type WatchProjection = {
  readonly snapshot: (
    payload: unknown,
    degraded?: readonly ControlDegradedReason[],
  ) => WatchLine | undefined;
  readonly event: (
    payload: unknown,
    cursor: number,
    degraded?: readonly ControlDegradedReason[],
  ) => WatchLine | undefined;
  readonly overflow: (topic: ControlTopic) => WatchLine;
  readonly lastCursor: () => number;
};

/** A deduplicating projection: a cursor at or below the last delivered is dropped. */
export const createWatchProjection = (topic: ControlTopic): WatchProjection => {
  let lastCursor = -1;
  const line = (
    type: "frame" | "degraded",
    payload: unknown,
    cursor: number,
    degraded?: readonly ControlDegradedReason[],
  ): WatchLine | undefined => {
    if (cursor <= lastCursor) return undefined;
    lastCursor = cursor;
    return boundWatchLine({
      kind: "event",
      type,
      topic,
      cursor,
      ...(degraded === undefined || degraded.length === 0 ? {} : { degraded }),
      data: payload,
    });
  };
  return {
    snapshot: (payload, degraded) => line("frame", payload, 0, degraded),
    event: (payload, cursor, degraded) => line("frame", payload, cursor, degraded),
    overflow: (overflowTopic) => ({
      text: JSON.stringify({
        kind: "event",
        type: "degraded",
        topic: overflowTopic,
        degraded: "subscriber-overflow",
      }),
      cursor: lastCursor,
    }),
    lastCursor: () => lastCursor,
  };
};
