/**
 * GH-350 TC-ZONE-003 — a syntactically valid zone the composition cannot
 * resolve refuses `provider.peak.zone-unknown` at exit 1 before any evaluation,
 * with no park, no announcement and no state write; a resolvable twin proceeds.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { resolveAppErrorCode } from "../../packages/cli/src/classify";
import { projectExitCode } from "../../packages/cli/src/projection";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import { bindZoneFacts } from "../../packages/core/src/provider/peak";
import { parseProviderConfiguration } from "../../packages/core/src/provider/validate";
import { BERLIN_STEPS, createCountingZonePort } from "../fixtures/provider/zone-port";

const ROOT = process.cwd();
const now = Date.parse("2026-07-13T10:00:00.000Z");

/** The declared unknown-zone fixture: grammar-valid, runtime-unresolvable. */
const unknownZone = (): string => {
  const document = parse(
    readFileSync(join(ROOT, "tests/fixtures/provider/config/peak-invalid-timezone.yaml"), "utf8"),
  ) as {
    provider: { entries: { bad: { peak: { timezone: string } } } };
  };
  return document.provider.entries.bad.peak.timezone;
};

const configFor = (timezone: string) => {
  const parsed = parseProviderConfiguration({
    provider: {
      entries: {
        "provider-a": {
          class: "subscription",
          enabled: true,
          peak: {
            timezone,
            startSecondsOfDay: 0,
            endSecondsOfDay: 86_399,
            bufferSeconds: 0,
          },
        },
      },
      credentials: {},
      chains: { main: { entries: ["provider-a"], allowPaidFallback: false } },
      defaultChain: "main",
    },
  });
  if (!parsed.ok) throw new Error(parsed.error.detail);
  return parsed.config;
};

const throwingStore = {
  read: () => {
    throw new Error("state store must not be read");
  },
  write: () => {
    throw new Error("state store must not be written");
  },
  transact: () => {
    throw new Error("state store must not be transacted");
  },
};

describe("GH-350 TC-ZONE-003 a runtime-unknown zone refuses by name before evaluation", () => {
  test("a grammar-valid but unresolvable zone refuses: one typed refusal, no writes", async () => {
    const port = createCountingZonePort({ "Europe/Berlin": BERLIN_STEPS });
    const engine = createProviderEngine({
      clock: { nowMs: () => now },
      credentialPort: {
        resolve: () => {
          throw new Error("credential port must not be reached");
        },
      } as never,
      transport: {
        send: () => {
          throw new Error("transport must not be reached");
        },
      } as never,
      sleep: { sleep: async () => undefined },
      stateStore: throwingStore as never,
      zoneFactsFor: (zone) => (port.isKnownZone(zone) ? bindZoneFacts(zone, port) : undefined),
    });
    const result = await engine.resolve({ config: configFor(unknownZone()) });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.errorCode).toBe("provider.peak.zone-unknown");
    expect(result.summary).toContain(unknownZone());
    expect(port.counts.offsetSecondsAt).toBe(0);
    expect(port.counts.nextTransitionAtOrAfter).toBe(0);
  });

  test("the resolvable twin resolves, and the identity projects to exit 1", async () => {
    const port = createCountingZonePort({ "Europe/Berlin": BERLIN_STEPS });
    const engine = createProviderEngine({
      clock: { nowMs: () => now },
      credentialPort: { resolve: () => undefined } as never,
      transport: { send: async () => ({ status: 200, bodyText: "{}" }) } as never,
      sleep: { sleep: async () => undefined },
      zoneFactsFor: (zone) => bindZoneFacts(zone, port),
    });
    const result = await engine.resolve({ config: configFor("Europe/Berlin") });
    expect(result.ok).toBe(true);

    const resolved = resolveAppErrorCode("provider.peak.zone-unknown");
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.entry.projectionClass).toBe("user-validation");
      expect(projectExitCode(resolved.entry.projectionClass)).toBe(1);
    }
  });
});

/**
 * GH-350 B2 (review remediation) — an unresolvable declared zone is never
 * silently evaluated as UTC outside `resolve`/`quota`.
 *
 * The profile probe, the status/dispatch profile-context read and the daemon
 * watcher helper each had a UTC fallback or a silent skip. They now fail closed:
 * the probe marks the provider unavailable for a zone-named reason, the context
 * read returns nothing, and the watcher reports the unknown zone explicitly.
 */
describe("GH-350 B2 an unresolvable zone fails closed on every probe surface", () => {
  const unknown = unknownZone();

  test("the profile probe never reads an unknown zone as UTC", async () => {
    const { createResolvedProviderProbe } = await import("../../packages/cli/src/edge");
    const closedEntries = (timezone: string) => {
      const parsed = parseProviderConfiguration({
        provider: {
          entries: {
            "provider-a": {
              class: "subscription",
              enabled: true,
              peak: {
                timezone,
                startSecondsOfDay: 0,
                endSecondsOfDay: 3_600,
                bufferSeconds: 0,
              },
            },
          },
          credentials: {},
          chains: { main: { entries: ["provider-a"], allowPaidFallback: false } },
          defaultChain: "main",
        },
      });
      if (!parsed.ok) throw new Error(parsed.error.detail);
      return parsed.config.entries;
    };
    const unknownProbe = createResolvedProviderProbe(closedEntries(unknown), now, () => undefined);
    const availability = unknownProbe.probe("provider-a");
    expect(availability.available).toBe(false);
    expect(availability.condition).toBe("provider.peak.zone-unknown");
    expect(availability.source).toContain(unknown);
    expect(availability.blockers.map((blocker) => blocker.detail).join("\n")).toContain(unknown);

    const port = createCountingZonePort({ "Europe/Berlin": BERLIN_STEPS });
    const known = createResolvedProviderProbe(closedEntries("Europe/Berlin"), now, (zone) =>
      port.isKnownZone(zone) ? bindZoneFacts(zone, port) : undefined,
    );
    expect(known.probe("provider-a").available).toBe(true);
  });

  test("the status/dispatch profile-context read returns nothing for an unknown zone", async () => {
    const { resolveProfileContextFrom } = await import("../../packages/cli/src/production");
    const values = (timezone: string) => ({
      provider: {
        entries: {
          "provider-a": {
            class: "subscription",
            enabled: true,
            peak: {
              timezone,
              startSecondsOfDay: 0,
              endSecondsOfDay: 3_600,
              bufferSeconds: 0,
            },
          },
        },
        credentials: {},
        profiles: {
          tiers: { regular: { description: "tier" } },
          profiles: {
            prof: {
              tier: "regular",
              providers: ["provider-a"],
              seats: {
                seat: { model: "model-a", pacingClass: "judgment", capability: "text-only" },
              },
            },
          },
          preferenceChain: { base: "prof" },
        },
      },
    });
    expect(resolveProfileContextFrom(values(unknown), now)).toBeUndefined();
    expect(resolveProfileContextFrom(values("Europe/Berlin"), now)).toBeDefined();
  });

  test("the watcher helper reports the unknown zone instead of a closed UTC window", async () => {
    const { peakWindowOpenAt } = await import("../../packages/core/src/domain/daemon-peak-pause");
    const { parseProfilePeakWindows } = await import("../../packages/core/src/provider/peak-rules");
    const parsed = parseProfilePeakWindows({
      graceSeconds: 60,
      windows: [
        {
          timezone: unknown,
          startSecondsOfDay: 0,
          endSecondsOfDay: 86_399,
          multiplier: 1,
          bufferBeforeSeconds: 60,
          bufferAfterSeconds: 60,
        },
      ],
    });
    if (!parsed.ok) throw new Error(parsed.failure.detail);
    // At noon a 0..86399 window would be OPEN if read as UTC; the only honest
    // answer without facts is the explicit unknown-zone result.
    const result = peakWindowOpenAt(
      parsed.rules,
      Date.parse("2026-07-13T10:00:00.000Z"),
      () => undefined,
    );
    expect(result.open).toBe(false);
    expect(result.windowEnd).toBe("");
    expect(result.unknownZone).toBe(unknown);
  });
});

/**
 * GH-350 n7 (review remediation) — the zone refusal runs before any spend read.
 *
 * The budget gate used to run first, so an unresolvable zone could be masked by
 * a budget refusal (or spend a read) before the zone was validated. The zone
 * refusal is now the first evaluation step.
 */
describe("GH-350 n7 the zone refusal precedes the budget gate", () => {
  test("an unknown zone refuses without resolving a ref or reading spend", async () => {
    const parsed = parseProviderConfiguration({
      provider: {
        entries: {
          "provider-a": {
            class: "subscription",
            enabled: true,
            peak: {
              timezone: unknownZone(),
              startSecondsOfDay: 0,
              endSecondsOfDay: 86_399,
              bufferSeconds: 0,
            },
          },
        },
        credentials: {},
        chains: { main: { entries: ["provider-a"], allowPaidFallback: false } },
        defaultChain: "main",
        budgets: {
          cap: { enabled: true, scope: "window", basis: "cost", ceiling: 10, windowSeconds: 60 },
        },
      },
    });
    if (!parsed.ok) throw new Error(parsed.error.detail);
    let spendReads = 0;
    let refReads = 0;
    const engine = createProviderEngine({
      clock: { nowMs: () => now },
      credentialPort: { resolve: () => undefined } as never,
      transport: { send: async () => ({ status: 200, bodyText: "{}" }) } as never,
      sleep: { sleep: async () => undefined },
      spendTotals: {
        read: async () => {
          spendReads += 1;
          return { status: "empty" };
        },
      },
      resolveWorkItemRef: () => {
        refReads += 1;
        return { status: "resolved", workItemRef: "GH-350" };
      },
      zoneFactsFor: () => undefined,
    });
    const result = await engine.resolve({ config: parsed.config });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected a refusal");
    expect(result.errorCode).toBe("provider.peak.zone-unknown");
    expect(spendReads).toBe(0);
    expect(refReads).toBe(0);
  });
});

/**
 * GH-350 NB5 (review remediation) — the engine's evaluated-entry zone lookup is
 * non-optional. The `?? UTC_ZONE_FACTS` substitution was the exact pattern B2
 * removed from the probe surfaces; the zone refusal runs first, and a lookup
 * that cannot resolve now fails loudly instead of evaluating on UTC.
 */
describe("GH-350 NB5 the engine never substitutes UTC for an evaluated entry", () => {
  test("the evaluated-entry lookup is an assertion, not a fallback", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/provider/engine.ts"), "utf8");
    expect(source).not.toContain("?? UTC_ZONE_FACTS");
    expect(source).toContain("zoneFactsForEvaluatedEntry");
    expect(source).toContain("the zone refusal must run first");
  });
});
