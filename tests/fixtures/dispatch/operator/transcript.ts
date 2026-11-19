/**
 * The transcript read seam doubles (GH-354 §6.1, §6.2).
 *
 * One double for the composition-level cases (it records every call and its
 * arguments, including that no live handle is handed over), plus the wiring that
 * exercises the REAL opencode reader over a built store. Neither reimplements
 * the composition order: the query owns redact -> flatten -> bound -> mark.
 */
import { createBunSqliteStoreOpener } from "../../../../packages/adapters/src/harness/sqlite-loader";
import { createOpencodeTranscriptReader } from "../../../../packages/adapters/src/harness/opencode-transcript";
import type {
  DispatchTranscriptRead,
  DispatchTranscriptResult,
} from "../../../../packages/core/src/app/dispatch-last-message";

export type TranscriptCall = {
  readonly harnessKind: string;
  readonly sessionId: string;
  readonly ref: string;
  /** The seam takes no live handle; a case asserts this stays `true`. */
  readonly handedNoHandle: boolean;
};

export type TranscriptDouble = {
  readonly read: DispatchTranscriptRead;
  readonly calls: readonly TranscriptCall[];
  readonly reset: () => void;
};

export type TranscriptDoubleOptions = {
  /** The stored final text per session identity. */
  readonly messages?: Readonly<Record<string, string>>;
  /** The recordedAt the seam reports (default: the fixed instant). */
  readonly recordedAt?: string;
  /** Force one closed absence for every call. */
  readonly absence?: "session-unknown" | "no-message" | "unreadable";
};

const DEFAULT_RECORDED_AT = "2026-11-19T00:00:00.000Z";

/** A recording seam double over a session -> text map. */
export const createTranscriptDouble = (options: TranscriptDoubleOptions = {}): TranscriptDouble => {
  const calls: TranscriptCall[] = [];
  return {
    read: (input) => {
      calls.push({
        harnessKind: input.harnessKind,
        sessionId: input.sessionId,
        ref: input.ref,
        handedNoHandle: true,
      });
      if (options.absence !== undefined) {
        return { ok: false, reason: options.absence } satisfies DispatchTranscriptResult;
      }
      const text = options.messages?.[input.sessionId];
      if (text === undefined) return { ok: false, reason: "session-unknown" };
      if (text.length === 0) return { ok: false, reason: "no-message" };
      return {
        ok: true,
        message: text,
        recordedAt: options.recordedAt ?? DEFAULT_RECORDED_AT,
      } satisfies DispatchTranscriptResult;
    },
    get calls() {
      return calls;
    },
    reset: () => {
      calls.length = 0;
    },
  };
};

/** The real opencode reader over one built store path. */
export const createRealTranscriptRead = (input: {
  readonly storePath: string;
  readonly onStatement?: (sql: string) => void;
  readonly readCapChars?: number;
}): DispatchTranscriptRead => {
  const reader = createOpencodeTranscriptReader({
    opener: createBunSqliteStoreOpener(),
    storePath: input.storePath,
    ...(input.onStatement === undefined ? {} : { onStatement: input.onStatement }),
    ...(input.readCapChars === undefined ? {} : { readCapChars: input.readCapChars }),
  });
  return (request) => reader.read(request);
};
