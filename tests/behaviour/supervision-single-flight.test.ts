/**
 * TC-SUP-052 — a per-ref double-claim is refused through the delivered
 * single-flight identity with the holder named; zero claim/lease appends
 * (GH-295 AC-F6-1, DEC-8). The delivered tested helper produces the refusal, so
 * a parallel predicate would fail the case.
 */
import { describe, expect, test } from "bun:test";
import {
  claimSingleFlightRefusal,
  readQueueLeases,
  readQueueParks,
} from "../../packages/core/src/app/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import { LANE_REF, seedLiveLease, stalledAndParked } from "../fixtures/supervise/records";

describe("TC-SUP-052 the per-ref double-claim reuses queue.single-flight", () => {
  test("the refusal names holder-a, lands nothing, and leaves the lease untouched", async () => {
    const harness = createSupervisionHarness({ label: "single-flight" });
    try {
      // A lane already parked by the supervised-stall cause, so no park intent
      // is pending; the restart admission is the claiming action.
      stalledAndParked(harness.seed);
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "holder-a" });
      const leasesBefore = readQueueLeases(harness.store);
      const run = await harness.runCli(["supervise", "--json"], {
        claimRefusal: (ref) => {
          const refusal = claimSingleFlightRefusal(harness.store, {
            ref,
            holder: "supervise",
            nowMs: harness.nowMs,
          });
          return refusal === undefined
            ? undefined
            : {
                code: "queue.single-flight",
                ...(refusal.holder === undefined ? {} : { holder: refusal.holder }),
              };
        },
        admitRestart: () => ({ outcome: "admit", restarts: 0 }),
      });
      expect(run.exitCode).toBe(1);
      const envelope = JSON.parse(run.stdout) as {
        error?: { code: string; summary?: string };
        data?: unknown;
      };
      expect(envelope.data).toBeUndefined();
      expect(envelope.error?.code).toBe("queue.single-flight");
      expect(envelope.error?.summary ?? "").toContain("holder-a");
      // Zero new lease records; the existing lease is untouched.
      const leasesAfter = readQueueLeases(harness.store);
      if (!leasesBefore.ok || !leasesAfter.ok) throw new Error("lease read failed");
      expect(leasesAfter.records).toHaveLength(leasesBefore.records.length);
      expect(leasesAfter.records.at(-1)?.holder).toBe("holder-a");
      const records = harness.store.readRecords();
      if (!records.ok) throw new Error("ledger read failed");
      expect(
        records.value.records.filter((record) => record.kind === "economics.restart"),
      ).toHaveLength(0);
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-052 the snapshot path answers by default", () => {
  test("the battery refuses from the fold snapshot without a second store read", () => {
    const harness = createSupervisionHarness({ label: "single-flight-snapshot" });
    try {
      stalledAndParked(harness.seed);
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "holder-a" });
      const result = harness.battery();
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("queue.single-flight");
      expect(result.summary).toContain("holder-a");
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});
