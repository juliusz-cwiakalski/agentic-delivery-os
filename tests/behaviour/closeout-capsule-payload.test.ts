/** TC-CAP-016 / TC-CAP-023 — the additive capsule payload and plan refusal. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

describe("TC-CAP-016 capsule payload", () => {
  test("the applied capsule object has exactly the declared keys", async () => {
    const run = await runPromotionCloseout({ candidates: { "a.yaml": candidateYaml() } });
    try {
      expect(run.exitCode).toBe(0);
      const capsule = (run.data?.capsule ?? {}) as Record<string, unknown>;
      expect(Object.keys(capsule).sort()).toEqual(["candidates", "closed", "events"]);
      const entry = (capsule.candidates as Record<string, unknown>[])[0] as Record<string, unknown>;
      expect(
        Object.keys(entry).every((key) => ["id", "decision", "home", "reason"].includes(key)),
      ).toBe(true);
    } finally {
      run.cleanup();
    }
  });

  test("plan mode refuses an invalid candidate and writes no home", async () => {
    const run = await runPromotionCloseout({
      candidates: { "a.yaml": candidateYaml({ scope: "galaxy" }) },
      apply: false,
    });
    try {
      expect(run.exitCode).toBe(0);
      const data = run.data as Record<string, unknown>;
      expect(data.capsule).toBeUndefined();
      const steps = data.steps as Record<string, unknown>[];
      const capsuleStep = steps.find((step) => step.stepId === "capsule");
      expect(capsuleStep?.outcome).toBe("would-refuse");
      expect(run.memory.read("README.md")).not.toContain("review-catch-fixture");
    } finally {
      run.cleanup();
    }
  });
});
