/**
 * GH-354 F-4 — `last-message` (TC-MSG-001..007, 009).
 *
 * Driver D1 over the composed program with the injected transcript seam. The
 * capability gate is the production one: the adapter declaration decides, so the
 * Claude Code gap is data, never a test-local branch.
 */
import { describe, expect, test } from "bun:test";
import { storeWithReadFailure } from "../../fixtures/dispatch/attempts-harness";
import { createOperatorHarness, OPERATOR_REF } from "../../fixtures/dispatch/operator/harness";
import { createTranscriptDouble } from "../../fixtures/dispatch/operator/transcript";
import { createGuardedRunner } from "../../fixtures/dispatch/parity/process-runner";

const FINAL = "I stopped at the merge gate; the PR is open and the gate needs your approval.";
const PARTIAL = "Working through the second phase; the gate";
const dataOf = (data: unknown) => data as Record<string, unknown>;

describe("TC-MSG the last-message read", () => {
  test("TC-MSG-001 a terminal lane answers the transcript's final assistant message with final=true", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-final": FINAL } });
    const h = createOperatorHarness({ label: "msg-001", transcriptRead: transcript.read });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "terminal",
        sessionId: "ses-final",
        harnessKind: "opencode",
        lastToken: "pr-open",
        lastOutcome: "completed",
      });
      for (const argv of [
        ["dispatch", "last-message", OPERATOR_REF],
        ["dispatch", "last-message", OPERATOR_REF, "--json"],
      ]) {
        const result = await h.run(argv);
        expect(result.exit).toBe(0);
        if (argv.includes("--json")) {
          const data = dataOf(result.data);
          expect(data.query).toBe("last-message");
          expect(data.available).toBe(true);
          expect(data.final).toBe(true);
          expect(data.message).toBe(FINAL);
          expect(data.truncated).toBe(false);
          expect(data.recordedAt).toBe("2026-11-19T00:00:00.000Z");
        } else {
          expect(result.stdout).toContain("available=true");
          expect(result.stdout).toContain("final=true");
          expect(result.stdout).toContain("last_message=");
        }
      }
      expect(transcript.calls).toHaveLength(2);
      expect(transcript.calls[0]).toMatchObject({
        harnessKind: "opencode",
        sessionId: "ses-final",
        ref: OPERATOR_REF,
        handedNoHandle: true,
      });
    } finally {
      h.dispose();
    }
  });

  test("TC-MSG-002 the answer is the assistant text, never the envelope's synthesized lastMessage", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-final": FINAL } });
    const h = createOperatorHarness({ label: "msg-002", transcriptRead: transcript.read });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "terminal",
        sessionId: "ses-final",
        harnessKind: "opencode",
      });
      const before = h.counters.readRecords;
      const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      const data = dataOf(result.data);
      expect(data.message).toBe(FINAL);
      // The only store read is the lane read: no attempt record was read.
      expect(h.counters.readRecords - before).toBe(1);
      // The delivered envelope's synthesized sentence never appears.
      expect(result.stdout).not.toContain("harness evidence unreadable");
      expect(result.stdout).not.toContain("the shared classifier");
    } finally {
      h.dispose();
    }
  });

  test("TC-MSG-003 an active lane answers its latest assistant text with final=false", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-live": PARTIAL } });
    const h = createOperatorHarness({ label: "msg-003", transcriptRead: transcript.read });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "active",
        sessionId: "ses-live",
        harnessKind: "opencode",
      });
      const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(result.exit).toBe(0);
      const data = dataOf(result.data);
      expect(data.available).toBe(true);
      expect(data.final).toBe(false);
      expect(data.message).toBe(PARTIAL);
      const human = await h.run(["dispatch", "last-message", OPERATOR_REF]);
      expect(human.stdout).toContain("final=false");
    } finally {
      h.dispose();
    }
  });

  test("TC-MSG-004 no lane answers no-lane at exit 1 with a null message", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-x": FINAL } });
    const h = createOperatorHarness({ label: "msg-004", transcriptRead: transcript.read });
    try {
      h.seedForeignLane(
        { ref: OPERATOR_REF, state: "terminal", sessionId: "ses-foreign" },
        "github.com/other/repo",
      );
      const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(result.exit).toBe(1);
      const data = dataOf(result.data);
      expect(data.available).toBe(false);
      expect(data.reason).toBe("no-lane");
      expect(data.message).toBeNull();
      expect(data.final).toBe(false);
      expect(data.truncated).toBe(false);
      expect(data.recordedAt).toBeNull();
      expect(transcript.calls).toHaveLength(0);
      expect(result.envelope?.error).toBeUndefined();
    } finally {
      h.dispose();
    }
  });

  test("TC-MSG-005 the closed ladder answers capability-gap, session-unknown, no-message and unreadable", async () => {
    // (a) A Claude lane whose harness declares the gap: the seam is never called.
    {
      const transcript = createTranscriptDouble({ messages: { "ses-claude": FINAL } });
      const h = createOperatorHarness({ label: "msg-005-claude", transcriptRead: transcript.read });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "terminal",
          sessionId: "ses-claude",
          harnessKind: "claude-code",
        });
        const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
        expect(result.exit).toBe(1);
        expect(dataOf(result.data).reason).toBe("capability-gap");
        expect(transcript.calls).toHaveLength(0);
        expect(result.envelope?.error).toBeUndefined();
      } finally {
        h.dispose();
      }
    }

    // (b) An opencode lane with an unknown session.
    {
      const transcript = createTranscriptDouble({ absence: "session-unknown" });
      const h = createOperatorHarness({
        label: "msg-005-unknown",
        transcriptRead: transcript.read,
      });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-gone" });
        const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
        expect(result.exit).toBe(1);
        expect(dataOf(result.data).reason).toBe("session-unknown");
        expect(dataOf(result.data).message).toBeNull();
      } finally {
        h.dispose();
      }
    }

    // (c) An opencode transcript holding no assistant message.
    {
      const transcript = createTranscriptDouble({ absence: "no-message" });
      const h = createOperatorHarness({ label: "msg-005-empty", transcriptRead: transcript.read });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-tools-only" });
        const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
        expect(result.exit).toBe(1);
        expect(dataOf(result.data).reason).toBe("no-message");
      } finally {
        h.dispose();
      }
    }

    // (d) An unreadable transcript read.
    {
      const transcript = createTranscriptDouble({ absence: "unreadable" });
      const h = createOperatorHarness({
        label: "msg-005-unreadable",
        transcriptRead: transcript.read,
      });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-corrupt" });
        const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
        expect(result.exit).toBe(1);
        expect(dataOf(result.data).reason).toBe("unreadable");
        expect(result.envelope?.error).toBeUndefined();
      } finally {
        h.dispose();
      }
    }

    // (e) The negative control: an opencode lane never answers capability-gap.
    {
      const transcript = createTranscriptDouble({ messages: { "ses-ok": FINAL } });
      const h = createOperatorHarness({
        label: "msg-005-control",
        transcriptRead: transcript.read,
      });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-ok" });
        const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
        expect(result.exit).toBe(0);
        expect(dataOf(result.data).available).toBe(true);
      } finally {
        h.dispose();
      }
    }
  });

  test("TC-MSG-006 an unreadable lane store refuses its typed identity instead of a closed reason", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-x": FINAL } });
    const h = createOperatorHarness({
      label: "msg-006",
      transcriptRead: transcript.read,
      wrap: (store) => storeWithReadFailure(store, "dispatch.lane", "state.store.torn"),
    });
    try {
      h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-x" });
      const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(result.exit).toBe(2);
      expect(result.errorCode).toBe("state.store.torn");
      expect(result.data).toBeUndefined();
      expect(transcript.calls).toHaveLength(0);
    } finally {
      h.dispose();
    }
  });

  test("TC-MSG-007 a message read performs zero session operations and starts zero processes", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-final": FINAL } });
    const guarded = createGuardedRunner();
    const h = createOperatorHarness({
      label: "msg-007",
      transcriptRead: transcript.read,
      guarded,
    });
    try {
      h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-final" });
      const success = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(success.exit).toBe(0);
      const absent = await h.run(["dispatch", "last-message", "GH-999", "--json"]);
      expect(absent.exit).toBe(1);
      expect(guarded.spawns).toBe(0);
      expect(guarded.resumes).toBe(0);
      expect(guarded.violations).toEqual([]);
      expect(transcript.calls).toHaveLength(1);
    } finally {
      h.dispose();
    }
  });

  test("TC-MSG-009 the ladder is ordered: an earlier rung wins when two conditions hold", async () => {
    // (a) capability-gap beats session-unknown for a Claude lane.
    {
      const transcript = createTranscriptDouble({ absence: "session-unknown" });
      const h = createOperatorHarness({ label: "msg-009-a", transcriptRead: transcript.read });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "terminal",
          sessionId: "ses-unknown-claude",
          harnessKind: "claude-code",
        });
        const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
        expect(dataOf(result.data).reason).toBe("capability-gap");
        expect(transcript.calls).toHaveLength(0);
      } finally {
        h.dispose();
      }
    }
    // (b) no-lane beats everything: no transcript call at all.
    {
      const transcript = createTranscriptDouble({ messages: { "ses-x": FINAL } });
      const h = createOperatorHarness({ label: "msg-009-b", transcriptRead: transcript.read });
      try {
        const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
        expect(dataOf(result.data).reason).toBe("no-lane");
        expect(transcript.calls).toHaveLength(0);
      } finally {
        h.dispose();
      }
    }
    // (c) session-unknown beats unreadable: the read is never attempted.
    {
      const transcript = createTranscriptDouble({ absence: "session-unknown" });
      const h = createOperatorHarness({ label: "msg-009-c", transcriptRead: transcript.read });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-both" });
        const result = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
        expect(dataOf(result.data).reason).toBe("session-unknown");
        expect(transcript.calls).toHaveLength(1);
      } finally {
        h.dispose();
      }
    }
  });
});
