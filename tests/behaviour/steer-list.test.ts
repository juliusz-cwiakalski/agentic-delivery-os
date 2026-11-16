/**
 * TC-STEER-023 and TC-STEER-025 — queued, landed, and expired render side by
 * side with receipts and reasons, and a completed note stays under landed with
 * `completedWith` instead of a fourth group.
 */
import { describe, expect, test } from "bun:test";
import {
  lifecycleMatrix,
  makeAppliedOutcome,
  makeCompletion,
  makeExpiredOutcome,
  makeMessage,
} from "../fixtures/steer/cases";
import { createSteerHarness } from "../fixtures/steer/harness";

const rows = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? (value as readonly Record<string, unknown>[]) : [];

const seedMatrix = (harness: ReturnType<typeof createSteerHarness>): void => {
  const matrix = lifecycleMatrix();
  for (const message of matrix.messages) harness.seedMessage(message);
  for (const outcome of matrix.outcomes) harness.seedOutcome(outcome);
  for (const completion of matrix.completions) harness.seedCompletion(completion);
};

describe("TC-STEER-023 the three lifecycle groups render side by side", () => {
  test("groups, receipts, reasons, ages, and ranks are all present", async () => {
    const harness = createSteerHarness();
    try {
      seedMatrix(harness);
      const run = await harness.run(["list"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.schemaVersion).toBe("delivery.steer.v1");
      expect(run.data?.omitted).toBe(0);
      expect(run.data?.truncated).toBe(false);
      expect(rows(run.data?.queued)).toHaveLength(1);
      expect(rows(run.data?.landed)).toHaveLength(2);
      expect(rows(run.data?.expired)).toHaveLength(1);
      const landed = rows(run.data?.landed);
      const completed = landed.find((row) => row.lifecycle === "completed");
      const open = landed.find((row) => row.lifecycle === "landed");
      expect(completed?.completedWith).toBe(
        "doc/changes/2026-11/2026-11-16--GH-298--steer/chg-GH-298-plan.yaml",
      );
      expect(open?.completedWith).toBeNull();
      for (const row of landed) {
        const receipt = row.receipt as Record<string, unknown> | undefined;
        expect(receipt?.origin).toBeDefined();
        expect(receipt?.readReceipt).toBeDefined();
        expect(receipt?.ttl).toBe(86_400_000);
      }
      const expired = rows(run.data?.expired)[0];
      expect((expired?.expiry as Record<string, unknown> | undefined)?.reason).toBe("ttl-elapsed");
      expect((expired?.expiry as Record<string, unknown> | undefined)?.recordedAt).toBeDefined();
      expect(expired?.receipt).toBeUndefined();
      for (const row of [...rows(run.data?.queued), ...landed, ...rows(run.data?.expired)]) {
        expect(typeof row.age).toBe("number");
        expect(typeof row.rank).toBe("number");
      }
      const human = await harness.run(["list"], { json: false });
      expect(human.stdout).toContain("queued");
      expect(human.stdout).toContain("landed");
      expect(human.stdout).toContain("expired");
    } finally {
      harness.cleanup();
    }
  });
});

describe("TC-STEER-025 a completed note stays under landed", () => {
  test("completion is a derived marker under landed, never a fourth group or a queued row", async () => {
    const harness = createSteerHarness();
    try {
      const landed = makeMessage({ id: "msg-landed" });
      const done = makeMessage({ id: "msg-done" });
      harness.seedMessage(landed);
      harness.seedMessage(done);
      harness.seedOutcome(makeAppliedOutcome(landed));
      harness.seedOutcome(makeAppliedOutcome(done));
      harness.seedCompletion(makeCompletion(done.id, "doc/proof.md"));
      const run = await harness.run(["list"]);
      expect(Object.keys(run.data ?? {}).sort()).toEqual([
        "expired",
        "landed",
        "omitted",
        "queued",
        "schemaVersion",
        "truncated",
      ]);
      const landedRows = rows(run.data?.landed);
      expect(landedRows).toHaveLength(2);
      const completed = landedRows.find((row) => row.id === "msg-done");
      expect(completed?.completedWith).toBe("doc/proof.md");
      expect(rows(run.data?.queued)).toHaveLength(0);
      expect(rows(run.data?.expired)).toHaveLength(0);
      // The completion is additive: the receipt is the landing receipt.
      expect(
        (completed?.receipt as Record<string, unknown> | undefined)?.readReceipt,
      ).toBeDefined();
    } finally {
      harness.cleanup();
    }
  });

  test("an expired row never carries completedWith", async () => {
    const harness = createSteerHarness();
    try {
      const expired = makeMessage({ id: "msg-expired" });
      harness.seedMessage(expired);
      harness.seedOutcome(makeExpiredOutcome(expired));
      const run = await harness.run(["list"]);
      const expiredRow = rows(run.data?.expired)[0];
      expect(expiredRow?.completedWith).toBeUndefined();
    } finally {
      harness.cleanup();
    }
  });
});
