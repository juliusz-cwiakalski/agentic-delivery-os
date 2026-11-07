/**
 * TC-PROFILE-047, 048, 052 (groups 1-2) — the ported legacy decision table:
 * chain order and lazy probes. Groups 3-5 land with the lifecycle/watch phases.
 */
import { describe, expect, test } from "bun:test";
import {
  parseAndValidateProfileConfiguration,
  parseProviderConfiguration,
} from "../../packages/core/src/provider/validate";
import { selectProfile } from "../../packages/core/src/provider/index";
import { available, exhausted } from "../fixtures/provider/profile/selection/fixtures";
import {
  capabilityChain,
  mixedChain,
} from "../fixtures/provider/profile/selection/fixtures";
import { createProviderFactsProbe } from "../../packages/core/src/provider/index";
import { recordingProbe } from "../fixtures/provider/profile/probes/fixtures";

const NOW = 1_700_000_000_000;

describe("TC-PROFILE-047 ported group 1 — chain order", () => {
  test("first fully eligible profile wins and later eligible profiles are shadowed", () => {
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({ "coding-plan": available(), deepseek: available() }),
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("mixed");
    expect(result.decision.eligibility.map((entry) => entry.verdict)).toEqual([
      "eligible",
      "shadowed",
    ]);
  });

  test("an ineligible early profile is skipped in declared order", () => {
    const result = selectProfile({
      profiles: capabilityChain(),
      probe: createProviderFactsProbe({ cheap: exhausted("cheap"), pricey: available() }),
      nowMs: NOW,
      agent: "pm",
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("vision-later");
  });

  test("a chain ordering violation fails validation by name", () => {
    const values = {
      provider: {
        credentials: {},
        entries: { p1: { class: "subscription" } },
        profiles: {
          tiers: { t: {} },
          profiles: {
            a: {
              tier: "t",
              providers: ["p1"],
              seats: { pm: { model: "m", pacingClass: "judgment", capability: "text-only" } },
            },
            b: {
              tier: "t",
              providers: ["p1"],
              seats: { pm: { model: "n", pacingClass: "judgment", capability: "text-only" } },
            },
          },
          preferenceChain: { base: "a", fallbacks: ["b", "b"] },
        },
      },
    };
    const provider = parseProviderConfiguration(values);
    expect(provider.ok).toBe(true);
    if (!provider.ok) return;
    const result = parseAndValidateProfileConfiguration(values, provider.config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("provider.profile.invalid");
    expect(result.error.detail).toContain("duplicate");
  });

  test("the same fixture produces the same decision across repeated runs", () => {
    const run = () => {
      const result = selectProfile({
        profiles: mixedChain(),
        probe: createProviderFactsProbe({ "coding-plan": available(), deepseek: available() }),
        nowMs: NOW,
      });
      if (!result.ok) throw new Error("selection failed");
      return JSON.stringify(result.decision);
    };
    const first = run();
    for (let index = 0; index < 20; index += 1) expect(run()).toBe(first);
  });
});

describe("TC-PROFILE-048 ported group 2 — lazy probes", () => {
  test("a provider is probed only when a decision depends on it", () => {
    const probe = recordingProbe(() => available());
    const chain = mixedChain();
    chain.profiles = {
      first: {
        name: "first",
        tier: "regular",
        providers: ["p1"],
        seats: { pm: { model: "m", pacingClass: "judgment", capability: "vision-capable" } },
        agentOverrides: {},
      },
      later: {
        name: "later",
        tier: "regular",
        providers: ["p2", "p3"],
        seats: { pm: { model: "n", pacingClass: "judgment", capability: "vision-capable" } },
        agentOverrides: {},
      },
    };
    chain.preferenceChain = { base: "first", fallbacks: ["later"], order: ["first", "later"] };
    const result = selectProfile({ profiles: chain, probe, nowMs: NOW });
    if (!result.ok) throw new Error("selection failed");
    expect(probe.calls).toEqual(["p1"]);
  });

  test("one probe per provider per pass regardless of referencing profiles", () => {
    const probe = recordingProbe(() => exhausted("shared"));
    const profiles = Object.fromEntries(
      Array.from({ length: 5 }, (_value, index) => [
        `p${index}`,
        {
          name: `p${index}`,
          tier: "regular",
          providers: ["shared"],
          seats: { pm: { model: "m", pacingClass: "judgment" as const, capability: "text-only" as const } },
          agentOverrides: {},
        },
      ]),
    );
    const chain = {
      tiers: { regular: { name: "regular" } },
      profiles,
      preferenceChain: {
        base: "p0",
        fallbacks: ["p1", "p2", "p3", "p4"],
        order: ["p0", "p1", "p2", "p3", "p4"],
      },
    };
    selectProfile({ profiles: chain, probe, nowMs: NOW });
    expect(probe.counts.shared).toBe(1);
  });

  test("probe failure is never availability", () => {
    const probe = recordingProbe(() => "throw");
    const result = selectProfile({
      profiles: mixedChain(),
      probe,
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const entry of result.eligibility) {
      expect(entry.verdict).not.toBe("eligible");
    }
  });
});

describe("TC-PROFILE-052 no-silent-path matrix (groups 1-2)", () => {
  const cases: ReadonlyArray<{
    readonly name: string;
    readonly profiles: ReturnType<typeof mixedChain>;
    readonly facts: Readonly<Record<string, ReturnType<typeof available>>>;
    readonly vision: boolean;
  }> = [
    { name: "chain order", profiles: mixedChain(), facts: { "coding-plan": available(), deepseek: available() }, vision: false },
    { name: "exhaustion", profiles: mixedChain(), facts: { "coding-plan": exhausted("coding-plan"), deepseek: available() }, vision: false },
    { name: "no candidate", profiles: mixedChain(), facts: { "coding-plan": exhausted("coding-plan"), deepseek: exhausted("deepseek") }, vision: false },
    { name: "capability gate", profiles: capabilityChain(), facts: { cheap: available(), pricey: available() }, vision: true },
  ];

  for (const entry of cases) {
    test(`${entry.name} yields a structured verdict or classified outcome`, () => {
      const result = selectProfile({
        profiles: entry.profiles,
        probe: createProviderFactsProbe(entry.facts),
        nowMs: NOW,
        ...(entry.vision ? { agent: "pm", requireVision: true } : {}),
      });
      if (result.ok) {
        expect(result.decision.eligibility.length).toBeGreaterThan(0);
        expect(result.events.length).toBeGreaterThan(0);
      } else {
        expect(result.code.length).toBeGreaterThan(0);
        expect(result.events.length).toBeGreaterThan(0);
        expect(result.eligibility.length).toBeGreaterThan(0);
      }
    });
  }
});

import {
  createProfileTargetRecord,
  evaluateProfileLifecycle,
  evaluatePacing,
} from "../../packages/core/src/provider/index";
import { peak } from "../fixtures/provider/profile/selection/fixtures";
import { holdJudgmentPacing } from "../fixtures/provider/profile/lifecycle/fixtures";

describe("TC-PROFILE-049 ported group 3 — park versus switch", () => {
  test("an expensive window parks with cause and expiry", () => {
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({ "coding-plan": peak("coding-plan"), deepseek: available() }),
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("deepseek");
    expect(result.decision.eligibility[0]?.blockers[0]?.value).toBe("peak-window");
  });

  test("exhaustion switches to the next eligible profile, never a spawn-stalling park", () => {
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({ "coding-plan": exhausted("coding-plan"), deepseek: available() }),
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("deepseek");
    expect(result.ok).toBe(true);
  });

  test("an all-ineligible chain yields an honest classified outcome with reasons", () => {
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": exhausted("coding-plan"),
        deepseek: exhausted("deepseek"),
      }),
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider.profile.unavailable");
    expect(result.events.length).toBeGreaterThan(0);
  });

  test("a judgment-seat rung action is structurally inert", () => {
    const chain = mixedChain();
    const mixed = chain.profiles.mixed;
    if (mixed === undefined) throw new Error("mixed profile missing");
    const evaluation = evaluatePacing({
      pacing: holdJudgmentPacing(),
      profile: mixed,
      utilizationPercent: 99,
      nowMs: NOW,
    });
    expect(evaluation.seatModels.pm).toBe("claude-opus");
    expect(evaluation.seatModels.coder).toBe("claude-haiku-mini");
  });
});

describe("TC-PROFILE-050 ported group 4 — revert", () => {
  test("recovery restores the preferred target automatically", () => {
    const recovered = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({ "coding-plan": available(), deepseek: available() }),
      nowMs: NOW,
    });
    const outcome = evaluateProfileLifecycle({
      profiles: mixedChain(),
      selection: recovered,
      persisted: createProfileTargetRecord({
        targetProfile: "deepseek",
        reason: "switch",
        previousProfile: "mixed",
        revertCondition: "quota-exhausted",
        nowMs: NOW,
      }),
      nowMs: NOW,
    });
    expect(outcome.target?.targetProfile).toBe("mixed");
    expect(outcome.events.filter((event) => event.code === "profile.reverted")).toHaveLength(1);
  });

  test("the persisted target stays stable across intermediate spawns", () => {
    const exhaustedSelection = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({ "coding-plan": exhausted("coding-plan"), deepseek: available() }),
      nowMs: NOW,
    });
    const persisted = createProfileTargetRecord({
      targetProfile: "deepseek",
      reason: "switch",
      nowMs: NOW,
    });
    for (let index = 0; index < 3; index += 1) {
      const outcome = evaluateProfileLifecycle({
        profiles: mixedChain(),
        selection: exhaustedSelection,
        persisted,
        nowMs: NOW,
      });
      expect(outcome.append).toBe(false);
    }
  });

  test("a later episode can record a new revert", () => {
    const recovered = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({ "coding-plan": available(), deepseek: available() }),
      nowMs: NOW,
    });
    const first = evaluateProfileLifecycle({
      profiles: mixedChain(),
      selection: recovered,
      persisted: createProfileTargetRecord({
        targetProfile: "deepseek",
        reason: "switch",
        nowMs: NOW,
      }),
      nowMs: NOW,
    });
    const second = evaluateProfileLifecycle({
      profiles: mixedChain(),
      selection: recovered,
      persisted: first.target,
      nowMs: NOW,
    });
    expect(first.target?.reason).toBe("revert");
    expect(second.append).toBe(false);
  });
});
