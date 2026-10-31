/**
 * TC-PROV-048/062 (hermetic half) — the provider suite performs no live
 * network call, reads no ambient credential, and never sleeps on a real timer.
 */
import { describe, expect, spyOn, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CredentialPort,
  ProviderClock,
  ProviderSleep,
  QuotaTransport,
} from "../../packages/core/src/contracts/index";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import { runProviderLoop } from "../../packages/core/src/provider/loop";

const ROOT = process.cwd();
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const clock: ProviderClock = { nowMs: () => NOW };

const providerTestFiles = (): string[] =>
  readdirSync(join(ROOT, "tests/behaviour"))
    .filter((entry) => entry.startsWith("provider-") && entry.endsWith(".test.ts"))
    .map((entry) => `tests/behaviour/${entry}`);

describe("TC-PROV-048 hermetic guarantees", () => {
  test("an evaluated resolve makes zero live fetch calls", async () => {
    const fetchSpy = spyOn(globalThis, "fetch");
    try {
      const transport: QuotaTransport = {
        send: async () => ({
          status: 200,
          bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
        }),
      };
      const credential: CredentialPort = {
        resolve: () => ({ ok: true, material: { value: "CANARY" } }),
      };
      const engine = createProviderEngine({
        clock,
        sleep: { sleep: async () => undefined },
        credentialPort: credential,
        transport,
      });
      await engine.resolve({
        config: {
          defaultChain: "default",
          credentials: { zai: { sourceKey: { style: "literal", name: "KEY" } } },
          entries: {
            p0: {
              name: "p0",
              class: "subscription",
              enabled: true,
              quota: {
                enabled: true,
                endpoint: "https://p0.test/quota",
                credentialRef: "zai",
                timeoutMs: 1000,
                thresholdPercent: 100,
                maxSleepLoops: 24,
                outageParkTtlSeconds: 300,
                credentialParkTtlSeconds: 900,
                capParkTtlSeconds: 300,
              },
            },
          },
          chains: { default: { name: "default", entries: ["p0"], allowPaidFallback: false } },
        },
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  test("the loop uses only the injected sleep seam", async () => {
    const timerSpy = spyOn(globalThis, "setTimeout");
    try {
      const sleeps: number[] = [];
      const sleep: ProviderSleep = {
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      };
      const result = await runProviderLoop({
        subjectName: "default",
        evaluate: async () => ({
          status: "parked",
          cause: "quota-exhausted",
          conditions: ["quota-exhausted"],
          waitSeconds: 60,
          expiresAtMs: NOW + 60 * 1000,
          announcementCode: "provider.quota.parked",
          evidence: { conditionKinds: ["quota-exhausted"], waitSeconds: 60 },
        }),
        clock,
        sleep,
        maxSleepLoops: 2,
        capParkTtlSeconds: 300,
      });
      expect(result.outcome).toBe("capped");
      expect(sleeps).toEqual([60_000, 60_000]);
      expect(timerSpy).not.toHaveBeenCalled();
    } finally {
      timerSpy.mockRestore();
    }
  });

  test("provider tests reference no live endpoint and never execute the legacy battery", () => {
    for (const file of providerTestFiles()) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text, file).not.toContain("globalThis.fetch");
      expect(text, file).not.toMatch(/\bfetch\(/);
      expect(text, file).not.toContain("test-hook-zai-example.sh");
      expect(text, file).not.toContain("child_process");
    }
  });
});

/** The documented condition/park contract (TC-PROV-062 steps 2-4). */
export const guideFailures = (text: string): string[] => {
  const failures: string[] = [];
  for (const required of [
    "condition kinds",
    "park causes",
    "resume",
    "expiry",
    "fail-loud",
    "provider.peak.parked",
    "provider.quota.reset_missing",
    "provider.resumed",
  ]) {
    if (!text.toLowerCase().includes(required.toLowerCase())) failures.push(`missing ${required}`);
  }
  for (const forbidden of ["process.env", "ZAI_API_KEY", "legacy hook contract"]) {
    if (text.toLowerCase().includes(forbidden.toLowerCase())) failures.push(`forbidden ${forbidden}`);
  }
  return failures;
};

describe("TC-PROV-062 documentation contract", () => {
  const path = join(ROOT, "doc/guides/provider-conditions-and-parks.md");
  test("the guide documents the provider condition/park contract", () => {
    const text = readFileSync(path, "utf8");
    expect(guideFailures(text)).toEqual([]);
    expect(text).toContain("ados_distribution: redistributable");
    expect(text).not.toContain("test-hook-zai" + "-example.sh");
  });

  test("removing the condition/park section fails the guide contract", () => {
    const text = readFileSync(path, "utf8");
    const removed = text.replace(/## Condition kinds[\s\S]*## Configuration/, "## Configuration");
    expect(guideFailures(removed).length).toBeGreaterThan(0);
  });
});
