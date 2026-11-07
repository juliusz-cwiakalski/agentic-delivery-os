/**
 * TC-LEASE-002 / TC-LEASE-004 (GH-237) — deterministic single-writer claim
 * interleaving: 50 distinct holders against one repository yield exactly one
 * acquisition and 49 lease conflicts; the same-holder control renews.
 */
import { describe, expect, test } from "bun:test";
import {
  declareQueueEntry,
  readActiveLeases,
} from "../../packages/core/src/app/index";
import { makeAuditStore } from "../fixtures/state/harness";
import {
  holders,
  inFenceReadPrecedesAppend,
  NOW_ISO,
  NOW_MS,
  recordingStore,
  REPO,
  runScheduledClaims,
} from "../fixtures/queue/leases/fence-harness";

const seeded = (label: string) => {
  const fixture = makeAuditStore(`queue-lease-${label}`);
  const declared = declareQueueEntry(fixture.store, {
    ref: "GH-320",
    repository: REPO,
    repositoryRoot: "/work/repo-alpha",
    priority: 1,
    recordedAt: NOW_ISO,
    fenceToken: "seed",
  });
  expect(declared.ok).toBe(true);
  return fixture;
};

describe("TC-LEASE-002 50 distinct holders acquire exactly one lease", () => {
  test("exactly 1 acquisition, 0 renewals, and 49 lease conflicts", () => {
    const { store } = seeded("concurrency");
    const recording = recordingStore(store);
    const results = runScheduledClaims(recording.store, {
      ref: "GH-320",
      holders: holders(50),
      repository: REPO,
    });
    const claimed = results.filter((entry) => entry.result.ok && entry.result.value.result === "claimed");
    const renewed = results.filter((entry) => entry.result.ok && entry.result.value.result === "renewed");
    const conflicts = results.filter(
      (entry) => !entry.result.ok && entry.result.kind === "queue" && entry.result.code === "queue.lease-conflict",
    );
    expect(claimed).toHaveLength(1);
    expect(renewed).toHaveLength(0);
    expect(conflicts).toHaveLength(49);
    expect(recording.appends()).toBe(1);
    expect(recording.leaseRecords()).toHaveLength(1);
    expect(recording.leaseRecords()[0]?.operation).toBe("acquired");
    expect(inFenceReadPrecedesAppend(recording.log)).toBe(true);
  });

  test("the active read shows exactly one holder after the drain", () => {
    const { store } = seeded("concurrency-read");
    runScheduledClaims(store, { ref: "GH-320", holders: holders(50), repository: REPO });
    const active = readActiveLeases(store, NOW_MS);
    expect(active.ok).toBe(true);
    if (active.ok) {
      expect(active.active).toHaveLength(1);
      expect(active.active[0]?.holder).toBe("holder-01");
      expect(active.records.filter((record) => record.operation === "acquired")).toHaveLength(1);
    }
  });

  test("the same-holder control renews rather than conflicting", () => {
    const { store } = seeded("renewal-control");
    const recording = recordingStore(store);
    const results = runScheduledClaims(recording.store, {
      ref: "GH-320",
      holders: ["holder-01", "holder-01"],
      repository: REPO,
    });
    expect(results[0]?.result.ok).toBe(true);
    if (results[0]?.result.ok) expect(results[0].result.value.result).toBe("claimed");
    expect(results[1]?.result.ok).toBe(true);
    if (results[1]?.result.ok) {
      expect(results[1].result.value.result).toBe("renewed");
      const first = results[0]?.result.ok ? results[0].result.value.lease : undefined;
      expect(results[1].result.value.lease.leaseId).toBe(first?.leaseId);
      expect(results[1].result.value.lease.holder).toBe("holder-01");
    }
  });
});
