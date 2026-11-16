/**
 * TC-STEER-050/051/052/053 — the registered-value guard refuses note text,
 * `--ref`, and derived origin values with zero persisted bytes, while an
 * unregistered token-shaped value passes (TDR-0012: no pattern layer).
 */
import { describe, expect, test } from "bun:test";
import { CREATED, makeAppliedOutcome, makeMessage } from "../fixtures/steer/cases";
import {
  BENIGN_REF,
  BENIGN_TEXT,
  REGISTERED_SENTINEL,
  UNREGISTERED_TOKEN_SHAPED,
} from "../fixtures/steer/credentials";
import { BOUND_ORIGIN, createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const errorOf = (run: { readonly envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const error = run.envelope?.error;
  if (typeof error !== "object" || error === null) throw new Error("no error payload");
  return error as Record<string, unknown>;
};

describe("TC-STEER-050 a registered secret in the note text is refused", () => {
  test("zero persisted bytes, the classified identity, and no leak in the payload", async () => {
    const harness = createSteerHarness({ secrets: [REGISTERED_SENTINEL] });
    try {
      const before = harness.ledgerBytes();
      const run = await harness.run(["send", `note with ${REGISTERED_SENTINEL} inside`]);
      expect(run.exitCode).toBe(1);
      expect(errorOf(run).code).toBe("steer.credential-value-rejected");
      expect(errorOf(run).category).toBe("user");
      expect(errorOf(run).consequence).toBe("not_landed");
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      expect(JSON.stringify(run.envelope)).not.toContain(REGISTERED_SENTINEL);
      const benign = await harness.run(["send", BENIGN_TEXT]);
      expect(benign.exitCode).toBe(0);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-051 a registered secret in --ref is refused on both subcommands", () => {
  test("send and complete refuse the ref path with zero persisted bytes and a benign continuation", async () => {
    const harness = createSteerHarness({ secrets: [REGISTERED_SENTINEL], phase: NO_PHASE_RECORD });
    try {
      const landed = makeMessage({ id: "msg-landed", created: CREATED });
      harness.seedMessage(landed);
      harness.seedOutcome(makeAppliedOutcome(landed));
      const before = harness.ledgerBytes();
      const send = await harness.run(["send", BENIGN_TEXT, "--ref", REGISTERED_SENTINEL]);
      expect(send.exitCode).toBe(1);
      expect(errorOf(send).code).toBe("steer.credential-value-rejected");
      const complete = await harness.run(["complete", "msg-landed", "--ref", REGISTERED_SENTINEL]);
      expect(complete.exitCode).toBe(1);
      expect(errorOf(complete).code).toBe("steer.credential-value-rejected");
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      expect(harness.read().completions).toHaveLength(0);
      expect(JSON.stringify(complete.envelope)).not.toContain(REGISTERED_SENTINEL);
      const benign = await harness.run(["complete", "msg-landed", "--ref", BENIGN_REF]);
      expect(benign.exitCode).toBe(0);
      expect(harness.read().completions).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-052 a registered secret in a derived origin value is refused", () => {
  test("the guard runs after derivation and before the append; a benign origin files", async () => {
    const derived = createSteerHarness({
      secrets: [REGISTERED_SENTINEL],
      origin: { change: "GH-298", repo: `example/${REGISTERED_SENTINEL}`, agent: "owner" },
    });
    try {
      const run = await derived.run(["send", BENIGN_TEXT]);
      expect(run.exitCode).toBe(1);
      expect(errorOf(run).code).toBe("steer.credential-value-rejected");
      expect(String(errorOf(run).summary)).toContain("origin.repo");
      expect(String(errorOf(run).summary)).not.toContain(REGISTERED_SENTINEL);
      expect(derived.read().messages).toHaveLength(0);
      expect(derived.recorder.calls.filter((call) => call === "append")).toHaveLength(0);
    } finally {
      derived.cleanup();
    }
    const benign = createSteerHarness({ secrets: [REGISTERED_SENTINEL], origin: BOUND_ORIGIN });
    try {
      expect((await benign.run(["send", BENIGN_TEXT])).exitCode).toBe(0);
      expect(benign.read().messages).toHaveLength(1);
    } finally {
      benign.cleanup();
    }
  });
});

describe("TC-STEER-053 unregistered token-shaped values pass and no payload leaks", () => {
  test("every unregistered token-shaped value is accepted in text and ref", async () => {
    const harness = createSteerHarness({ secrets: [REGISTERED_SENTINEL] });
    try {
      for (const value of UNREGISTERED_TOKEN_SHAPED) {
        const run = await harness.run(["send", `shape ${value}`, "--ref", value]);
        expect(run.exitCode, value).toBe(0);
      }
      const records = harness.read().messages;
      expect(records).toHaveLength(UNREGISTERED_TOKEN_SHAPED.length);
      for (const [index, value] of UNREGISTERED_TOKEN_SHAPED.entries()) {
        expect(records[index]?.subject).toBe(`shape ${value}`);
        expect(records[index]?.ref).toBe(value);
      }
      const refused = await harness.run(["send", `shape ${REGISTERED_SENTINEL}`]);
      expect(refused.exitCode).toBe(1);
      expect(JSON.stringify(refused.envelope)).not.toContain(REGISTERED_SENTINEL);
    } finally {
      harness.cleanup();
    }
  });
});
