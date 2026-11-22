/**
 * TC-PROFILE-003 (spawn half), 033, 034, 058 — resolution before every spawn,
 * the data-v1 record reaching the deny-by-default spawn seam, and the
 * milestone-seam evaluability note (external evidence not asserted here).
 */
import { describe, expect, test } from "bun:test";
import {
  buildProfileEnvRecord,
  envRecordNameForSeat,
  resolveProfileForSpawn,
  runProfileSpawn,
} from "../../packages/core/src/provider/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import type {
  CredentialPort,
  HarnessExecutionEnvironmentDescriptor,
  ProviderDescriptor,
} from "../../packages/core/src/contracts/index";
import { createParkRecord, parkView } from "../../packages/core/src/provider/parks";
import { createResolvedProviderProbe } from "../../packages/cli/src/edge";
import {
  mixedChain,
  noSupplierChain,
  substitutionChain,
} from "../fixtures/provider/profile/selection/fixtures";
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

/* ------------------------------------------------------------------------- *
 * GH-377 — truthful --for-spawn: per-seat agreement and all-or-nothing.
 * ------------------------------------------------------------------------- */

const seatEntries: Readonly<Record<string, ProviderDescriptor>> = {
  a: { name: "a", class: "subscription", enabled: true },
  b: { name: "b", class: "subscription", enabled: true },
  parked: { name: "parked", class: "pay-per-token", enabled: true },
};

const parkedProbe = (kind: "park" | "none") => {
  if (kind === "none") {
    return createResolvedProviderProbe(seatEntries, NOW, undefined, {
      parks: { ok: true, value: [] },
    });
  }
  const park = createParkRecord({
    subjectKind: "provider",
    subjectName: "parked",
    cause: "quota-exhausted",
    conditions: ["quota-exhausted"],
    createdAtMs: NOW - 1_000,
    expiresAtMs: NOW + 3_600_000,
    evidence: {},
  });
  return createResolvedProviderProbe(seatEntries, NOW, undefined, {
    parks: { ok: true, value: [parkView(park, NOW)] },
  });
};

describe("GH-377 TC-PROFILE-072 the env record and the spawn binding agree for every seat", () => {
  test("one string serves the seat map, the record, and the binding; no parked provider is named", () => {
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
    for (const kind of ["none", "park"] as const) {
      const profiles = substitutionChain();
      const probe = parkedProbe(kind);
      const outcome = resolveProfileForSpawn({
        profiles,
        probe,
        nowMs: NOW,
        agent: "pm",
        namePrefix: NAME_PREFIX,
      });
      if (!outcome.ok) throw new Error(`resolution failed for ${kind}`);
      const profile = profiles.profiles[outcome.selection.decision.profile];
      if (profile === undefined) throw new Error("selected profile missing");
      for (const [seatName, seat] of Object.entries(profile.seats)) {
        const expected = outcome.selection.decision.seatModels[seatName];
        if (expected === undefined) throw new Error(`seat ${seatName} missing`);
        const name = envRecordNameForSeat(seatName, seat, NAME_PREFIX);
        const entry = outcome.envRecord.entries.find(
          (candidate) => candidate.operation === "set" && candidate.name === name,
        );
        expect(entry?.operation === "set" ? entry.value : undefined, `${kind}/${seatName}`).toBe(
          expected,
        );
        const provider = expected.includes("/") ? expected.split("/")[0] : undefined;
        if (provider !== undefined) {
          expect(probe.probe(provider).available, `${kind}/${provider}`).toBe(true);
        }
      }

      const descriptor: HarnessExecutionEnvironmentDescriptor = {
        kind: "opencode",
        workDirectory: "/work",
        environment: Object.keys(outcome.variables).map((name) => ({
          kind: "variable" as const,
          name,
        })),
      };
      const built = buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: {},
        credentials,
        record: outcome.variables,
      });
      expect(built.ok, kind).toBe(true);
      if (!built.ok) return;
      expect(built.value, kind).toEqual(outcome.variables);
    }
  });
});

describe("GH-377 TC-PROFILE-073 emission is all-or-nothing", () => {
  test("an unsatisfiable seat emits no record, no variables, and calls no spawn port", () => {
    const recorder = recordingSpawnPort();
    const outcome = runProfileSpawn({
      profiles: noSupplierChain(),
      probe: parkedProbe("park"),
      nowMs: NOW,
      agent: "pm",
      namePrefix: NAME_PREFIX,
      spawnPort: recorder.port,
    });
    expect(outcome.ok).toBe(false);
    expect(recorder.environments).toHaveLength(0);
    if (outcome.ok) return;
    expect(outcome.code).toBe("provider.profile.unavailable");
    expect(outcome.summary).toContain("pm");
    expect(outcome.summary).toContain("parked");
    expect("envRecord" in outcome).toBe(false);
  });
});
