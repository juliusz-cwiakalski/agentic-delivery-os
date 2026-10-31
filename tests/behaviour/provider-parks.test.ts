/**
 * TC-PROV-028..033 (model halves) — park shape, closed allowlist, deterministic
 * naming, T−1/T/T+1 expiry views, fold ordering, and cap/chain expiries.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProviderParkEvidence } from "../../packages/core/src/contracts/index";
import { resolveProviderChain } from "../../packages/core/src/provider/chain";
import {
  chainParkName,
  compareParks,
  createParkRecord,
  foldParks,
  formatUtcIso,
  parkView,
  providerParkName,
} from "../../packages/core/src/provider/parks";

const ROOT = process.cwd();
const allowlist = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/provider/evidence/park-allowlist.json"), "utf8"),
) as { fields: string[] };
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const evidence: ProviderParkEvidence = {
  providerName: "zai-coding-plan",
  conditionKinds: ["quota-exhausted"],
  waitSeconds: 60,
  resetEpochMs: NOW + 60 * 1000,
};
const park = (expiresAtMs = NOW + 60 * 1000) =>
  createParkRecord({
    subjectKind: "provider",
    subjectName: "zai-coding-plan",
    cause: "quota-exhausted",
    conditions: ["quota-exhausted"],
    createdAtMs: NOW,
    expiresAtMs,
    evidence,
  });

describe("TC-PROV-028 park shape and closed allowlist", () => {
  test("name, subject, cause, conditions, expiry, and evidence are deterministic", () => {
    const record = park();
    expect(record.name).toBe("provider:zai-coding-plan");
    expect(providerParkName("zai")).toBe("provider:zai");
    expect(chainParkName("default")).toBe("chain:default");
    expect(record.subjectKind).toBe("provider");
    expect(record.subjectName).toBe("zai-coding-plan");
    expect(record.cause).toBe("quota-exhausted");
    expect(record.conditions).toEqual(["quota-exhausted"]);
    expect(record.expiresAtMs).toBeGreaterThan(record.createdAtMs);
    expect(record.expiresAt).toBe(formatUtcIso(record.expiresAtMs));
    expect(record.schemaVersion).toBe("delivery.provider.park.v1");
  });

  test("every evidence key belongs to the eight-field allowlist", () => {
    for (const key of Object.keys(park().evidence)) {
      expect(allowlist.fields).toContain(key);
    }
    expect(allowlist.fields).toHaveLength(8);
  });
});

describe("TC-PROV-029 exact-expiry inactivity with no write", () => {
  test("T−1 active, T expired, T+1 expired; the record is unchanged", () => {
    const record = park(NOW + 1000);
    const before = JSON.stringify(record);
    expect(parkView(record, NOW + 999).state).toBe("active");
    expect(parkView(record, NOW + 1000).state).toBe("expired");
    expect(parkView(record, NOW + 1001).state).toBe("expired");
    expect(JSON.stringify(record)).toBe(before);
  });

  test("a cleared record is reported cleared and retains its clear time", () => {
    const record = park();
    const cleared: typeof record = {
      ...record,
      state: "cleared",
      clearedAt: formatUtcIso(NOW + 10),
      clearedAtMs: NOW + 10,
    };
    expect(parkView(cleared, NOW + 20).state).toBe("cleared");
    expect(parkView(cleared, NOW + 20).clearedAt).toBe(formatUtcIso(NOW + 10));
  });
});

describe("TC-PROV-030/033 fold, ordering, and cap/chain expiry", () => {
  test("the fold keeps the latest record per park name and orders by expiry/name", () => {
    const first = park(NOW + 1000);
    const changed = { ...park(NOW + 2000), cause: "peak-window" as const };
    const other = createParkRecord({
      subjectKind: "provider",
      subjectName: "alpha",
      cause: "peak-window",
      conditions: ["peak-window"],
      createdAtMs: NOW,
      expiresAtMs: NOW + 3000,
      evidence: { providerName: "alpha", conditionKinds: ["peak-window"] },
    });
    const folded = foldParks([first, changed, other]);
    expect(folded).toHaveLength(2);
    expect(folded[0]?.name).toBe("provider:zai-coding-plan");
    expect(folded[0]?.cause).toBe("peak-window");
    expect(folded[1]?.name).toBe("provider:alpha");
    expect([...folded].sort(compareParks).map((record) => record.name)).toEqual(
      folded.map((record) => record.name),
    );
  });

  test("a chain-exhausted park uses the earliest contributing provider expiry", () => {
    const chain = { name: "default", entries: ["a", "b"], allowPaidFallback: false };
    const outcome = resolveProviderChain({
      chain,
      nowMs: NOW,
      states: {
        a: {
          descriptor: { name: "a", class: "subscription", enabled: true },
          condition: {
            status: "parked",
            cause: "quota-exhausted",
            conditions: ["quota-exhausted"],
            waitSeconds: 900,
            expiresAtMs: NOW + 900 * 1000,
            announcementCode: "provider.quota.parked",
            evidence: { conditionKinds: ["quota-exhausted"], waitSeconds: 900 },
          },
        },
        b: {
          descriptor: { name: "b", class: "subscription", enabled: true },
          condition: {
            status: "parked",
            cause: "provider-outage",
            conditions: ["provider-outage"],
            waitSeconds: 300,
            expiresAtMs: NOW + 300 * 1000,
            announcementCode: "provider.quota.unreachable",
            evidence: { conditionKinds: ["provider-outage"], waitSeconds: 300 },
          },
        },
      },
    });
    if (!outcome.ok || outcome.decision.kind !== "parked") throw new Error("expected a chain park");
    expect(outcome.decision.park.name).toBe("chain:default");
    expect(outcome.decision.park.cause).toBe("chain-exhausted");
    expect(outcome.decision.park.expiresAtMs).toBe(NOW + 300 * 1000);
    expect(outcome.decision.park.expiresAtMs).toBeGreaterThan(outcome.decision.park.createdAtMs);
  });
});
