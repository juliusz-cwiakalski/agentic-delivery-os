/**
 * `dispatch last-message` — the capability-gated transcript read and the closed
 * ladder (GH-354 F-4; API-4, API-6, API-9, API-11; DM-3, DM-5; DEC-4).
 *
 * The query resolves the newest lane, takes its session identity and harness
 * kind, and calls ONE injected adapter-owned read seam — only where that harness
 * declares the existing `session-introspection` capability supported. It never
 * composes a sentence: no attempt record, derivation payload, or envelope field
 * is read, and no session operation is performed.
 *
 * The ladder is closed and ordered: `no-lane` -> `capability-gap` ->
 * `session-unknown` -> `no-message` -> `unreadable`. An unreadable LANE STORE
 * keeps the store's own typed identity instead of a closed reason.
 */
import {
  type DispatchLastMessageData,
  type DispatchMessageReason,
  type DispatchTranscriptRead,
  type DispatchTranscriptResult,
  type HarnessKind,
  type StateStorePort,
} from "#contracts";
import { composeDispatchMessage } from "../domain/dispatch-message.js";
import { operatorLaneFor } from "../domain/dispatch-operator-view.js";
import { readDispatchLanes } from "./dispatch-ledger.js";

export type { DispatchTranscriptRead, DispatchTranscriptResult };

export type DispatchLastMessageRead =
  | { readonly ok: true; readonly data: DispatchLastMessageData }
  | { readonly ok: false; readonly code: string; readonly path: string };

const absent = (
  ref: string,
  reason: DispatchMessageReason,
  final: boolean,
): DispatchLastMessageData => ({
  query: "last-message",
  ref,
  available: false,
  final,
  reason,
  message: null,
  truncated: false,
  recordedAt: null,
});

/** One bounded lane read, the capability gate, the seam, then the ladder. */
export const readDispatchLastMessage = async (input: {
  readonly store: StateStorePort;
  readonly repository: string;
  readonly ref: string;
  readonly transcript: DispatchTranscriptRead;
  /** The adapter's declared `session-introspection` support, injected as data. */
  readonly supportsIntrospection: (kind: HarnessKind) => boolean;
  /** The delivered redaction chokepoint (registered credential values only). */
  readonly redact: (text: string) => string;
}): Promise<DispatchLastMessageRead> => {
  const lanes = readDispatchLanes(input.store);
  if (!lanes.ok) return { ok: false, code: lanes.code, path: lanes.path };
  const record = operatorLaneFor(lanes.records, input.repository, input.ref);
  if (record === undefined) return { ok: true, data: absent(input.ref, "no-lane", false) };

  const final = record.state === "terminal";
  if (!input.supportsIntrospection(record.harnessKind)) {
    return { ok: true, data: absent(input.ref, "capability-gap", final) };
  }

  const read = await input.transcript({
    harnessKind: record.harnessKind,
    sessionId: record.sessionId,
    ref: input.ref,
  });
  if (!read.ok) return { ok: true, data: absent(input.ref, read.reason, final) };

  const composed = composeDispatchMessage({ text: read.message, redact: input.redact });
  return {
    ok: true,
    data: {
      query: "last-message",
      ref: input.ref,
      available: true,
      final,
      message: composed.message,
      truncated: composed.truncated,
      recordedAt: read.recordedAt,
    },
  };
};
