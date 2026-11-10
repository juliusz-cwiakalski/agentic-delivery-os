/**
 * TC-HOLDQUEUE-004 engine half (GH-280) — the dispatch claim seam refuses an
 * active owner hold with the existing `queue.precondition.unmet` identity, the
 * engine carries the additive bounded summary, and the refusal is a classified
 * user-validation refusal at exit 1 with zero leases, sessions, attempts,
 * divergences, handover records, or authority changes.
 */
import { describe, expect, test } from "bun:test";
import {
  readDispatchAttempts,
  readDispatchDivergences,
  readDispatchHandover,
} from "../../packages/core/src/app/index";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";

const SUMMARY = "reason=owner-hold; owner hold active (marker): peak-hour cost pause";

describe("TC-HOLDQUEUE-004 a held dispatch is a classified user-validation refusal", () => {
  test("the claim seam refuses with the existing identity and the bounded summary", async () => {
    const scenario = createCommandScenario({
      claim: { ok: false, code: "queue.precondition.unmet", summary: SUMMARY },
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      expect(run.envelope?.error?.code).toBe("queue.precondition.unmet");
      expect(run.envelope?.error?.summary).toBe(SUMMARY);
      expect(run.envelope?.error?.category).toBe("user");
      expect(run.envelope?.error?.consequence).toBe("not_landed");
      expect(scenario.calls.claims).toEqual(["claim"]);
      expect(scenario.calls.spawn).toBe(0);
      expect(scenario.calls.resume).toBe(0);
      expect(scenario.calls.releases).toEqual([]);

      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok ? attempts.records : []).toEqual([]);
      const divergences = readDispatchDivergences(scenario.state.store);
      expect(divergences.ok ? divergences.records : []).toEqual([]);
      const handover = readDispatchHandover(scenario.state.store);
      expect(handover.ok ? handover.records : []).toEqual([]);
    } finally {
      scenario.dispose();
    }
  });

  test("a no-hold control claims and proceeds to the spawn seam", async () => {
    const scenario = createCommandScenario();
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).not.toBe(1);
      expect(scenario.calls.claims).toEqual(["claim"]);
    } finally {
      scenario.dispose();
    }
  });
});
