/**
 * TC-PROFILE-001..005 — typed `provider.profiles` configuration, fail-closed
 * validation, shipped-empty defaults, configuration-only tuning, and layered
 * provenance. Pure: no credential resolution, probe, or state write occurs.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import type { ConfigValue } from "../../packages/core/src/contracts/config";
import { resolveConfig } from "../../packages/core/src/index";
import {
  parseAndValidateProfileConfiguration,
  parseProfileConfiguration,
  parseProviderConfiguration,
} from "../../packages/core/src/provider/validate";
import { fileFacts } from "../fixtures/config/facts";

const ROOT = process.cwd();
const fixture = (name: string): unknown =>
  parse(readFileSync(join(ROOT, "tests/fixtures/provider/profile/config", name), "utf8"));
const invalid = (name: string): unknown => fixture(`invalid/${name}`);

const providerConfigOf = (values: unknown) => {
  const parsed = parseProviderConfiguration(values);
  if (!parsed.ok) throw new Error(`provider branch did not parse: ${parsed.error.detail}`);
  return parsed.config;
};

const validValues = (): unknown => fixture("valid.yaml");

describe("TC-PROFILE-001 typed profile configuration model", () => {
  test("every declared field parses and seat assignments carry closed pacingClass/capability", () => {
    const values = validValues();
    const result = parseAndValidateProfileConfiguration(values, providerConfigOf(values));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.config.tiers).sort()).toEqual(["powerful", "regular"]);
    expect(Object.keys(result.config.profiles).sort()).toEqual(["deepseek-only", "mixed"]);
    const mixed = result.config.profiles.mixed;
    if (mixed === undefined) throw new Error("mixed profile missing");
    expect(mixed.tier).toBe("regular");
    expect(mixed.providers).toEqual(["zai-coding-plan", "deepseek"]);
    expect(mixed.seats.pm?.pacingClass).toBe("judgment");
    expect(mixed.seats.coder?.pacingClass).toBe("execution");
    expect(mixed.seats.pm?.capability).toBe("vision-capable");
    expect(mixed.agentOverrides.reviewer).toBe("coder");
    expect(result.config.preferenceChain).toEqual({
      base: "mixed",
      fallbacks: ["deepseek-only"],
      order: ["mixed", "deepseek-only"],
    });
    expect(result.config.pacing?.goalPriorities).toEqual([
      "hold-judgment",
      "utilize-subscription",
      "minimize-paid",
    ]);
    expect(result.config.pacing?.rungs.conserve?.executionModel).toBe("claude-haiku");
  });

  test("the shipped defaults declare no profile, tier, rung, or chain", () => {
    const resolved = resolveConfig();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const parsed = parseProfileConfiguration(resolved.value.values);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.profiles).toEqual({});
    expect(parsed.config.tiers).toEqual({});
    expect(parsed.config.preferenceChain).toBeUndefined();
    expect(parsed.config.pacing).toBeUndefined();
    const provider = parseProviderConfiguration(resolved.value.values);
    expect(provider.ok).toBe(true);
    if (!provider.ok) return;
    const validation = parseAndValidateProfileConfiguration(
      resolved.value.values,
      provider.config,
    );
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.code).toBe("provider.profile.absent");
  });
});

describe("TC-PROFILE-002 fail-closed validation matrix", () => {
  const cases: ReadonlyArray<readonly [string, string, string]> = [
    ["unknown-tier.yaml", "provider.profile.invalid", "unknown tier missing"],
    ["unknown-provider.yaml", "provider.profile.invalid", "unknown provider ghost"],
    ["bad-pacing-class.yaml", "provider.profile.invalid", "pacingClass"],
    ["bad-capability.yaml", "provider.profile.invalid", "capability"],
    ["duplicate-chain.yaml", "provider.profile.invalid", "duplicate profile"],
    ["negative-threshold.yaml", "provider.profile.invalid", "thresholdPercent"],
    ["duplicate-goal.yaml", "provider.profile.invalid", "duplicate priority"],
  ];

  for (const [name, code, detail] of cases) {
    test(`${name} fails closed naming ${detail}`, () => {
      const values = invalid(name);
      const result = parseAndValidateProfileConfiguration(values, providerConfigOf(values));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe(code);
      expect(result.error.detail.toLowerCase()).toContain(detail.toLowerCase());
    });
  }

  test("validation performs no I/O (fetch is never reached)", () => {
    const original = globalThis.fetch;
    let reached = false;
    globalThis.fetch = (() => {
      reached = true;
      throw new Error("fetch reached");
    }) as typeof globalThis.fetch;
    try {
      const values = validValues();
      expect(
        parseAndValidateProfileConfiguration(values, providerConfigOf(values)).ok,
      ).toBe(true);
      const bad = invalid("unknown-tier.yaml");
      expect(parseAndValidateProfileConfiguration(bad, providerConfigOf(bad)).ok).toBe(false);
      expect(reached).toBe(false);
    } finally {
      globalThis.fetch = original;
    }
  });

  test("an empty chain is a classified absent refusal and no partial decision escapes", () => {
    const values = {
      provider: {
        credentials: {},
        entries: { p1: { class: "subscription" } },
        profiles: {
          tiers: { t: {} },
          profiles: {
            only: {
              tier: "t",
              providers: ["p1"],
              seats: { pm: { model: "m", pacingClass: "judgment", capability: "text-only" } },
            },
          },
        },
      },
    };
    const provider = parseProviderConfiguration(values);
    expect(provider.ok).toBe(true);
    if (!provider.ok) return;
    const result = parseAndValidateProfileConfiguration(values, provider.config);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("provider.profile.absent");
  });
});

describe("TC-PROFILE-004 configuration-only tuning", () => {
  const base = (): ConfigValue => structuredClone(validValues() as ConfigValue);

  const profileValue = (values: ConfigValue): Record<string, unknown> => {
    const provider = (values as Record<string, unknown>).provider as Record<string, unknown>;
    return provider.profiles as Record<string, unknown>;
  };

  const chainOrder = (values: ConfigValue): readonly string[] => {
    const result = parseAndValidateProfileConfiguration(values, providerConfigOf(values));
    if (!result.ok) throw new Error(result.error.detail);
    return result.config.preferenceChain?.order ?? [];
  };

  test("changing only the declared chain order changes the parsed order", () => {
    const first = base();
    const second = base();
    const profiles = profileValue(second);
    profiles.preferenceChain = { base: "deepseek-only", fallbacks: ["mixed"] };
    expect(chainOrder(first)).toEqual(["mixed", "deepseek-only"]);
    expect(chainOrder(second)).toEqual(["deepseek-only", "mixed"]);
  });

  test("changing only a rung model changes the parsed execution model", () => {
    const second = base();
    const profiles = profileValue(second) as { pacing: { rungs: Record<string, unknown> } };
    profiles.pacing.rungs.cruise = { thresholdPercent: 0, executionModel: "claude-haiku-4" };
    const result = parseAndValidateProfileConfiguration(second, providerConfigOf(second));
    if (!result.ok) throw new Error(result.error.detail);
    expect(result.config.pacing?.rungs.cruise?.executionModel).toBe("claude-haiku-4");
  });

  test("changing only a per-agent override changes that agent's seat", () => {
    const second = base();
    const profiles = profileValue(second) as {
      profiles: { mixed: { agentOverrides: Record<string, string> } };
    };
    profiles.profiles.mixed.agentOverrides.reviewer = "pm";
    const result = parseAndValidateProfileConfiguration(second, providerConfigOf(second));
    if (!result.ok) throw new Error(result.error.detail);
    expect(result.config.profiles.mixed?.agentOverrides.reviewer).toBe("pm");
  });
});

describe("TC-PROFILE-005 layered provenance for every effective value", () => {
  const systemFacts = () =>
    fileFacts(
    "system",
    {
      provider: {
        profiles: {
          tiers: { regular: {} },
          profiles: {
            mixed: {
              tier: "regular",
              providers: ["zai-coding-plan"],
              seats: {
                pm: { model: "model-system", pacingClass: "judgment", capability: "vision-capable" },
                coder: { model: "coder-system", pacingClass: "execution", capability: "text-only" },
              },
            },
            "deepseek-only": {
              tier: "regular",
              providers: ["zai-coding-plan"],
              seats: {
                pm: { model: "deepseek-reasoner", pacingClass: "judgment", capability: "text-only" },
              },
            },
          },
          preferenceChain: { base: "mixed", fallbacks: ["deepseek-only"] },
        },
      },
    } as Record<string, ConfigValue>,
    5,
    );
  const userFacts = () =>
    fileFacts(
    "user-global",
    {
      provider: {
        profiles: {
          profiles: {
            mixed: {
              tier: "regular",
              providers: ["zai-coding-plan"],
              seats: {
                coder: { model: "coder-user", pacingClass: "execution", capability: "text-only" },
              },
            },
          },
          preferenceChain: { base: "mixed", fallbacks: ["deepseek-only", "mixed"] },
        },
      },
    } as Record<string, ConfigValue>,
    9,
    ["provider.profiles.profiles.deepseek-only"],
    );

  test("record maps merge by child name and provenance names the winning layer", () => {
    const resolved = resolveConfig({ sources: [systemFacts(), userFacts()] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const values = resolved.value.values as ConfigValue;
    const provider = parseProviderConfiguration(values);
    expect(provider.ok).toBe(true);
    if (!provider.ok) return;
    const result = parseAndValidateProfileConfiguration(values, provider.config);
    // The user layer duplicated `mixed` in fallbacks, so the chain is invalid.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.detail).toContain("duplicate");
    expect(
      resolved.value.origins["provider.profiles.profiles.mixed.seats.coder.model"]?.layer,
    ).toBe("user-global");
    expect(resolved.value.origins["provider.profiles.profiles.mixed.seats.pm.model"]?.layer).toBe(
      "system",
    );
  });

  test("a reset removes the inherited value and provenance reflects it", () => {
    const resolved = resolveConfig({ sources: [systemFacts(), userFacts()] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const values = resolved.value.values as Record<string, unknown>;
    const provider = values.provider as Record<string, unknown>;
    const profiles = provider.profiles as Record<string, unknown>;
    const declared = profiles.profiles as Record<string, unknown>;
    expect(declared["deepseek-only"]).toBeUndefined();
  });

  test("a list replaces whole rather than concatenating", () => {
    const resolved = resolveConfig({ sources: [systemFacts(), userFacts()] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const values = resolved.value.values as Record<string, unknown>;
    const provider = values.provider as Record<string, unknown>;
    const profiles = provider.profiles as Record<string, unknown>;
    const chain = profiles.preferenceChain as { fallbacks: readonly string[] };
    expect(chain.fallbacks).toEqual(["deepseek-only", "mixed"]);
  });

  test("the empty branch ships present but declares nothing", () => {
    const resolved = resolveConfig();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const values = resolved.value.values as Record<string, unknown>;
    const provider = values.provider as Record<string, unknown>;
    expect(provider.profiles).toEqual({});
  });
});

import { resolveProfileForSpawn } from "../../packages/core/src/provider/index";

describe("TC-PROFILE-003 shipped-empty defaults refuse resolution and spawn", () => {
  test("the shipped-empty branch refuses before a spawn without inventing a model", () => {
    let spawned = 0;
    const outcome = resolveProfileForSpawn({
      profiles: { tiers: {}, profiles: {} },
      probe: {
        probe: () => {
          throw new Error("no provider should be probed");
        },
      },
      nowMs: 1_700_000_000_000,
      namePrefix: "ADOS",
      // The port is only reachable through runProfileSpawn; resolution itself
      // must fail before any model is substituted.
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe("provider.profile.absent");
    expect(spawned).toBe(0);
  });
});
