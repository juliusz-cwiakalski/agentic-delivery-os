/**
 * TC-PROFILE-043/044 (golden half) — normalized provider profile resolve data
 * and human output. No absolute paths, wall-clock timestamps, or unstable order.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createProviderFactsProbe,
  evaluateProfileLifecycle,
  selectProfile,
} from "../../packages/core/src/provider/index";
import { eligibility, selectedResult } from "../fixtures/provider/profile/golden/data";
import { runGolden } from "../fixtures/provider/profile/golden/run";
import { lifecycleChain } from "../fixtures/provider/profile/lifecycle/fixtures";
import { available, mixedChain, peak } from "../fixtures/provider/profile/selection/fixtures";

const ENGINE_NOW = 1_700_000_000_000;

const GOLDEN = "tests/fixtures/provider/profile/golden";
const golden = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(process.cwd(), GOLDEN, name), "utf8")) as Record<string, unknown>;
const text = (name: string): string =>
  readFileSync(join(process.cwd(), GOLDEN, name), "utf8").trim();

describe("TC-PROFILE-044 profile-resolve golden", () => {
  test("machine data matches the committed golden", async () => {
    const result = await runGolden(["profile", "resolve", "--for-spawn", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout) as { data: unknown };
    expect(envelope.data).toMatchObject(golden("profile-resolve.json"));
  });

  test("human output matches the committed golden", async () => {
    const result = await runGolden(["profile", "resolve"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(text("profile-resolve.txt"));
  });
});

describe("TC-PROFILE-024..028 engine-path switch/revert golden", () => {
  test("the real selection and lifecycle compose the switched and reverted outcomes", () => {
    const profiles = lifecycleChain();
    const switchedSelection = selectProfile({
      profiles,
      probe: createProviderFactsProbe({
        "coding-plan": peak("coding-plan"),
        deepseek: available(),
      }),
      nowMs: ENGINE_NOW,
    });
    if (!switchedSelection.ok) throw new Error("switched selection failed");
    const switched = evaluateProfileLifecycle({
      profiles,
      selection: switchedSelection,
      nowMs: ENGINE_NOW,
      providerName: "coding-plan",
    });
    if (!switched.selection.ok) throw new Error("switched projection failed");
    if (switched.target === undefined) throw new Error("switch target missing");

    // Normalized machine shape the CLI envelope projects (engine-path output).
    expect({
      outcome: switched.selection.outcome,
      profile: switched.selection.decision.profile,
      tier: switched.selection.decision.tier,
      target: {
        targetProfile: switched.target.targetProfile,
        reason: switched.target.reason,
        previousProfile: switched.target.previousProfile,
        revertCondition: switched.target.revertCondition,
      },
      events: switched.events.map((event) => ({ code: event.code, evidence: event.evidence })),
    }).toEqual({
      outcome: "switched",
      profile: "deepseek",
      tier: "powerful",
      target: {
        targetProfile: "deepseek",
        reason: "switch",
        previousProfile: "mixed",
        revertCondition: "peak-window",
      },
      events: [
        {
          code: "profile.selected",
          evidence: {
            profileName: "deepseek",
            tier: "powerful",
            rung: "base",
            reason: "selection",
            blockers: ["condition:peak-window"],
          },
        },
        {
          code: "profile.switched",
          evidence: {
            profileName: "deepseek",
            previousProfile: "mixed",
            newProfile: "deepseek",
            reason: "switch",
            revertCondition: "peak-window",
            providerName: "coding-plan",
          },
        },
      ],
    });

    const recoveredSelection = selectProfile({
      profiles,
      probe: createProviderFactsProbe({
        "coding-plan": available(),
        deepseek: available(),
      }),
      nowMs: ENGINE_NOW,
    });
    if (!recoveredSelection.ok) throw new Error("recovered selection failed");
    const reverted = evaluateProfileLifecycle({
      profiles,
      selection: recoveredSelection,
      persisted: switched.target,
      nowMs: ENGINE_NOW,
      providerName: "coding-plan",
    });
    if (!reverted.selection.ok) throw new Error("reverted projection failed");
    if (reverted.target === undefined) throw new Error("revert target missing");
    expect(reverted.selection.outcome).toBe("reverted");
    expect(reverted.target).toMatchObject({
      targetProfile: "mixed",
      reason: "revert",
      previousProfile: "deepseek",
      revertCondition: "peak-window",
    });
    expect(reverted.events.filter((event) => event.code === "profile.reverted")).toHaveLength(1);
  });
});

describe("GH-377 TC-PROFILE-089/090 recorded-park and healthy selections", () => {
  test("TC-PROFILE-089 the golden decision is the recorded-park selection", async () => {
    const result = await runGolden(["profile", "resolve", "--for-spawn", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout) as { readonly data: Record<string, unknown> };
    expect(envelope.data.profile).toBe("deepseek");
    expect(eligibility[0]).toMatchObject({ profile: "mixed", verdict: "ineligible" });
    expect(eligibility[0]?.blockers.some((blocker) => blocker.value === "quota-exhausted")).toBe(
      true,
    );
    expect(selectedResult().ok && selectedResult().decision.seatModels.pm).toBe(
      "deepseek-reasoner",
    );
    const envRecord = envelope.data.envRecord as {
      readonly entries: readonly Record<string, unknown>[];
    };
    expect(envRecord.entries.map((entry) => entry.value)).toContain("deepseek-reasoner");
  });

  test("TC-PROFILE-090 healthy facts select the preferred profile and its declared seats", () => {
    const healthy = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": available(),
        deepseek: available(),
      }),
      nowMs: ENGINE_NOW,
    });
    if (!healthy.ok) throw new Error("healthy selection failed");
    expect(healthy.decision.profile).toBe("mixed");
    expect(healthy.decision.seatModels.pm).toBe("claude-opus");
    expect(golden("profile-resolve.json").profile).toBe("deepseek");
  });
});
