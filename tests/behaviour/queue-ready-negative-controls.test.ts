/**
 * TC-QREADY-021 — the exhaustive 22-control AC-F14-1 negative matrix.
 */
import { describe, expect, test } from "bun:test";
import type { QueueReadyCondition } from "../../packages/core/src/contracts/index";
import {
  baseFacts,
  evaluate,
  queueRuntime,
  runQueueReadyCli,
} from "../fixtures/queue-ready/harness";
import { negativeControls } from "../fixtures/queue-ready/negative-controls/cases";

const ALL_CLEAR = /clear|green|nothing blocks|all good/i;

/** The scoped all-clear scan: the affected condition's evidence only. */
export const scopedClaimViolations = (condition: QueueReadyCondition): string[] => {
  if (condition.id === "provider-available") {
    const text = JSON.stringify(condition.evidence);
    return /available/i.test(text) ? ["provider evidence claims available"] : [];
  }
  const text = JSON.stringify(condition.evidence);
  return ALL_CLEAR.test(text) ? ["condition evidence claims an all-clear"] : [];
};

describe("TC-QREADY-021 negative-control matrix", () => {
  test("every control is asserted on its targeted surface", async () => {
    for (const control of negativeControls) {
      const run = await runQueueReadyCli(
        ["queue", "ready", "GH-176", "--json"],
        queueRuntime({ ...baseFacts(control.facts) }),
      );
      expect(run.exitCode, control.name).toBe(0);
      const envelope = JSON.parse(run.stdout) as {
        readonly data?: {
          readonly candidates: readonly {
            readonly ready: boolean;
            readonly closeClass: string;
            readonly close: { readonly reason: string };
            readonly conditions: readonly QueueReadyCondition[];
          }[];
        };
        readonly error?: unknown;
      };
      expect(envelope.error, control.name).toBeUndefined();
      const candidate = envelope.data?.candidates[0];
      expect(candidate, control.name).toBeDefined();
      if (candidate === undefined) continue;
      expect(candidate.ready, control.name).toBe(control.ready);
      expect(candidate.closeClass, control.name).toBe(control.closeClass);
      expect(candidate.closeClass, control.name).not.toBe("merge-ready");
      if (control.target.kind === "condition") {
        const condition = candidate.conditions.find((entry) => entry.id === control.target.id);
        expect(condition?.state, control.name).toBe(control.target.state);
        expect(condition?.evidence[0]?.reason, control.name).toBe(control.target.reason);
        expect(condition?.state, control.name).not.toBe("satisfied");
        expect(
          scopedClaimViolations({ ...condition, evidence: condition?.evidence ?? [] }),
          control.name,
        ).toEqual([]);
      } else {
        expect(candidate.close.reason, control.name).toBe("pr-association-unknown");
        expect(candidate.closeClass, control.name).not.toBe("new-start");
      }
      expect(run.stdout.includes("planted-queue-ready-control"), control.name).toBe(false);
    }
  });

  test("no control yields a ready claim with a non-satisfied condition", () => {
    for (const control of negativeControls) {
      const candidate = evaluate(control.facts).candidates[0];
      if (candidate === undefined) continue;
      const allSatisfied = candidate.conditions.every(
        (condition) => condition.state === "satisfied",
      );
      expect(candidate.ready, control.name).toBe(allSatisfied);
      if (!candidate.ready) {
        expect(candidate.blockingConditions.length, control.name).toBeGreaterThan(0);
      }
    }
  });

  test("every control has a restored positive control", () => {
    const restored = evaluate();
    expect(restored.candidates[0]?.ready).toBe(true);
    expect(restored.candidates[0]?.closeClass).toBe("new-start");
  });

  test("the matrix meta-check names exactly twenty-two controls", () => {
    expect(negativeControls).toHaveLength(22);
    expect(new Set(negativeControls.map((control) => control.name)).size).toBe(22);
    expect(negativeControls.map((control) => control.id)).toEqual(
      Array.from({ length: 22 }, (_, index) => index + 1),
    );
    const expected = [
      "deps-relations-unavailable",
      "candidate-unobserved",
      "pm-context-missing",
      "pm-context-malformed",
      "other-active-change",
      "tier-absent",
      "tier-conflict",
      "owner-label-present",
      "ci-none",
      "ci-pending",
      "ci-canceled",
      "ci-failed",
      "unresolved-sha",
      "check-runs-read-failed",
      "no-default-provider-chain",
      "unresolved-provider-chain",
      "provider-park-fold-failed",
      "active-provider-park",
      "active-chain-park",
      "pr-read-failure",
      "binding-unavailable",
      "at-limit-pr-no-match",
    ];
    expect(negativeControls.map((control) => control.name)).toEqual(expected);
  });

  test("a hand-planted forbidden claim fails the scoped scan by name", () => {
    const plantedSystem = scopedClaimViolations({
      id: "provider-available",
      state: "satisfied",
      evidence: [
        { source: "provider-config", reason: "engine-not-run", detail: "provider available" },
      ],
    });
    expect(plantedSystem.length).toBeGreaterThan(0);
    const plantedClear = scopedClaimViolations({
      id: "ci-healthy",
      state: "satisfied",
      evidence: [{ source: "ci", reason: "ci-succeeded", detail: "all good" }],
    });
    expect(plantedClear.length).toBeGreaterThan(0);
  });
});
