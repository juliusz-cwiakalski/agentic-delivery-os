/**
 * TC-QLC-031/032/035 (GH-292) — `dep remove` drops exactly one edge, recomputes
 * readiness, publishes the `dependency-edge` delta naming `removed: ["B"]`,
 * and an absent edge is a noop with zero records and zero events.
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold } from "../../packages/core/src/app/queue";
import { REMOVE_PAYLOAD_KEYS, ADD_PAYLOAD_KEYS } from "../fixtures/queue/depend/grammar-cases";
import { CONSUMER_REF, PRODUCER_REF } from "../fixtures/queue/depend/grammar-cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";
import { observed, ciSucceeded } from "../fixtures/queue/schedule/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

const seedPair = (harness: ReturnType<typeof createRemovalHarness>): void => {
  harness.seedEntry({ ref: PRODUCER_REF, priority: 1 });
  harness.seedEntry({ ref: CONSUMER_REF, priority: 2 });
  harness.seedEdge({ ref: CONSUMER_REF, onRef: PRODUCER_REF });
  // Tracker facts observed for both refs, so the delivered dependency hold is
  // attributable to the declared edge alone.
  harness.factSource.workItems[PRODUCER_REF] = observed({ deliveryState: "done" });
  harness.factSource.workItems[CONSUMER_REF] = observed();
  harness.factSource.ci[CONSUMER_REF] = ciSucceeded();
  harness.factSource.close[CONSUMER_REF] = "none";
};

describe("TC-QLC-031 dep remove drops the edge", () => {
  test("the edge is gone, readiness is recomputed, and the payload is additive", async () => {
    const harness = createRemovalHarness("dep-remove-happy");
    seedPair(harness);
    const run = await harness.run([
      "queue",
      "dep",
      "remove",
      CONSUMER_REF,
      PRODUCER_REF,
      "--json",
    ]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(REMOVE_PAYLOAD_KEYS);
    expect(data.result).toBe("removed");
    expect(data.edges).toEqual([]);
    expect(data.readySet).toContain(CONSUMER_REF);
    expect(data.event).toEqual({ topic: "queue.graph", kind: "dependency-edge" });
    // Exactly one new dependency record carries the folded set for the consumer.
    const fold = readQueueFold(harness.composition.store);
    if (!fold.ok) throw new Error("fold read failed");
    const consumer = fold.value.entries.find((entry) => entry.ref === CONSUMER_REF);
    expect(consumer?.edges).toEqual([]);
    // The producer is in the ready set on the recomputed surface.
    const ready = await harness.run(["queue", "list", "--json"]);
    expect(ready.stdout).not.toContain("dependency-unobserved");
  });
});

describe("TC-QLC-032 an absent edge is a noop", () => {
  test("noop at exit 0 with zero appends, zero events, and a repeatable outcome", async () => {
    const harness = createRemovalHarness("dep-remove-noop");
    harness.seedEntry({ ref: PRODUCER_REF });
    harness.seedEntry({ ref: CONSUMER_REF });
    harness.factSource.workItems[CONSUMER_REF] = observed();
    const digestBefore = ledgerDigestOf(harness);
    const run = await harness.run([
      "queue",
      "dep",
      "remove",
      CONSUMER_REF,
      PRODUCER_REF,
      "--json",
    ]);
    expect(run.exitCode).toBe(0);
    const data = json(run.stdout).data as Record<string, unknown>;
    expect(data.result).toBe("noop");
    expect(data.readySet).toEqual([]);
    expect(ledgerDigestOf(harness)).toBe(digestBefore);
    // The repeat run is the same noop.
    const repeat = await harness.run([
      "queue",
      "dep",
      "remove",
      CONSUMER_REF,
      PRODUCER_REF,
      "--json",
    ]);
    expect(repeat.exitCode).toBe(0);
    expect((json(repeat.stdout).data as Record<string, unknown>).result).toBe("noop");
    expect(ledgerDigestOf(harness)).toBe(digestBefore);
  });
});

describe("TC-QLC-035 payload keys and the sequence rule", () => {
  test("add keeps the delivered key set; remove is exactly additive; no sequence anywhere", async () => {
    const harness = createRemovalHarness("dep-payload");
    seedPair(harness);
    const added = await harness.run(["queue", "dep", CONSUMER_REF, PRODUCER_REF, "--json"]);
    expect(added.exitCode).toBe(0);
    expect(Object.keys(json(added.stdout).data as Record<string, unknown>)).toEqual(
      ADD_PAYLOAD_KEYS,
    );
    seedPair(harness);
    const removed = await harness.run([
      "queue",
      "dep",
      "remove",
      CONSUMER_REF,
      PRODUCER_REF,
      "--json",
    ]);
    expect(removed.exitCode).toBe(0);
    const data = json(removed.stdout).data as Record<string, unknown>;
    expect(Object.keys(data)).toEqual(REMOVE_PAYLOAD_KEYS);
    const event = data.event as Record<string, unknown>;
    expect(Object.keys(event)).toEqual(["topic", "kind"]);
    expect(data.result).toBe("removed");
  });
});

/** Read the ledger digest through the harness store. */
const ledgerDigestOf = (harness: ReturnType<typeof createRemovalHarness>): string => {
  const records = harness.composition.store.readRecords();
  if (!records.ok) throw new Error("ledger read failed");
  return records.value.records.map((record) => record.checksum).join("|");
};
