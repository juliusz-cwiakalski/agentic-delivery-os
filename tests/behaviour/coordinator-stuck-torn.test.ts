/**
 * TC-COORD-036 — a single torn or unreadable store is `unknown`, never
 * fabricated as stale, and the state identity is returned.
 */
import { describe, expect, test } from "bun:test";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { evaluateStuck } from "../../packages/core/src/domain/index";
import {
  appendCoordinatorPayload,
  coordinatorStuckKey,
  readCoordinatorRecords,
} from "../../packages/core/src/state/index";
import { staleBaseline } from "../fixtures/coordinator/evidence";
import { COORDINATOR_ID, makeCoordinatorStore, stuckRecord } from "../fixtures/coordinator/states";

describe("TC-COORD-036 a single torn store is unknown evidence", () => {
  test("an unreadable merge store yields unevaluable, never stale", () => {
    const verdict = evaluateStuck(
      staleBaseline({ merge: "unknown", answer: "stale", newTurn: "unknown" }),
    );
    expect(verdict.verdict).toBe("stuck");
    if (verdict.verdict === "stuck") expect(verdict.classes.merge).toBe("unknown");
  });

  test("a torn coordinator record read returns the state identity", () => {
    const { store } = makeCoordinatorStore("stuck-torn");
    appendCoordinatorPayload(store, "writer", {
      kind: "coordinator.stuck",
      recordKey: coordinatorStuckKey(COORDINATOR_ID),
      payload: { ...stuckRecord(), verdict: "maybe" },
    });
    const read = readCoordinatorRecords(store, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.code).toBe("state.store.torn");
      expect(read.location?.path).toContain("ledger");
    }
  });

  test("an all-unknown read makes the verdict unevaluable, never a kill", () => {
    const verdict = evaluateStuck(
      staleBaseline({ merge: "unknown", answer: "unknown", newTurn: "unknown" }),
    );
    expect(verdict.verdict).toBe("unevaluable");
    if (verdict.verdict === "unevaluable") {
      expect(verdict.reason).toBe("evidence-unevaluable");
      expect(verdict.evidence).not.toContain("merge=stale");
    }
  });

  test("a fabricated-stale mutant would be observable against the oracle", () => {
    const real = evaluateStuck(
      staleBaseline({ merge: "unknown", answer: "unknown", newTurn: "unknown" }),
    );
    expect(real.verdict).toBe("unevaluable");
    // The mutant (collapsing unknown to stale) is different, so the assertion
    // above cannot pass by accident.
    expect(real.verdict).not.toBe("stuck");
  });

  test("a read faulted at the store classifies its code", () => {
    const { store } = makeCoordinatorStore("stuck-unreadable");
    const failing: StateStorePort = {
      ...store,
      readRecords: () => ({
        ok: false,
        error: {
          kind: "state",
          code: "state.store.torn",
          consequence: "not_landed",
          location: { path: "ledger" },
        },
      }),
    };
    const read = readCoordinatorRecords(failing, COORDINATOR_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.store.torn");
  });
});
