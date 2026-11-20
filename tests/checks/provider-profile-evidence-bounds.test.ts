/**
 * TC-PROFILE-042 — every profile event and target record serializes to
 * <= 1024 bytes and <= 20 fields, drawn only from the closed allowlist (NFR-8).
 */
import { describe, expect, test } from "bun:test";
import {
  PROFILE_EVIDENCE_FIELDS,
  PROFILE_EVIDENCE_MAX_BYTES,
  PROFILE_EVIDENCE_MAX_FIELDS,
  type ProfileProviderAvailability,
  type ProviderProfileConfiguration,
} from "../../packages/core/src/contracts/index";
import {
  createProfileEvent,
  createProfileTargetRecord,
  createProviderFactsProbe,
  projectProfileEvidence,
  selectProfile,
} from "../../packages/core/src/provider/index";

const NOW = 1_700_000_000_000;

const events = () => [
  createProfileEvent({
    code: "profile.selected",
    createdAtMs: NOW,
    message: "selected profile mixed",
    evidence: { profileName: "mixed", tier: "regular", rung: "cruise", reason: "selection" },
  }),
  createProfileEvent({
    code: "profile.switched",
    createdAtMs: NOW,
    message: "switched to deepseek",
    evidence: {
      profileName: "deepseek",
      previousProfile: "mixed",
      newProfile: "deepseek",
      reason: "switch",
      revertCondition: "quota-exhausted",
    },
  }),
  createProfileEvent({
    code: "profile.reverted",
    createdAtMs: NOW,
    message: "reverted to mixed",
    evidence: {
      profileName: "mixed",
      previousProfile: "deepseek",
      newProfile: "mixed",
      reason: "revert",
      providerName: "coding-plan",
    },
  }),
  createProfileEvent({
    code: "profile.ineligible",
    severity: "warning",
    createdAtMs: NOW,
    message: "no profile eligible",
    evidence: { reason: "no-eligible-profile", blockers: ["mixed:condition:quota-exhausted"] },
  }),
  createProfileEvent({
    code: "profile.rung-changed",
    createdAtMs: NOW,
    message: "rung conserve",
    evidence: { profileName: "mixed", rung: "conserve", reason: "hold-judgment" },
  }),
];

describe("TC-PROFILE-042 evidence bounds", () => {
  test("every event serializes within the byte and field bounds", () => {
    for (const event of events()) {
      expect(JSON.stringify(event).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_BYTES);
      expect(Object.keys(event.evidence).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
      for (const key of Object.keys(event.evidence)) {
        expect(PROFILE_EVIDENCE_FIELDS as readonly string[]).toContain(key);
      }
    }
  });

  test("a target record serializes within the bounds", () => {
    const record = createProfileTargetRecord({
      targetProfile: "deepseek",
      reason: "switch",
      previousProfile: "mixed",
      revertCondition: "quota-exhausted",
      providerName: "coding-plan",
      nowMs: NOW,
    });
    expect(JSON.stringify(record).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_BYTES);
    expect(Object.keys(record.evidence).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
  });

  test("the projector drops unknown keys and keeps the closed allowlist", () => {
    const projected = projectProfileEvidence({
      profileName: "mixed",
      unknownKey: "dropped",
      rawVendorBody: '{"secret":true}',
    } as never);
    expect(projected).toEqual({ profileName: "mixed" });
    expect(Object.keys(projected).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
  });

  test("an over-bound event message is truncated, never silently oversized", () => {
    const event = createProfileEvent({
      code: "profile.selected",
      createdAtMs: NOW,
      message: "x".repeat(2000),
      evidence: { profileName: "mixed" },
    });
    expect(JSON.stringify(event).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_BYTES);
    expect(event.message.endsWith("...")).toBe(true);
  });

  test("a 21-field evidence object is projected to the closed allowlist", () => {
    const evidence: Record<string, string> = {};
    for (let index = 0; index < 21; index += 1) evidence[`field${index}`] = "x";
    evidence.profileName = "mixed";
    const projected = projectProfileEvidence(evidence as never);
    expect(Object.keys(projected)).toEqual(["profileName"]);
  });

  const utf8 = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

  test("pathological evidence is structurally capped before serialization", () => {
    const event = createProfileEvent({
      code: "profile.ineligible",
      createdAtMs: NOW,
      message: "m".repeat(4000),
      evidence: {
        reason: "no-eligible-profile",
        blockers: Array.from({ length: 100 }, (_, index) => `${index}:${"b".repeat(400)}`),
      },
    });
    expect(utf8(event)).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_BYTES);
    expect(Object.keys(event.evidence).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
  });

  test("a pathological configuration still serializes every event within 1024 bytes", () => {
    const longName = (index: number): string => `${"p".repeat(400)}-${index}`;
    const names = Array.from({ length: 40 }, (_, index) => longName(index));
    const profiles: ProviderProfileConfiguration = {
      tiers: {},
      profiles: Object.fromEntries(
        names.map((name) => [
          name,
          {
            name,
            tier: "regular",
            providers: [`${name}-provider`],
            agentOverrides: {},
            seats: {
              pm: {
                model: "m",
                pacingClass: "judgment" as const,
                capability: "text-only" as const,
              },
            },
          },
        ]),
      ),
      preferenceChain: { base: names[0] as string, fallbacks: names.slice(1), order: names },
    };
    const unavailableFact = (provider: string): ProfileProviderAvailability => ({
      available: false,
      condition: "provider-outage",
      source: `provider ${provider}: ${"s".repeat(400)}`,
      blockers: [
        {
          kind: "condition",
          value: "provider-outage",
          detail: `provider ${provider} ${"d".repeat(400)}`,
        },
      ],
    });
    const facts = Object.fromEntries(
      names.map((name) => [`${name}-provider`, unavailableFact(`${name}-provider`)]),
    );
    const result = selectProfile({
      profiles,
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.events.length).toBeGreaterThan(0);
    for (const event of result.events) {
      expect(utf8(event)).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_BYTES);
      expect(Object.keys(event.evidence).length).toBeLessThanOrEqual(PROFILE_EVIDENCE_MAX_FIELDS);
    }
  });
});

/**
 * GH-350 TC-WFRESH-010 — a stale watch view is bounded and carries no body or
 * credential: the seven-field set, <= 1024 bytes, <= 20 fields, and no vendor
 * body, authorization header, or credential-shaped string.
 */
describe("TC-WFRESH-010 a stale watch view is bounded and secret-free", () => {
  const CANARY = "CANARY-WATCH-BODY-SECRET";

  test("the stale view stays inside the declared bounds and leaks no body or header", async () => {
    const { createProviderWatchStatus } = await import("../../packages/core/src/provider/quota");
    const { createProviderWatchMappings } = await import(
      "../../packages/adapters/src/provider-quota/index"
    );
    const reader = createProviderWatchStatus({
      clock: { nowMs: () => NOW },
      credentialPort: { resolve: () => ({ ok: true, material: { value: CANARY } }) },
      transport: {
        send: async () => ({
          status: 200,
          bodyText: JSON.stringify({ secret: CANARY, authorization: `Bearer ${CANARY}` }),
        }),
      },
      mappings: createProviderWatchMappings(),
    });
    const result = await reader.status({
      targets: {
        p: {
          mapping: "coding-plan-windows",
          endpoint: "https://watch.example/quota",
          credentialRef: "c",
          maxAgeSeconds: 900,
        },
      },
      credentials: { c: { sourceKey: { style: "literal", name: "WATCH_KEY" } } },
      observedAtMs: NOW - 1_200_000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const view = result.providers[0];
    if (view === undefined) throw new Error("no view");
    const serialized = JSON.stringify(view);
    expect(serialized.length).toBeLessThanOrEqual(1024);
    expect(Object.keys(view).length).toBeLessThanOrEqual(20);
    expect(Object.keys(view)).toEqual([
      "name",
      "condition",
      "source",
      "checkedAt",
      "observedAt",
      "ageSeconds",
      "maxAgeSeconds",
    ]);
    expect(view.condition).toBe("watch-stale");
    expect(serialized).not.toContain(CANARY);
    expect(serialized).not.toMatch(/authorization|bearer/iu);
    expect(view.source).toBe("observed at 2023-11-14T21:53:20.000Z; max age 900s");
  });
});
