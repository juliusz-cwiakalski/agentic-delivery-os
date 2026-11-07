/**
 * TC-PROFILE-006..011, 053 — declarative selection heuristics, the hard
 * capability gate, eligibility order, selection events, and 100-run replay.
 */
import { describe, expect, test } from "bun:test";
import {
  createProviderFactsProbe,
  familyDiversityAllowed,
  scoreProfileTask,
  selectProfile,
} from "../../packages/core/src/provider/index";
import {
  available,
  capabilityChain,
  descriptorChain,
  exhausted,
  mixedChain,
} from "../fixtures/provider/profile/selection/fixtures";

const NOW = 1_700_000_000_000;

describe("TC-PROFILE-006 declarative selection heuristics", () => {
  const facts = { consequenceOfError: 3, reasoningDepth: 4, volume: 2 };
  const policy = {
    consequenceWeight: 1,
    reasoningDepthWeight: 1,
    volumeWeight: 1,
    amplificationThreshold: 12,
    amplificationMultiplier: 2,
    familyDiversityMax: 2,
  };

  test("scores consequence x reasoning depth / volume as declared", () => {
    expect(scoreProfileTask(facts, policy)).toBe(6);
  });

  test("two policies differing only in a declared weight score differently", () => {
    const heavier = { ...policy, reasoningDepthWeight: 2 };
    expect(scoreProfileTask(facts, heavier)).toBe(24);
  });

  test("amplification is applied only at the declared threshold", () => {
    expect(scoreProfileTask(facts, { ...policy, amplificationThreshold: 7 })).toBe(6);
    expect(scoreProfileTask(facts, { ...policy, amplificationThreshold: 6 })).toBe(12);
  });

  test("family diversity is read from the declared cap", () => {
    expect(familyDiversityAllowed(0, policy)).toBe(true);
    expect(familyDiversityAllowed(1, policy)).toBe(true);
    expect(familyDiversityAllowed(2, policy)).toBe(false);
    expect(familyDiversityAllowed(1, { ...policy, familyDiversityMax: 1 })).toBe(false);
  });

  test("100 replays of the same facts produce identical scores", () => {
    const first = scoreProfileTask(facts, policy);
    for (let index = 0; index < 100; index += 1) {
      expect(scoreProfileTask(facts, policy)).toBe(first);
    }
  });
});

describe("TC-PROFILE-007 selection event", () => {
  test("exactly one event carries profile, tier, rung, reason, and refused blockers", () => {
    const facts = { "coding-plan": exhausted("coding-plan"), deepseek: available() };
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    const event = result.events[0];
    expect(event?.code).toBe("profile.selected");
    expect(event?.evidence.profileName).toBe("deepseek");
    expect(event?.evidence.tier).toBe("powerful");
    expect(event?.evidence.rung).toBe("base");
    expect(event?.evidence.reason).toBe("selection");
    expect(event?.evidence.blockers).toContain("condition:quota-exhausted");
  });

  test("the event identity is deterministic and a changed rung produces a new identity", () => {
    const facts = { "coding-plan": available(), deepseek: available() };
    const first = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
    });
    const second = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
    });
    if (!first.ok || !second.ok) throw new Error("selection failed");
    expect(first.events[0]?.identity).toBe(second.events[0]?.identity);
    const rungChanged = selectProfile(
      { profiles: mixedChain(), probe: createProviderFactsProbe(facts), nowMs: NOW },
      { rung: "conserve" },
    );
    if (!rungChanged.ok) throw new Error("selection failed");
    expect(rungChanged.events[0]?.identity).not.toBe(first.events[0]?.identity);
  });

  test("the event carries no secret or raw vendor body", () => {
    const canary = "CANARY-SECRET-abc123";
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": available(canary),
        deepseek: available(canary),
      }),
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(JSON.stringify(result.events)).not.toContain(canary);
  });
});

describe("TC-PROFILE-008 hard capability gate", () => {
  test("a text-only first candidate is refused for a vision task regardless of position", () => {
    const result = selectProfile({
      profiles: capabilityChain(),
      probe: createProviderFactsProbe({ cheap: available(), pricey: available() }),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.profile).toBe("vision-later");
    const refused = result.decision.eligibility.find(
      (entry) => entry.profile === "text-only-first",
    );
    expect(refused?.verdict).toBe("ineligible");
    expect(refused?.blockers.some((blocker) => blocker.kind === "capability")).toBe(true);
    expect(result.decision.seatModels.pm).toBe("vision-model");
  });

  test("the refusal is unchanged when the text-only candidate has more quota headroom", () => {
    const result = selectProfile({
      profiles: capabilityChain(),
      probe: createProviderFactsProbe({
        cheap: available("weekly 1%, 5h window 1%"),
        pricey: available("weekly 95%, 5h window 95%"),
      }),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("vision-later");
    expect(
      result.decision.eligibility.find((entry) => entry.profile === "text-only-first")?.verdict,
    ).toBe("ineligible");
  });
});

describe("TC-PROFILE-009 the gate reads declared descriptors, not names", () => {
  test("a vision-named text-only profile is refused; a neutral-named capable profile is eligible", () => {
    const result = selectProfile({
      profiles: descriptorChain(),
      probe: createProviderFactsProbe({ p1: available() }),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("text-named-vision");
    expect(
      result.decision.eligibility.find((entry) => entry.profile === "vision-named-text-only")
        ?.verdict,
    ).toBe("ineligible");
  });

  test("inverting the descriptors inverts the outcome", () => {
    const chain = descriptorChain();
    const first = chain.profiles["vision-named-text-only"];
    const second = chain.profiles["text-named-vision"];
    if (first === undefined || second === undefined) throw new Error("fixtures missing");
    const inverted = {
      ...chain,
      profiles: {
        "vision-named-text-only": {
          ...first,
          seats: {
            pm: { model: "same-model", pacingClass: "judgment", capability: "vision-capable" },
          },
        },
        "text-named-vision": {
          ...second,
          seats: { pm: { model: "same-model", pacingClass: "judgment", capability: "text-only" } },
        },
      },
    };
    const result = selectProfile({
      profiles: inverted,
      probe: createProviderFactsProbe({ p1: available() }),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("vision-named-text-only");
  });
});

describe("TC-PROFILE-010 no capable candidate fails closed", () => {
  test("every refused profile names the capability blocker and no target is fabricated", () => {
    const chain = capabilityChain();
    const textOnly = {
      ...chain,
      profiles: {
        "text-only-first": chain.profiles["text-only-first"],
        "vision-later": {
          ...chain.profiles["vision-later"],
          seats: {
            pm: {
              model: "vision-model",
              pacingClass: "judgment" as const,
              capability: "text-only" as const,
            },
          },
        },
      },
    };
    const result = selectProfile({
      profiles: textOnly,
      probe: createProviderFactsProbe({ cheap: available(), pricey: available() }),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider.profile.unavailable");
    expect(result.eligibility).toHaveLength(2);
    for (const entry of result.eligibility) {
      expect(entry.verdict).toBe("ineligible");
      expect(entry.blockers.some((blocker) => blocker.kind === "capability")).toBe(true);
    }
    expect(result.events[0]?.code).toBe("profile.ineligible");
  });
});

describe("TC-PROFILE-011 eligibility requires every provider; first fully eligible wins", () => {
  test("the first profile is ineligible when one of its providers is unavailable", () => {
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": exhausted("coding-plan"),
        deepseek: available(),
      }),
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("deepseek");
    expect(result.decision.eligibility.map((entry) => entry.profile)).toEqual([
      "mixed",
      "deepseek",
    ]);
    const mixed = result.decision.eligibility[0];
    expect(mixed?.verdict).toBe("ineligible");
    expect(mixed?.blockers.some((blocker) => blocker.value === "quota-exhausted")).toBe(true);
  });

  test("later eligible profiles are shadowed-equivalent, not omitted", () => {
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": available(),
        deepseek: available(),
      }),
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("mixed");
    const deepseek = result.decision.eligibility.find((entry) => entry.profile === "deepseek");
    expect(deepseek?.verdict).toBe("shadowed");
    expect(deepseek?.blockers).toEqual([]);
  });

  test("every profile receives exactly one verdict in chain order", () => {
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": available(),
        deepseek: available(),
      }),
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.eligibility).toHaveLength(2);
    expect(new Set(result.decision.eligibility.map((entry) => entry.profile)).size).toBe(2);
  });
});

describe("TC-PROFILE-053 100-run deterministic replay", () => {
  test("identical facts produce byte-identical decisions and event identities", () => {
    const facts = { "coding-plan": available(), deepseek: available() };
    const first = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
    });
    if (!first.ok) throw new Error("selection failed");
    const expected = JSON.stringify(first);
    const identities = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      const result = selectProfile({
        profiles: mixedChain(),
        probe: createProviderFactsProbe(facts),
        nowMs: NOW,
      });
      if (!result.ok) throw new Error("selection failed");
      expect(JSON.stringify(result)).toBe(expected);
      identities.add(result.events[0]?.identity ?? "");
    }
    expect(identities.size).toBe(1);
  });
});
