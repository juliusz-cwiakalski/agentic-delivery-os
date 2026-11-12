/**
 * TC-QLC-036 (GH-292) — every dependency edit is one append: latest-wins
 * records, durable byte-identical history, a refusal appending nothing.
 */
import { describe, expect, test } from "bun:test";
import { readQueueFold } from "../../packages/core/src/app/queue";
import { CONSUMER_REF, PRODUCER_REF } from "../fixtures/queue/depend/grammar-cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";
import { ledgerDigest, ledgerText } from "../fixtures/state/harness";

const THIRD = "GH-244";

describe("TC-QLC-036 each edit is one append with durable history", () => {
  test("add C then remove B leaves both records and folds to the latest set", async () => {
    const harness = createRemovalHarness("dep-history");
    harness.seedEntry({ ref: CONSUMER_REF, priority: 1 });
    harness.seedEntry({ ref: PRODUCER_REF, priority: 2 });
    harness.seedEntry({ ref: THIRD, priority: 3 });
    harness.seedEdge({ ref: CONSUMER_REF, onRef: PRODUCER_REF });
    const store = harness.composition.store;
    const afterSeed = store.readRecords();
    if (!afterSeed.ok) throw new Error("read failed");
    const firstRecord = afterSeed.value.records.find(
      (record) => record.key === `queue.deps:${CONSUMER_REF}`,
    );
    if (firstRecord === undefined) throw new Error("dependency record missing");
    const firstBytes = JSON.stringify(firstRecord);

    // Add C: exactly one new dependency record for A.
    const addC = await harness.run(["queue", "dep", CONSUMER_REF, THIRD, "--json"]);
    expect(addC.exitCode).toBe(0);
    const afterAdd = store.readRecords();
    if (!afterAdd.ok) throw new Error("read failed");
    const records = afterAdd.value.records.filter(
      (record) => record.key === `queue.deps:${CONSUMER_REF}`,
    );
    expect(records).toHaveLength(2);

    // Remove B: exactly one more dependency record; the first is byte-identical.
    const removeB = await harness.run(["queue", "dep", "remove", CONSUMER_REF, PRODUCER_REF, "--json"]);
    expect(removeB.exitCode).toBe(0);
    const afterRemove = store.readRecords();
    if (!afterRemove.ok) throw new Error("read failed");
    const history = afterRemove.value.records.filter(
      (record) => record.key === `queue.deps:${CONSUMER_REF}`,
    );
    expect(history).toHaveLength(3);
    expect(JSON.stringify(history[0])).toBe(firstBytes);
    // The fold returns the latest record's edge set.
    const fold = readQueueFold(store);
    if (!fold.ok) throw new Error("fold failed");
    const consumer = fold.value.entries.find((entry) => entry.ref === CONSUMER_REF);
    expect(consumer?.edges).toEqual([THIRD]);
    // The derived document lists A's edges once, without duplicates.
    const document = harness.graphDocument();
    const parsed = JSON.parse(document ?? "{}") as {
      entries: readonly { ref: string; edges: readonly string[] }[];
    };
    const entry = parsed.entries.find((candidate) => candidate.ref === CONSUMER_REF);
    expect(entry?.edges).toEqual([THIRD]);
  });

  test("a refused dependency edit appends nothing and leaves the fold unchanged", async () => {
    const harness = createRemovalHarness("dep-history-refused");
    harness.seedEntry({ ref: CONSUMER_REF, priority: 1 });
    harness.seedEntry({ ref: PRODUCER_REF, priority: 2 });
    // B depends on A; A declaring B would close a cycle and is refused.
    harness.seedEdge({ ref: PRODUCER_REF, onRef: CONSUMER_REF });
    const store = harness.composition.store;
    const digestBefore = ledgerDigest(store.identity);
    const bytesBefore = ledgerText(store.identity);
    const refused = await harness.run(["queue", "dep", "add", CONSUMER_REF, PRODUCER_REF, "--json"]);
    expect(refused.exitCode).toBe(1);
    expect(ledgerDigest(store.identity)).toBe(digestBefore);
    expect(ledgerText(store.identity)).toBe(bytesBefore);
  });
});
