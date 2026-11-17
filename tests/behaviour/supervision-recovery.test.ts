/**
 * TC-SUP-044 — a parked stall lane recovers only through the delivered
 * classification: no second park while the active park stands, no restart
 * outside the delivered admission, no silent requeue (GH-295 AC-F5-1, AC-F7-1,
 * NG-7).
 */
import { describe, expect, test } from "bun:test";
import { readQueueLeases, readQueueParks } from "../../packages/core/src/app/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import { stalledAndParked } from "../fixtures/supervise/records";

describe("TC-SUP-044 a parked stall lane recovers only through the delivered path", () => {
  test("a run inside the park's re-entry horizon appends nothing and burns no budget", async () => {
    const harness = createSupervisionHarness({ label: "reentry-horizon" });
    try {
      stalledAndParked(harness.seed, { untilOffsetMs: 60_000 });
      let admissionCalls = 0;
      const run = await harness.runCli(["supervise", "--json"], {
        admitRestart: () => {
          admissionCalls += 1;
          return { outcome: "admit", restarts: 0 };
        },
      });
      expect(run.exitCode).toBe(0);
      expect(admissionCalls).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      expect(data?.actions).toEqual([]);
      const records = harness.store.readRecords();
      if (!records.ok) throw new Error("ledger read failed");
      expect(
        records.value.records.filter((record) => record.kind === "economics.restart"),
      ).toHaveLength(0);
      const parks = readQueueParks(harness.store);
      if (!parks.ok) throw new Error("park read failed");
      expect(parks.records).toHaveLength(1);
    } finally {
      harness.remove();
    }
  });

  test("a second run appends no second park and restarts nothing outside admission", async () => {
    const harness = createSupervisionHarness({ label: "recovery" });
    try {
      stalledAndParked(harness.seed);
      const first = await harness.runCli(["supervise", "--json"]);
      expect(first.exitCode).toBe(0);
      const parksAfterFirst = readQueueParks(harness.store);
      if (!parksAfterFirst.ok) throw new Error("park read failed");
      expect(parksAfterFirst.records).toHaveLength(1);
      const second = await harness.runCli(["supervise", "--json"]);
      expect(second.exitCode).toBe(0);
      const parksAfterSecond = readQueueParks(harness.store);
      if (!parksAfterSecond.ok) throw new Error("park read failed");
      expect(parksAfterSecond.records).toHaveLength(1);
      const data = (JSON.parse(second.stdout) as { data?: Record<string, unknown> }).data;
      expect(data?.actions).toEqual([]);
      // No lease is created, no queue entry is reopened, and no session starts.
      const leases = readQueueLeases(harness.store);
      if (!leases.ok) throw new Error("lease read failed");
      expect(leases.records.filter((lease) => lease.operation === "acquired")).toHaveLength(1);
      const records = harness.store.readRecords();
      if (!records.ok) throw new Error("ledger read failed");
      const kinds = records.value.records.map((record) => record.kind);
      expect(kinds).not.toContain("economics.restart");
      expect(kinds).not.toContain("dispatch.attempt");
    } finally {
      harness.remove();
    }
  });
});
