/**
 * Committed profile-selection fixtures (GH-234 F-2..F-4). Data only, never a
 * test file: the suites import these factories and inject the port fakes.
 */
import type {
  ProfileHeuristicPolicy,
  ProfileProviderAvailability,
  ProviderProfile,
  ProviderProfileConfiguration,
  ProviderProfileSeat,
} from "../../../../../packages/core/src/contracts/index";

export const seat = (
  model: string,
  pacingClass: "judgment" | "execution",
  capability: "vision-capable" | "text-only",
): ProviderProfileSeat => ({ model, pacingClass, capability });

export const profile = (input: {
  readonly name: string;
  readonly tier: string;
  readonly providers: readonly string[];
  readonly seats: Readonly<Record<string, ProviderProfileSeat>>;
  readonly agentOverrides?: Readonly<Record<string, string>>;
}): ProviderProfile => ({
  name: input.name,
  tier: input.tier,
  providers: input.providers,
  seats: input.seats,
  agentOverrides: input.agentOverrides ?? {},
});

export const available = (source = "clear"): ProfileProviderAvailability => ({
  available: true,
  condition: "clear",
  blockers: [],
  source,
});

export const exhausted = (providerName: string): ProfileProviderAvailability => ({
  available: false,
  condition: "quota-exhausted",
  blockers: [
    {
      kind: "condition",
      value: "quota-exhausted",
      detail: `${providerName}: weekly window at threshold`,
    },
  ],
  source: `${providerName}: weekly window at threshold`,
});

export const peak = (providerName: string): ProfileProviderAvailability => ({
  available: false,
  condition: "peak-window",
  blockers: [
    {
      kind: "condition",
      value: "peak-window",
      detail: `${providerName}: peak window active`,
    },
  ],
  source: `${providerName}: peak window active`,
});

/** The mixed/deepseek chain used by the seed scenarios. */
export const mixedChain = (): ProviderProfileConfiguration => ({
  tiers: { regular: { name: "regular" }, powerful: { name: "powerful" } },
  profiles: {
    mixed: profile({
      name: "mixed",
      tier: "regular",
      providers: ["coding-plan", "deepseek"],
      seats: {
        pm: seat("claude-opus", "judgment", "vision-capable"),
        coder: seat("claude-sonnet", "execution", "text-only"),
      },
      agentOverrides: { reviewer: "coder" },
    }),
    deepseek: profile({
      name: "deepseek",
      tier: "powerful",
      providers: ["deepseek"],
      seats: {
        pm: seat("deepseek-reasoner", "judgment", "text-only"),
        coder: seat("deepseek-chat", "execution", "text-only"),
      },
    }),
  },
  preferenceChain: { base: "mixed", fallbacks: ["deepseek"], order: ["mixed", "deepseek"] },
  pacing: {
    goalPriorities: ["hold-judgment", "utilize-subscription", "minimize-paid"],
    tailThresholdPercent: 80,
    rungs: {
      cruise: { name: "cruise", thresholdPercent: 0, executionModel: "claude-sonnet" },
      conserve: { name: "conserve", thresholdPercent: 70, executionModel: "claude-haiku" },
    },
  },
});

/** A chain whose first candidate is text-only but has the quota advantage. */
export const capabilityChain = (): ProviderProfileConfiguration => ({
  tiers: { regular: { name: "regular" } },
  profiles: {
    "text-only-first": profile({
      name: "text-only-first",
      tier: "regular",
      providers: ["cheap"],
      seats: { pm: seat("cheap-model", "judgment", "text-only") },
    }),
    "vision-later": profile({
      name: "vision-later",
      tier: "regular",
      providers: ["pricey"],
      seats: { pm: seat("vision-model", "judgment", "vision-capable") },
    }),
  },
  preferenceChain: {
    base: "text-only-first",
    fallbacks: ["vision-later"],
    order: ["text-only-first", "vision-later"],
  },
});

/** Two profiles that use the same model but declare opposite descriptors. */
export const descriptorChain = (): ProviderProfileConfiguration => ({
  tiers: { regular: { name: "regular" } },
  profiles: {
    "vision-named-text-only": profile({
      name: "vision-named-text-only",
      tier: "regular",
      providers: ["p1"],
      seats: { pm: seat("same-model", "judgment", "text-only") },
    }),
    "text-named-vision": profile({
      name: "text-named-vision",
      tier: "regular",
      providers: ["p1"],
      seats: { pm: seat("same-model", "judgment", "vision-capable") },
    }),
  },
  preferenceChain: {
    base: "vision-named-text-only",
    fallbacks: ["text-named-vision"],
    order: ["vision-named-text-only", "text-named-vision"],
  },
});

export const policyA = (): ProfileHeuristicPolicy => ({
  consequenceWeight: 1,
  reasoningDepthWeight: 1,
  volumeWeight: 1,
  amplificationThreshold: 12,
  amplificationMultiplier: 2,
  familyDiversityMax: 2,
});

export const policyB = (): ProfileHeuristicPolicy => ({
  ...policyA(),
  reasoningDepthWeight: 2,
});

/**
 * GH-377 seat-level substitution chains: the selected profile is eligible on its
 * declared `providers` while a seat model names a provider outside that list.
 * `parked` is the provider a recorded park or stale observation makes
 * unavailable; `secondary` and `capable` are later suppliers.
 */
export const substitutionChain = (): ProviderProfileConfiguration => ({
  tiers: { regular: { name: "regular" }, fallback: { name: "fallback" } },
  profiles: {
    primary: profile({
      name: "primary",
      tier: "regular",
      providers: ["a"],
      seats: {
        pm: seat("parked/parked-model", "judgment", "vision-capable"),
        coder: seat("a/coder-model", "execution", "text-only"),
        reviewer: seat("a/reviewer-model", "judgment", "text-only"),
      },
      agentOverrides: { reviewer: "pm" },
    }),
    secondary: profile({
      name: "secondary",
      tier: "fallback",
      providers: ["b"],
      seats: {
        pm: seat("b/secondary-model", "judgment", "text-only"),
        coder: seat("b/coder-model", "execution", "text-only"),
      },
    }),
    narrow: profile({
      name: "narrow",
      tier: "fallback",
      providers: ["b"],
      seats: { coder: seat("b/narrow-coder-model", "execution", "text-only") },
    }),
  },
  preferenceChain: {
    base: "primary",
    fallbacks: ["secondary", "narrow"],
    order: ["primary", "secondary", "narrow"],
  },
});

/** The same shape with a capability-adequate later supplier after an inadequate one. */
export const capabilitySubstitutionChain = (): ProviderProfileConfiguration => {
  const chain = substitutionChain();
  return {
    ...chain,
    tiers: { ...chain.tiers, capable: { name: "capable" } },
    profiles: {
      ...chain.profiles,
      capable: profile({
        name: "capable",
        tier: "capable",
        providers: ["b"],
        seats: { pm: seat("b/capable-model", "judgment", "vision-capable") },
      }),
    },
    preferenceChain: {
      base: "primary",
      fallbacks: ["secondary", "capable"],
      order: ["primary", "secondary", "capable"],
    },
  };
};

/** A chain with no later profile that declares the parked seat. */
export const noSupplierChain = (): ProviderProfileConfiguration => {
  const chain = substitutionChain();
  return {
    ...chain,
    preferenceChain: { base: "primary", fallbacks: ["narrow"], order: ["primary", "narrow"] },
  };
};
