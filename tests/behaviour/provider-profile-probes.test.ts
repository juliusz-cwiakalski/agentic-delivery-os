/**
 * TC-PROFILE-012..015 — lazy and memoized probes, fail-loud probe failure, and
 * the NFR-6 evaluation-cost bound (GAP-T6).
 */
import { describe, expect, test } from "bun:test";
import type {
  ProfileProviderAvailability,
  ProviderDescriptor,
  ProviderProfileConfiguration,
  ProviderWatchTarget,
} from "../../packages/core/src/contracts/index";
import { selectProfile, resolveProfileForSpawn } from "../../packages/core/src/provider/index";
import { createParkRecord, parkView } from "../../packages/core/src/provider/parks";
import { createResolvedProviderProbe, type ProviderAvailabilityFacts } from "../../packages/cli/src/edge";
import {
  available,
  exhausted,
  profile,
  seat,
} from "../fixtures/provider/profile/selection/fixtures";
import { recordingProbe } from "../fixtures/provider/profile/probes/fixtures";

const NOW = 1_700_000_000_000;

const chainOf = (
  entries: ReadonlyArray<{
    readonly name: string;
    readonly providers: readonly string[];
    readonly vision?: boolean;
  }>,
): ProviderProfileConfiguration => {
  const profiles = Object.fromEntries(
    entries.map((entry) => [
      entry.name,
      profile({
        name: entry.name,
        tier: "t",
        providers: entry.providers,
        seats: {
          pm: seat(
            `${entry.name}-model`,
            "judgment",
            entry.vision === true ? "vision-capable" : "text-only",
          ),
        },
      }),
    ]),
  );
  const order = entries.map((entry) => entry.name);
  return {
    tiers: { t: { name: "t" } },
    profiles,
    preferenceChain: { base: order[0] ?? "", fallbacks: order.slice(1), order },
  };
};

describe("TC-PROFILE-012 probes are lazy and stop after the decision", () => {
  test("only the selected profile's provider is probed", () => {
    const probe = recordingProbe(() => available());
    const result = selectProfile({
      profiles: chainOf([
        { name: "a", providers: ["p1"] },
        { name: "b", providers: ["p2", "p3"] },
      ]),
      probe,
      nowMs: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.profile).toBe("a");
    expect(probe.calls).toEqual(["p1"]);
    expect(probe.counts.p2).toBeUndefined();
    expect(probe.counts.p3).toBeUndefined();
  });

  test("when the first profile is ineligible the next profile's providers are probed", () => {
    const probe = recordingProbe((providerName) => available(providerName));
    const result = selectProfile({
      profiles: chainOf([
        { name: "a", providers: ["p1"] },
        { name: "b", providers: ["p2", "p3"], vision: true },
      ]),
      probe,
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.profile).toBe("b");
    expect(probe.counts.p1).toBe(1);
    expect(probe.counts.p2).toBe(1);
    expect(probe.counts.p3).toBe(1);
  });
});

describe("TC-PROFILE-013 probes are memoized once per provider per pass", () => {
  test("ten profiles sharing one provider cause exactly one probe", () => {
    const probe = recordingProbe(() => exhausted("p1"));
    const entries = Array.from({ length: 10 }, (_value, index) => ({
      name: `p${index}`.replace("p", "profile-"),
      providers: ["shared"],
    }));
    const result = selectProfile({ profiles: chainOf(entries), probe, nowMs: NOW });
    expect(result.ok).toBe(false);
    expect(probe.counts.shared).toBe(1);
    expect(probe.calls.filter((name) => name === "shared")).toHaveLength(1);
    expect(probe.calls.length).toBeLessThanOrEqual(1);
  });

  test("memoization is per pass, not global", () => {
    const first = recordingProbe(() => exhausted("p1"));
    const second = recordingProbe(() => exhausted("p1"));
    const chain = chainOf([{ name: "only", providers: ["p1"] }]);
    selectProfile({ profiles: chain, probe: first, nowMs: NOW });
    selectProfile({ profiles: chain, probe: second, nowMs: NOW });
    expect(first.counts.p1).toBe(1);
    expect(second.counts.p1).toBe(1);
  });

  test("distinct providers are each probed once and the total is bounded", () => {
    const probe = recordingProbe(() => available());
    const result = selectProfile({
      profiles: chainOf([{ name: "wide", providers: ["p1", "p2", "p3", "p4"] }]),
      probe,
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(probe.counts).toEqual({ p1: 1, p2: 1, p3: 1, p4: 1 });
  });
});

describe("TC-PROFILE-014 probe failure is never availability", () => {
  test("a thrown probe is a provider-outage blocker and the chain continues", () => {
    const probe = recordingProbe((providerName) =>
      providerName === "p1" ? "throw" : available(providerName),
    );
    const result = selectProfile({
      profiles: chainOf([
        { name: "a", providers: ["p1"] },
        { name: "b", providers: ["p2"], vision: true },
      ]),
      probe,
      nowMs: NOW,
      agent: "pm",
      requireVision: true,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(result.decision.profile).toBe("b");
    const refused = result.decision.eligibility[0];
    expect(refused?.verdict).toBe("ineligible");
    expect(refused?.blockers.some((blocker) => blocker.value === "provider-outage")).toBe(true);
  });

  test("an unavailable verdict is a named condition blocker, never clear", () => {
    const probe = recordingProbe(() => exhausted("p1"));
    const result = selectProfile({
      profiles: chainOf([{ name: "a", providers: ["p1"] }]),
      probe,
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.eligibility[0]?.verdict).toBe("ineligible");
    expect(result.eligibility[0]?.blockers[0]?.value).toBe("quota-exhausted");
  });
});

describe("TC-PROFILE-015 evaluation cost of 100 profiles over 100 providers", () => {
  test("pure eligibility evaluation is I/O-free and within the reference bound", () => {
    const providerNames = Array.from({ length: 100 }, (_value, index) => `p${index}`);
    const entries = Array.from({ length: 100 }, (_value, index) => ({
      name: `profile-${index}`,
      providers: providerNames,
    }));
    const chain = chainOf(entries);
    const run = () => {
      const probe = recordingProbe(() => available());
      const result = selectProfile({
        profiles: chain,
        probe,
        nowMs: NOW,
        agent: "pm",
        requireVision: true,
      });
      return { result, probe };
    };
    run(); // warm-up
    const started = performance.now();
    const { result, probe } = run();
    const elapsed = performance.now() - started;
    expect(result.ok).toBe(false);
    expect(probe.calls.length).toBe(100);
    expect(probe.counts.p0).toBe(1);
    expect(elapsed).toBeLessThanOrEqual(50);
  });
});

/* ------------------------------------------------------------------------- *
 * GH-377 — park-aware availability and the watch-observation seam.
 * ------------------------------------------------------------------------- */

const entriesOf = (
  ...names: readonly string[]
): Readonly<Record<string, ProviderDescriptor>> =>
  Object.fromEntries(
    names.map((name) => [name, { name, class: "subscription" as const, enabled: true }]),
  );

const watchTarget = (maxAgeSeconds?: number): ProviderWatchTarget => ({
  mapping: "deepseek-balance",
  endpoint: "https://watch.example/balance",
  credentialRef: "watch",
  ...(maxAgeSeconds === undefined ? {} : { maxAgeSeconds }),
});

const parkedView = (
  providerName: string,
  cause: "peak-window" | "quota-exhausted" | "budget-exhausted" | "provider-outage" | "credential-missing" | "credential-rejected",
  nowMs: number,
) => {
  const park = createParkRecord({
    subjectKind: "provider",
    subjectName: providerName,
    cause,
    conditions: [cause],
    createdAtMs: nowMs - 1_000,
    expiresAtMs: nowMs + 3_600_000,
    evidence: {},
  });
  return parkView(park, nowMs);
};

describe("GH-377 TC-PROFILE-062/063 watch freshness is per declared target", () => {
  const chain = () =>
    chainOf([
      { name: "a", providers: ["p"] },
      { name: "b", providers: ["q"] },
    ]);

  test("TC-PROFILE-062 an observation at the bound blocks as watch-stale", () => {
    const probe = createResolvedProviderProbe(entriesOf("p", "q"), NOW, undefined, {
      watch: { p: watchTarget(60) },
      observations: { p: { condition: "clear", observedAtMs: NOW - 60_000 } },
    });
    const verdict = probe.probe("p");
    expect(verdict.available).toBe(false);
    expect(verdict.condition).toBe("watch-stale");
    expect(verdict.blockers).toHaveLength(1);
    expect(verdict.blockers[0]).toMatchObject({ kind: "condition", value: "watch-stale" });
    expect(String(verdict.blockers[0]?.detail)).toContain("p");
    expect(String(verdict.blockers[0]?.detail)).toContain("60");

    const selection = selectProfile({ profiles: chain(), probe, nowMs: NOW });
    if (!selection.ok) throw new Error("selection failed");
    expect(selection.decision.profile).toBe("b");
    expect(
      selection.decision.eligibility.find((entry) => entry.profile === "a")?.blockers[0]?.value,
    ).toBe("watch-stale");

    const spawn = resolveProfileForSpawn({
      profiles: chain(),
      probe,
      nowMs: NOW,
      agent: "pm",
      namePrefix: "TEST",
    });
    if (!spawn.ok) throw new Error("spawn resolution failed");
    expect(Object.values(spawn.variables).some((value) => value.includes("/p/"))).toBe(false);
  });

  test("TC-PROFILE-063 one second below the bound is available", () => {
    const probe = createResolvedProviderProbe(entriesOf("p", "q"), NOW, undefined, {
      watch: { p: watchTarget(60) },
      observations: { p: { condition: "clear", observedAtMs: NOW - 59_000 } },
    });
    expect(probe.probe("p")).toMatchObject({ available: true, condition: "clear", blockers: [] });
    const selection = selectProfile({ profiles: chain(), probe, nowMs: NOW });
    if (!selection.ok) throw new Error("selection failed");
    expect(selection.decision.profile).toBe("a");
  });
});

describe("GH-377 TC-PROFILE-064 a live read is age zero; an absent observation is not stale", () => {
  test("every live observation is fresh at every validated bound", () => {
    for (const bound of [1, 60, 900]) {
      const probe = createResolvedProviderProbe(entriesOf("p"), NOW, undefined, {
        watch: { p: watchTarget(bound) },
        observations: { p: { condition: "clear", observedAtMs: NOW } },
      });
      expect(probe.probe("p"), `bound ${bound}`).toMatchObject({
        available: true,
        condition: "clear",
      });
    }
  });

  test("an absent observation contributes nothing", () => {
    const probe = createResolvedProviderProbe(entriesOf("p"), NOW, undefined, {
      watch: { p: watchTarget(1) },
    });
    expect(probe.probe("p")).toMatchObject({ available: true, condition: "clear", blockers: [] });
  });
});

describe("GH-377 TC-PROFILE-095 staleness is per declared target; no target is never stale", () => {
  test("a short bound blocks, a long bound stays fresh, and an undeclared target never blocks", () => {
    const probe = createResolvedProviderProbe(entriesOf("short", "long", "none"), NOW, undefined, {
      watch: { short: watchTarget(60), long: watchTarget(900) },
      observations: {
        short: { condition: "clear", observedAtMs: NOW - 120_000 },
        long: { condition: "clear", observedAtMs: NOW - 120_000 },
        none: { condition: "clear", observedAtMs: NOW - 120_000 },
      },
    });
    expect(probe.probe("short")).toMatchObject({ available: false, condition: "watch-stale" });
    expect(String(probe.probe("short").blockers[0]?.detail)).toContain("short");
    expect(probe.probe("long")).toMatchObject({ available: true, condition: "clear" });
    expect(probe.probe("none")).toMatchObject({ available: true, condition: "clear" });

    const below = createResolvedProviderProbe(entriesOf("short"), NOW, undefined, {
      watch: { short: watchTarget(60) },
      observations: { short: { condition: "clear", observedAtMs: NOW - 59_000 } },
    });
    expect(below.probe("short")).toMatchObject({ available: true, condition: "clear" });
  });
});

describe("GH-377 TC-PROFILE-096 only freshness is consumed", () => {
  test("a condition that derived a park is consumed as that park, once", () => {
    const facts = (withPark: boolean): ProviderAvailabilityFacts => ({
      watch: { p: watchTarget(60) },
      observations: { p: { condition: "quota-exhausted", observedAtMs: NOW } },
      ...(withPark
        ? { parks: { ok: true as const, value: [parkedView("p", "quota-exhausted", NOW)] } }
        : {}),
    });
    const withPark = createResolvedProviderProbe(entriesOf("p"), NOW, undefined, facts(true));
    const parkOnly = createResolvedProviderProbe(entriesOf("p"), NOW, undefined, {
      parks: { ok: true as const, value: [parkedView("p", "quota-exhausted", NOW)] },
    });
    const verdict = withPark.probe("p");
    expect(verdict.available).toBe(false);
    expect(verdict.blockers).toHaveLength(1);
    expect(verdict.blockers[0]?.value).toBe("quota-exhausted");
    expect(verdict.condition).toBe(parkOnly.probe("p").condition);

    const fresh = createResolvedProviderProbe(entriesOf("p"), NOW, undefined, facts(false));
    expect(fresh.probe("p")).toMatchObject({ available: true, condition: "clear", blockers: [] });
  });
});

describe("GH-377 TC-PROFILE-097 the three excluded freshness readings fail by name", () => {
  test("global instant, undeclared-target staleness, and all-providers staleness are rejected", () => {
    const probe = createResolvedProviderProbe(entriesOf("short", "long", "none"), NOW, undefined, {
      watch: { short: watchTarget(60), long: watchTarget(900) },
      observations: {
        short: { condition: "clear", observedAtMs: NOW - 120_000 },
        long: { condition: "clear", observedAtMs: NOW - 120_000 },
        none: { condition: "clear", observedAtMs: NOW - 120_000 },
      },
    });
    const names = ["short", "long", "none"];
    const correct = (name: string): boolean => probe.probe(name).available;
    expect(names.filter((name) => correct(name) !== correct(name))).toEqual([]);

    const variants: ReadonlyArray<{ readonly id: string; readonly verdict: (name: string) => boolean }> = [
      { id: "global-instant", verdict: () => false },
      { id: "undeclared-target-stale", verdict: (name) => name !== "none" ? correct(name) : false },
      { id: "all-providers-stale", verdict: () => false },
    ];
    for (const variant of variants) {
      const failures = names
        .filter((name) => variant.verdict(name) !== correct(name))
        .map(() => variant.id);
      expect(failures, variant.id).toContain(variant.id);
    }
  });
});

describe("GH-377 TC-PROFILE-088 a failed fold read is a named unavailable verdict", () => {
  test("the failure is unavailable, never clear, and not cached into a later resolution", () => {
    const failed = createResolvedProviderProbe(entriesOf("p", "q"), NOW, undefined, {
      parks: {
        ok: false,
        error: {
          kind: "state",
          code: "state.store.torn",
          consequence: "not_landed",
          location: { path: "provider.park" },
        },
      },
    });
    const verdict = failed.probe("p");
    expect(verdict.available).toBe(false);
    expect(verdict.condition).toBe("provider-outage");
    expect(verdict.blockers[0]).toMatchObject({ kind: "condition", value: "provider-outage" });

    const chain = chainOf([
      { name: "a", providers: ["p"] },
      { name: "b", providers: ["q"] },
    ]);
    const selection = selectProfile({ profiles: chain, probe: failed, nowMs: NOW });
    expect(selection.ok).toBe(false);
    if (selection.ok) return;
    expect(selection.code).toBe("provider.profile.unavailable");
    const refused = resolveProfileForSpawn({
      profiles: chainOf([{ name: "a", providers: ["p"] }]),
      probe: failed,
      nowMs: NOW,
      agent: "pm",
      namePrefix: "TEST",
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.code).toBe("provider.profile.unavailable");

    const later = createResolvedProviderProbe(entriesOf("p"), NOW, undefined, {
      parks: { ok: true, value: [] },
    });
    expect(later.probe("p")).toMatchObject({ available: true, condition: "clear" });
  });
});
