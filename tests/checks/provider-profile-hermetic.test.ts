/**
 * TC-PROFILE-054/055/056/038 (hermetic/safety half) — the profile/watch suite is
 * hermetic, the new policy is runtime-neutral, and secret canaries never cross
 * an observable surface.
 */
import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createProviderWatchMappings } from "../../packages/adapters/src/provider-quota/index";
import type {
  CredentialPort,
  ProviderWatchTarget,
  QuotaTransport,
  QuotaTransportRequest,
  StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  createProfileEvent,
  createProfileTargetRecord,
  createProviderFactsProbe,
  createProviderWatchStatus,
  evaluateProfileLifecycle,
  resolveProfileForSpawn,
  selectProfile,
} from "../../packages/core/src/provider/index";
import { createResolvedProviderProbe } from "../../packages/cli/src/edge";
import { scan } from "../../scripts/checks/ambient-globals";
import { matchSeedLiteral } from "../../scripts/checks/forbidden-literals";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import {
  available,
  exhausted,
  mixedChain,
  peak,
  profile,
  seat,
} from "../fixtures/provider/profile/selection/fixtures";

const ROOT = process.cwd();
const NOW = 1_700_000_000_000;
const CANARY = "CANARY-PROFILE-SECRET";
const roots: string[] = [];

afterEach(() => {
  for (const root of roots) removeRoot(root);
  roots.length = 0;
});

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
          send: async () => ({
            status: 200,
            bodyText: '{"weekly":{"usedPercent":1},"rolling":{"usedPercent":1}}',
          }),
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

describe("GH-377 TC-PROFILE-087 one fold read and memoized probes over one hundred providers", () => {
  const countingStore = (store: StateStorePort) => {
    let foldReads = 0;
    const wrapped: StateStorePort = {
      ...store,
      read: (input) => {
        if (input.requiredKeys.length === 0) foldReads += 1;
        return store.read(input);
      },
    };
    return { store: wrapped, foldReads: () => foldReads };
  };

  test("one verified fold read per resolution and one probe per distinct provider", () => {
    const root = makeTempRoot("profile-hermetic");
    roots.push(root);
    const base = openStore(makeIdentity(root)).store;
    const counting = countingStore(base);
    const providerNames = Array.from({ length: 100 }, (_value, index) => `p${index}`);
    const entries = Object.fromEntries(
      providerNames.map((name) => [
        name,
        { name, class: "subscription" as const, enabled: true },
      ]),
    );
    const profiles = Object.fromEntries(
      providerNames.map((name, index) => [
        `profile-${index}`,
        profile({
          name: `profile-${index}`,
          tier: "t",
          providers: index === 0 ? providerNames : [name],
          seats: { pm: seat(`${name}-model`, "judgment", "text-only") },
        }),
      ]),
    );
    const chain = {
      tiers: { t: { name: "t" } },
      profiles,
      preferenceChain: {
        base: "profile-0",
        fallbacks: providerNames.slice(1).map((_name, index) => `profile-${index + 1}`),
        order: providerNames.map((_name, index) => `profile-${index}`),
      },
    };
    const inner = createResolvedProviderProbe(entries, NOW, undefined, { store: counting.store });
    let probeCalls = 0;
    const probe = {
      probe: (providerName: string) => {
        probeCalls += 1;
        return inner.probe(providerName);
      },
    };
    const selection = selectProfile({ profiles: chain, probe, nowMs: NOW });
    expect(selection.ok).toBe(true);
    if (!selection.ok) return;
    expect(selection.decision.profile).toBe("profile-0");
    expect(counting.foldReads()).toBe(1);
    expect(probeCalls).toBe(100);

    const before = probeCalls;
    resolveProfileForSpawn({
      profiles: chain,
      probe,
      nowMs: NOW,
      agent: "pm",
      namePrefix: "TEST",
    });
    // The same probe instance serves the spawn resolution; the fold is not
    // re-read, and each pass memoizes one probe per distinct provider.
    expect(counting.foldReads()).toBe(1);
    expect(probeCalls - before).toBe(100);
  });

  test("the construction census finds one factory at exactly three call sites", () => {
    const edge = read("packages/cli/src/edge.ts");
    const production = read("packages/cli/src/production.ts");
    const calls = (text: string): number =>
      (text.match(/createResolvedProviderProbe\(/g) ?? []).length;
    // The definition is `createResolvedProviderProbe = (` and does not match.
    expect(calls(edge) + calls(production)).toBe(3);
  });
});
