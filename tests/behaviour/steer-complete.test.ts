/**
 * TC-STEER-040/041/042 — artifact-ref completion appends exactly one record for
 * a landed note, the first completion is authoritative, and every receipt-less
 * or artifact-less completion is refused before any write.
 */
import { describe, expect, test } from "bun:test";
import {
  CREATED,
  makeAppliedOutcome,
  makeCompletion,
  makeExpiredOutcome,
  makeMessage,
} from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";
import { NO_PHASE_RECORD } from "../fixtures/steer/phase-boundary";

const ARTIFACT = "doc/changes/2026-11/2026-11-16--GH-298--steer/chg-GH-298-plan.yaml";

const errorOf = (run: {
  readonly envelope?: Record<string, unknown>;
  readonly data?: Record<string, unknown>;
}): Record<string, unknown> => {
  const error = run.envelope?.error;
  if (typeof error !== "object" || error === null) throw new Error("no error payload");
  return error as Record<string, unknown>;
};

const seeded = (): ReturnType<typeof createSteerHarness> => {
  const harness = createSteerHarness({ phase: NO_PHASE_RECORD });
  const landed = makeMessage({ id: "msg-landed", created: CREATED });
  const queued = makeMessage({ id: "msg-queued", created: CREATED });
  const expired = makeMessage({ id: "msg-expired", created: CREATED });
  harness.seedMessage(landed);
  harness.seedMessage(queued);
  harness.seedMessage(expired);
  harness.seedOutcome(makeAppliedOutcome(landed));
  harness.seedOutcome(makeExpiredOutcome(expired));
  return harness;
};

describe("TC-STEER-040 completion appends one artifact-bearing record", () => {
  test("the landed note completes with its artifact and the evidence stays unchanged", async () => {
    const harness = seeded();
    try {
      const before = harness.ledgerBytes();
      const run = await harness.run(["complete", "msg-landed", "--ref", ARTIFACT]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.schemaVersion).toBe("delivery.steer.v1");
      expect(run.data?.record).toEqual({
        id: "msg-landed",
        lifecycle: "completed",
        completedAt: harness.now.iso,
        artifact: ARTIFACT,
      });
      const completions = harness.read().completions;
      expect(completions).toHaveLength(1);
      expect(completions[0]).toEqual(makeCompletion("msg-landed", ARTIFACT, harness.now.iso));
      const after = harness.ledgerBytes();
      expect(after.subarray(0, before.length).equals(before)).toBe(true);
      const list = await harness.run(["list"]);
      const landed = list.data?.landed;
      if (!Array.isArray(landed)) throw new Error("the list answer carries no landed group");
      const completed = (landed as readonly Record<string, unknown>[]).find(
        (row) => row.id === "msg-landed",
      );
      expect(completed?.completedWith).toBe(ARTIFACT);
      const receipt = completed?.receipt;
      expect(typeof receipt === "object" && receipt !== null).toBe(true);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-041 the first completion is authoritative", () => {
  test("a repeat completion is refused and the artifact is never replaced", async () => {
    const harness = seeded();
    try {
      expect((await harness.run(["complete", "msg-landed", "--ref", ARTIFACT])).exitCode).toBe(0);
      const before = harness.ledgerBytes();
      const repeat = await harness.run(["complete", "msg-landed", "--ref", "other.md"]);
      expect(repeat.exitCode).toBe(1);
      expect(errorOf(repeat).code).toBe("input.value.rejected");
      expect(errorOf(repeat).consequence).toBe("not_landed");
      expect(harness.ledgerBytes().equals(before)).toBe(true);
      expect(harness.read().completions[0]?.artifact).toBe(ARTIFACT);
      const identical = await harness.run(["complete", "msg-landed", "--ref", ARTIFACT]);
      expect(identical.exitCode).toBe(1);
      expect(harness.ledgerBytes().equals(before)).toBe(true);
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-042 receipt-less and artifact-less completions refuse before any write", () => {
  test("queued, expired, missing/empty/over-cap ref cells all refuse with zero writes", async () => {
    const harness = seeded();
    try {
      const before = harness.ledgerBytes();
      const cells: readonly (readonly string[])[] = [
        ["complete", "msg-queued", "--ref", ARTIFACT],
        ["complete", "msg-expired", "--ref", ARTIFACT],
        ["complete", "msg-landed"],
        ["complete", "msg-landed", "--ref", ""],
        ["complete", "msg-landed", "--ref", "x".repeat(161)],
      ];
      for (const argv of cells) {
        const run = await harness.run(argv);
        expect(run.exitCode, argv.join(" ")).toBe(1);
        expect(errorOf(run).code).toBe("input.value.rejected");
        expect(harness.ledgerBytes().equals(before)).toBe(true);
      }
      expect(harness.read().completions).toHaveLength(0);
      const twin = await harness.run(["complete", "msg-landed", "--ref", "x".repeat(160)]);
      expect(twin.exitCode).toBe(0);
      expect(harness.read().completions).toHaveLength(1);
    } finally {
      harness.cleanup();
    }
  });
});
