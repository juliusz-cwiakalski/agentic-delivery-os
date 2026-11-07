/** TC-CAP-023 — one promotion decision per candidate; durable vs output shapes. */
import { describe, expect, test } from "bun:test";
import { candidateYaml, runPromotionCloseout } from "../fixtures/capsule/promotion";

describe("TC-CAP-023 promotion decisions", () => {
  test("each candidate has one durable event and one output projection", async () => {
    const run = await runPromotionCloseout({
      candidates: {
        "a.yaml": candidateYaml({ id: "first-candidate" }),
        "b.yaml": candidateYaml({ id: "second-candidate", class: "fact" }),
      },
    });
    try {
      expect(run.exitCode).toBe(0);
      const candidates = ((run.data?.capsule ?? {}) as Record<string, unknown>)
        .candidates as Record<string, unknown>[];
      expect(candidates.length).toBe(2);
      const events = run.capsule.read("GH-183");
      expect(events.ok).toBe(true);
      if (!events.ok) return;
      const promotions = events.events.filter((event) => event.kind === "capsule.promotion");
      expect(promotions.length).toBe(2);
      const durable = promotions[0]?.payload as Record<string, unknown>;
      expect(Object.keys(durable).sort()).toEqual(
        ["class", "decision", "home", "id", "mode"].sort(),
      );
      const projected = candidates[0] as Record<string, unknown>;
      expect(Object.keys(projected).sort()).toEqual(["decision", "home", "id"]);
    } finally {
      run.cleanup();
    }
  });
});
