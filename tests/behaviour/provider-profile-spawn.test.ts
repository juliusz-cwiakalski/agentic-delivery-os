/**
 * TC-PROFILE-003 (spawn half), 033, 034, 058 — resolution before every spawn,
 * the data-v1 record reaching the deny-by-default spawn seam, and the
 * milestone-seam evaluability note (external evidence not asserted here).
 */
import { describe, expect, test } from "bun:test";
import {
  buildProfileEnvRecord,
  resolveProfileForSpawn,
  runProfileSpawn,
} from "../../packages/core/src/provider/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import type {
  CredentialPort,
  HarnessExecutionEnvironmentDescriptor,
} from "../../packages/core/src/contracts/index";
import { mixedChain } from "../fixtures/provider/profile/selection/fixtures";
import { createProviderFactsProbe } from "../../packages/core/src/provider/index";

const NOW = 1_700_000_000_000;
const NAME_PREFIX = "ADOS";

const facts = {
  "coding-plan": { available: true, condition: "clear", blockers: [], source: "clear" },
  deepseek: { available: true, condition: "clear", blockers: [], source: "clear" },
};

const recordingSpawnPort = () => {
  const environments: Array<Readonly<Record<string, string>>> = [];
  return {
    environments,
    port: {
      spawn: (environment: Readonly<Record<string, string>>) => {
        environments.push(environment);
      },
    },
  };
};

describe("TC-PROFILE-033 resolution runs before every spawn; refusal stops the spawn", () => {
  test("a resolving case calls the spawn port once after resolution", () => {
    const recorder = recordingSpawnPort();
    const outcome = runProfileSpawn({
      profiles: mixedChain(),
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
      agent: "pm",
      namePrefix: NAME_PREFIX,
      spawnPort: recorder.port,
    });
    expect(outcome.ok).toBe(true);
    expect(recorder.environments).toHaveLength(1);
    if (!outcome.ok) return;
    expect(recorder.environments[0]).toEqual(outcome.variables);
  });

  test("an empty configuration refuses without calling the spawn port", () => {
    const recorder = recordingSpawnPort();
    const outcome = runProfileSpawn({
      profiles: { tiers: {}, profiles: {} },
      probe: createProviderFactsProbe({}),
      nowMs: NOW,
      namePrefix: NAME_PREFIX,
      spawnPort: recorder.port,
    });
    expect(outcome.ok).toBe(false);
    expect(recorder.environments).toHaveLength(0);
    if (outcome.ok) return;
    expect(outcome.code).toBe("provider.profile.absent");
  });

  test("an all-ineligible chain refuses without calling the spawn port", () => {
    const recorder = recordingSpawnPort();
    const outcome = runProfileSpawn({
      profiles: mixedChain(),
      probe: createProviderFactsProbe({
        "coding-plan": {
          available: false,
          condition: "quota-exhausted",
          blockers: [],
          source: "x",
        },
        deepseek: { available: false, condition: "provider-outage", blockers: [], source: "y" },
      }),
      nowMs: NOW,
      namePrefix: NAME_PREFIX,
      spawnPort: recorder.port,
    });
    expect(outcome.ok).toBe(false);
    expect(recorder.environments).toHaveLength(0);
    if (outcome.ok) return;
    expect(outcome.code).toBe("provider.profile.unavailable");
  });
});

describe("TC-PROFILE-034 --for-spawn emits a data-v1 record into the spawn seam", () => {
  test("the record has the exact grammar and the declared variables reach the seam", () => {
    const outcome = resolveProfileForSpawn({
      profiles: mixedChain(),
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
      agent: "pm",
      namePrefix: NAME_PREFIX,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.envRecord.recordFormat).toBe("data-v1");
    const lines = outcome.envRecord.serialized.split("\n");
    expect(lines[0]).toBe("# model-env data-v1");
    expect(lines[lines.length - 1]).toBe("");
    expect(lines.slice(1, -1).every((line) => line.startsWith("set "))).toBe(true);
    for (const line of lines.slice(1, -1)) {
      const name = line.slice(4).split("=")[0] ?? "";
      expect(name.startsWith("OC_ADOS_AGENT_")).toBe(true);
    }

    const descriptor: HarnessExecutionEnvironmentDescriptor = {
      kind: "opencode",
      workDirectory: "/work",
      environment: Object.keys(outcome.variables).map((name) => ({
        kind: "variable" as const,
        name,
      })),
    };
    const credentials: CredentialPort = {
      resolve: () => ({
        ok: false,
        code: "config.credential.missing",
        domainKind: "config",
        category: "user",
        retryable: false,
        consequence: "not_landed",
        projectionClass: "user-validation",
      }),
    };
    const built = buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: { DECOY_PARENT_SECRET: "decoy" },
      credentials,
      record: outcome.variables,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual(outcome.variables);
    expect(built.value.DECOY_PARENT_SECRET).toBeUndefined();
  });

  test("the deny-by-default invariant still holds for an undeclared record name", () => {
    const outcome = resolveProfileForSpawn({
      profiles: mixedChain(),
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
      namePrefix: NAME_PREFIX,
    });
    if (!outcome.ok) throw new Error("resolution failed");
    const descriptor: HarnessExecutionEnvironmentDescriptor = {
      kind: "opencode",
      workDirectory: "/work",
      environment: [{ kind: "variable", name: "OC_ADOS_AGENT_PM_MODEL" }],
    };
    const built = buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: {},
      credentials: {
        resolve: () => ({
          ok: false,
          code: "config.credential.missing",
          domainKind: "config",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          projectionClass: "user-validation",
        }),
      },
      record: { ...outcome.variables, UNDECLARED_SECRET: "x" },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.value)).toEqual(["OC_ADOS_AGENT_PM_MODEL"]);
    expect(built.value.UNDECLARED_SECRET).toBeUndefined();
  });

  test("size limits are enforced on the built record", () => {
    const built = buildProfileEnvRecord({
      seatModels: { pm: "x".repeat(200) },
      seats: { pm: { model: "x", pacingClass: "judgment", capability: "text-only" } },
      namePrefix: NAME_PREFIX,
      policy: { maxLineBytes: 20 },
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error.code).toBe("provider.env-record.oversized");
  });
});

describe("TC-PROFILE-058 milestone seam evaluability", () => {
  test("the seam exposes the documented envelope and exit-relevant outcome; external evidence is not asserted", () => {
    const outcome = resolveProfileForSpawn({
      profiles: mixedChain(),
      probe: createProviderFactsProbe(facts),
      nowMs: NOW,
      agent: "pm",
      namePrefix: NAME_PREFIX,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.selection.ok).toBe(true);
    if (!outcome.selection.ok) return;
    expect(outcome.selection.decision.profile.length).toBeGreaterThan(0);
    expect(outcome.selection.decision.envRecord?.recordFormat).toBe("data-v1");
    // AC-F8-8's zero-manual-override evidence arrives via M1-S9 (GH-239) and
    // M1-S22 (GH-223); it is deliberately not asserted by this suite.
    expect(outcome.envRecord.serialized.includes("MANUAL_OVERRIDE")).toBe(false);
  });
});
