/**
 * TC-PEAK-014 — one result states paused and resumed, or the refusal and the
 * park end, with the additive bounded episode fact (GH-413 F-7, AC-F7-1, DM-4,
 * DM-5; the refusal arm is AC-F4-3).
 */
import { describe, expect, test } from "bun:test";
import {
  createCommandScenario,
  createPeakScenario,
  readsFrom,
} from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

describe("TC-PEAK-014 a resumed episode returns one result that states the pause and resume", () => {
  test("the token and exit match the no-episode control and the episode fact is bounded", async () => {
    const { scenario } = createPeakScenario({
      label: "gh413-result-resumed",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
    });
    const control = createCommandScenario({
      label: "gh413-result-control",
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom(),
      nowIso: () => new Date(atUtcHour(11)).toISOString(),
      livenessIntervalMs: 30_000,
      leaseTtlMs: 90_000,
      collectAfterPolls: 2,
      nominate: () => ({ ok: true, profile: "delivery" }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      const baseline = await control.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(baseline.exit);
      expect(run.envelope?.data?.result).toBe(baseline.envelope?.data?.result);
      expect(run.envelope?.data?.episode).toMatchObject({
        cause: "peak-window",
        until: "2026-11-12T10:00:00.000Z",
      });
      expect(run.envelope?.data?.episode?.episodeId).toBeDefined();
      expect(run.envelope?.data?.episode?.resumedAt).toBeDefined();
      expect(run.envelope?.data?.lastMessage).toContain("peak-window: paused until");
      expect(run.envelope?.data?.lastMessage).toContain("resumed at");
      expect(baseline.envelope?.data?.episode).toBeUndefined();
    } finally {
      scenario.dispose();
      control.dispose();
    }
  });
});

describe("TC-PEAK-014 a refused recovery names the refusal and the park end", () => {
  test("the result is the delivered derivation and the episode fact carries the refusal", async () => {
    const { scenario } = createPeakScenario({
      label: "gh413-result-refused",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
      preservation: "session-state-not-preserved",
      restartCount: 0,
      restartBound: 3,
      prefillCost: 100,
      uniqueProgress: 0,
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.data?.episode?.refusal).toBe("dispatch.resume-uneconomical");
      expect(run.envelope?.data?.lastMessage).toContain("recovery refused");
      expect(run.envelope?.data?.lastMessage).toContain("2026-11-12T10:00:00.000Z");
    } finally {
      scenario.dispose();
    }
  });
});
