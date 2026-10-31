/**
 * TC-PROV-014..027, TC-PROV-023, TC-PROV-051 — quota normalization/evaluation,
 * failure classification, the completed-sleep cap, and evaluation cost.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CombinedProviderCondition,
  CredentialPort,
  ProviderClock,
  ProviderConditionResult,
  ProviderConfiguration,
  ProviderSleep,
  QuotaTransport,
  QuotaTransportResult,
} from "../../packages/core/src/contracts/index";
import { resolveProviderChain } from "../../packages/core/src/provider/chain";
import { combineProviderConditions } from "../../packages/core/src/provider/conditions";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import { runProviderLoop } from "../../packages/core/src/provider/loop";
import { evaluateQuotaResponse } from "../../packages/core/src/provider/quota";

const ROOT = process.cwd();
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const quotaFile = (name: string): QuotaTransportResult => ({
  status: 200,
  bodyText: readFileSync(join(ROOT, "tests/fixtures/provider/quota", name), "utf8"),
});
const body = (value: unknown): QuotaTransportResult => ({
  status: 200,
  bodyText: JSON.stringify(value),
});
const tokens = (percentage: number, reset?: number): unknown => ({
  type: "TOKENS_LIMIT",
  percentage,
  ...(reset === undefined ? {} : { nextResetTime: reset }),
});
const envelope = (limits: unknown[]): QuotaTransportResult =>
  body({ code: 200, success: true, data: { limits } });

describe("TC-PROV-014..022 quota math", () => {
  test("an exhausted token limit parks to the reset instant", () => {
    const result = evaluateQuotaResponse(quotaFile("exhausted-valid-reset.json"), 100, NOW);
    expect(result.status).toBe("parked");
    if (result.status === "parked") {
      expect(result.waitSeconds).toBe(3600);
      expect(result.expiresAtMs).toBe(NOW + 3600 * 1000);
      expect(result.evidence.resetEpochMs).toBe(NOW + 3600 * 1000);
      expect(result.snapshot.limits).toHaveLength(1);
    }
  });

  test("both exhausted limits use the soonest reset regardless of order", () => {
    const first = evaluateQuotaResponse(quotaFile("both-exhausted.json"), 100, NOW);
    expect(first.status).toBe("parked");
    if (first.status === "parked") expect(first.expiresAtMs).toBe(NOW + 3600 * 1000);
    const reordered = envelope([tokens(100, NOW + 3600 * 1000), tokens(100, NOW + 7200 * 1000)]);
    const second = evaluateQuotaResponse(reordered, 100, NOW);
    if (second.status === "parked") expect(second.expiresAtMs).toBe(NOW + 3600 * 1000);
  });

  test("TIME_LIMIT entries never drive exhaustion", () => {
    expect(evaluateQuotaResponse(quotaFile("time-limit-only.json"), 100, NOW).status).toBe("clear");
    const withTokens = envelope([tokens(100, NOW + 3600 * 1000)]);
    expect(evaluateQuotaResponse(withTokens, 100, NOW).status).toBe("parked");
  });

  test("threshold is inclusive at 100 and overage is exhausted", () => {
    expect(evaluateQuotaResponse(quotaFile("pct-99.json"), 100, NOW).status).toBe("clear");
    expect(evaluateQuotaResponse(quotaFile("pct-100.json"), 100, NOW).status).toBe("parked");
    expect(evaluateQuotaResponse(quotaFile("pct-105.json"), 100, NOW).status).toBe("parked");
  });

  test("a past or equal reset clamps to zero and does not park", () => {
    expect(evaluateQuotaResponse(quotaFile("past-reset.json"), 100, NOW).status).toBe("clear");
    expect(evaluateQuotaResponse(envelope([tokens(100, NOW)]), 100, NOW).status).toBe("clear");
  });

  test("mixed valid/invalid resets use the valid one without reset_missing", () => {
    const result = evaluateQuotaResponse(quotaFile("mixed-reset.json"), 100, NOW);
    expect(result.status).toBe("parked");
    if (result.status === "parked") expect(result.expiresAtMs).toBe(NOW + 3600 * 1000);
    const swapped = envelope([tokens(100, NOW + 3600 * 1000), tokens(100, "later" as never)]);
    const again = evaluateQuotaResponse(swapped, 100, NOW);
    if (again.status === "parked") expect(again.expiresAtMs).toBe(NOW + 3600 * 1000);
  });

  test("an earlier reset on a non-exhausted limit is ignored", () => {
    const result = evaluateQuotaResponse(quotaFile("non-exhausted-earlier.json"), 100, NOW);
    expect(result.status).toBe("parked");
    if (result.status === "parked") expect(result.expiresAtMs).toBe(NOW + 7200 * 1000);
  });

  test("clear snapshots produce no outage artifact and retain only normalized limits", () => {
    for (const name of ["clear-no-tokens.json", "clear-below-threshold.json"]) {
      const result = evaluateQuotaResponse(quotaFile(name), 100, NOW);
      expect(result.status).toBe("clear");
      if (result.status === "clear") expect(Object.keys(result)).toEqual(["status", "snapshot"]);
    }
  });

  test("exhausted without a valid reset fails provider.quota.exceeded", () => {
    for (const name of ["reset-absent.json", "reset-malformed.json", "reset-null.json"]) {
      const result = evaluateQuotaResponse(quotaFile(name), 100, NOW);
      expect(result.status, name).toBe("failed");
      if (result.status === "failed") {
        expect(result.errorCode).toBe("provider.quota.exceeded");
        expect(result.announcementCode).toBe("provider.quota.reset_missing");
        expect(result.failureClass).toBe("reset_missing");
      }
    }
  });
});

describe("TC-PROV-024..027 failure classification", () => {
  test("401/403 is credential rejection; other non-200 is an outage", () => {
    for (const status of [401, 403]) {
      const result = evaluateQuotaResponse({ status, bodyText: "" }, 100, NOW);
      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.errorCode).toBe("provider.auth.rejected");
        expect(result.announcementCode).toBe("provider.quota.auth_rejected");
      }
    }
    for (const status of [500, 429, 302]) {
      const result = evaluateQuotaResponse({ status, bodyText: "" }, 100, NOW);
      expect(result.status).toBe("failed");
      if (result.status === "failed") {
        expect(result.errorCode).toBe("provider.outage");
        expect(result.announcementCode).toBe("provider.quota.http_error");
        expect(result.httpStatus).toBe(status);
      }
    }
  });

  test("every malformed class is an outage and never clear", () => {
    for (const name of [
      "malformed-json.txt",
      "envelope-code.json",
      "envelope-success.json",
      "limits-absent.json",
      "limits-nonarray.json",
      "pct-non-numeric.json",
    ]) {
      const result = evaluateQuotaResponse(quotaFile(name), 100, NOW);
      expect(result.status, name).toBe("failed");
      if (result.status === "failed") {
        expect(result.errorCode).toBe("provider.outage");
        expect(result.announcementCode).toBe("provider.quota.malformed");
      }
    }
  });
});

const credentialPort = (ok: boolean, calls: { count: number }): CredentialPort => ({
  resolve: () => {
    calls.count += 1;
    return ok
      ? { ok: true, material: { value: "CANARY-SECRET" } }
      : {
          ok: false,
          code: "config.credential.missing",
          domainKind: "config",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          projectionClass: "user-validation",
        };
  },
});

const config = (): ProviderConfiguration => ({
  defaultChain: "default",
  credentials: { zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } } },
  entries: {
    "zai-coding-plan": {
      name: "zai-coding-plan",
      class: "subscription",
      enabled: true,
      quota: {
        enabled: true,
        endpoint: "https://example.test/quota",
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
  chains: { default: { name: "default", entries: ["zai-coding-plan"], allowPaidFallback: false } },
});

const clock: ProviderClock = { nowMs: () => NOW };
const sleep: ProviderSleep = { sleep: async () => undefined };

const engineFor = (transport: QuotaTransport, ok = true, calls = { count: 0 }) =>
  createProviderEngine({
    clock,
    sleep,
    credentialPort: credentialPort(ok, calls),
    transport,
  });

describe("TC-PROV-024/025/039 engine parks and classifications", () => {
  test("a transport failure parks provider-outage and a quota run classifies", async () => {
    const transport: QuotaTransport = {
      send: async () => {
        throw new Error("network down");
      },
    };
    const engine = engineFor(transport);
    const resolved = await engine.resolve({ config: config() });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.parks[0]?.cause).toBe("provider-outage");
    expect(resolved.parks[0]?.expiresAtMs).toBe(NOW + 300 * 1000);
    expect(resolved.announcements[0]?.code).toBe("provider.quota.unreachable");
    const quota = await engine.quota({ config: config() });
    expect(quota.ok).toBe(false);
    if (!quota.ok) expect(quota.errorCode).toBe("provider.outage");
  });

  test("401 parks credential-rejected and quota classifies auth rejection", async () => {
    const engine = engineFor({ send: async () => ({ status: 401, bodyText: "" }) });
    const resolved = await engine.resolve({ config: config() });
    if (!resolved.ok) throw new Error("resolve failed");
    expect(resolved.parks[0]?.cause).toBe("credential-rejected");
    expect(resolved.announcements[0]?.code).toBe("provider.quota.auth_rejected");
    const quota = await engine.quota({ config: config() });
    expect(quota.ok).toBe(false);
    if (!quota.ok) expect(quota.errorCode).toBe("provider.auth.rejected");
  });

  test("a missing credential performs no fetch and gives failureClass evidence", async () => {
    let sends = 0;
    const transport: QuotaTransport = {
      send: async () => {
        sends += 1;
        return { status: 200, bodyText: "{}" };
      },
    };
    const calls = { count: 0 };
    const engine = engineFor(transport, false, calls);
    const resolved = await engine.resolve({ config: config() });
    if (!resolved.ok) throw new Error("resolve failed");
    expect(calls.count).toBe(1);
    expect(sends).toBe(0);
    expect(resolved.parks[0]?.cause).toBe("credential-missing");
    expect(resolved.parks[0]?.evidence.failureClass).toBe("config.credential.missing");
    expect(resolved.parks[0]?.evidence.credentialRefName).toBe("zai");
    expect(resolved.announcements[0]?.code).toBe("provider.credential.missing");
  });

  test("the credential port is called once per request and never cached", async () => {
    let sends = 0;
    const calls = { count: 0 };
    const engine = engineFor(
      {
        send: async () => {
          sends += 1;
          return quotaFile("exhausted-valid-reset.json");
        },
      },
      true,
      calls,
    );
    await engine.resolve({ config: config() });
    await engine.resolve({ config: config() });
    expect(calls.count).toBe(2);
    expect(sends).toBe(2);
  });

  test("no canary appears in the returned resolution", async () => {
    const engine = engineFor({
      send: async () => {
        throw new Error("down");
      },
    });
    const resolved = await engine.resolve({ config: config() });
    expect(JSON.stringify(resolved)).not.toContain("CANARY-SECRET");
  });
});

describe("TC-PROV-023 completed-sleep cap", () => {
  const parked = (wait: number): CombinedProviderCondition => ({
    status: "parked",
    cause: "quota-exhausted",
    conditions: ["quota-exhausted"],
    waitSeconds: wait,
    expiresAtMs: NOW + wait * 1000,
    announcementCode: "provider.quota.parked",
    evidence: { conditionKinds: ["quota-exhausted"], waitSeconds: wait },
  });

  test("a fresh evaluation after the first sleep can clear", async () => {
    const responses = [parked(7200), { status: "clear" } as CombinedProviderCondition];
    let calls = 0;
    const sleeps: number[] = [];
    const result = await runProviderLoop({
      subjectName: "default",
      evaluate: async () => responses[calls++] as CombinedProviderCondition,
      clock,
      sleep: {
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      },
      maxSleepLoops: 4,
      capParkTtlSeconds: 300,
    });
    expect(result.outcome).toBe("clear");
    expect(result.completedSleeps).toBe(1);
    expect(sleeps).toEqual([7200 * 1000]);
    expect(calls).toBe(2);
  });

  test("exactly N completed sleeps cap with no post-cap fetch", async () => {
    for (const max of [1, 3]) {
      let calls = 0;
      const sleeps: number[] = [];
      const result = await runProviderLoop({
        subjectName: "default",
        evaluate: async () => {
          calls += 1;
          return parked(60);
        },
        clock,
        sleep: {
          sleep: async (ms) => {
            sleeps.push(ms);
          },
        },
        maxSleepLoops: max,
        capParkTtlSeconds: 300,
      });
      expect(result.outcome).toBe("capped");
      expect(result.completedSleeps).toBe(max);
      expect(sleeps).toHaveLength(max);
      expect(calls).toBe(max);
      if (result.outcome === "capped") {
        expect(result.park.cause).toBe("reevaluation-cap");
        expect(result.park.expiresAtMs).toBe(NOW + 300 * 1000);
        expect(result.announcement.code).toBe("provider.reevaluation.cap");
        expect(result.announcement.severity).toBe("warning");
      }
    }
  });
});

describe("TC-PROV-051 100-entry evaluation cost", () => {
  test("pure evaluation of 100 provider entries stays under 50 ms", () => {
    const entries = 100;
    const parkedCondition: ProviderConditionResult = {
      status: "parked",
      kind: "quota-exhausted",
      waitSeconds: 60,
      expiresAtMs: NOW + 60 * 1000,
      announcementCode: "provider.quota.parked",
      evidence: { conditionKinds: ["quota-exhausted"], waitSeconds: 60 },
    };
    const names = Array.from({ length: entries }, (_, index) => `p${index}`);
    const chain = { name: "default", entries: names, allowPaidFallback: false };
    const states = Object.fromEntries(
      names.map((name) => [
        name,
        {
          descriptor: { name, class: "subscription" as const, enabled: true },
          condition: parkedCondition,
        },
      ]),
    );
    const run = (): number => {
      const start = performance.now();
      for (const name of names) {
        combineProviderConditions([parkedCondition, { status: "clear" }]);
        void states[name];
      }
      const outcome = resolveProviderChain({ chain, states, nowMs: NOW });
      if (!outcome.ok) throw new Error("100-entry evaluation failed");
      return performance.now() - start;
    };
    run();
    const samples = Array.from({ length: 5 }, run).sort((left, right) => left - right);
    const median = samples[Math.floor(samples.length / 2)] ?? 0;
    expect(median).toBeLessThan(50);
    expect(names).toHaveLength(entries);
  });
});
