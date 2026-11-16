/**
 * TC-STEER-004 and TC-STEER-005 — value violations and grammar violations are
 * refused before any state read or write, with zero persisted bytes; every
 * at-cap twin is accepted.
 */
import { describe, expect, test } from "bun:test";
import { STEER_ERROR_CODES } from "../../packages/core/src/contracts/index";
import {
  grammarRefusalCells,
  makeMessage,
  valueAcceptingTwins,
  valueRefusalCells,
} from "../fixtures/steer/cases";
import { createSteerHarness, FIXED_NOW_ISO } from "../fixtures/steer/harness";

const readCalls = (calls: readonly string[]): number =>
  calls.filter((call) => call === "read" || call === "readRecords").length;

const appendCalls = (calls: readonly string[]): number =>
  calls.filter((call) => call === "append" || call === "acquireFence").length;

const errorOf = (run: {
  readonly envelope?: Record<string, unknown>;
  readonly data?: Record<string, unknown>;
}): Record<string, unknown> => {
  const error = run.envelope?.error ?? run.data?.error;
  if (typeof error !== "object" || error === null) throw new Error("no error payload");
  return error as Record<string, unknown>;
};

describe("TC-STEER-004 value violations refuse pre-read with zero persisted bytes", () => {
  for (const cell of valueRefusalCells()) {
    test(`${cell.label} is input.value.rejected with no read and no write`, async () => {
      const harness = createSteerHarness();
      try {
        harness.seedMessage(makeMessage({ id: "msg-existing", created: FIXED_NOW_ISO }));
        const before = harness.ledgerBytes();
        const run = await harness.run(cell.argv);
        expect(run.exitCode).toBe(1);
        const error = errorOf(run);
        expect(error.code).toBe("input.value.rejected");
        expect(error.category).toBe("user");
        expect(error.consequence).toBe("not_landed");
        expect(String(error.summary)).toContain(cell.field);
        expect(harness.read().messages).toHaveLength(1);
        expect(harness.ledgerBytes().equals(before)).toBe(true);
        expect(readCalls(harness.recorder.calls)).toBe(0);
        expect(appendCalls(harness.recorder.calls)).toBe(0);
      } finally {
        harness.cleanup();
      }
    });
  }

  for (const argv of valueAcceptingTwins()) {
    test(`the accepting twin ${argv.at(-1) ?? ""} is accepted`, async () => {
      const harness = createSteerHarness();
      try {
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(0);
        expect(harness.read().messages).toHaveLength(1);
      } finally {
        harness.cleanup();
      }
    });
  }

  test("a malformed ttl is never coerced to a neighbouring duration", async () => {
    const harness = createSteerHarness();
    try {
      for (const cell of ["24", "1.5h"]) {
        const run = await harness.run(["send", "note", "--ttl", cell]);
        expect(run.exitCode, cell).toBe(1);
        expect(errorOf(run).code).toBe("input.value.rejected");
      }
      expect(harness.read().messages).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-005 grammar violations refuse pre-read as fallback.invocation", () => {
  for (const argv of grammarRefusalCells()) {
    test(`steer ${argv.join(" ")} is fallback.invocation with no read and no write`, async () => {
      const harness = createSteerHarness();
      try {
        harness.seedMessage(makeMessage({ id: "msg-existing" }));
        const before = harness.ledgerBytes();
        const run = await harness.run(argv);
        expect(run.exitCode).toBe(1);
        const error = errorOf(run);
        expect(error.code).toBe("fallback.invocation");
        expect(STEER_ERROR_CODES as readonly string[]).not.toContain(error.code);
        expect(String(error.summary ?? "").length).toBeGreaterThan(0);
        expect(harness.ledgerBytes().equals(before)).toBe(true);
        expect(readCalls(harness.recorder.calls)).toBe(0);
        expect(appendCalls(harness.recorder.calls)).toBe(0);
      } finally {
        harness.cleanup();
      }
    });
  }

  test("the plain read form still answers after a grammar refusal", async () => {
    const harness = createSteerHarness();
    try {
      harness.seedMessage(makeMessage({ id: "msg-existing" }));
      const refused = await harness.run(["read", "msg-existing"]);
      expect(refused.exitCode).toBe(1);
      expect(errorOf(refused).code).toBe("fallback.invocation");
      const plain = await harness.run(["read"]);
      expect(plain.exitCode).toBe(0);
      const notes = plain.data?.notes;
      if (!Array.isArray(notes)) throw new Error("the read answer carries no notes");
      expect(notes).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});
