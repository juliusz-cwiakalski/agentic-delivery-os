/**
 * TC-QLC-005 (GH-292) — a live lease blocks removal until the delivered
 * `queue release` clears it; a removal never releases a lease on the caller's
 * behalf.
 */
import { describe, expect, test } from "bun:test";
import { REMOVAL_REF } from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

describe("TC-QLC-005 a live lease blocks removal until release", () => {
  test("the refusal names lease-held and the holder, appends nothing, and release clears it", async () => {
    const harness = createRemovalHarness("remove-lease");
    harness.seedEntry({ ref: REMOVAL_REF });
    harness.seedLease({ ref: REMOVAL_REF, holder: "lane-1" });
    const recordsBefore = harness.composition.store.readRecords();
    if (!recordsBefore.ok) throw new Error("read failed");
    const countBefore = recordsBefore.value.records.length;

    const refused = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(refused.exitCode).toBe(1);
    const error = errorOf(refused.stdout);
    expect(error.code).toBe("queue.precondition.unmet");
    expect(refused.stdout).toContain("lease-held");
    expect(refused.stdout).toContain("lane-1");
    // Zero appended records and the lease record is unchanged.
    const afterRefusal = harness.composition.store.readRecords();
    if (!afterRefusal.ok) throw new Error("read failed");
    expect(afterRefusal.value.records.length).toBe(countBefore);
    expect(harness.removalRecords()).toHaveLength(0);

    // The delivered release is the supported precondition-clearing verb.
    const released = await harness.run([
      "queue",
      "release",
      REMOVAL_REF,
      "--holder",
      "lane-1",
      "--json",
    ]);
    expect(released.exitCode).toBe(0);
    const afterRelease = harness.composition.store.readRecords();
    if (!afterRelease.ok) throw new Error("read failed");

    // The same removal now succeeds with exactly one new removal record and
    // no further lease append after the release.
    const applied = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(applied.exitCode).toBe(0);
    expect((json(applied.stdout).data as Record<string, unknown>).result).toBe("removed");
    expect(harness.removalRecords()).toHaveLength(1);
    const final = harness.composition.store.readRecords();
    if (!final.ok) throw new Error("read failed");
    const leaseKeys = final.value.records.filter((record) => record.kind === "queue.lease");
    expect(leaseKeys.at(-1)).toEqual(
      afterRelease.value.records.filter((record) => record.kind === "queue.lease").at(-1),
    );
  });

  test("a lease at or over its TTL is not live: the boundary is inclusive and removal succeeds", async () => {
    const harness = createRemovalHarness("remove-stale-lease");
    harness.seedEntry({ ref: REMOVAL_REF });
    harness.seedLease({ ref: REMOVAL_REF, holder: "lane-1" });
    const leaseRecords = () => {
      const read = harness.composition.store.readRecords();
      if (!read.ok) throw new Error("read failed");
      return read.value.records.filter((record) => record.kind === "queue.lease");
    };
    const leaseBefore = leaseRecords().at(-1);

    // One millisecond below the 90s TTL the lease is still live and refuses.
    harness.advance(89_999);
    const live = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(live.exitCode).toBe(1);
    expect(errorOf(live.stdout).code).toBe("queue.precondition.unmet");
    expect(harness.removalRecords()).toHaveLength(0);

    // At the TTL the lease is stale (inclusive bound): removal no longer refuses.
    harness.advance(1);
    const applied = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(applied.exitCode).toBe(0);
    expect((json(applied.stdout).data as Record<string, unknown>).result).toBe("removed");
    expect(harness.removalRecords()).toHaveLength(1);
    // A stale lease is not live, but it is still not released on the caller's behalf.
    const leaseAfter = leaseRecords().at(-1);
    expect(leaseAfter).toEqual(leaseBefore);
  });
});
