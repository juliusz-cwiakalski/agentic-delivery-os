/**
 * TC-QLC-008 (GH-292) — removal does not cascade: the dependent keeps its edge
 * bytes and records unchanged and is held `dependency-unobserved`; `dep remove`
 * is the supported remedy.
 */
import { describe, expect, test } from "bun:test";
import { observed, ciSucceeded } from "../fixtures/queue/schedule/harness";
import { REMOVAL_REF } from "../fixtures/queue/removal/cases";
import { createRemovalHarness } from "../fixtures/queue/removal/harness";

const CONSUMER = "GH-242";
const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;

describe("TC-QLC-008 removal does not cascade", () => {
  test("the dependent's edge set and records survive byte-identical and it is held", async () => {
    const harness = createRemovalHarness("remove-nocascade");
    harness.seedEntry({ ref: REMOVAL_REF, priority: 1 });
    harness.seedEntry({ ref: CONSUMER, priority: 2 });
    harness.seedEdge({ ref: CONSUMER, onRef: REMOVAL_REF });
    // The consumer's tracker facts are observed with no tracker relation, so
    // the `dependency-unobserved` hold is attributable to the declared edge
    // whose producer the removal retired.
    harness.factSource.workItems[CONSUMER] = observed();
    harness.factSource.ci[CONSUMER] = ciSucceeded();
    harness.factSource.close[CONSUMER] = "none";

    // The dependent's dependency records and folded edge set, captured before.
    const before = harness.composition.store.readRecords();
    if (!before.ok) throw new Error("read failed");
    const dependentRecords = before.value.records.filter(
      (record) => record.key === `queue.deps:${CONSUMER}`,
    );

    const run = await harness.run([
      "queue",
      "remove",
      REMOVAL_REF,
      "--reason",
      "superseded",
      "--json",
    ]);
    expect(run.exitCode).toBe(0);

    // The dependent's records are byte-identical; the fold still carries the edge.
    const after = harness.composition.store.readRecords();
    if (!after.ok) throw new Error("read failed");
    const dependentAfter = after.value.records.filter(
      (record) => record.key === `queue.deps:${CONSUMER}`,
    );
    expect(dependentAfter).toEqual(dependentRecords);

    // The dependent is held with the delivered blocking reason.
    const list = await harness.run(["queue", "list", "--json"]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout).toContain(CONSUMER);
    expect(list.stdout).toContain("dependency-unobserved");

    // The only new keys are the producer's removal and the derived document.
    const removals = harness.removalRecords();
    expect(removals).toHaveLength(1);
    expect(removals[0]?.ref).toBe(REMOVAL_REF);

    // The supported remedy: dep remove clears the edge and recomputes readiness.
    const remedy = await harness.run(["queue", "dep", "remove", CONSUMER, REMOVAL_REF, "--json"]);
    expect(remedy.exitCode).toBe(0);
    const remedyData = json(remedy.stdout).data as Record<string, unknown>;
    expect(remedyData.result).toBe("removed");
    expect(remedyData.edges).toEqual([]);
    const listAfter = await harness.run(["queue", "list", "--json"]);
    expect(listAfter.stdout).not.toContain("dependency-unobserved");
  });
});
