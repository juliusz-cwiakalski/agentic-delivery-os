/**
 * TC-VERIFY-001..005 — variant-aware classification, the partial identity split,
 * and declaration/registry overlay precedence at the pure seam (Phase 2). The
 * command-level halves land with the command in Phase 3.
 */
import { describe, expect, test } from "bun:test";
import {
  CANONICAL_PHASE_IDS,
  LITE_REQUIRED_PHASES,
  type PhaseTransitionRecord,
} from "../../packages/core/src/contracts/index";
import {
  classifyVerifyChange,
  classifyVerifyDocument,
  type VerifyChangeVerdict,
  type VerifyRegistryEvidence,
} from "../../packages/core/src/domain/index";
import {
  appendLanding,
  createVerifyState,
  fullBase,
  fullReversed,
  liteCompleteAbsent,
  liteCompleteNull,
  liteWrongTyped,
  partialA,
  partialB,
  partialC,
  withCompletedPhase,
  withOpenPhase,
  withoutPhaseKey,
} from "./verify-support";

const REF = "GH-177";
const CANARY = "planted-payload-verify-";

const emptyRegistry = (): VerifyRegistryEvidence => ({
  ok: true,
  present: false,
  verifiedEmpty: true,
  transitions: [],
  recordCount: 0,
});

const otherRefRegistry = (): VerifyRegistryEvidence => ({
  ok: true,
  present: false,
  verifiedEmpty: false,
  transitions: [],
  recordCount: 1,
});

const landed = (
  phaseId: string,
  operation: "complete" | "reopen",
  timestamp: string,
): PhaseTransitionRecord => ({
  changeRef: REF,
  phaseId,
  operation,
  timestamp,
  outcome: "landed",
  ...(operation === "reopen" ? { reason: "fixture reopen" } : {}),
});

const registryWith = (transitions: readonly PhaseTransitionRecord[]): VerifyRegistryEvidence => ({
  ok: true,
  present: transitions.length > 0,
  verifiedEmpty: transitions.length === 0,
  transitions,
  recordCount: transitions.length,
});

const classify = (
  document: unknown,
  registry: VerifyRegistryEvidence = emptyRegistry(),
): VerifyChangeVerdict => {
  const classified = classifyVerifyDocument({ ok: true, value: document });
  if (!classified.ok) return classified;
  return classifyVerifyChange({ changeRef: REF, document: classified, registry });
};

const expectFailure = (verdict: VerifyChangeVerdict, code: string, summary: string): void => {
  expect(verdict.ok).toBe(false);
  if (verdict.ok) throw new Error("expected a failure verdict");
  expect(verdict.code).toBe(code);
  expect(verdict.summary).toBe(summary);
  expect(JSON.stringify(verdict)).not.toContain(CANARY);
};

const expectFinished = (verdict: VerifyChangeVerdict): void => {
  expect(verdict.ok).toBe(true);
  if (!verdict.ok) throw new Error(`expected finished, got ${verdict.code}`);
  expect(verdict.data.result).toBe("finished");
  expect(verdict.data.missingPhases).toEqual([]);
};

const expectDataShape = (verdict: VerifyChangeVerdict, variant: "full" | "lite"): void => {
  expectFinished(verdict);
  if (!verdict.ok) return;
  const data = verdict.data;
  expect(Object.keys(data).sort()).toEqual([
    "changeRef",
    "completedPhases",
    "evidence",
    "missingPhases",
    "requiredPhases",
    "result",
    "target",
    "variant",
  ]);
  expect(data.changeRef).toBe(REF);
  expect(data.target).toBe("change");
  expect(data.variant).toBe(variant);
  expect(Object.keys(data.evidence).sort()).toEqual(["declaration", "registry"]);
  expect(Object.keys(data.evidence.declaration).sort()).toEqual([
    "completedCount",
    "requiredCount",
  ]);
  expect(Object.keys(data.evidence.registry).sort()).toEqual([
    "overlaidPhases",
    "present",
    "recordCount",
    "transitionCount",
    "verifiedEmpty",
  ]);
};

describe("TC-VERIFY-001 full incomplete ledger names each missing phase (pure)", () => {
  test("each single missing phase names exactly that phase in required-set order", () => {
    for (const phaseId of CANONICAL_PHASE_IDS) {
      const verdict = classify(withOpenPhase(phaseId));
      expectFailure(
        verdict,
        "verify.ledger.incomplete",
        `result=partial; variant=full; missing=${phaseId}`,
      );
    }
  });

  test("the multi-missing fixture names ids in canonical order", () => {
    const document = withOpenPhase("quality_gates");
    const phases = document.phases as Record<string, unknown>;
    phases.test_planning = { ...(phases.test_planning as object), completed: null };
    phases.dor_check = { ...(phases.dor_check as object), completed: null };
    const verdict = classify(document);
    expectFailure(
      verdict,
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=test_planning,dor_check,quality_gates",
    );
  });

  test("restored and complete controls are finished", () => {
    for (const phaseId of CANONICAL_PHASE_IDS) {
      const restored = withCompletedPhase(phaseId, withOpenPhase(phaseId));
      expectFinished(classify(restored));
    }
    expectFinished(classify(fullBase()));
    expectFinished(classify(fullReversed()));
  });

  test("no negative is a sibling identity and no canary leaks", () => {
    for (const phaseId of CANONICAL_PHASE_IDS.slice(0, 4)) {
      const verdict = classify(withOpenPhase(phaseId));
      if (verdict.ok) throw new Error("expected failure");
      expect(verdict.code).not.toBe("lint.phases.incomplete");
      expect(verdict.code).not.toBe("state.keys.missing");
      expect(verdict.code).not.toBe("fallback.internal");
      expect(JSON.stringify(verdict)).not.toContain(CANARY);
    }
  });
});

describe("TC-VERIFY-002 complete full ledger is a verified success (pure)", () => {
  test("the three registry evidence states all finish with the same tuple", () => {
    for (const registry of [emptyRegistry(), otherRefRegistry()]) {
      const verdict = classify(fullBase(), registry);
      expectDataShape(verdict, "full");
      if (verdict.ok) {
        expect(verdict.data.requiredPhases).toEqual([...CANONICAL_PHASE_IDS]);
        expect(verdict.data.completedPhases).toEqual([...CANONICAL_PHASE_IDS]);
        expect(verdict.data.evidence.declaration).toEqual({
          completedCount: 11,
          requiredCount: 11,
        });
        expect(verdict.data.evidence.registry.transitionCount).toBe(0);
        expect(verdict.data.evidence.registry.overlaidPhases).toEqual([]);
        expect(Number.isInteger(verdict.data.evidence.registry.recordCount)).toBe(true);
        expect(verdict.data.evidence.registry.recordCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("an absent per-change record is no evidence, never state.keys.missing", () => {
    const verdict = classify(fullBase(), otherRefRegistry());
    expectFinished(verdict);
    if (verdict.ok) {
      expect(verdict.data.evidence.registry.present).toBe(false);
      expect(verdict.data.evidence.registry.verifiedEmpty).toBe(false);
    }
  });

  test("reversed declaration key order yields deep-equal data", () => {
    expect(classify(fullReversed())).toEqual(classify(fullBase()));
  });
});

describe("TC-VERIFY-003 LITE required six, never the other five (pure)", () => {
  const nonLite = [
    "test_planning",
    "delivery_planning",
    "dor_check",
    "system_spec_update",
    "review_fix",
  ];

  test("each LITE omission names exactly that phase and no non-LITE phase", () => {
    for (const phaseId of LITE_REQUIRED_PHASES) {
      const verdict = classify(withOpenPhase(phaseId, liteCompleteAbsent()));
      expectFailure(
        verdict,
        "verify.ledger.incomplete",
        `result=partial; variant=lite; missing=${phaseId}`,
      );
      for (const ignored of nonLite) {
        if (verdict.ok) throw new Error("expected failure");
        expect(verdict.summary).not.toContain(ignored);
      }
    }
  });

  test("complete LITE controls (absent and null non-LITE phases) finish", () => {
    for (const document of [liteCompleteAbsent(), liteCompleteNull()]) {
      const verdict = classify(document);
      expectDataShape(verdict, "lite");
      if (verdict.ok) {
        expect(verdict.data.requiredPhases).toEqual([...LITE_REQUIRED_PHASES]);
        expect(verdict.data.completedPhases).toEqual([...LITE_REQUIRED_PHASES]);
      }
    }
    expectFinished(classify(liteWrongTyped()));
  });

  test("the full variant still enforces dor_check (variant-gating control)", () => {
    const verdict = classify(withOpenPhase("dor_check", fullBase()));
    expectFailure(
      verdict,
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
  });

  test("restoring each LITE omission finishes", () => {
    for (const phaseId of LITE_REQUIRED_PHASES) {
      const open = withOpenPhase(phaseId, liteCompleteAbsent());
      expectFinished(classify(withCompletedPhase(phaseId, open)));
    }
  });
});

describe("TC-VERIFY-004 partial identity split (pure)", () => {
  test("A declared-incomplete is verify.ledger.incomplete", () => {
    expectFailure(
      classify(partialA()),
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
  });

  test("B key-absent is lint.phases.incomplete", () => {
    expectFailure(
      classify(partialB()),
      "lint.phases.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
  });

  test("C mixed uses absence precedence and names the full missing set", () => {
    expectFailure(
      classify(partialC()),
      "lint.phases.incomplete",
      "result=partial; variant=full; missing=dor_check,quality_gates",
    );
  });

  test("neither identity is a key-set failure; controls classify", () => {
    for (const document of [partialA(), partialB(), partialC()]) {
      const verdict = classify(document);
      if (verdict.ok) throw new Error("expected failure");
      expect(verdict.code).not.toBe("lint.keys.missing");
      expect(verdict.code).not.toBe("state.keys.missing");
    }
    const restoredB = partialB();
    const restoredPhases = restoredB.phases as Record<string, unknown>;
    restoredPhases.dor_check = {
      started: "2026-10-31T00:30:00Z",
      completed: null,
    };
    expectFailure(
      classify(restoredB),
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
    expectFinished(
      classify(withCompletedPhase("quality_gates", withCompletedPhase("dor_check", partialC()))),
    );
  });

  test("a non-required opaque key never changes the verdict", () => {
    const document = partialA();
    document.opaque_extra = { text: "ignored" };
    expectFailure(
      classify(document),
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
  });
});

describe("TC-VERIFY-005 overlay precedence and presence-tolerant evidence (pure)", () => {
  test("O1 declaration-completed plus registry reopen is partial", () => {
    const verdict = classify(
      fullBase(),
      registryWith([
        landed("delivery", "complete", "2026-10-31T05:00:00Z"),
        landed("delivery", "reopen", "2026-10-31T05:05:00Z"),
      ]),
    );
    expectFailure(
      verdict,
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=delivery",
    );
  });

  test("O2 declaration-incomplete plus registry complete is finished", () => {
    const verdict = classify(
      withOpenPhase("delivery"),
      registryWith([landed("delivery", "complete", "2026-10-31T05:00:00Z")]),
    );
    expectDataShape(verdict, "full");
    if (verdict.ok) {
      expect(verdict.data.completedPhases).toContain("delivery");
      expect(verdict.data.evidence.registry.overlaidPhases).toEqual(["delivery"]);
    }
  });

  test("O3 declaration-key-absent plus registry complete is finished", () => {
    const verdict = classify(
      withoutPhaseKey("review_fix"),
      registryWith([landed("review_fix", "complete", "2026-10-31T05:00:00Z")]),
    );
    expectDataShape(verdict, "full");
    if (verdict.ok) {
      expect(verdict.data.evidence.registry.overlaidPhases).toEqual(["review_fix"]);
    }
  });

  test("O4 declaration-match control is finished and overlaid", () => {
    const verdict = classify(
      fullBase(),
      registryWith([landed("quality_gates", "complete", "2026-10-31T05:00:00Z")]),
    );
    expectDataShape(verdict, "full");
    if (verdict.ok) {
      expect(verdict.data.evidence.registry.overlaidPhases).toEqual(["quality_gates"]);
    }
  });

  test("O5 declaration-open plus registry reopen is partial", () => {
    const verdict = classify(
      withOpenPhase("dor_check"),
      registryWith([
        landed("dor_check", "complete", "2026-10-31T05:00:00Z"),
        landed("dor_check", "reopen", "2026-10-31T05:05:00Z"),
      ]),
    );
    expectFailure(
      verdict,
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
  });

  test("O6/O7/O8 absent per-change records are no evidence", () => {
    expectFinished(classify(fullBase(), otherRefRegistry()));
    expectFailure(
      classify(withOpenPhase("dor_check"), otherRefRegistry()),
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
    expectFailure(
      classify(withOpenPhase("dor_check"), otherRefRegistry()),
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
  });

  test("O9 no store decides from the declaration", () => {
    expectFinished(classify(fullBase(), emptyRegistry()));
    expectFailure(
      classify(withOpenPhase("dor_check"), emptyRegistry()),
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
  });

  test("P1/P2 the projection is not evidence at the pure seam", () => {
    const p1 = classify(
      fullBase(),
      registryWith([
        landed("delivery", "complete", "2026-10-31T05:00:00Z"),
        landed("delivery", "reopen", "2026-10-31T05:05:00Z"),
      ]),
    );
    expectFailure(p1, "verify.ledger.incomplete", "result=partial; variant=full; missing=delivery");
    const p2 = classify(withOpenPhase("dor_check"), emptyRegistry());
    expectFailure(
      p2,
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=dor_check",
    );
  });

  test("directional controls: declaration-only and registry-required answers differ", () => {
    // Declaration-only would finish O1; registry-required would fail O6/O8.
    expectFinished(classify(fullBase()));
    expectFailure(
      classify(withOpenPhase("delivery"), registryWith([])),
      "verify.ledger.incomplete",
      "result=partial; variant=full; missing=delivery",
    );
    expectFinished(classify(fullBase(), otherRefRegistry()));
  });

  test("real appendPhaseTransition histories drive the same overlay", () => {
    const state = createVerifyState();
    try {
      appendLanding(state, "delivery", "complete", "2026-10-31T05:00:00Z");
      appendLanding(state, "delivery", "reopen", "2026-10-31T05:05:00Z");
      const read = state.store.read({ requiredKeys: [] });
      expect(read.ok).toBe(true);
      const transitions: PhaseTransitionRecord[] = [
        landed("delivery", "complete", "2026-10-31T05:00:00Z"),
        landed("delivery", "reopen", "2026-10-31T05:05:00Z"),
      ];
      const verdict = classify(fullBase(), registryWith(transitions));
      expectFailure(
        verdict,
        "verify.ledger.incomplete",
        "result=partial; variant=full; missing=delivery",
      );
    } finally {
      state.cleanup();
    }
  });
});
