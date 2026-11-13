/**
 * TC-QLC-007 (GH-292) — re-declaration restores a removed entry because the
 * presence rule compares ledger append position (`sequence`), never timestamp
 * text — including when `recordedAt` values are equal in both append orders.
 */
import { describe, expect, test } from "bun:test";
import { readQueueRemovals } from "../../packages/core/src/app/queue";
import { declareQueueEntry } from "../../packages/core/src/app/index";
import { REMOVAL_REF } from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-007 presence follows append position, not timestamp text", () => {
  test("a later re-declaration restores the entry and keeps the removal record durable", async () => {
    const harness = createRemovalHarness("remove-redeclare");
    harness.seedEntry({ ref: REMOVAL_REF });
    const removed = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(removed.exitCode).toBe(0);

    const removals = harness.composition.store.readRecords();
    if (!removals.ok) throw new Error("read failed");
    const removalRecord = removals.value.records.find((record) => record.kind === "queue.removal");
    if (removalRecord === undefined) throw new Error("removal record missing");
    const removalBytes = JSON.stringify(removalRecord);
    const removalSequence = removalRecord.sequence;

    // Re-declare with a later recordedAt through the production writer.
    harness.seedEntry({ ref: REMOVAL_REF, priority: 2 });
    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain(REMOVAL_REF);

    // The entry's latest append position is greater than the removal's.
    const records = harness.composition.store.readRecords();
    if (!records.ok) throw new Error("read failed");
    const entryRecord = [...records.value.records]
      .filter((record) => record.key === `queue.entries:${REMOVAL_REF}`)
      .at(-1);
    if (entryRecord === undefined) throw new Error("entry record missing");
    expect(entryRecord.sequence).toBeGreaterThan(removalSequence);

    // The original removal record survives byte-identical.
    const after = harness.composition.store.readRecords();
    if (!after.ok) throw new Error("read failed");
    const removalAfter = after.value.records.find((record) => record.kind === "queue.removal");
    expect(JSON.stringify(removalAfter)).toBe(removalBytes);

    // The derived document lists the ref again.
    const document = harness.graphDocument();
    expect(document).toBeDefined();
    expect(document).toContain(REMOVAL_REF);
  });

  test("an equal recordedAt re-declaration is present because its append is later", async () => {
    const harness = createRemovalHarness("remove-redeclare-equal");
    harness.seedEntry({ ref: REMOVAL_REF });
    const removalRead = readQueueRemovals(harness.composition.store);
    const removed = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "abandoned",
      "--json",
    ]);
    expect(removed.exitCode).toBe(0);
    const afterRemoval = readQueueRemovals(harness.composition.store);
    if (!afterRemoval.ok) throw new Error("removal read failed");
    const removal = afterRemoval.records.at(-1);
    if (removal === undefined) throw new Error("removal record missing");
    const SAME_TS = removal.recordedAt;

    // Re-declare carrying the removal's exact recordedAt, so the timestamps are
    // equal and only the ledger position can decide.
    const declared = declareQueueEntry(harness.composition.store, {
      ref: REMOVAL_REF,
      recordedAt: SAME_TS,
      fenceToken: "redeclare-equal",
    });
    expect(declared.ok).toBe(true);

    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain(REMOVAL_REF);
    const records = harness.composition.store.readRecords();
    if (!records.ok) throw new Error("read failed");
    const entrySequence = records.value.records
      .filter((record) => record.key === `queue.entries:${REMOVAL_REF}`)
      .at(-1)?.sequence;
    const removalSequence = records.value.records.find(
      (record) => record.kind === "queue.removal",
    )?.sequence;
    expect(entrySequence).toBeGreaterThan(removalSequence ?? 0);
    void removalRead;
    void json;
  });

  test("the inverse equal-recordedAt order stays absent: removal appended later", async () => {
    // A second harness seeded so the removal append is the LATEST record while
    // both timestamps are equal.
    const harness = createRemovalHarness("remove-redeclare-inverse");
    const SAME_TS = harness.nowIso();
    harness.seedEntry({ ref: REMOVAL_REF });
    // Force the entry's recordedAt to equal the future removal's by re-declaring
    // at the same fixture instant the command will use.
    const declared = declareQueueEntry(harness.composition.store, {
      ref: REMOVAL_REF,
      recordedAt: SAME_TS,
      fenceToken: "inverse-equal-entry",
    });
    expect(declared.ok).toBe(true);
    // The command's clock advances by 10ms per invocation; the removal's
    // recordedAt is therefore strictly later in BOTH position and text. To pin
    // the position rule alone, compare against the store directly: append a
    // removal at the SAME recordedAt after the entry.
    const direct = await import("../../packages/core/src/app/queue");
    const removed = direct.removeQueueEntry(harness.composition.store, {
      ref: REMOVAL_REF,
      reason: "abandoned",
      recordedAt: SAME_TS,
      nowMs: harness.nowMs(),
      fenceToken: "inverse-equal-removal",
    });
    expect(removed.ok).toBe(true);

    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).not.toContain(REMOVAL_REF);
    const records = harness.composition.store.readRecords();
    if (!records.ok) throw new Error("read failed");
    const entrySequence = records.value.records
      .filter((record) => record.key === `queue.entries:${REMOVAL_REF}`)
      .at(-1)?.sequence;
    const removalSequence = records.value.records
      .filter((record) => record.kind === "queue.removal")
      .at(-1)?.sequence;
    expect(removalSequence).toBeGreaterThan(entrySequence ?? 0);
  });
});
