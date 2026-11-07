/**
 * TC-PROFILE-054/055/056/038 (hermetic/safety half) — the profile/watch suite is
 * hermetic, the new policy is runtime-neutral, and secret canaries never cross
 * an observable surface.
 */
import { describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scan } from "../../scripts/checks/ambient-globals";
import { matchSeedLiteral } from "../../scripts/checks/forbidden-literals";
import {
  createProviderFactsProbe,
  createProfileEvent,
  evaluateProfileLifecycle,
  resolveProfileForSpawn,
  selectProfile,
} from "../../packages/core/src/provider/index";
import { createProviderWatchStatus } from "../../packages/core/src/provider/index";
import { createProviderWatchMappings } from "../../packages/adapters/src/provider-quota/index";
import type {
  CredentialPort,
  ProviderWatchTarget,
  QuotaTransport,
  QuotaTransportRequest,
} from "../../packages/core/src/contracts/index";
import {
  available,
  exhausted,
  mixedChain,
  peak,
} from "../fixtures/provider/profile/selection/fixtures";
import { createProfileTargetRecord } from "../../packages/core/src/provider/index";

const ROOT = process.cwd();
const NOW = 1_700_000_000_000;
const CANARY = "CANARY-PROFILE-SECRET";

const profileSources = [
  "packages/core/src/contracts/provider-profile.ts",
  "packages/core/src/provider/profile.ts",
  "packages/core/src/provider/profile-lifecycle.ts",
  "packages/core/src/provider/profile-pacing.ts",
  "packages/core/src/provider/profile-env-record.ts",
  "packages/adapters/src/provider-quota/coding-plan.ts",
  "packages/adapters/src/provider-quota/deepseek.ts",
  "packages/adapters/src/provider-quota/openai.ts",
];

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-PROFILE-054 hermetic and runtime-neutral scans", () => {
  test("the ambient-globals guard is clean over every new module with a non-zero floor", () => {
    const violations = scan(ROOT).filter((violation) =>
      profileSources.some((source) => violation.file === source),
    );
    expect(violations).toEqual([]);
    expect(profileSources.length).toBeGreaterThanOrEqual(5);
  });

  test("no new module embeds a forbidden seed literal", () => {
    for (const source of profileSources) {
      expect(matchSeedLiteral(read(source), ["ados", "ADOS_", "~/.ados"])).toBeUndefined();
    }
  });

  test("selection policy reads no ambient clock, randomness, env, fetch, or timer", () => {
    const policy = [
      "packages/core/src/provider/profile.ts",
      "packages/core/src/provider/profile-lifecycle.ts",
      "packages/core/src/provider/profile-pacing.ts",
      "packages/core/src/provider/profile-env-record.ts",
      "packages/core/src/contracts/provider-profile.ts",
    ];
    const forbidden = [
      "Date.now",
      "Math.random",
      "process.env",
      "globalThis.fetch",
      "setTimeout",
      "setInterval",
      "node:",
      "bun:",
    ];
    for (const source of policy) {
      const text = read(source);
      for (const token of forbidden) expect(text, `${source}: ${token}`).not.toContain(token);
    }
  });

  test("a representative resolution/lifecycle/watch run makes zero live fetch calls", async () => {
    const fetchSpy = spyOn(globalThis, "fetch");
    try {
      const selection = selectProfile({
        profiles: mixedChain(),
        probe: createProviderFactsProbe({
          "coding-plan": exhausted("coding-plan"),
          deepseek: available(),
        }),
        nowMs: NOW,
      });
      evaluateProfileLifecycle({
        profiles: mixedChain(),
        selection,
        persisted: createProfileTargetRecord({
          targetProfile: "mixed",
          reason: "selection",
          nowMs: NOW,
        }),
        nowMs: NOW,
      });
      const reader = createProviderWatchStatus({
        clock: { nowMs: () => NOW },
        credentialPort: {
          resolve: () => ({ ok: true, material: { value: CANARY } }),
        },
        transport: {
          send: async () => ({ status: 200, bodyText: '{"weekly":{"usedPercent":1},"rolling":{"usedPercent":1}}' }),
        },
        mappings: createProviderWatchMappings(),
      });
      await reader.status({
        targets: {
          cp: {
            mapping: "coding-plan-windows",
            endpoint: "https://cp.example/q",
            credentialRef: "cp",
          },
        },
        credentials: { cp: { sourceKey: { style: "literal", name: "CP_KEY" } } },
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("TC-PROFILE-056 secret-safety canaries", () => {
  const targets: Readonly<Record<string, ProviderWatchTarget>> = {
    cp: {
      mapping: "coding-plan-windows",
      endpoint: "https://cp.example/q",
      credentialRef: "cp",
      thresholdPercent: 100,
    },
    ds: {
      mapping: "deepseek-balance",
      endpoint: "https://ds.example/b",
      credentialRef: "ds",
      floor: 5,
    },
  };
  const credentials = {
    cp: { sourceKey: { style: "literal" as const, name: "CP_KEY" } },
    ds: { sourceKey: { style: "literal" as const, name: "DS_KEY" } },
  };

  test("credential material is handed to the transport once per target and never returned", async () => {
    const requests: QuotaTransportRequest[] = [];
    let resolutions = 0;
    const credentialPort: CredentialPort = {
      resolve: () => {
        resolutions += 1;
        return { ok: true, material: { value: CANARY } };
      },
    };
    const transport: QuotaTransport = {
      send: async (request) => {
        requests.push(request);
        return request.endpoint.includes("cp.example")
          ? { status: 200, bodyText: '{"weekly":{"usedPercent":1},"rolling":{"usedPercent":1}}' }
          : { status: 200, bodyText: '{"balance":12}' };
      },
    };
    const result = await createProviderWatchStatus({
      clock: { nowMs: () => NOW },
      credentialPort,
      transport,
      mappings: createProviderWatchMappings(),
    }).status({ targets, credentials });
    expect(result.ok).toBe(true);
    expect(resolutions).toBe(2);
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.credential.value === CANARY)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });

  test("canaries in credentials and vendor bodies never reach events, records, or env records", () => {
    const outcome = resolveProfileForSpawn({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": available(CANARY),
        deepseek: available(CANARY),
      }),
      nowMs: NOW,
      agent: "pm",
      namePrefix: "EXAMPLE",
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const event = createProfileEvent({
      code: "profile.selected",
      createdAtMs: NOW,
      message: "selected",
      evidence: { profileName: outcome.selection.ok ? outcome.selection.decision.profile : "" },
    });
    const record = createProfileTargetRecord({
      targetProfile: "mixed",
      reason: "selection",
      nowMs: NOW,
    });
    const surfaces = JSON.stringify({ outcome, event, record });
    expect(surfaces).not.toContain(CANARY);
    expect(surfaces).not.toContain("authorization");
    expect(surfaces).not.toContain("Bearer");
  });

  test("a peak-window blocker never carries a secret", () => {
    const result = selectProfile({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": peak("coding-plan"),
        deepseek: available(),
      }),
      nowMs: NOW,
    });
    if (!result.ok) throw new Error("selection failed");
    expect(JSON.stringify(result)).not.toContain(CANARY);
  });
});
