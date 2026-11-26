/**
 * TC-PEAK-003 — paired identical runs produce byte-identical decisions, park
 * records, episode facts, and summaries apart from the intended composition
 * mode value, with no real sleep, network call, or credential read (GH-413
 * F-1, AC-F1-3, NFR-5, NFR-7).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPeakScenario } from "../fixtures/dispatch/golden/harness";
import { atUtcHour, RULES_BY_PROFILE } from "../fixtures/provider/profile/gh413-rules";

const runOnce = async (label: string) => {
  const { peak, scenario } = createPeakScenario({
    label,
    startMs: atUtcHour(6, 30),
    rules: { ...RULES_BY_PROFILE },
    nomination: "delivery",
  });
  try {
    const run = await scenario.invoke(["dispatch", "GH-413", "--json"]);
    return {
      exit: run.exit,
      data: run.envelope?.data,
      parks: peak.parks,
      stops: peak.stopCalls.length,
      resumed: peak.resumed(),
    };
  } finally {
    scenario.dispose();
  }
};

describe("TC-PEAK-003 paired identical runs are byte-identical", () => {
  test("decisions, records, the episode fact, and the summary are stable", async () => {
    const first = await runOnce("gh413-determinism-a");
    const second = await runOnce("gh413-determinism-b");
    expect(first.exit).toBe(second.exit);
    expect(first.stops).toBe(second.stops);
    expect(first.resumed).toBe(second.resumed);
    expect(first.parks).toEqual(second.parks);
    expect(first.data?.episode).toEqual(second.data?.episode);
    expect(first.data?.lastMessage).toBe(second.data?.lastMessage);
    // The one intended composition-fact value is not part of the dispatch
    // result; the lanes read carries it (TC-PEAK-033).
    expect(first.data?.lastMessage).toContain("peak-window: paused until");
  });

  test("the delivering modules carry no real timer, network, or credential read", () => {
    for (const file of [
      "packages/core/src/app/dispatch-peak-pause.ts",
      "packages/core/src/app/dispatch-stop.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      for (const marker of ["setTimeout", "setInterval", "Bun.sleep", "fetch(", "process.env"]) {
        expect(source, `${file}:${marker}`).not.toContain(marker);
      }
    }
  });
});
