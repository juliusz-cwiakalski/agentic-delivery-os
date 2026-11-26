/**
 * TC-PEAK-035 — a separately invoked stop hands off through the durable record;
 * the owning invocation withholds classification for at least the applied grace
 * plus one observation cadence, re-reads the park, and waits and resumes
 * (GH-413 F-9, AC-F9-4, DM-8, DM-9, DEC-15).
 */
import { describe, expect, test } from "bun:test";
import type { QueueParkRecord } from "../../packages/core/src/contracts/index";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

const UNTIL = new Date(atUtcHour(10)).toISOString();

const operatorPark = (recordedAtMs: number): QueueParkRecord => ({
  schema: "delivery.queue.park.v1",
  ref: "GH-413",
  repository: "github.com/owner/repo",
  cause: "peak-window",
  conditionType: "provider-window",
  condition: { type: "provider-window", expiresAt: UNTIL },
  recheckMs: 60_000,
  evaluatedAt: new Date(recordedAtMs).toISOString(),
  recoveryState: "parked",
  providerProfile: "delivery",
  until: UNTIL,
  graceDeadline: new Date(recordedAtMs + 20_000).toISOString(),
  windowEnd: UNTIL,
  stoppedAt: new Date(recordedAtMs).toISOString(),
  preservation: "preserved",
  episodeId: "episode-operator",
  recordedAt: new Date(recordedAtMs).toISOString(),
});

describe("TC-PEAK-035 the owning invocation takes the stop hand-off after collection", () => {
  test("the post-collection re-read finds the park, waits, resumes, and returns one result", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-stop-handoff",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
      watchEnabled: false,
      standingParkVisibleAtMs: atUtcHour(6, 30) + 1_000,
    });
    // The separate stop command writes the park after the owning invocation's
    // collection has resolved but within the grace-plus-cadence withhold.
    peak.parks.push(operatorPark(atUtcHour(6, 30) + 1_000));
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.episode?.episodeId).toBe("episode-operator");
      expect(run.envelope?.data?.episode?.resumedAt).toBeDefined();
      expect(run.envelope?.data?.lastMessage).toContain("paused until");
      expect(run.envelope?.data?.lastMessage).toContain("resumed at");
      expect(peak.resumed()).toBe(1);
      const recovered = peak.parks.find((park) => park.recoveryState === "recovered");
      expect(recovered?.episodeId).toBe("episode-operator");
    } finally {
      scenario.dispose();
    }
  });

  test("a park already durable before collection takes the same wait and resume path", async () => {
    const { peak, scenario } = createPeakScenario({
      label: "gh413-stop-handoff-durable",
      startMs: atUtcHour(6, 30),
      rules: { ...RULES_BY_PROFILE },
      nomination: "delivery",
      watchEnabled: false,
      standingParkVisibleAtMs: atUtcHour(6, 30) + 1_000,
    });
    peak.parks.push(operatorPark(atUtcHour(6, 30)));
    try {
      const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data?.episode?.episodeId).toBe("episode-operator");
      expect(peak.resumed()).toBe(1);
    } finally {
      scenario.dispose();
    }
  });
});
