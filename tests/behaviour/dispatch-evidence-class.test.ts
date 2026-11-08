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
      const tampered = {
        ...attempt,
        evidenceClass: "production",
      } as unknown as DispatchAttemptRecord;
      const appended = appendDispatchAttempt(store, fenceToken, tampered);
      expect(appended.ok).toBe(false);
      const read = readDispatchAttempts(store);
      expect(read.ok && read.records).toEqual([]);
    });
  });

  test("an in-place escalation and a second escalating append are both refused", () => {
    withState(({ store, fenceToken }) => {
      const original = makeAttemptFor("pr-open", {
        attemptId: "a-immutable",
        evidenceClass: "fixture",
      });
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

describe("TC-EVID-006 phase-4 confirmation: the production composition declares pilot", () => {
  test("a real dispatch under the production default records pilot", async () => {
    const { createCommandScenario } = await import("../fixtures/dispatch/golden/harness");
    const { COMPLETED_EVIDENCE } = await import("../fixtures/dispatch/harness");
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(0);
      const read = readDispatchAttempts(scenario.state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      expect(read.records[0]?.evidenceClass).toBe("pilot");
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-GATE-011 evidence-class counting per repository scope", () => {
  test("a production repository counts only pilot and reports every excluded class", async () => {
    const { evaluateSpecs, eligibleSpecs } = await import("../fixtures/dispatch/evidence-windows");
    const specs = eligibleSpecs().map((spec, index) => ({
      ...spec,
      evidenceClass: (["pilot", "controlled-proof", "smoke", "fixture"] as const)[index % 4],
    }));
    const { window } = evaluateSpecs(specs, { scope: "production" });
    expect(window.countedEvidenceClass).toBe("pilot");
    expect(window.excludedEvidenceClasses.map((entry) => entry.evidenceClass).sort()).toEqual([
      "controlled-proof",
      "fixture",
      "smoke",
    ]);
    expect(window.countedInWindow.every((attempt) => attempt.evidenceClass === "pilot")).toBe(true);
  });

  test("the controlled scope counts only controlled-proof", async () => {
    const { evaluateSpecs, eligibleSpecs } = await import("../fixtures/dispatch/evidence-windows");
    const specs = eligibleSpecs({ evidenceClass: "controlled-proof" }).map((spec, index) =>
      index % 5 === 0 ? { ...spec, evidenceClass: "pilot" as const } : spec,
    );
    const { window, evaluation } = evaluateSpecs(specs, { scope: "controlled" });
    expect(window.countedEvidenceClass).toBe("controlled-proof");
    expect(
      window.countedInWindow.every((attempt) => attempt.evidenceClass === "controlled-proof"),
    ).toBe(true);
    expect(window.excludedEvidenceClasses).toEqual([{ evidenceClass: "pilot", count: 4 }]);
    expect(evaluation.eligibility).toBe(false);
    expect(evaluation.unmetConditions.map((entry) => entry.condition)).toContain("coverage");
  });

  test("smoke and fixture evidence advances no floor, coverage, incident, or corroboration", async () => {
    const { evaluateSpecs } = await import("../fixtures/dispatch/evidence-windows");
    const specs = Array.from({ length: 25 }, (_, index) => ({
      token: "pr-open" as const,
      id: `smoke-${index}`,
      day: index % 7,
      evidenceClass: index % 2 === 0 ? ("smoke" as const) : ("fixture" as const),
    }));
    const { window, evaluation } = evaluateSpecs(specs, { scope: "production" });
    expect(window.countedInWindow).toEqual([]);
    expect(window.floorMet).toBe(false);
    expect(window.coverage.present).toEqual([]);
    expect(evaluation.eligibility).toBe(false);
  });

  test("a controlled-proof attempt under a production identity is surfaced and not counted", async () => {
    const { evaluateSpecs, eligibleSpecs } = await import("../fixtures/dispatch/evidence-windows");
    const specs = [
      ...eligibleSpecs(),
      {
        token: "merged" as const,
        id: "cross-scope",
        day: 0,
        evidenceClass: "controlled-proof" as const,
      },
    ];
    const { window, evaluation } = evaluateSpecs(specs, { scope: "production" });
    expect(window.excludedEvidenceClasses).toEqual([
      { evidenceClass: "controlled-proof", count: 1 },
    ]);
    expect(window.countedInWindow.some((attempt) => attempt.attemptId === "cross-scope")).toBe(
      false,
    );
    expect(evaluation.eligibility).toBe(true);
  });
});
