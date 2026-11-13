/**
 * TC-QLC-006 (GH-292) — an active park is withdrawn with the delivered
 * `released` recovery record before the removal record; the park pass and the
 * lane projection stop seeing the ref; no park vocabulary moves.
 */
import { describe, expect, test } from "bun:test";
import { readQueueParks } from "../../packages/core/src/app/queue";
import { QUEUE_PARK_CAUSES, QUEUE_PARK_RECORD_KIND } from "../../packages/core/src/contracts/index";
import { REMOVAL_REF } from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-006 an active park is withdrawn before the removal", () => {
  test("the ledger order is park history, then released, then the removal", async () => {
    const harness = createRemovalHarness("remove-park");
    harness.seedEntry({ ref: REMOVAL_REF });
    harness.seedPark({ ref: REMOVAL_REF });
    const before = harness.composition.store.readRecords();
    if (!before.ok) throw new Error("read failed");
    const parkKeysBefore = before.value.records
      .filter((record) => record.kind === QUEUE_PARK_RECORD_KIND)
      .map((record) => record.payload);

    const run = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(run.exitCode).toBe(0);
    expect((json(run.stdout).data as Record<string, unknown>).result).toBe("removed");

    const after = harness.composition.store.readRecords();
    if (!after.ok) throw new Error("read failed");
    const records = after.value.records;
    const lastParkIndex = records.reduce(
      (last, record, index) => (record.kind === QUEUE_PARK_RECORD_KIND ? index : last),
      -1,
    );
    const removalIndex = records.findIndex((record) => record.kind === "queue.removal");
    expect(removalIndex).toBeGreaterThan(lastParkIndex);
    expect(lastParkIndex).toBeGreaterThanOrEqual(0);

    // The withdrawal is the delivered released record; the earlier park bytes
    // are unchanged.
    const parks = readQueueParks(harness.composition.store);
    if (!parks.ok) throw new Error("park read failed");
    const states = parks.records.map((park) => park.recoveryState);
    expect(states).toContain("released");
    const priorPayloads = records
      .filter((record) => record.kind === QUEUE_PARK_RECORD_KIND)
      .map((record) => record.payload)
      .slice(0, parkKeysBefore.length);
    expect(priorPayloads).toEqual(parkKeysBefore);
    // The withdrawn park keeps the delivered cause vocabulary.
    const causes = parks.records.map((park) => park.cause);
    for (const cause of causes) expect(QUEUE_PARK_CAUSES).toContain(cause);

    // The park pass and the lane projection stop seeing the ref: the entry is
    // gone and no ACTIVE park remains (the released record is terminal
    // history the delivered parks projection may still list).
    const lanes = await harness.run(["lanes", "list", "--json"]);
    expect(lanes.exitCode).toBe(0);
    expect(lanes.stdout).not.toContain(REMOVAL_REF);
    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.exitCode).toBe(0);
    const listData = json(list.stdout).data as {
      entries: readonly { ref: string }[];
      parks: readonly { ref: string; recoveryState: string }[];
    };
    expect(listData.entries.some((entry) => entry.ref === REMOVAL_REF)).toBe(false);
    for (const park of listData.parks) {
      if (park.ref === REMOVAL_REF) expect(park.recoveryState).toBe("released");
    }
    // Exactly one removal record was appended.
    expect(harness.removalRecords()).toHaveLength(1);
  });
});
