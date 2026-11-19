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
