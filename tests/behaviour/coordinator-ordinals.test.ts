/**
 * TC-COORD-026 — ordinal accounting is consistent across all six decision
 * outcomes (join-live, resume-context, four spawn reasons).
 */
import { describe, expect, test } from "bun:test";
import { decideLifecycle } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorRestart,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import { LIFECYCLE_CASES } from "../fixtures/coordinator/lifecycle";
import {
  COORDINATOR_ID,
  EPOCH_ID,
  makeCoordinatorStore,
  restartRecord,
} from "../fixtures/coordinator/states";

describe("TC-COORD-026 the six-outcome ordinal matrix is consistent", () => {
  test("every outcome carries the expected ordinal consumption and reason", () => {
    expect(LIFECYCLE_CASES.map((entry) => entry.id)).toContain("live-session-joins");
    for (const entry of LIFECYCLE_CASES) {
      const decision = decideLifecycle(entry.facts);
      expect(decision.kind, entry.id).toBe(entry.expected.kind);
      expect(decision.reason, entry.id).toBe(entry.expected.reason);
      expect(decision.consumesOrdinal, entry.id).toBe(entry.expected.consumesOrdinal);
    }
  });

  test("the persisted restart count equals the sum of consumed ordinals", () => {
    const { store } = makeCoordinatorStore("ordinals");
    let ordinal = 0;
    for (const entry of LIFECYCLE_CASES) {
      const decision = decideLifecycle(entry.facts);
      if (decision.consumesOrdinal === 0) continue;
      ordinal += decision.consumesOrdinal;
      const reason =
        decision.reason === "live-session" || decision.reason === "expectation"
          ? "session-interrupted"
          : decision.reason;
      appendCoordinatorRestart(
        store,
        "writer",
        restartRecord({
          ordinal,
          restartId: `${COORDINATOR_ID}#${EPOCH_ID}#${ordinal}`,
          reason: reason as "session-interrupted",
        }),
      );
    }
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.restarts).toHaveLength(ordinal);
    expect(read.restarts.map((entry) => entry.ordinal)).toEqual(
      Array.from({ length: ordinal }, (_value, index) => index + 1),
    );
  });
});
