/**
 * TC-PROV-034/035/036 (engine halves) — announcement shape, closed vocabulary,
 * severity, deterministic identity, and skipped-entry outage visibility.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CredentialPort,
  ParkCause,
  ProviderClock,
  ProviderConfiguration,
  ProviderSleep,
  QuotaTransport,
} from "../../packages/core/src/contracts/index";
import {
  announcementCodeForCondition,
  createParkAnnouncement,
  createResumedAnnouncement,
  severityForAnnouncementCode,
} from "../../packages/core/src/provider/announcements";
import { createProviderEngine } from "../../packages/core/src/provider/engine";
import { createParkRecord } from "../../packages/core/src/provider/parks";

const ROOT = process.cwd();
const allowlist = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/provider/evidence/announcement-allowlist.json"), "utf8"),
) as { fields: string[] };
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const clock: ProviderClock = { nowMs: () => NOW };
const sleep: ProviderSleep = { sleep: async () => undefined };
const credential: CredentialPort = {
  resolve: () => ({ ok: true, material: { value: "CANARY-SECRET" } }),
};

const park = (cause: ParkCause) =>
  createParkRecord({
    subjectKind: "provider",
    subjectName: "zai-coding-plan",
    cause,
    conditions: cause === "chain-exhausted" || cause === "reevaluation-cap" ? [] : [cause],
    createdAtMs: NOW,
    expiresAtMs: NOW + 60 * 1000,
    evidence: { providerName: "zai-coding-plan", conditionKinds: cause === "chain-exhausted" || cause === "reevaluation-cap" ? [] : [cause] },
  });

describe("TC-PROV-034 announcement shape, severity, and identity", () => {
  test("the closed code set maps every cause with the documented severity", () => {
    const expected: Array<[ParkCause, string, "info" | "warning"]> = [
      ["peak-window", "provider.peak.parked", "info"],
      ["quota-exhausted", "provider.quota.parked", "info"],
      ["provider-outage", "provider.quota.unreachable", "warning"],
      ["credential-missing", "provider.credential.missing", "warning"],
      ["credential-rejected", "provider.quota.auth_rejected", "warning"],
      ["chain-exhausted", "provider.chain.exhausted", "warning"],
      ["reevaluation-cap", "provider.reevaluation.cap", "warning"],
    ];
    for (const [cause, code, severity] of expected) {
      const mapped = announcementCodeForCondition(cause);
      expect(mapped).toBe(code as never);
      expect(severityForAnnouncementCode(mapped)).toBe(severity);
    }
    expect(announcementCodeForCondition("provider-outage", "http_500")).toBe(
      "provider.quota.http_error",
    );
    expect(announcementCodeForCondition("provider-outage", "malformed_json")).toBe(
      "provider.quota.malformed",
    );
    expect(severityForAnnouncementCode("provider.resumed")).toBe("info");
  });

  test("every announcement carries only the eleven-field allowlist and a safe message", () => {
    for (const cause of [
      "peak-window",
      "quota-exhausted",
      "provider-outage",
      "credential-missing",
      "credential-rejected",
      "chain-exhausted",
      "reevaluation-cap",
    ] as const) {
      const announcement = createParkAnnouncement(park(cause), NOW);
      for (const key of Object.keys(announcement.evidence)) {
        expect(allowlist.fields, `${cause}:${key}`).toContain(key);
      }
      expect(announcement.message).not.toContain("CANARY-SECRET");
      expect(announcement.evidence.announcementCode).toBe(announcement.code);
      expect(announcement.schemaVersion).toBe("delivery.provider.announcement.v1");
    }
  });

  test("identity is deterministic for the same generation and changes with the generation", () => {
    const first = createParkAnnouncement(park("quota-exhausted"), NOW);
    const second = createParkAnnouncement(park("quota-exhausted"), NOW);
    expect(first.identity).toBe(second.identity);
    const changed = createParkAnnouncement(park("peak-window"), NOW);
    expect(changed.identity).not.toBe(first.identity);
    const resumed = createResumedAnnouncement(park("quota-exhausted"), NOW);
    expect(resumed.code).toBe("provider.resumed");
    expect(resumed.severity).toBe("info");
  });
});

const config = (): ProviderConfiguration => ({
  defaultChain: "default",
  credentials: { zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } } },
  entries: {
    a: {
      name: "a",
      class: "subscription",
      enabled: true,
      quota: {
        enabled: true,
        endpoint: "https://a.test/quota",
        credentialRef: "zai",
        timeoutMs: 1000,
        thresholdPercent: 100,
        maxSleepLoops: 24,
        outageParkTtlSeconds: 300,
        credentialParkTtlSeconds: 900,
        capParkTtlSeconds: 300,
      },
    },
    b: {
      name: "b",
      class: "subscription",
      enabled: true,
      quota: {
        enabled: true,
        endpoint: "https://b.test/quota",
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
  chains: { default: { name: "default", entries: ["a", "b"], allowPaidFallback: false } },
});

describe("TC-PROV-035 skipped-entry outage stays visible", () => {
  test("the later entry is selected while the earlier outage is parked and announced", async () => {
    const transport: QuotaTransport = {
      send: async (request) => {
        if (request.endpoint.includes("a.test")) throw new Error("down");
        return {
          status: 200,
          bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
        };
      },
    };
    const engine = createProviderEngine({ clock, sleep, credentialPort: credential, transport });
    const resolved = await engine.resolve({ config: config() });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.decision).toMatchObject({ kind: "selected", providerName: "b" });
    expect(resolved.skipped).toEqual([{ providerName: "a", reason: "provider-outage" }]);
    expect(resolved.parks.map((entry) => entry.name)).toContain("provider:a");
    expect(resolved.announcements.map((entry) => entry.code)).toContain(
      "provider.quota.unreachable",
    );
  });
});
