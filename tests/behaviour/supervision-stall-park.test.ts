/**
 * TC-SUP-040 / TC-SUP-043 / TC-SUP-047 — the supervised-stall park: the
 * classified cause, the mapped condition, a non-null re-entry instant, the
 * corroborating evidence, the safe-boundary intent over a held session, and
 * zero process effects (GH-295 AC-F5-1, DM-2, DEC-2, DEC-7, RSK-3).
 */
import { describe, expect, test } from "bun:test";
import {
  readQueueEntries,
  readQueueLeases,
  readQueueParks,
} from "../../packages/core/src/app/index";
import {
  QUEUE_PARK_RECHECK_DEFAULTS,
  SUPERVISION_MAX_EVIDENCE_BYTES,
} from "../../packages/core/src/contracts/index";
import { conditionTypeForCause } from "../../packages/core/src/domain/index";
import { createSupervisionHarness } from "../fixtures/supervise/harness";
import { LANE_REF, seedHeartbeat, seedLane, seedLiveLease } from "../fixtures/supervise/records";

describe("TC-SUP-040 the corroborated stall appends one liveness-stall park", () => {
  test("cause, mapped condition, until, recheck default, evidence, and no claim", async () => {
    const harness = createSupervisionHarness({ label: "stall-park" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
      const entriesBefore = readQueueEntries(harness.store);
      const leasesBefore = readQueueLeases(harness.store);
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const parks = readQueueParks(harness.store);
      if (!parks.ok) throw new Error("park read failed");
      expect(parks.records).toHaveLength(1);
      const park = parks.records[0];
      if (park === undefined) throw new Error("park missing");
      expect(park.cause).toBe("liveness-stall");
      expect(park.conditionType).toBe(conditionTypeForCause("liveness-stall"));
      expect(park.recheckMs).toBe(QUEUE_PARK_RECHECK_DEFAULTS["provider-window"]);
      const expectedUntil = new Date(
        harness.nowMs + QUEUE_PARK_RECHECK_DEFAULTS["provider-window"],
      ).toISOString();
      expect(park.until).toBe(expectedUntil);
      expect(Date.parse(park.until ?? "")).toBeGreaterThan(harness.nowMs);
      // The report counts the action with the same evidence.
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      const actions = data.actions as readonly Record<string, unknown>[];
      expect(actions).toHaveLength(1);
      expect(actions[0]?.kind).toBe("supervised-stall-park");
      expect(actions[0]?.ref).toBe(LANE_REF);
      expect((data.counts as Record<string, number>).parked).toBe(1);
      // The battery parks; it does not claim or mutate the queue entry.
      const entriesAfter = readQueueEntries(harness.store);
      const leasesAfter = readQueueLeases(harness.store);
      if (!entriesBefore.ok || !entriesAfter.ok || !leasesBefore.ok || !leasesAfter.ok) {
        throw new Error("ledger read failed");
      }
      expect(entriesAfter.records).toHaveLength(entriesBefore.records.length);
      expect(leasesAfter.records).toHaveLength(leasesBefore.records.length);
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-043 a held session records the safe-boundary intent", () => {
  test("the intent is durable, the lease is untouched, and nothing is signalled", async () => {
    const harness = createSupervisionHarness({ label: "stall-held" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
      seedLiveLease(harness.seed, { ref: LANE_REF, holder: "session-holder" });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      const actions = data.actions as readonly Record<string, unknown>[];
      expect(actions).toHaveLength(1);
      expect(actions[0]?.kind).toBe("safe-boundary-park-intent");
      const evidence = actions[0]?.evidence as readonly { code: string; ref?: string }[];
      expect(evidence.some((item) => item.code === "park-intent-recorded")).toBe(true);
      expect(evidence.some((item) => item.code === "holder-recorded")).toBe(true);
      // Durable: the park record exists and names the stall cause.
      const parks = readQueueParks(harness.store);
      if (!parks.ok) throw new Error("park read failed");
      expect(parks.records.map((park) => park.cause)).toEqual(["liveness-stall"]);
      // The live lease is untouched: the battery never releases or signals.
      const leases = readQueueLeases(harness.store);
      if (!leases.ok) throw new Error("lease read failed");
      expect(leases.records.at(-1)?.operation).toBe("acquired");
      const heldPark = parks.records[0];
      // The re-run at the same injected instant appends nothing and creates no
      // deferral state (the landed park refuses an identical second park).
      const second = await harness.runCli(["supervise", "--json"]);
      expect(second.exitCode).toBe(0);
      const parksAfter = readQueueParks(harness.store);
      if (!parksAfter.ok) throw new Error("park read failed");
      expect(parksAfter.records).toHaveLength(1);
      expect(
        ((JSON.parse(second.stdout) as { data?: { actions?: readonly unknown[] } }).data?.actions ??
          []) as readonly unknown[],
      ).toHaveLength(0);
      // The unheld twin lands the same operator-visible park outcome.
      const twin = createSupervisionHarness({ label: "stall-unheld" });
      try {
        seedLane(twin.seed, LANE_REF);
        seedHeartbeat(twin.seed, { ordinal: 1, offsetMs: -(300_000 + 1) });
        const twinRun = await twin.runCli(["supervise", "--json"]);
        expect(twinRun.exitCode).toBe(0);
        const twinParks = readQueueParks(twin.store);
        if (!twinParks.ok) throw new Error("twin park read failed");
        const twinPark = twinParks.records[0];
        expect(twinPark?.cause).toBe(heldPark?.cause);
        expect(twinPark?.conditionType).toBe(heldPark?.conditionType);
        expect(twinPark?.until).toBe(heldPark?.until);
        expect(twinPark?.recheckMs).toBe(heldPark?.recheckMs);
        expect(readQueueParks(twin.store).ok).toBe(true);
        expect(
          ((JSON.parse(twinRun.stdout) as { data?: { actions?: readonly unknown[] } }).data
            ?.actions ?? []) as readonly unknown[],
        ).toHaveLength(1);
      } finally {
        twin.remove();
      }
    } finally {
      harness.remove();
    }
  });
});

describe("TC-SUP-047 the park carries auditable corroborating evidence", () => {
  test("the evidence names the ref, heartbeat, artifact classes, bound, and stays bounded", async () => {
    const harness = createSupervisionHarness({ label: "stall-evidence" });
    try {
      seedLane(harness.seed, LANE_REF);
      seedHeartbeat(harness.seed, { ordinal: 1, offsetMs: -(300_000 + 5) });
      const run = await harness.runCli(["supervise", "--json"]);
      expect(run.exitCode).toBe(0);
      const data = (JSON.parse(run.stdout) as { data?: Record<string, unknown> }).data;
      if (data === undefined) throw new Error("report data missing");
      const action = (data.actions as readonly Record<string, unknown>[])[0];
      const evidence = (action?.evidence ?? []) as readonly Record<string, unknown>[];
      const codes = evidence.map((item) => item.code);
      expect(codes).toContain("artifact-heartbeat-aged");
      expect(codes).toContain("artifact-flat");
      expect(codes).toContain("bound-applied");
      expect(codes).toContain("park-applied");
      for (const item of evidence) {
        expect(typeof item.code).toBe("string");
      }
      // The evidence corpus respects the delivered byte cap and carries no free text.
      expect(new TextEncoder().encode(JSON.stringify(evidence)).length).toBeLessThanOrEqual(
        SUPERVISION_MAX_EVIDENCE_BYTES,
      );
      expect(JSON.stringify(evidence)).not.toContain("lock-");
      expect(readQueueParks(harness.store).ok).toBe(true);
    } finally {
      harness.remove();
    }
  });
});
