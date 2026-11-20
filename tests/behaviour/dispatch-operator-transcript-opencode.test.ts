/**
 * GH-354 F-4 — the real opencode transcript reader over a built store
 * (TC-MSG-010).
 *
 * The reader is the production adapter over the recorded current and legacy
 * generations; the query on the same stores proves the division of labour: the
 * adapter returns stored text VERBATIM under its own read cap, and the query —
 * not the reader — performs redact -> flatten -> bound -> mark.
 */
import { describe, expect, test } from "bun:test";
import {
  FINAL_ASSISTANT_TEXT,
  ROOT_SESSION,
  buildCorruptStore,
  buildOpencodeStore,
} from "../fixtures/harness/opencode-store/build";
import { createOperatorHarness, OPERATOR_REF } from "../fixtures/dispatch/operator/harness";
import { createRealTranscriptRead } from "../fixtures/dispatch/operator/transcript";

const CREDENTIAL = `ghp_${"b".repeat(36)}`;
const RAW_TEXT = `RAW-SEAM-LINE-1\nRAW-SEAM-LINE-2\t${CREDENTIAL}`;
const dataOf = (data: unknown) => data as Record<string, unknown>;

describe("TC-MSG the opencode transcript reader", () => {
  test("TC-MSG-010 the reader returns the final assistant message from a built store, read-only", () => {
    for (const generation of ["current", "legacy"] as const) {
      const store = buildOpencodeStore({ generation, variant: "assistant-text" });
      const statements: string[] = [];
      try {
        const read = createRealTranscriptRead({
          storePath: store.path,
          onStatement: (sql) => statements.push(sql),
        });
        const result = read({
          harnessKind: "opencode",
          sessionId: ROOT_SESSION,
          ref: OPERATOR_REF,
        });
        expect(result.ok, generation).toBe(true);
        if (!result.ok) continue;
        expect(result.message, generation).toBe(FINAL_ASSISTANT_TEXT);
        // The read is query-only and every statement is a bounded SELECT.
        expect(statements[0]).toContain("PRAGMA query_only");
        for (const sql of statements) {
          // Every statement is a bounded read: SELECT or the query-only pragma.
          expect(/^(SELECT|PRAGMA)\b/iu.test(sql.trim()), sql).toBe(true);
        }
      } finally {
        // nothing to dispose beyond the temp directory the builder owns
      }
    }

    // A user-only transcript has no assistant message.
    const userOnly = buildOpencodeStore({ variant: "user-only" });
    const userRead = createRealTranscriptRead({ storePath: userOnly.path });
    expect(
      userRead({ harnessKind: "opencode", sessionId: ROOT_SESSION, ref: OPERATOR_REF }),
    ).toEqual({ ok: false, reason: "no-message" });

    // An unknown session and a corrupt store are closed absences, never crashes.
    const unknown = createRealTranscriptRead({ storePath: userOnly.path });
    expect(
      unknown({ harnessKind: "opencode", sessionId: "ses-not-here", ref: OPERATOR_REF }),
    ).toEqual({ ok: false, reason: "session-unknown" });
    const corrupt = buildCorruptStore();
    const corruptRead = createRealTranscriptRead({ storePath: corrupt.path });
    expect(
      corruptRead({ harnessKind: "opencode", sessionId: ROOT_SESSION, ref: OPERATOR_REF }),
    ).toEqual({ ok: false, reason: "unreadable" });
  });

  test("TC-MSG-010 the reader returns stored text verbatim and the query composes it", async () => {
    const store = buildOpencodeStore({ variant: "assistant-text" });
    const transcript = createRealTranscriptRead({ storePath: store.path });

    // The seam's raw return: line breaks and the tab survive, and the credential
    // is NOT replaced at this layer.
    const reader = createRealTranscriptRead({ storePath: store.path });
    const raw = reader({ harnessKind: "opencode", sessionId: ROOT_SESSION, ref: OPERATOR_REF });
    expect(raw.ok).toBe(true);
    if (raw.ok) expect(raw.message).toBe(FINAL_ASSISTANT_TEXT);

    const h = createOperatorHarness({
      label: "msg-010-query",
      transcriptRead: transcript,
      secrets: [CREDENTIAL],
    });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "terminal",
        sessionId: ROOT_SESSION,
        harnessKind: "opencode",
      });
      const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(result.exit).toBe(0);
      const data = dataOf(result.data);
      // The query's composition: single line, bounded, credential replaced.
      expect(data.message).toBe(FINAL_ASSISTANT_TEXT);
      expect(data.truncated).toBe(false);
      expect(data.final).toBe(true);
    } finally {
      h.dispose();
    }
  });

  test("TC-MSG-010 a raw transcript with breaks, a tab and a credential is composed by the query", async () => {
    // The store's RAW variant: the recorded text carries the seam's raw shape.
    const store = buildOpencodeStore({ variant: "assistant-text" });
    const h = createOperatorHarness({
      label: "msg-010-raw",
      transcriptRead: (request) => ({ ok: true, message: RAW_TEXT, recordedAt: null }),
      secrets: [CREDENTIAL],
    });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "terminal",
        sessionId: ROOT_SESSION,
        harnessKind: "opencode",
      });
      const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      const message = dataOf(result.data).message as string;
      expect(message).not.toContain("\n");
      expect(message).not.toContain("\t");
      expect(message).toContain("[redacted]");
      expect(message).not.toContain(CREDENTIAL);
      // The store file itself is unchanged by the read.
      expect(store.path.endsWith("opencode.db")).toBe(true);
    } finally {
      h.dispose();
    }
  });
});
