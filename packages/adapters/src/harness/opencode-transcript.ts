/**
 * The opencode transcript reader (GH-354 F-4; API-9; DM-3; TDR-0056 DC-4).
 *
 * The content use of the EXISTING `session-introspection` capability: a
 * read-only, bounded read of the adapter's own persisted session store that
 * returns the stored FINAL assistant text verbatim under its own read cap.
 *
 * It performs no session operation, takes no handle, starts nothing, resumes
 * nothing, terminates nothing, and writes nothing. It does NOT flatten, bound to
 * 512 characters, redact, or mark: that composition belongs to the query, so no
 * cut can precede redaction.
 */
import type { HarnessKind } from "@delivery-os/core/contracts";
import { DISPATCH_TRANSCRIPT_READ_CAP_CHARS } from "@delivery-os/core/contracts";
import {
  type HarnessOpenedStore,
  type HarnessSqliteRow,
  type HarnessStoreOpener,
  openHarnessStoreReadOnly,
} from "./sqlite-loader.js";

export type OpencodeTranscriptOptions = {
  readonly opener: HarnessStoreOpener;
  readonly storePath: string;
  readonly onStatement?: (sql: string) => void;
  /** The reader's own storage bound, never the 512-character message bound. */
  readonly readCapChars?: number;
};

/** The closed absence the reader can answer. */
export type OpencodeTranscriptAbsence = "session-unknown" | "no-message" | "unreadable";

export type OpencodeTranscriptResult =
  | { readonly ok: true; readonly message: string; readonly recordedAt: string | null }
  | { readonly ok: false; readonly reason: OpencodeTranscriptAbsence };

/** The bounded statement texts, so a case can assert the read-only posture. */
export const TRANSCRIPT_STATEMENT_LIMIT = 20;

const textOf = (data: unknown): string | undefined => {
  if (typeof data !== "string") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const content = (parsed as { readonly content?: unknown }).content;
  const parts: string[] = [];
  if (typeof content === "string") parts.push(content);
  if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const entry = part as { readonly type?: unknown; readonly text?: unknown };
      if (entry.type === "text" && typeof entry.text === "string") parts.push(entry.text);
    }
  }
  return parts.length === 0 ? undefined : parts.join("\n");
};

const isoOf = (value: unknown): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Build the reader over the persisted store. */
export const createOpencodeTranscriptReader = (options: OpencodeTranscriptOptions) => {
  const cap = options.readCapChars ?? DISPATCH_TRANSCRIPT_READ_CAP_CHARS;

  const open = (): HarnessOpenedStore | { readonly ok: false } =>
    openHarnessStoreReadOnly(options.opener, options.storePath, options.onStatement);

  /** Whether the CURRENT generation's tables exist. */
  const hasCurrentTables = (opened: HarnessOpenedStore): boolean => {
    try {
      opened.handle.query("SELECT id FROM session_v2 LIMIT 1");
      return true;
    } catch {
      return false;
    }
  };

  return {
    read: (input: {
      readonly harnessKind: HarnessKind;
      readonly sessionId: string;
      readonly ref: string;
    }): OpencodeTranscriptResult => {
      if (input.harnessKind !== "opencode") return { ok: false, reason: "unreadable" };
      const opened = open();
      if (!opened.ok) return { ok: false, reason: "unreadable" };
      try {
        const current = hasCurrentTables(opened);
        const sessionSql = current
          ? "SELECT id, time_updated FROM session_v2 WHERE id = ? LIMIT 1"
          : "SELECT id, time_updated FROM session WHERE id = ? LIMIT 1";
        let session: HarnessSqliteRow | undefined;
        try {
          session = opened.handle.query(sessionSql, [input.sessionId])[0];
        } catch {
          return { ok: false, reason: "unreadable" };
        }
        if (session === undefined) return { ok: false, reason: "session-unknown" };

        const messageSql = current
          ? "SELECT data, time_created FROM session_message WHERE session_id = ? AND type = 'assistant' ORDER BY seq DESC LIMIT ?"
          : "SELECT data, time_created FROM message WHERE session_id = ? ORDER BY time_created DESC LIMIT ?";
        let rows: readonly HarnessSqliteRow[];
        try {
          rows = opened.handle.query(messageSql, [input.sessionId, TRANSCRIPT_STATEMENT_LIMIT]);
        } catch {
          return { ok: false, reason: "unreadable" };
        }
        for (const row of rows) {
          const text = textOf(row.data);
          if (text === undefined || text.length === 0) continue;
          const bounded = text.length > cap ? text.slice(0, cap) : text;
          return { ok: true, message: bounded, recordedAt: isoOf(row.time_created) };
        }
        return { ok: false, reason: "no-message" };
      } catch {
        return { ok: false, reason: "unreadable" };
      } finally {
        try {
          opened.handle.close();
        } catch {
          // A close fault changes nothing about the answer already decided.
        }
      }
    },
  };
};

/** The seam's declared shape, exported so the manifest can name one symbol. */
export type OpencodeTranscriptReader = ReturnType<typeof createOpencodeTranscriptReader>;
