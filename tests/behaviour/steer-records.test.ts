/**
 * TC-STEER-006 — filing appends exactly one immutable record per note, ids are
 * unique per store, a collision fails closed, and nothing derived is stored.
 */
import { describe, expect, test } from "bun:test";
import { makeMessage } from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";

describe("TC-STEER-006 write minimality and per-store identity", () => {
  test("one filing adds exactly one record and never rewrites an existing one", async () => {
    const harness = createSteerHarness();
    try {
      expect((await harness.run(["send", "first note"])).exitCode).toBe(0);
      const before = harness.ledgerBytes();
      expect((await harness.run(["send", "second note"])).exitCode).toBe(0);
      const after = harness.ledgerBytes();
      expect(harness.read().messages).toHaveLength(2);
      expect(harness.read().recordCount).toBe(2);
      // Append-only: every pre-existing byte is preserved as a prefix.
      expect(after.subarray(0, before.length).equals(before)).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("100 filings produce 100 distinct msg- ids with no stored derived field", async () => {
    const harness = createSteerHarness();
    try {
      for (let index = 0; index < 100; index += 1) {
        const run = await harness.run(["send", `note ${String(index)}`]);
        expect(run.exitCode).toBe(0);
      }
      const messages = harness.read().messages;
      expect(messages).toHaveLength(100);
      expect(new Set(messages.map((message) => message.id)).size).toBe(100);
      for (const message of messages) {
        expect(message.id.startsWith("msg-")).toBe(true);
        expect(Object.hasOwn(message, "rank")).toBe(false);
        expect(Object.hasOwn(message, "age")).toBe(false);
        expect(Object.hasOwn(message, "lifecycle")).toBe(false);
      }
    } finally {
      harness.cleanup();
    }
  });

  test("a forced id collision fails closed instead of overwriting", async () => {
    const harness = createSteerHarness({ newMessageSuffix: () => "same" });
    try {
      expect((await harness.run(["send", "first"])).exitCode).toBe(0);
      const before = harness.ledgerBytes();
      const collision = await harness.run(["send", "second"]);
      expect(collision.exitCode).toBe(2);
      expect(harness.read().messages).toHaveLength(1);
      expect(harness.ledgerBytes().equals(before)).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("the same text filed twice appends two independently addressable records", async () => {
    const harness = createSteerHarness();
    try {
      expect((await harness.run(["send", "same text"])).exitCode).toBe(0);
      expect((await harness.run(["send", "same text"])).exitCode).toBe(0);
      const messages = harness.read().messages;
      expect(messages).toHaveLength(2);
      expect(messages[0]?.id).not.toBe(messages[1]?.id);
      expect(messages[0]?.subject).toBe("same text");
      expect(messages[1]?.subject).toBe("same text");
    } finally {
      harness.cleanup();
    }
  });

  test("a pre-existing record is served unchanged by the projection", () => {
    const harness = createSteerHarness();
    try {
      const record = makeMessage({ id: "msg-seeded" });
      harness.seedMessage(record);
      expect(harness.read().messages[0]).toEqual(record);
    } finally {
      harness.cleanup();
    }
  });
});
