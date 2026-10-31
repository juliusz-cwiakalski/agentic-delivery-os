/**
 * TC-PROV-003 — shipped provider defaults, optional fields, and provenance.
 *
 * Phase 2 extends this suite with validation, cost ordering, skip precedence,
 * determinism, and the no-fabrication controls.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import type { ConfigValue } from "../../packages/core/src/contracts/config";
import { resolveConfig } from "../../packages/core/src/index";
import {
  parseAndValidateProviderConfiguration,
  parseProviderConfiguration,
} from "../../packages/core/src/provider/validate";

const ROOT = process.cwd();
const fixture = (name: string): unknown =>
  parse(readFileSync(join(ROOT, "tests/fixtures/provider/config", name), "utf8"));

const shipped = (): ReturnType<typeof parseProviderConfiguration> => {
  const resolved = resolveConfig();
  if (!resolved.ok) throw new Error(`defaults failed: ${JSON.stringify(resolved.error)}`);
  return parseProviderConfiguration(resolved.value.values);
};

describe("TC-PROV-003 shipped defaults", () => {
  test("the descriptor and credential reference ship exactly once with no chain", () => {
    const parsed = shipped();
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.config.credentials)).toEqual(["zai"]);
    expect(Object.keys(parsed.config.entries)).toEqual(["zai-coding-plan"]);
    expect(parsed.config.entries["zai-coding-plan"]?.class).toBe("subscription");
    expect(parsed.config.entries["zai-coding-plan"]?.peak).toEqual({
      timezone: "UTC",
      startSecondsOfDay: 21600,
      endSecondsOfDay: 36000,
      bufferSeconds: 7200,
    });
    expect(parsed.config.defaultChain).toBeUndefined();
    expect(parsed.config.chains).toEqual({});
  });

  test("optional defaults materialize exactly as Appendix B documents", () => {
    const parsed = shipped();
    if (!parsed.ok) throw new Error("defaults did not parse");
    const entry = parsed.config.entries["zai-coding-plan"];
    expect(entry?.enabled).toBe(true);
    expect(entry?.quota).toMatchObject({
      enabled: true,
      timeoutMs: 15000,
      thresholdPercent: 100,
      maxSleepLoops: 24,
      outageParkTtlSeconds: 300,
      credentialParkTtlSeconds: 900,
      capParkTtlSeconds: 300,
    });
    expect(entry?.quota?.endpoint).toBe("https://api.z.ai/api/monitor/usage/quota/limit");
    expect(entry?.quota?.credentialRef).toBe("zai");
    expect(parsed.config.credentials.zai?.sourceKey).toEqual({
      style: "literal",
      name: "ZAI_API_KEY",
    });
  });

  test("an omitted optional peak/quota block stays absent", () => {
    const config = fixture("optional-omitted.yaml") as ConfigValue;
    const parsed = parseAndValidateProviderConfiguration(config);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const entry = parsed.config.entries.minimal;
    expect(entry?.enabled).toBe(true);
    expect(entry === undefined ? "missing" : Object.hasOwn(entry, "peak")).toBe(false);
    expect(entry === undefined ? "missing" : Object.hasOwn(entry, "quota")).toBe(false);
  });

  test("the shipped descriptor appears exactly once; a temp-copy duplicate is detected", () => {
    const path = join(ROOT, "packages/core/src/config/defaults.ts");
    const text = readFileSync(path, "utf8");
    const count = (source: string): number => source.split('"zai-coding-plan"').length - 1;
    expect(count(text)).toBe(1);
    const root = mkdtempSync(join(tmpdir(), "provider-defaults-"));
    try {
      const copy = join(root, "defaults.ts");
      writeFileSync(copy, `${text}\n// "zai-coding-plan"\n`);
      expect(count(readFileSync(copy, "utf8"))).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("config debug provenance names the defaults layer for provider fields", () => {
    const resolved = resolveConfig();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    for (const path of [
      "provider",
      "provider.entries.zai-coding-plan.class",
      "provider.entries.zai-coding-plan.peak.timezone",
      "provider.credentials.zai.sourceKey.name",
    ]) {
      expect(resolved.value.origins[path]?.layer, path).toBe("defaults");
    }
  });
});

import type {
  CombinedProviderCondition,
  ProviderChain,
  ProviderConditionKind,
  ProviderDescriptor,
} from "../../packages/core/src/contracts/index";
import { resolveProviderChain } from "../../packages/core/src/provider/chain";
import {
  selectProviderChain,
  validateProviderConfiguration,
} from "../../packages/core/src/provider/validate";

const fixtureConfig = (name: string) => {
  const parsed = parseProviderConfiguration(
    parse(readFileSync(join(ROOT, "tests/fixtures/provider/config", name), "utf8")),
  );
  if (!parsed.ok) throw new Error(`${name}: ${parsed.error.detail}`);
  return parsed.config;
};

const clear: CombinedProviderCondition = { status: "clear" };
const announcementFor = (kind: ProviderConditionKind) => {
  if (kind === "peak-window") return "provider.peak.parked" as const;
  if (kind === "quota-exhausted") return "provider.quota.parked" as const;
  if (kind === "provider-outage") return "provider.quota.unreachable" as const;
  if (kind === "credential-missing") return "provider.credential.missing" as const;
  return "provider.quota.auth_rejected" as const;
};
const parked = (
  kind: ProviderConditionKind,
  waitSeconds: number,
  nowMs: number,
): CombinedProviderCondition => ({
  status: "parked",
  cause: kind,
  conditions: [kind],
  waitSeconds,
  expiresAtMs: nowMs + waitSeconds * 1000,
  announcementCode: announcementFor(kind),
  evidence: { conditionKinds: [kind], waitSeconds },
});
const descriptor = (
  name: string,
  costClass: ProviderDescriptor["class"] = "subscription",
  enabled = true,
): ProviderDescriptor => ({ name, class: costClass, enabled });
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);

describe("TC-PROV-002/004/005 provider validation", () => {
  test("cost order, duplicates, unknown references, and empty chains fail closed", () => {
    const paidFirst = validateProviderConfiguration(fixtureConfig("paid-before-subscription.yaml"));
    expect(paidFirst?.code).toBe("provider.chain.invalid");
    expect(paidFirst?.entries).toContain("zai-coding-plan");
    const duplicate = validateProviderConfiguration(fixtureConfig("duplicate-entries.yaml"));
    expect(duplicate?.code).toBe("provider.chain.invalid");
    const unknown = validateProviderConfiguration(fixtureConfig("unknown-reference.yaml"));
    expect(unknown?.code).toBe("provider.chain.invalid");
    const empty = validateProviderConfiguration(fixtureConfig("empty-chain.yaml"));
    expect(empty?.code).toBe("provider.chain.empty");
    expect(validateProviderConfiguration(fixtureConfig("valid-chain.yaml"))).toBeUndefined();
  });

  test("missing chain and missing default chain fail provider.chain.empty", () => {
    const noChain = fixtureConfig("no-chain.yaml");
    const selection = selectProviderChain(noChain);
    expect(selection.ok).toBe(false);
    if (!selection.ok) expect(selection.error.code).toBe("provider.chain.empty");
    const unknownChain = selectProviderChain(fixtureConfig("valid-chain.yaml"), "missing");
    expect(unknownChain.ok).toBe(false);
    if (!unknownChain.ok) expect(unknownChain.error.code).toBe("provider.chain.empty");
  });

  test("peak ranges, timezone, credential references, and endpoints are validated", () => {
    for (const name of [
      "peak-invalid-timezone.yaml",
      "peak-end-before-start.yaml",
      "peak-out-of-range.yaml",
    ]) {
      const parsed = parseAndValidateProviderConfiguration(
        parse(readFileSync(join(ROOT, "tests/fixtures/provider/config", name), "utf8")) as never,
      );
      expect(parsed.ok, name).toBe(false);
      if (!parsed.ok) expect(parsed.error.code, name).toBe("provider.chain.invalid");
    }
    for (const endpoint of ["http://example.test/q", "https://user:pw@example.test/q"]) {
      const parsed = parseProviderConfiguration({
        provider: {
          credentials: { zai: { sourceKey: { style: "literal", name: "KEY" } } },
          entries: {
            bad: { class: "subscription", quota: { endpoint, credentialRef: "zai" } },
          },
          chains: { default: { entries: ["bad"] } },
        },
      });
      if (!parsed.ok) throw new Error("endpoint fixture did not parse");
      expect(validateProviderConfiguration(parsed.config)?.code).toBe("provider.chain.invalid");
    }
    const unknownCredential = parseProviderConfiguration({
      provider: {
        entries: {
          bad: {
            class: "subscription",
            quota: { endpoint: "https://example.test/q", credentialRef: "nope" },
          },
        },
        chains: { default: { entries: ["bad"] } },
      },
    });
    if (!unknownCredential.ok) throw new Error("credential fixture did not parse");
    expect(validateProviderConfiguration(unknownCredential.config)?.code).toBe(
      "provider.chain.invalid",
    );
  });
});

describe("TC-PROV-007/008/009/010 chain resolution", () => {
  const resolve = (
    chain: ProviderChain,
    states: Record<
      string,
      { descriptor: ProviderDescriptor; condition: CombinedProviderCondition }
    >,
  ) => resolveProviderChain({ chain, states, nowMs: NOW });

  test("declared order selects the first eligible subscription; paid is shadowed", () => {
    const chain: ProviderChain = {
      name: "default",
      entries: ["sub", "paid"],
      allowPaidFallback: true,
    };
    const outcome = resolve(chain, {
      sub: { descriptor: descriptor("sub"), condition: clear },
      paid: { descriptor: descriptor("paid", "pay-per-token"), condition: clear },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.decision).toMatchObject({ kind: "selected", providerName: "sub" });
    expect(outcome.skipped).toEqual([{ providerName: "paid", reason: "shadowed" }]);
  });

  test("paid fallback disabled marks a later paid entry paid-fallback-not-allowed", () => {
    const chain: ProviderChain = {
      name: "default",
      entries: ["sub", "paid"],
      allowPaidFallback: false,
    };
    const outcome = resolve(chain, {
      sub: { descriptor: descriptor("sub"), condition: clear },
      paid: { descriptor: descriptor("paid", "pay-per-token"), condition: clear },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.skipped).toEqual([
      { providerName: "paid", reason: "paid-fallback-not-allowed" },
    ]);
  });

  test("every closed reason is exercised with the pinned precedence", () => {
    const chain: ProviderChain = {
      name: "default",
      entries: ["disabled", "peak", "quota", "outage", "missing", "rejected", "eligible", "paid"],
      allowPaidFallback: true,
    };
    const outcome = resolve(chain, {
      disabled: {
        descriptor: descriptor("disabled", "subscription", false),
        condition: parked("peak-window", 10, NOW),
      },
      peak: { descriptor: descriptor("peak"), condition: parked("peak-window", 10, NOW) },
      quota: { descriptor: descriptor("quota"), condition: parked("quota-exhausted", 20, NOW) },
      outage: { descriptor: descriptor("outage"), condition: parked("provider-outage", 30, NOW) },
      missing: {
        descriptor: descriptor("missing"),
        condition: parked("credential-missing", 40, NOW),
      },
      rejected: {
        descriptor: descriptor("rejected"),
        condition: parked("credential-rejected", 50, NOW),
      },
      eligible: { descriptor: descriptor("eligible"), condition: clear },
      paid: { descriptor: descriptor("paid", "pay-per-token"), condition: clear },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.decision).toMatchObject({ kind: "selected", providerName: "eligible" });
    expect(outcome.skipped.map((entry) => entry.reason)).toEqual([
      "disabled",
      "peak-window",
      "quota-exhausted",
      "provider-outage",
      "credential-missing",
      "credential-rejected",
      "shadowed",
    ]);
  });

  test("a peak-parked subscription never permits paid substitution", () => {
    const chain: ProviderChain = {
      name: "default",
      entries: ["sub", "paid"],
      allowPaidFallback: true,
    };
    const outcome = resolve(chain, {
      sub: { descriptor: descriptor("sub"), condition: parked("peak-window", 3600, NOW) },
      paid: { descriptor: descriptor("paid", "pay-per-token"), condition: clear },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.decision.kind).toBe("parked");
    if (outcome.decision.kind !== "parked") return;
    expect(outcome.decision.park.name).toBe("chain:default");
    expect(outcome.decision.park.cause).toBe("chain-exhausted");
    expect(outcome.decision.park.expiresAtMs).toBe(NOW + 3600 * 1000);
    expect(outcome.skipped).toEqual([
      { providerName: "sub", reason: "peak-window" },
      { providerName: "paid", reason: "shadowed" },
    ]);
  });

  test("an all-parked chain uses the earliest provider expiry", () => {
    const chain: ProviderChain = { name: "default", entries: ["a", "b"], allowPaidFallback: false };
    const outcome = resolve(chain, {
      a: { descriptor: descriptor("a"), condition: parked("quota-exhausted", 900, NOW) },
      b: { descriptor: descriptor("b"), condition: parked("provider-outage", 300, NOW) },
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.decision.kind).toBe("parked");
    if (outcome.decision.kind !== "parked") return;
    expect(outcome.decision.park.expiresAtMs).toBe(NOW + 300 * 1000);
    expect(outcome.decision.park.conditions).toEqual(["quota-exhausted", "provider-outage"]);
    expect(outcome.skipped.map((entry) => entry.reason)).toEqual([
      "quota-exhausted",
      "provider-outage",
    ]);
  });

  test("identical facts produce deep-equal decisions", () => {
    const chain: ProviderChain = { name: "default", entries: ["a"], allowPaidFallback: false };
    const states = { a: { descriptor: descriptor("a"), condition: clear } };
    expect(resolve(chain, states)).toEqual(resolve(chain, states));
  });
});
