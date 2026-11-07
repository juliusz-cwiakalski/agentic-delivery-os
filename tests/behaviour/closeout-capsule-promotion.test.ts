/** TC-CAP-018 — capture bar and evidence gate with no silent skip. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

const decisionOf = (run: Awaited<ReturnType<typeof runPromotionCloseout>>) =>
  (
    ((run.data?.capsule ?? {}) as Record<string, unknown>).candidates as Record<string, unknown>[]
  )[0];

describe("TC-CAP-018 capture bar and evidence", () => {
  test("a missing basis is rejected capture-bar-unmet", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ basis: undefined }) },
    });
    try {
      expect(run.exitCode).toBe(0);
      expect(decisionOf(run)).toEqual({
        id: "review-catch-fixture",
        decision: "rejected",
        reason: "capture-bar-unmet",
      });
    } finally {
      run.cleanup();
    }
  });

  test("an empty evidence value is rejected evidence-missing", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ evidence: "" }) },
    });
    try {
      expect(decisionOf(run)).toEqual({
        id: "review-catch-fixture",
        decision: "rejected",
        reason: "evidence-missing",
      });
    } finally {
      run.cleanup();
    }
  });

  test("capture-bar and evidence omissions are never silently skipped", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({ id: "no-basis", basis: undefined }),
        "b.yaml": candidateYaml({ id: "no-evidence", evidence: "" }),
      },
    });
    try {
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates.length).toBe(2);
      expect(candidates.every((entry) => entry.decision === "rejected")).toBe(true);
    } finally {
      run.cleanup();
    }
  });
});
