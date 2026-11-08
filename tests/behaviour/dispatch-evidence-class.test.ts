/**
 * TC-EVID-006 (phase-3 ledger/type slice) — the evidence class is declared,
 * closed, immutable, never inferred from the outcome, and never escalated. A
 * fifth value is refused at the append boundary. The production `pilot` default
 * is the documented configuration default; the command-level confirmation is
 * phase 4.
 */
import { describe, expect, test } from "bun:test";
import {
  appendDispatchAttempt,
  readDispatchAttempts,
} from "../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_DEFAULT_EVIDENCE_CLASS,
  DISPATCH_EVIDENCE_CLASSES,
  type DispatchAttemptRecord,
  type DispatchEvidenceClass,
} from "../../packages/core/src/contracts/index";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { makeAttemptFor } from "../fixtures/dispatch/ledger";

const withState = <T>(body: (state: ReturnType<typeof createDispatchState>) => T): T => {
  const state = createDispatchState("evidence-class");
  try {
    return body(state);
  } finally {
    state.dispose();
  }
};

describe("TC-EVID-006 declared, closed, and immutable evidence class", () => {
  test("the closed union is exactly the four declared classes", () => {
    expect([...DISPATCH_EVIDENCE_CLASSES]).toEqual([
      "pilot",
      "controlled-proof",
      "smoke",
      "fixture",
    ]);
    expect(DISPATCH_DEFAULT_EVIDENCE_CLASS).toBe("pilot");
  });

  test("the production default and every explicit declaration are recorded exactly", () => {
    withState(({ store, fenceToken }) => {
      const declarations: DispatchEvidenceClass[] = [
        DISPATCH_DEFAULT_EVIDENCE_CLASS,
        "controlled-proof",
        "smoke",
        "fixture",
      ];
      declarations.forEach((evidenceClass, index) => {
        const attempt = makeAttemptFor("pr-open", {
          attemptId: `a-class-${index}`,
          evidenceClass,
        });
        expect(appendDispatchAttempt(store, fenceToken, attempt).ok).toBe(true);
      });
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records.map((record) => record.evidenceClass)).toEqual(declarations);
    });
  });

  test("the class is not inferred from the outcome", () => {
    withState(({ store, fenceToken }) => {
      appendDispatchAttempt(
        store,
        fenceToken,
        makeAttemptFor("pr-open", { attemptId: "a-pilot", evidenceClass: "pilot" }),
      );
      appendDispatchAttempt(
        store,
        fenceToken,
        makeAttemptFor("pr-open", { attemptId: "a-fixture", evidenceClass: "fixture" }),
      );
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.evidenceClass).toBe("pilot");
      expect(read.records[1]?.evidenceClass).toBe("fixture");
    });
  });

  test("a fifth value is refused at the append boundary and no record lands", () => {
    withState(({ store, fenceToken }) => {
      const attempt = makeAttemptFor("pr-open", { attemptId: "a-bad" });
      const tampered = { ...attempt, evidenceClass: "production" } as unknown as DispatchAttemptRecord;
      const appended = appendDispatchAttempt(store, fenceToken, tampered);
      expect(appended.ok).toBe(false);
      const read = readDispatchAttempts(store);
      expect(read.ok && read.records).toEqual([]);
    });
  });

  test("an in-place escalation and a second escalating append are both refused", () => {
    withState(({ store, fenceToken }) => {
      const original = makeAttemptFor("pr-open", { attemptId: "a-immutable", evidenceClass: "fixture" });
      expect(appendDispatchAttempt(store, fenceToken, original).ok).toBe(true);
      const escalated = makeAttemptFor("pr-open", {
        attemptId: "a-immutable",
        evidenceClass: "pilot",
      });
      const refused = appendDispatchAttempt(store, fenceToken, escalated);
      expect(refused.ok).toBe(false);
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      expect(JSON.stringify(read.records[0])).toBe(JSON.stringify(original));
    });
  });

  test("a user-editable payload class never overrides the declared composition value", () => {
    withState(({ store, fenceToken }) => {
      const declared = makeAttemptFor("pr-open", {
        attemptId: "a-declared",
        evidenceClass: "fixture",
      });
      const tampered = { ...declared, payloadEvidenceClass: "pilot" } as DispatchAttemptRecord;
      expect(appendDispatchAttempt(store, fenceToken, tampered).ok).toBe(true);
      const read = readDispatchAttempts(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.evidenceClass).toBe("fixture");
    });
  });
});
