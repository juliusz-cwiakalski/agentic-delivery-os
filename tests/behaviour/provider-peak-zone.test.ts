/**
 * GH-350 TC-ZONE-001/002/004/005/006/007/008 — zone-aware peak windows on the
 * declared clock: the grammar and the `UTC` default, the runtime-unknown
 * refusal at the edge, the transition-segment expiry matrix (gap → the
 * transition instant, repeat → the first occurrence), and one boundary truth
 * across the engine gate and the watcher.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decidePeakStops } from "../../packages/core/src/domain/index";
import {
  bindZoneFacts,
  evaluatePeakWindow,
  isZoneNameGrammar,
  normaliseZoneName,
  peakWindowEndInstantMs,
  peakWindowEndSeconds,
  UTC_ZONE_FACTS,
} from "../../packages/core/src/provider/peak";
import { parseProfilePeakWindows } from "../../packages/core/src/provider/peak-rules";
import { parseProviderConfiguration } from "../../packages/core/src/provider/validate";
import {
  BERLIN_STEPS,
  createCountingZonePort,
  SYDNEY_STEPS,
  TOKYO_STEPS,
} from "../fixtures/provider/zone-port";

const ROOT = process.cwd();

const peakBlock = (timezone?: string): Record<string, unknown> => ({
  ...(timezone === undefined ? {} : { timezone }),
  startSecondsOfDay: 0,
  endSecondsOfDay: 86_399,
  bufferSeconds: 0,
});

const configWithPeak = (timezone?: string): unknown => ({
  provider: {
    entries: { "provider-a": { class: "subscription", enabled: true, peak: peakBlock(timezone) } },
    credentials: {},
    chains: { main: { entries: ["provider-a"], allowPaidFallback: false } },
    defaultChain: "main",
  },
});

const profileWindow = (timezone?: string): Record<string, unknown> => ({
  ...(timezone === undefined ? {} : { timezone }),
  startSecondsOfDay: 0,
  endSecondsOfDay: 86_399,
  multiplier: 1,
  bufferBeforeSeconds: 300,
  bufferAfterSeconds: 300,
});

const berlinPort = () => createCountingZonePort({ "Europe/Berlin": BERLIN_STEPS });

describe("GH-350 TC-ZONE-001/002 the declared zone grammar and the UTC default", () => {
  test("both declaring surfaces validate absent/UTC/Etc/UTC/IANA, and the default is UTC", () => {
    for (const timezone of [undefined, "UTC", "Etc/UTC", "Europe/Berlin"]) {
      const descriptor = parseProviderConfiguration(configWithPeak(timezone));
      expect(descriptor.ok, `descriptor ${timezone ?? "absent"}`).toBe(true);
      if (descriptor.ok) {
        expect(descriptor.config.entries["provider-a"]?.peak?.timezone).toBe(
          timezone === "Etc/UTC" ? "UTC" : (timezone ?? "UTC"),
        );
      }
      const profile = parseProfilePeakWindows({
        graceSeconds: 60,
        windows: [profileWindow(timezone)],
      });
      expect(profile.ok, `profile ${timezone ?? "absent"}`).toBe(true);
      if (profile.ok) {
        expect(profile.rules.windows[0]?.timezone).toBe(
          timezone === "Etc/UTC" ? "UTC" : (timezone ?? "UTC"),
        );
      }
    }
    // The retired closed UTC-only set is gone from the contract surface.
    const contracts = readFileSync(join(ROOT, "packages/core/src/contracts/provider.ts"), "utf8");
    expect(contracts).not.toContain("PROVIDER_PEAK_TIMEZONES");
    expect(isZoneNameGrammar("Europe/Berlin")).toBe(true);
    expect(isZoneNameGrammar("utc")).toBe(true); // grammar only; existence is an edge decision
    expect(normaliseZoneName("Etc/UTC")).toBe("UTC");
  });

  test("malformed literals and the length bound refuse with the declaring surface's identity", () => {
    for (const timezone of ["", "1UTC", "-UTC", "Europe/", "Europe//Berlin", "../Europe/Berlin"]) {
      const descriptor = parseProviderConfiguration(configWithPeak(timezone));
      expect(descriptor.ok, timezone).toBe(false);
      if (!descriptor.ok) expect(descriptor.error.detail, timezone).toContain("timezone");
      const profile = parseProfilePeakWindows({
        graceSeconds: 60,
        windows: [profileWindow(timezone)],
      });
      expect(profile.ok, timezone).toBe(false);
      if (!profile.ok) expect(profile.failure.field, timezone).toContain("timezone");
    }
    for (const length of [63, 64, 65]) {
      const name = "A".repeat(length);
      const profile = parseProfilePeakWindows({
        graceSeconds: 60,
        windows: [profileWindow(name)],
      });
      expect(profile.ok, `length ${length}`).toBe(length <= 64);
    }
  });
});

describe("GH-350 TC-ZONE-004 a composition without the port refuses non-UTC and never falls back", () => {
  const now = Date.parse("2026-07-13T10:00:00.000Z");
  const engineFor = (zoneFactsFor?: (zone: string) => ReturnType<typeof bindZoneFacts>) => {
    const credentialPort = {
      resolve: () => {
        throw new Error("credential port must not be reached");
      },
    };
    const transport = {
      send: () => {
        throw new Error("transport must not be reached");
      },
    };
    return {
      credentialPort: credentialPort as never,
      transport: transport as never,
      clock: { nowMs: () => now },
      sleep: { sleep: async () => undefined },
      ...(zoneFactsFor === undefined ? {} : { zoneFactsFor }),
    };
  };

  test("UTC needs no port; non-UTC refuses without one and resolves with one", async () => {
    const { createProviderEngine } = await import("../../packages/core/src/provider/engine");
    const utc = createProviderEngine(engineFor());
    const utcResult = await utc.resolve({
      config: (() => {
        const parsed = parseProviderConfiguration(configWithPeak("UTC"));
        if (!parsed.ok) throw new Error("UTC fixture must parse");
        return parsed.config;
      })(),
    });
    expect(utcResult.ok).toBe(true);

    const berlinConfig = (() => {
      const parsed = parseProviderConfiguration(configWithPeak("Europe/Berlin"));
      if (!parsed.ok) throw new Error("Berlin fixture must parse");
      return parsed.config;
    })();
    const withoutPort = createProviderEngine(engineFor());
    const refused = await withoutPort.resolve({ config: berlinConfig });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.errorCode).toBe("provider.peak.zone-unknown");

    const port = berlinPort();
    const withPort = createProviderEngine(engineFor((zone) => bindZoneFacts(zone, port)));
    const resolved = await withPort.resolve({ config: berlinConfig });
    expect(resolved.ok).toBe(true);
  });
});

describe("GH-350 TC-ZONE-005/006 the exact transition-segment expiry", () => {
  const rule = { endSecondsOfDay: 9_000, bufferAfterSeconds: 0 }; // 02:30 local

  test("spring-forward end inside the gap resolves to the transition instant exactly", () => {
    const port = berlinPort();
    const facts = bindZoneFacts("Europe/Berlin", port);
    const expiry = peakWindowEndInstantMs(Date.parse("2026-03-29T00:00:00.000Z"), facts, rule);
    expect(expiry).toBe(Date.parse("2026-03-29T01:00:00.000Z"));
  });

  test("fall-back end inside the repeated hour resolves to its first occurrence", () => {
    const port = berlinPort();
    const facts = bindZoneFacts("Europe/Berlin", port);
    const expiry = peakWindowEndInstantMs(Date.parse("2026-10-25T00:00:00.000Z"), facts, rule);
    expect(expiry).toBe(Date.parse("2026-10-25T00:30:00.000Z"));
  });

  test("a no-transition zone and a southern-hemisphere winter resolve by plain arithmetic", () => {
    const tokyo = bindZoneFacts(
      "Asia/Tokyo",
      createCountingZonePort({ "Asia/Tokyo": TOKYO_STEPS }),
    );
    expect(
      peakWindowEndInstantMs(Date.parse("2026-03-29T00:00:00.000Z"), tokyo, {
        endSecondsOfDay: 36_000,
        bufferAfterSeconds: 0,
      }),
    ).toBe(Date.parse("2026-03-29T01:00:00.000Z"));
    const sydney = bindZoneFacts(
      "Australia/Sydney",
      createCountingZonePort({ "Australia/Sydney": SYDNEY_STEPS }),
    );
    expect(
      peakWindowEndInstantMs(Date.parse("2026-06-01T00:00:00.000Z"), sydney, {
        endSecondsOfDay: 39_600,
        bufferAfterSeconds: 0,
      }),
    ).toBe(Date.parse("2026-06-01T01:00:00.000Z"));
  });

  test("the buffer edge clamps at the end of day", () => {
    expect(peakWindowEndSeconds({ endSecondsOfDay: 86_100, bufferAfterSeconds: 300 })).toBe(86_400);
    expect(
      peakWindowEndInstantMs(Date.parse("2026-03-29T23:00:00.000Z"), UTC_ZONE_FACTS, {
        endSecondsOfDay: 86_100,
        bufferAfterSeconds: 300,
      }),
    ).toBe(Date.parse("2026-03-30T00:00:00.000Z"));
  });
});

describe("GH-350 TC-ZONE-007 the per-method probe budget", () => {
  test("a gap spends at most three offset probes and three transition lookups, typically 2 + 1", () => {
    const port = berlinPort();
    const facts = bindZoneFacts("Europe/Berlin", port);
    peakWindowEndInstantMs(Date.parse("2026-03-29T00:00:00.000Z"), facts, {
      endSecondsOfDay: 9_000,
      bufferAfterSeconds: 0,
    });
    expect(port.counts.offsetSecondsAt).toBeLessThanOrEqual(3);
    expect(port.counts.nextTransitionAtOrAfter).toBeLessThanOrEqual(3);
    expect(port.counts.offsetSecondsAt).toBe(2);
    expect(port.counts.nextTransitionAtOrAfter).toBe(1);
  });

  test("a no-transition zone spends one offset probe and one transition lookup", () => {
    const port = createCountingZonePort({ "Asia/Tokyo": TOKYO_STEPS });
    const facts = bindZoneFacts("Asia/Tokyo", port);
    peakWindowEndInstantMs(Date.parse("2026-03-29T00:00:00.000Z"), facts, {
      endSecondsOfDay: 36_000,
      bufferAfterSeconds: 0,
    });
    expect(port.counts.offsetSecondsAt).toBe(1);
    expect(port.counts.nextTransitionAtOrAfter).toBe(1);
  });
});

describe("GH-350 TC-ZONE-008 one boundary truth across the gate and the watcher", () => {
  test("the engine expiry and the watcher window end derive from the one named function", () => {
    const now = Date.parse("2026-07-13T10:00:00.000Z"); // local noon in Berlin
    const port = berlinPort();
    const facts = bindZoneFacts("Europe/Berlin", port);
    const window = {
      timezone: "Europe/Berlin",
      startSecondsOfDay: 0,
      endSecondsOfDay: 86_399,
      bufferSeconds: 0,
    };
    const condition = evaluatePeakWindow(window, now, facts);
    expect(condition.status).toBe("parked");
    const expected = peakWindowEndInstantMs(now, facts, {
      endSecondsOfDay: window.endSecondsOfDay,
      bufferAfterSeconds: 0,
    });
    if (condition.status !== "parked") throw new Error(condition.status);
    expect(condition.expiresAtMs).toBe(expected);

    const parsed = parseProfilePeakWindows({
      graceSeconds: 60,
      windows: [
        {
          timezone: "Europe/Berlin",
          startSecondsOfDay: 0,
          endSecondsOfDay: 86_399,
          multiplier: 1,
          bufferBeforeSeconds: 300,
          bufferAfterSeconds: 300,
        },
      ],
    });
    if (!parsed.ok) throw new Error(parsed.failure.detail);
    const decisions = decidePeakStops({
      lanes: [{ ref: "GH-350", providerProfile: "profile-a" }],
      rulesFor: () => parsed.rules,
      zoneFactsFor: () => facts,
      nowMs: now,
      parkedRefs: [],
      newEpisodeId: () => "e1",
    });
    expect(decisions).toHaveLength(1);
    const expectedWatcher = peakWindowEndInstantMs(now, facts, {
      endSecondsOfDay: 86_399,
      bufferAfterSeconds: 300,
    });
    expect(decisions[0]?.windowEnd).toBe(new Date(expectedWatcher).toISOString());
  });

  test("the watcher holds no second instant computation", () => {
    const source = readFileSync(
      join(ROOT, "packages/core/src/domain/daemon-peak-pause.ts"),
      "utf8",
    );
    expect(source).toContain("peakWindowEndInstantMs");
    expect(source).not.toContain("endMsToday");
    expect(source).not.toContain("utcSecondsOfDay");
  });
});

/**
 * GH-350 m1 (review remediation) — the expiry derivation never returns a past
 * instant. When the local reading at `nowMs` is already past the declared end,
 * `nowMs` itself is the earliest instant at or after now whose reading is at or
 * after the end, so the result is clamped rather than fabricated backwards.
 */
describe("GH-350 m1 peakWindowEndInstantMs is clamped at nowMs", () => {
  test("a closed window returns nowMs; an open window returns a future instant", () => {
    const port = berlinPort();
    const facts = bindZoneFacts("Europe/Berlin", port);
    const now = Date.parse("2026-07-13T10:00:00.000Z"); // 12:00 local (+02:00)
    const closed = peakWindowEndInstantMs(now, facts, {
      endSecondsOfDay: 3_600,
      bufferAfterSeconds: 0,
    });
    expect(closed).toBe(now);
    expect(closed).toBeGreaterThanOrEqual(now);
    const open = peakWindowEndInstantMs(now, facts, {
      endSecondsOfDay: 50_400,
      bufferAfterSeconds: 0,
    });
    expect(open).toBeGreaterThan(now);
    expect(open).toBe(Date.parse("2026-07-13T12:00:00.000Z"));
  });
});

/**
 * GH-350 m2 (review remediation) — the declared TC-ZONE-007 probe-budget arms:
 * a multi-transition walk spends exactly three offset probes and three
 * transition lookups, and the segment-3 guard prevents a fourth offset probe.
 */
describe("GH-350 m2 TC-ZONE-007 the 3+3 fixture and the fourth-probe trap", () => {
  const steps = [
    { fromMs: Date.parse("2026-01-01T00:00:00.000Z"), offsetSeconds: 0 },
    { fromMs: Date.parse("2026-01-01T01:00:00.000Z"), offsetSeconds: 60 },
    { fromMs: Date.parse("2026-01-01T02:00:00.000Z"), offsetSeconds: 120 },
    { fromMs: Date.parse("2026-01-01T03:00:00.000Z"), offsetSeconds: 180 },
  ] as const;

  test("two crossed transitions spend 3 + 3 and never a fourth offset probe", () => {
    const port = createCountingZonePort({ "Test/Stepped": steps });
    const facts = bindZoneFacts("Test/Stepped", port);
    const end = peakWindowEndInstantMs(Date.parse("2026-01-01T00:00:00.000Z"), facts, {
      endSecondsOfDay: 86_399,
      bufferAfterSeconds: 86_400,
    });
    expect(end).toBe(Date.parse("2026-01-01T23:58:00.000Z"));
    expect(port.counts.offsetSecondsAt).toBe(3);
    expect(port.counts.nextTransitionAtOrAfter).toBe(3);
  });
});
