/**
 * TC-PROFILE-012..015 — lazy and memoized probes, fail-loud probe failure, and
 * the NFR-6 evaluation-cost bound (GAP-T6).
 */
import { describe, expect, test } from "bun:test";
import type { ProviderProfileConfiguration } from "../../packages/core/src/contracts/index";
import { selectProfile } from "../../packages/core/src/provider/index";
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
