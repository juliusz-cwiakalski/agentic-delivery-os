/**
 * TC-COORD-038 (F-21) — a live cycle records a fresh `decision: none`
 * expectation when the state-sourced digest fingerprint advances.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, seedIteration } from "../fixtures/coordinator/harness";

describe("TC-COORD-038 a digest change while live refreshes the expectation", () => {
  test("an external record advance records one new expectation and no restart", async () => {
    const harness = createCoordinatorHarness({
      label: "expectation-refresh",
      session: { liveness: "alive", sessionId: "session-1" },
      alive: { 4242: true },
    });
    seedIteration(harness);
    // An external state record lands between cycles: the digest cursor advances.
    harness.appendRaw({
      kind: "merge.transaction",
      recordKey: "merge.transaction:GH-999",
      payload: {
        schemaId: "delivery.merge.transaction.v1",
        changeRef: "GH-999",
        state: "landed",
      },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    const refreshed = read.iterations.filter(
      (record) =>
        record.trigger === "collection" &&
        record.decision === "none" &&
        record.iterationId !== "iteration-seed",
    );
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0]?.reason).toBe("expectation");
    expect(read.restarts).toHaveLength(0);
    expect(read.stuck).toHaveLength(0);
  });
});
