/**
 * TC-PROFILE-029..032 — pacing rungs move only execution seats, judgment seats
 * are structurally immovable, declared goal-priority order is precedence, and
 * rung transitions are recorded once per crossing.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { evaluatePacing } from "../../packages/core/src/provider/index";
import {
  parseAndValidateProfileConfiguration,
  parseProviderConfiguration,
} from "../../packages/core/src/provider/validate";
import { mixedChain } from "../fixtures/provider/profile/selection/fixtures";
import {
  holdJudgmentPacing,
  utilizePacing,
} from "../fixtures/provider/profile/lifecycle/fixtures";

const NOW = 1_700_000_000_000;
const profileOf = () => {
  const chain = mixedChain();
  const mixed = chain.profiles.mixed;
  if (mixed === undefined) throw new Error("mixed profile missing");
  return mixed;
};

const models = (utilizationPercent: number, pacing = holdJudgmentPacing()) =>
  evaluatePacing({
    pacing,
    profile: profileOf(),
    utilizationPercent,
    nowMs: NOW,
  });

describe("TC-PROFILE-029 rungs move only execution-class seats", () => {
  test("an execution seat moves per the active rung", () => {
    expect(models(50, utilizePacing()).seatModels.coder).toBe("claude-sonnet-cruise");
    expect(models(75, utilizePacing()).seatModels.coder).toBe("claude-haiku");
    expect(models(95, utilizePacing()).seatModels.coder).toBe("claude-haiku-mini");
  });

  test("a judgment seat is identical at every rung", () => {
    for (const utilization of [0, 50, 70, 80, 90, 100]) {
      expect(models(utilization).seatModels.pm).toBe("claude-opus");
    }
  });

  test("the movement is driven by the typed pacingClass, not by names", () => {
    const evaluation = models(95);
    expect(evaluation.seatModels.pm).toBe("claude-opus");
    expect(evaluation.seatModels.coder).toBe("claude-haiku-mini");
    expect(evaluation.judgmentHeld).toBe(true);
  });
});

describe("TC-PROFILE-030 a judgment seat cannot be moved by rungs", () => {
  test("the judgment model never equals the rung execution model", () => {
    const evaluation = models(95);
    expect(evaluation.seatModels.pm).not.toBe("claude-haiku-mini");
  });

  test("an invalid pacingClass is a classified configuration error", () => {
    const root = process.cwd();
    const values = parse(
      readFileSync(
        join(root, "tests/fixtures/provider/profile/config/invalid/bad-pacing-class.yaml"),
        "utf8",
      ),
    );
    const provider = parseProviderConfiguration(values);
    expect(provider.ok).toBe(true);
    if (!provider.ok) return;
    const result = parseAndValidateProfileConfiguration(values, provider.config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("provider.profile.invalid");
    expect(result.error.detail).toContain("pacingClass");
  });
});

describe("TC-PROFILE-031 goal priorities hold judgment until the declared tail", () => {
  test("hold-judgment first defers execution movement below the tail", () => {
    expect(models(79).seatModels.coder).toBe("claude-sonnet");
    expect(models(80).seatModels.coder).toBe("claude-haiku");
    expect(models(89).seatModels.coder).toBe("claude-haiku");
  });

  test("utilize-subscription first moves execution seats at the rung threshold", () => {
    const pacing = { ...holdJudgmentPacing(), goalPriorities: utilizePacing().goalPriorities };
    expect(models(75, pacing).seatModels.coder).toBe("claude-haiku");
  });

  test("only the declared order differs between the two policies", () => {
    const hold = holdJudgmentPacing();
    const utilize = utilizePacing();
    expect(hold.rungs).toEqual(utilize.rungs);
    expect(hold.tailThresholdPercent).toBe(utilize.tailThresholdPercent);
    expect(hold.goalPriorities).not.toEqual(utilize.goalPriorities);
  });

  test("evaluation is deterministic and reads priorities from configuration", () => {
    const first = JSON.stringify(models(85));
    for (let index = 0; index < 20; index += 1) expect(JSON.stringify(models(85))).toBe(first);
    expect(models(85).reason).toBe("hold-judgment");
  });
});

describe("TC-PROFILE-032 rung transitions are recorded and deduplicated", () => {
  test("crossing a threshold records one transition event", () => {
    const evaluation = models(75);
    const event = evaluatePacing({
      pacing: holdJudgmentPacing(),
      profile: profileOf(),
      utilizationPercent: 75,
      previousRung: "cruise",
      nowMs: NOW,
    });
    expect(evaluation.rung).toBe("conserve");
    expect(event.events).toHaveLength(1);
    expect(event.events[0]?.code).toBe("profile.rung-changed");
    expect(event.events[0]?.evidence.rung).toBe("conserve");
  });

  test("an unchanged rung records no duplicate event", () => {
    const evaluation = evaluatePacing({
      pacing: holdJudgmentPacing(),
      profile: profileOf(),
      utilizationPercent: 75,
      previousRung: "conserve",
      nowMs: NOW,
    });
    expect(evaluation.events).toEqual([]);
  });

  test("crossing back records one new transition", () => {
    const evaluation = evaluatePacing({
      pacing: holdJudgmentPacing(),
      profile: profileOf(),
      utilizationPercent: 0,
      previousRung: "conserve",
      nowMs: NOW,
    });
    expect(evaluation.events).toHaveLength(1);
    expect(evaluation.events[0]?.evidence.rung).toBe("cruise");
  });
});
