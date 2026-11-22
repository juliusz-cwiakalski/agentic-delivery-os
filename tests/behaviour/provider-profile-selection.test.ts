/**
 * TC-PROFILE-006..011, 053 — declarative selection heuristics, the hard
 * capability gate, eligibility order, selection events, and 100-run replay.
 */
import { describe, expect, test } from "bun:test";
import {
  createProviderFactsProbe,
  familyDiversityAllowed,
  resolveProfileForSpawn,
  scoreProfileTask,
  selectProfile,
} from "../../packages/core/src/provider/index";
import { createParkRecord, parkView } from "../../packages/core/src/provider/parks";
import { createResolvedProviderProbe } from "../../packages/cli/src/edge";
import type {
  ProviderDescriptor,
  ProviderWatchTarget,
} from "../../packages/core/src/contracts/index";
import {
  available,
  capabilityChain,
  capabilitySubstitutionChain,
  descriptorChain,
  exhausted,
  mixedChain,
  noSupplierChain,
  profile,
  seat,
  substitutionChain,
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
    expect(result.code).toBe("provider.profile.capability-denied");
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

/* ------------------------------------------------------------------------- *
 * GH-377 — recorded parks are eligibility inputs.
 * ------------------------------------------------------------------------- */

const parkedEntries: Readonly<Record<string, ProviderDescriptor>> = {
  "coding-plan": { name: "coding-plan", class: "subscription", enabled: true },
  deepseek: { name: "deepseek", class: "pay-per-token", enabled: true },
};

const selectionOverPark = (cause: "peak-window" | "quota-exhausted") => {
  const park = createParkRecord({
    subjectKind: "provider",
    subjectName: "coding-plan",
    cause,
    conditions: [cause],
    createdAtMs: NOW - 1_000,
    expiresAtMs: NOW + 3_600_000,
    evidence: {},
  });
  return selectProfile({
    profiles: mixedChain(),
    probe: createResolvedProviderProbe(parkedEntries, NOW, undefined, {
      parks: { ok: true, value: [parkView(park, NOW)] },
    }),
    nowMs: NOW,
  });
};

describe("GH-377 TC-PROFILE-061 a peak park and a quota park are one eligibility rule", () => {
  test("the cause changes only the blocker value", () => {
    const peak = selectionOverPark("peak-window");
    const quota = selectionOverPark("quota-exhausted");
    if (!peak.ok || !quota.ok) throw new Error("selection failed");
    expect(peak.decision.profile).toBe("deepseek");
    expect(quota.decision.profile).toBe("deepseek");
    expect(peak.decision.seatModels).toEqual(quota.decision.seatModels);
    expect(peak.decision.seatModels.pm).toBe("deepseek-reasoner");
    expect(peak.decision.eligibility.map((entry) => entry.profile)).toEqual(
      quota.decision.eligibility.map((entry) => entry.profile),
    );
    expect(peak.decision.eligibility[0]?.verdict).toBe("ineligible");
    expect(peak.decision.eligibility[0]?.blockers[0]).toMatchObject({
      kind: "condition",
      value: "peak-window",
    });
    expect(quota.decision.eligibility[0]?.blockers[0]).toMatchObject({
      kind: "condition",
      value: "quota-exhausted",
    });
    const peakEvidence = { ...peak.events[0]?.evidence };
    const quotaEvidence = { ...quota.events[0]?.evidence };
    expect({ ...peakEvidence, blockers: undefined }).toEqual({
      ...quotaEvidence,
      blockers: undefined,
    });
  });
});

/* ------------------------------------------------------------------------- *
 * GH-377 — seat-level re-check, substitution, and the named refusal.
 * ------------------------------------------------------------------------- */

const seatEntries: Readonly<Record<string, ProviderDescriptor>> = {
  a: { name: "a", class: "subscription", enabled: true },
  b: { name: "b", class: "subscription", enabled: true },
  parked: { name: "parked", class: "pay-per-token", enabled: true },
};

const seatWatch = (maxAgeSeconds: number): ProviderWatchTarget => ({
  mapping: "deepseek-balance",
  endpoint: "https://watch.example/balance",
  credentialRef: "watch",
  maxAgeSeconds,
});

const parkedProbe = (kind: "park" | "stale" | "none") => {
  if (kind === "none") {
    return createResolvedProviderProbe(seatEntries, NOW, undefined, {
      parks: { ok: true, value: [] },
    });
  }
  if (kind === "stale") {
    return createResolvedProviderProbe(seatEntries, NOW, undefined, {
      parks: { ok: true, value: [] },
      watch: { parked: seatWatch(60) },
      observations: { parked: { condition: "clear", observedAtMs: NOW - 60_000 } },
    });
  }
  const park = createParkRecord({
    subjectKind: "provider",
    subjectName: "parked",
    cause: "quota-exhausted",
    conditions: ["quota-exhausted"],
    createdAtMs: NOW - 1_000,
    expiresAtMs: NOW + 3_600_000,
    evidence: {},
  });
  return createResolvedProviderProbe(seatEntries, NOW, undefined, {
    parks: { ok: true, value: [parkView(park, NOW)] },
  });
};

describe("GH-377 TC-PROFILE-066 a declared or rung seat model on a recorded-unavailable provider is substituted", () => {
  test("the declared-seat arm substitutes the seat and emits the substitute model", () => {
    const profiles = substitutionChain();
    const probe = parkedProbe("park");
    const result = selectProfile({ profiles, probe, nowMs: NOW, agent: "pm" });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("primary");
    expect(result.decision.tier).toBe("regular");
    expect(result.decision.rung).toBe("base");
    expect(result.decision.seatModels.pm).toBe("b/secondary-model");
    expect(result.decision.eligibility.map((entry) => entry.verdict)).toEqual([
      "eligible",
      "shadowed",
      "shadowed",
    ]);

    const spawn = resolveProfileForSpawn({
      profiles,
      probe,
      nowMs: NOW,
      agent: "pm",
      namePrefix: "TEST",
    });
    if (!spawn.ok) throw new Error("spawn resolution failed");
    expect(Object.values(spawn.variables)).toContain("b/secondary-model");
    expect(Object.values(spawn.variables)).not.toContain("parked/parked-model");
  });

  test("the rung arm substitutes the supplied execution model", () => {
    const result = selectProfile(
      { profiles: substitutionChain(), probe: parkedProbe("park"), nowMs: NOW, agent: "pm" },
      {
        rung: "conserve",
        seatModels: {
          pm: "parked/parked-model",
          coder: "a/coder-model",
          reviewer: "a/reviewer-model",
        },
      },
    );
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.rung).toBe("conserve");
    expect(result.decision.seatModels.pm).toBe("b/secondary-model");
  });

  test("the stale-observation variant produces the same substitution", () => {
    for (const kind of ["park", "stale"] as const) {
      const result = selectProfile({
        profiles: substitutionChain(),
        probe: parkedProbe(kind),
        nowMs: NOW,
        agent: "pm",
      });
      if (!result.ok) throw new Error(`selection failed for ${kind}`);
      expect(result.decision.seatModels.pm, kind).toBe("b/secondary-model");
    }
  });

  test("the no-park control emits the selected profile's declared model unchanged", () => {
    const result = selectProfile({
      profiles: substitutionChain(),
      probe: parkedProbe("none"),
      nowMs: NOW,
      agent: "pm",
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.seatModels.pm).toBe("parked/parked-model");
  });
});

describe("GH-377 TC-PROFILE-067 an agent override routing to a recorded-unavailable seat is substituted", () => {
  test("the override mapping is unchanged while the seat takes the substitute model", () => {
    const profiles = substitutionChain();
    const probe = parkedProbe("park");
    const result = selectProfile({ profiles, probe, nowMs: NOW, agent: "reviewer" });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.agentOverrides).toEqual({ reviewer: "pm" });
    expect(result.decision.seatModels.pm).toBe("b/secondary-model");

    const spawn = resolveProfileForSpawn({
      profiles,
      probe,
      nowMs: NOW,
      agent: "reviewer",
      namePrefix: "TEST",
    });
    if (!spawn.ok) throw new Error("spawn resolution failed");
    expect(Object.values(spawn.variables)).toContain("b/secondary-model");
    expect(Object.values(spawn.variables)).not.toContain("parked/parked-model");
  });
});

describe("GH-377 TC-PROFILE-068 substitution is per-seat routing with an unchanged eligibility list", () => {
  test("only the affected seat changes; profile, tier, rung, overrides and the list do not", () => {
    const profiles = substitutionChain();
    const healthy = selectProfile({ profiles, probe: parkedProbe("none"), nowMs: NOW, agent: "pm" });
    const parked = selectProfile({ profiles, probe: parkedProbe("park"), nowMs: NOW, agent: "pm" });
    if (!healthy.ok || !parked.ok) throw new Error("selection failed");
    expect(parked.decision.profile).toBe(healthy.decision.profile);
    expect(parked.decision.tier).toBe(healthy.decision.tier);
    expect(parked.decision.rung).toBe(healthy.decision.rung);
    expect(parked.decision.agentOverrides).toEqual(healthy.decision.agentOverrides);
    expect(parked.decision.eligibility).toEqual(healthy.decision.eligibility);
    expect(parked.decision.seatModels.coder).toBe(healthy.decision.seatModels.coder);
    expect(parked.decision.seatModels.reviewer).toBe(healthy.decision.seatModels.reviewer);
    expect(parked.decision.seatModels.pm).not.toBe(healthy.decision.seatModels.pm);
    expect(parked.events.map((event) => event.code)).toEqual(["profile.selected"]);
  });
});

describe("GH-377 TC-PROFILE-069 a capability-inadequate substitute is not used", () => {
  test("an inadequate later seat yields the unavailable refusal; an adequate one supplies the seat", () => {
    const inadequate = selectProfile({
      profiles: substitutionChain(),
      probe: parkedProbe("park"),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    expect(inadequate.ok).toBe(false);
    if (inadequate.ok) return;
    expect(inadequate.code).toBe("provider.profile.unavailable");
    expect(inadequate.summary).toContain("pm");
    expect(inadequate.summary).toContain("parked");

    const adequate = selectProfile({
      profiles: capabilitySubstitutionChain(),
      probe: parkedProbe("park"),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    if (!adequate.ok) throw new Error("selection failed");
    expect(adequate.decision.seatModels.pm).toBe("b/capable-model");
  });

  test("the selected profile's own capability-inadequate seat keeps capability-denied", () => {
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
    expect(result.code).toBe("provider.profile.capability-denied");
    expect(result.events[0]?.evidence.reason).toBe("capability-gate");
  });
});

describe("GH-377 TC-PROFILE-070 no valid substitute refuses unavailable, naming seat and provider", () => {
  test("the eligibility list is carried unchanged and no profile event is emitted", () => {
    const profiles = noSupplierChain();
    const probe = parkedProbe("park");
    const result = selectProfile({ profiles, probe, nowMs: NOW, agent: "pm" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("provider.profile.unavailable");
    expect(result.summary).toContain("pm");
    expect(result.summary).toContain("parked");
    expect(result.eligibility).toEqual([
      { profile: "primary", verdict: "eligible", blockers: [] },
      { profile: "narrow", verdict: "shadowed", blockers: [] },
    ]);
    expect(result.events).toEqual([]);

    const outcome = resolveProfileForSpawn({
      profiles,
      probe,
      nowMs: NOW,
      agent: "pm",
      namePrefix: "TEST",
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? undefined : outcome.events).toEqual([]);
  });
});

describe("GH-377 TC-PROFILE-092 profile.ineligible names park causes and watch-stale", () => {
  test("park and stale arms report no-eligible-profile with the named blockers", () => {
    const parkArm = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": exhausted("coding-plan"),
        deepseek: exhausted("deepseek"),
      }),
      nowMs: NOW,
    });
    expect(parkArm.ok).toBe(false);
    if (parkArm.ok) return;
    expect(parkArm.code).toBe("provider.profile.unavailable");
    expect(parkArm.events[0]?.evidence.reason).toBe("no-eligible-profile");
    expect(parkArm.events[0]?.evidence.blockers).toContain("mixed:condition:quota-exhausted");

    const staleProbe = createResolvedProviderProbe(
      {
        "coding-plan": { name: "coding-plan", class: "subscription", enabled: true },
        deepseek: { name: "deepseek", class: "pay-per-token", enabled: true },
      },
      NOW,
      undefined,
      {
        parks: { ok: true, value: [] },
        watch: { "coding-plan": seatWatch(60), deepseek: seatWatch(60) },
        observations: {
          "coding-plan": { condition: "clear", observedAtMs: NOW - 60_000 },
          deepseek: { condition: "clear", observedAtMs: NOW - 60_000 },
        },
      },
    );
    const staleArm = selectProfile({ profiles: mixedChain(), probe: staleProbe, nowMs: NOW });
    expect(staleArm.ok).toBe(false);
    if (staleArm.ok) return;
    expect(staleArm.events[0]?.evidence.reason).toBe("no-eligible-profile");
    expect(staleArm.events[0]?.evidence.blockers).toContain("mixed:condition:watch-stale");
  });

  test("capability-only keeps its precedence; a mixed arm reports no-eligible-profile", () => {
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
    const capabilityOnly = selectProfile({
      profiles: textOnly,
      probe: createProviderFactsProbe({ cheap: available(), pricey: available() }),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    expect(capabilityOnly.ok).toBe(false);
    if (capabilityOnly.ok) return;
    expect(capabilityOnly.code).toBe("provider.profile.capability-denied");
    expect(capabilityOnly.events[0]?.evidence.reason).toBe("capability-gate");

    const mixed = selectProfile({
      profiles: capabilityChain(),
      probe: createProviderFactsProbe({
        cheap: available(),
        pricey: exhausted("pricey"),
      }),
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    expect(mixed.ok).toBe(false);
    if (mixed.ok) return;
    expect(mixed.code).toBe("provider.profile.unavailable");
    expect(mixed.events[0]?.evidence.reason).toBe("no-eligible-profile");
  });
});

describe("GH-377 TC-PROFILE-094 the seat gate is not widened", () => {
  const gateChain = (model: string) => ({
    tiers: { t: { name: "t" } },
    profiles: {
      base: profile({
        name: "base",
        tier: "t",
        providers: ["a"],
        seats: { pm: seat(model, "judgment", "text-only") },
      }),
      alt: profile({
        name: "alt",
        tier: "t",
        providers: ["b"],
        seats: { pm: seat("b/alt-model", "judgment", "text-only") },
      }),
    },
    preferenceChain: { base: "base", fallbacks: ["alt"], order: ["base", "alt"] },
  });

  test("undeclared, disabled and peak-parked seat providers keep delivered behaviour", () => {
    const arms = [
      {
        name: "undeclared",
        entries: {
          a: seatEntries.a,
          b: seatEntries.b,
        } as Readonly<Record<string, ProviderDescriptor>>,
      },
      {
        name: "disabled",
        entries: {
          ...seatEntries,
          ghost: { name: "ghost", class: "pay-per-token" as const, enabled: false },
        },
      },
      {
        name: "peak",
        entries: {
          ...seatEntries,
          ghost: {
            name: "ghost",
            class: "pay-per-token" as const,
            enabled: true,
            peak: {
              timezone: "UTC",
              startSecondsOfDay: 0,
              endSecondsOfDay: 86_399,
              bufferSeconds: 0,
            },
          },
        },
      },
    ];
    for (const arm of arms) {
      const probe = createResolvedProviderProbe(arm.entries, NOW, undefined, {
        parks: { ok: true, value: [] },
      });
      const outcome = resolveProfileForSpawn({
        profiles: gateChain("ghost/ghost-model"),
        probe,
        nowMs: NOW,
        agent: "pm",
        namePrefix: "TEST",
      });
      if (!outcome.ok) throw new Error(`refused in ${arm.name} arm`);
      expect(outcome.selection.ok, arm.name).toBe(true);
      if (!outcome.selection.ok) return;
      expect(outcome.selection.decision.profile, arm.name).toBe("base");
      expect(outcome.selection.decision.seatModels.pm, arm.name).toBe("ghost/ghost-model");
      expect(Object.values(outcome.variables), arm.name).toContain("ghost/ghost-model");
      expect(
        outcome.selection.decision.eligibility.flatMap((entry) => entry.blockers),
        arm.name,
      ).toEqual([]);
    }
  });
});
