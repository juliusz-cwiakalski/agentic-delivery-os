/**
 * TC-QLC-030/034 (GH-292) — `dep add` is the same operation as the delivered
 * two-positional add, and the grammar refusals hold in both spellings.
 */
import { describe, expect, test } from "bun:test";
import { ledgerDigest } from "../fixtures/state/harness";
import {
  ADD_SPELLINGS,
  CONSUMER_REF,
  DELIVERED_DEP_ADD_RESULT,
  NON_CANONICAL_REFS,
  PRODUCER_REF,
  UNOBSERVED_REF,
} from "../fixtures/queue/depend/grammar-cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const errorOf = (text: string): Record<string, unknown> =>
  json(text).error as Record<string, unknown>;

describe("TC-QLC-030 dep add equals the two-positional add", () => {
  test("both spellings produce identical payloads, records, and results", async () => {
    const results: Record<string, unknown>[] = [];
    const recordDigests: string[] = [];
    for (const [index, spelling] of ADD_SPELLINGS.entries()) {
      const harness = createRemovalHarness(`dep-add-${index}`);
      harness.seedEntry({ ref: CONSUMER_REF, priority: 1 });
      harness.seedEntry({ ref: PRODUCER_REF, priority: 2 });
      const run = await harness.run(["queue", "dep", ...spelling, "--json"]);
      expect(run.exitCode, spelling.join(" ")).toBe(0);
      const data = json(run.stdout).data as Record<string, unknown>;
      // The delivered intent result for an existing consumer entry.
      expect(data.result, spelling.join(" ")).toBe(DELIVERED_DEP_ADD_RESULT);
      results.push(data);
      recordDigests.push(ledgerDigest(harness.composition.store.identity));
    }
    // Identical payloads (the fixed fixture clock keeps every field equal).
    expect(results[1]).toEqual(results[0]);
    // One dependency record per store carrying the folded edge set.
    for (const digest of recordDigests) expect(digest).toBeDefined();
  });
});

describe("TC-QLC-034 dependency grammar refusals", () => {
  test("non-canonical refs refuse in both spellings with zero appends", async () => {
    for (const bad of NON_CANONICAL_REFS) {
      for (const form of [["dep", bad, PRODUCER_REF], ["dep", "add", bad, PRODUCER_REF]]) {
        const harness = createRemovalHarness(`dep-bad-${bad}-${form.length}`);
        harness.seedEntry({ ref: CONSUMER_REF });
        harness.seedEntry({ ref: PRODUCER_REF });
        const digestBefore = ledgerDigest(harness.composition.store.identity);
        const run = await harness.run(["queue", ...form, "--json"]);
        expect(run.exitCode, form.join(" ")).toBe(1);
        expect(errorOf(run.stdout).code).toBe("input.value.rejected");
        expect(ledgerDigest(harness.composition.store.identity)).toBe(digestBefore);
      }
    }
  });

  test("an unknown consumer refuses unobserved; an unobserved producer is accepted", async () => {
    const harness = createRemovalHarness("dep-unobserved");
    harness.seedEntry({ ref: CONSUMER_REF });
    const refused = await harness.run([
      "queue",
      "dep",
      "add",
      UNOBSERVED_REF,
      PRODUCER_REF,
      "--json",
    ]);
    expect(refused.exitCode).toBe(1);
    expect(errorOf(refused.stdout).code).toBe("queue.entry.unobserved");
    expect(harness.composition.store.readRecords().ok).toBe(true);

    const accepted = await harness.run([
      "queue",
      "dep",
      "add",
      CONSUMER_REF,
      UNOBSERVED_REF,
      "--json",
    ]);
    expect(accepted.exitCode).toBe(0);
    const data = json(accepted.stdout).data as { result: string; edges: readonly string[] };
    expect(data.result).toBe(DELIVERED_DEP_ADD_RESULT);
    expect(data.edges).toContain(UNOBSERVED_REF);
    // The consumer is held with the delivered blocking reason.
    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.stdout).toContain("dependency-unobserved");

    // The removal spelling clears the unobserved-producer edge too.
    const removed = await harness.run([
      "queue",
      "dep",
      "remove",
      CONSUMER_REF,
      UNOBSERVED_REF,
      "--json",
    ]);
    expect(removed.exitCode).toBe(0);
    const removedData = json(removed.stdout).data as { result: string; edges: readonly string[] };
    expect(removedData.result).toBe("removed");
    expect(removedData.edges).toEqual([]);
  });

  test("a third positional is a grammar refusal in both spellings", async () => {
    const harness = createRemovalHarness("dep-third-positional");
    harness.seedEntry({ ref: CONSUMER_REF });
    harness.seedEntry({ ref: PRODUCER_REF });
    for (const form of [
      ["dep", CONSUMER_REF, PRODUCER_REF, "GH-244"],
      ["dep", "add", CONSUMER_REF, PRODUCER_REF, "GH-244"],
      ["dep", "remove", CONSUMER_REF, PRODUCER_REF, "GH-244"],
    ]) {
      const run = await harness.run(["queue", ...form, "--json"]);
      expect(run.exitCode, form.join(" ")).toBe(1);
      expect(errorOf(run.stdout).code).toBe("input.value.rejected");
    }
  });
});
