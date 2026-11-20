/**
 * GH-354 F-4 — the message composition order (TC-MSG-008).
 *
 * The expectation is computed by the production composition function itself, and
 * the case then asserts the composed program's answer is EQUIVALENT to it: the
 * delivered `composeDispatchMessage` is the one composition both sides use, so a
 * divergence is the wiring, never an expectation. A fixture-local scrub is never
 * used.
 */
import { describe, expect, test } from "bun:test";
import { composeDispatchMessage } from "../../packages/core/src/domain/dispatch-message";
import { createOperatorHarness, OPERATOR_REF } from "../fixtures/dispatch/operator/harness";
import { createTranscriptDouble } from "../fixtures/dispatch/operator/transcript";

const CREDENTIAL = `ghp_${"a".repeat(36)}`;
const dataOf = (data: unknown) => data as Record<string, unknown>;

describe("TC-MSG the message composition order", () => {
  test("TC-MSG-008 composition is redact -> flatten -> bound -> mark", async () => {
    // The credential straddles the 512-character cut: 490 prose chars, then the
    // credential, then 200 more, with embedded line breaks and a tab.
    const straddling = `${"p".repeat(490)}${CREDENTIAL}\nstill\tgoing ${"q".repeat(200)}`;
    const transcript = createTranscriptDouble({ messages: { "ses-secret": straddling } });
    const registered = createOperatorHarness({
      label: "msg-008-registered",
      transcriptRead: transcript.read,
      secrets: [CREDENTIAL],
    });
    const unregistered = createOperatorHarness({
      label: "msg-008-unregistered",
      transcriptRead: transcript.read,
      secrets: [],
    });
    try {
      for (const h of [registered, unregistered]) {
        h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-secret" });
      }

      // The expectation, computed by the production composition function; the
      // case asserts equivalence with the composed program's answer.
      const expected = composeDispatchMessage({
        text: straddling,
        secrets: [CREDENTIAL],
      });

      const result = await registered.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(result.exit).toBe(0);
      const data = dataOf(result.data);
      const message = data.message as string;
      expect(message).toBe(expected.message);
      expect(message.length).toBeLessThanOrEqual(512);
      expect(message).not.toContain("\n");
      expect(message).not.toContain("\t");
      // The credential never survives: not whole, not as a prefix.
      expect(message).not.toContain(CREDENTIAL);
      expect(message).not.toContain(CREDENTIAL.slice(0, 12));
      expect(data.truncated).toBe(expected.truncated);

      // Bound-before-redact would have disclosed a prefix; the delivered order
      // is observable by the removed credential and the post-redaction length.
      const naive = straddling.slice(0, 512);
      expect(naive).toContain(CREDENTIAL.slice(0, 8));
      expect(message).not.toContain(CREDENTIAL.slice(0, 8));

      // With the credential NOT registered, the same text is composed without
      // replacement — proving the redaction used the injected set.
      const unregisteredResult = await unregistered.run([
        "dispatch",
        "last-message",
        OPERATOR_REF,
        "--json",
      ]);
      const unregisteredMessage = dataOf(unregisteredResult.data).message as string;
      expect(unregisteredMessage).toBe(straddling.slice(0, 512));
      expect(unregisteredMessage).toContain(CREDENTIAL.slice(0, 8));

      // The 600-character, credential-free fixture: bound to exactly 512.
      const long = "L".repeat(600);
      const longTranscript = createTranscriptDouble({ messages: { "ses-long": long } });
      const longHarness = createOperatorHarness({
        label: "msg-008-long",
        transcriptRead: longTranscript.read,
        secrets: [CREDENTIAL],
      });
      try {
        longHarness.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-long" });
        const longResult = await longHarness.run([
          "dispatch",
          "last-message",
          OPERATOR_REF,
          "--json",
        ]);
        const longData = dataOf(longResult.data);
        expect((longData.message as string).length).toBe(512);
        expect(longData.truncated).toBe(true);
      } finally {
        longHarness.dispose();
      }

      // The 400-character fixture with an in-bound credential: replaced, not cut.
      const inBound = `${"c".repeat(100)}${CREDENTIAL}${"d".repeat(260)}`;
      const inBoundTranscript = createTranscriptDouble({ messages: { "ses-in": inBound } });
      const inBoundHarness = createOperatorHarness({
        label: "msg-008-inbound",
        transcriptRead: inBoundTranscript.read,
        secrets: [CREDENTIAL],
      });
      try {
        inBoundHarness.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-in" });
        const inResult = await inBoundHarness.run([
          "dispatch",
          "last-message",
          OPERATOR_REF,
          "--json",
        ]);
        const inData = dataOf(inResult.data);
        expect(inData.truncated).toBe(false);
        expect(inData.message as string).toContain("[redacted]");
        expect(inData.message as string).not.toContain(CREDENTIAL);
      } finally {
        inBoundHarness.dispose();
      }
    } finally {
      registered.dispose();
      unregistered.dispose();
    }
  });
});
