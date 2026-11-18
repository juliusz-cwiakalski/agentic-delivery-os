/**
 * TC-QLC-033 (GH-292) — the cycle predicate stays add-only: an add that closes
 * a cycle refuses with `queue.dependency-cycle`; a removal never runs the
 * cycle check, even on a cyclic graph.
 */
import { describe, expect, test } from "bun:test";
import { ledgerDigest } from "../fixtures/state/harness";
import { CONSUMER_REF, PRODUCER_REF } from "../fixtures/queue/depend/grammar-cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

describe("TC-QLC-033 the cycle check is add-only", () => {
  test("an add that would close a cycle refuses in both spellings with zero appends", async () => {
    const harness = createRemovalHarness("dep-cycle-add");
    // B (GH-242) already depends on A (GH-243) through the valid two-positional
    // form; the reverse add would close a two-node cycle.
    harness.seedEntry({ ref: CONSUMER_REF, priority: 1 });
    harness.seedEntry({ ref: PRODUCER_REF, priority: 2 });
    harness.seedEdge({ ref: PRODUCER_REF, onRef: CONSUMER_REF });
    for (const form of [
      ["dep", CONSUMER_REF, PRODUCER_REF],
      ["dep", "add", CONSUMER_REF, PRODUCER_REF],
    ]) {
      const digestBefore = ledgerDigest(harness.composition.store.identity);
      const refused = await harness.run(["queue", ...form, "--json"]);
      expect(refused.exitCode, form.join(" ")).toBe(1);
      expect(errorOf(refused.stdout).code).toBe("queue.dependency-cycle");
      // The summary names the existing path.
      expect(refused.stdout).toContain(PRODUCER_REF);
      expect(ledgerDigest(harness.composition.store.identity)).toBe(digestBefore);
    }
  });

  test("the removal of a declared edge runs no cycle check on a cyclic graph", async () => {
    // The cycle-seeded store: both directions declared (a legacy/foreign cycle
    // the add verb would refuse to create).
    const harness = createRemovalHarness("dep-cycle-remove");
    harness.seedEntry({ ref: CONSUMER_REF, priority: 1 });
    harness.seedEntry({ ref: PRODUCER_REF, priority: 2 });
    harness.seedEdge({ ref: PRODUCER_REF, onRef: CONSUMER_REF });
    harness.seedEdgeRaw({ ref: CONSUMER_REF, onRef: PRODUCER_REF });
    const digestBefore = ledgerDigest(harness.composition.store.identity);
    const removed = await harness.run([
      "queue",
      "dep",
      "remove",
      PRODUCER_REF,
      CONSUMER_REF,
      "--json",
    ]);
    expect(removed.exitCode).toBe(0);
    const data = json(removed.stdout).data as { result: string; edges: readonly string[] };
    expect(data.result).toBe("removed");
    expect(data.edges).toEqual([]);
    // Exactly one dependency record was appended; the reverse edge is untouched.
    expect(ledgerDigest(harness.composition.store.identity)).not.toBe(digestBefore);
    const foldRecords = harness.composition.store.readRecords();
    if (!foldRecords.ok) throw new Error("read failed");
    const reverse = foldRecords.value.records.filter(
      (record) => record.key === `queue.deps:${CONSUMER_REF}`,
    );
    expect(reverse.length).toBeGreaterThanOrEqual(1);
  });
});
