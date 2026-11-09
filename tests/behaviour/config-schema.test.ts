import { describe, expect, test } from "bun:test";
import { createGitMergeSeam } from "@delivery-os/adapters/git";
import { createMergeCommandRuntime } from "../../packages/cli/src/edge";
import type { ConfigValue } from "../../packages/core/src/contracts/config";
import {
  BOOTSTRAP_DESCRIPTOR,
  type ConfigCatalog,
  generateConfigSchema,
  PRODUCTION_CATALOG,
  PRODUCTION_SCHEMA,
  resolveConfig,
} from "../../packages/core/src/index";
import {
  createNodeStateEdge,
  createStateStore,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/state/index";
import { FIXTURE_CATALOG } from "../fixtures/config/catalog";
import { fileFacts } from "../fixtures/config/facts";

describe("TC-CONFIG-008/009/011 canonical schema, partial and final", () => {
  test("production exposes the typed provider branch and shipped defaults", () => {
    expect(BOOTSTRAP_DESCRIPTOR.workingName).toEqual({ type: "string", required: true });
    expect(Object.keys(PRODUCTION_CATALOG)).toEqual([
      "provider",
      "commit",
      "merge",
      "harness",
      "lane",
      "queue",
      "daemon",
      "coordinator",
      "poll",
    ]);
    expect(PRODUCTION_SCHEMA).toEqual(generateConfigSchema(PRODUCTION_CATALOG));
    const result = resolveConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.values.provider).toMatchObject({
        credentials: { zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } } },
        entries: { "zai-coding-plan": { class: "subscription", enabled: true } },
        chains: {},
      });
      expect(result.value.origins.provider?.layer).toBe("defaults");
    }
  });

  test("reserved metadata is validated, removed, and cannot load a foreign schema", () => {
    const metadata = resolveConfig({
      sources: [
        fileFacts(
          "system",
          {
            $schema: "https://invalid.test/hostile",
            "x-vendor": { list: [null, true, { nested: 2 }] },
          },
          3,
        ),
      ],
    });
    expect(metadata.ok).toBe(true);
    if (metadata.ok)
      expect(metadata.value.values["x-vendor"]).toEqual({
        list: [null, true, { nested: 2 }],
      });
    const bad = resolveConfig({ sources: [fileFacts("system", { $schema: 12 }, 3)] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("config.value.invalid");
    const unknown = resolveConfig({
      sources: [fileFacts("system", { speculative: "not allowed" }, 3)],
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe("config.key.unknown");
    const badReset = resolveConfig({ sources: [fileFacts("system", { reset: [12] }, 3)] });
    expect(badReset.ok).toBe(false);
    if (!badReset.ok) expect(badReset.error.code).toBe("config.reset.invalid");
  });

  test("partial nested required fields become optional; final fields remain required", () => {
    const partial = generateConfigSchema(FIXTURE_CATALOG, true);
    const strict = generateConfigSchema(FIXTURE_CATALOG);
    expect(JSON.stringify(partial)).not.toContain('"required"');
    expect(JSON.stringify(strict)).toContain('"required"');
    const nestedCatalog = {
      "x-nested": {
        type: "object",
        required: true,
        fields: {
          child: {
            type: "object",
            required: true,
            fields: { value: { type: "number", required: true } },
          },
        },
      },
    } as const satisfies ConfigCatalog;
    const nestedPartial = generateConfigSchema(nestedCatalog, true);
    expect(JSON.stringify(nestedPartial)).not.toContain('"required"');
    const nestedFinal = resolveConfig({
      catalog: nestedCatalog,
      sources: [fileFacts("system", { "x-nested": { child: {} } }, 4)],
    });
    expect(nestedFinal.ok).toBe(false);
    if (!nestedFinal.ok) expect(nestedFinal.error.code).toBe("config.value.invalid");
    const missing = resolveConfig({ catalog: FIXTURE_CATALOG });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("config.value.invalid");
      expect(missing.error).not.toHaveProperty("line");
    }
    const good = resolveConfig({
      catalog: FIXTURE_CATALOG,
      environmentPrefix: "FIXTURE_",
      environment: {
        FIXTURE_X_TEST__REQUIREDVALUE: "required",
        FIXTURE_X_TEST__CREDENTIAL: "SECRET-CANARY",
      },
    });
    expect(good.ok).toBe(true);
    if (good.ok)
      expect(good.value.values).toMatchObject({
        "x-test": { requiredValue: "required", credential: "SECRET-CANARY" },
      });
    const nullValue = resolveConfig({
      catalog: FIXTURE_CATALOG,
      environmentPrefix: "FIXTURE_",
      environment: {
        FIXTURE_X_TEST__REQUIREDVALUE: "required",
        FIXTURE_X_TEST__CREDENTIAL: "SECRET-CANARY",
        FIXTURE_X_TEST__NESTED__SECOND: "null",
      },
    });
    expect(nullValue.ok).toBe(true);
    if (nullValue.ok)
      expect(
        (nullValue.value.values["x-test"] as { nested: { second: unknown } }).nested.second,
      ).toBeNull();
  });
});

describe("TC-PROV-002 provider branch schema", () => {
  const provider = {
    provider: {
      defaultChain: "default",
      credentials: { zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } } },
      entries: { "zai-coding-plan": { class: "subscription", enabled: true } },
      chains: { default: { entries: ["zai-coding-plan"], allowPaidFallback: false } },
    },
  } as const;

  test("a valid provider branch resolves over shipped defaults", () => {
    const resolved = resolveConfig({ sources: [fileFacts("system", provider, 3)] });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.values.provider).toMatchObject({
        defaultChain: "default",
        chains: { default: { entries: ["zai-coding-plan"] } },
      });
    }
  });

  test("unknown keys and missing required entry fields fail closed", () => {
    const unknown = resolveConfig({
      sources: [fileFacts("system", { provider: { speculative: true } }, 3)],
    });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe("config.key.unknown");
    const missing = resolveConfig({
      sources: [
        fileFacts(
          "system",
          { provider: { entries: { minimal: { enabled: true } }, chains: {} } },
          3,
        ),
      ],
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("config.value.invalid");
  });
});

describe("TC-REGRESS-006 commit.phaseCommit branch", () => {
  test("defaults to true and reports the defaults layer", () => {
    const resolved = resolveConfig();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect((resolved.value.values.commit as { phaseCommit: boolean }).phaseCommit).toBe(true);
      expect(resolved.value.origins.commit?.layer).toBe("defaults");
    }
  });

  test("a project file layer overrides the default and reports its origin", () => {
    const resolved = resolveConfig({
      sources: [fileFacts("project-local", { commit: { phaseCommit: false } }, 3)],
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect((resolved.value.values.commit as { phaseCommit: boolean }).phaseCommit).toBe(false);
      expect(resolved.value.origins.commit?.layer).toBe("project-local");
    }
  });

  test("an invalid value fails closed naming the layer", () => {
    const invalid = resolveConfig({
      sources: [fileFacts("project-local", { commit: { phaseCommit: "yes" } }, 3)],
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe("config.value.invalid");
  });
});

describe("TC-MERGE-003 merge config branch origin and classified validation", () => {
  const mergeRuntime = (values: Readonly<Record<string, unknown>>) =>
    createMergeCommandRuntime({
      store: createStateStore(
        {
          level: "local",
          workspaceId: "config-unit",
          fenceNamespace: "config-unit",
          schemaVersion: STATE_SCHEMA_VERSION,
          stateDirectory: "tmp/tmpdir/config-merge-unit",
        },
        { driver: "jsonl", edge: createNodeStateEdge() },
      ),
      git: createGitMergeSeam(),
      values: () => values,
      readWorkItem: async () => ({ ok: false as const, code: "provider.outage" }),
      readCheckRuns: async () => ({ ok: false as const, code: "provider.outage" }),
      readRequestDetail: async () => ({ ok: false as const, code: "provider.outage" }),
      nowIso: () => "2026-11-06T12:00:00Z",
      nowMs: () => 0,
      newFenceToken: () => "config-unit-fence",
    });

  test("the three merge keys report their per-key file origin", () => {
    const resolved = resolveConfig({
      sources: [
        fileFacts(
          "project-local",
          {
            merge: {
              "gate-freshness": 600,
              gates: {
                schemaVersion: "delivery.merge.gates.v1",
                entries: [{ id: "ci-green", recipe: "required-ci-job", surface: "merge" }],
              },
              "deploy-expectations": { steps: ["build"], artifacts: ["app@*"] },
            },
          },
          7,
        ),
      ],
    });
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      for (const key of [
        "merge.gate-freshness",
        "merge.gates",
        "merge.deploy-expectations",
      ] as const) {
        expect(resolved.value.origins[key]).toMatchObject({
          layer: "project-local",
          file: "fixtures/project-local.yaml",
          line: 7,
        });
      }
      expect(resolved.value.origins["merge.gates.schemaVersion"]?.layer).toBe("project-local");
      expect(resolved.value.origins["merge.deploy-expectations.steps[0]"]?.layer).toBe(
        "project-local",
      );
      expect(resolved.value.values.merge).toMatchObject({
        "gate-freshness": 600,
        "deploy-expectations": { steps: ["build"], artifacts: ["app@*"] },
      });
    }
  });

  test("the shipped freshness default reports the defaults origin", () => {
    const resolved = resolveConfig();
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.origins["merge.gate-freshness"]).toMatchObject({ layer: "defaults" });
      expect(resolved.value.values.merge).toMatchObject({ "gate-freshness": 1800 });
    }
  });

  test("an invalid merge.gate-freshness is a classified config failure, never a silent default", () => {
    for (const invalid of ["soon", -1, Number.POSITIVE_INFINITY, Number.NaN]) {
      const read = mergeRuntime({ merge: { "gate-freshness": invalid } }).readConfig("GH-301");
      expect(read).toMatchObject({ ok: false, code: "config.value.invalid" });
    }
    const validZero = mergeRuntime({ merge: { "gate-freshness": 0 } }).readConfig("GH-301");
    expect(validZero.ok).toBe(true);
    if (validZero.ok) expect(validZero.config.freshnessBoundSeconds).toBe(0);
    const absent = mergeRuntime({}).readConfig("GH-301");
    expect(absent.ok).toBe(true);
    if (absent.ok) expect(absent.config.freshnessBoundSeconds).toBe(1800);
  });

  test("an invalid merge.gates declaration is a classified config failure", () => {
    const invalid = mergeRuntime({
      merge: { gates: { schemaVersion: "delivery.merge.gates.v1", entries: [] } },
    }).readConfig("GH-301");
    expect(invalid).toMatchObject({ ok: false, code: "config.value.invalid" });
  });

  test("malformed merge.gates and merge.deploy-expectations shapes fail closed at resolve", () => {
    const invalidValues: readonly Record<string, ConfigValue>[] = [
      {
        merge: {
          gates: {
            schemaVersion: "delivery.merge.gates.v1",
            entries: [{ id: "ci-green", surface: "merge" }],
          },
        },
      },
      { merge: { gates: { schemaVersion: 12, entries: [] } } },
      { merge: { "deploy-expectations": { steps: "build" } } },
      { merge: { "deploy-expectations": { artifacts: [12] } } },
    ];
    for (const values of invalidValues) {
      const resolved = resolveConfig({
        sources: [fileFacts("project-local", values, 9)],
      });
      expect(resolved.ok).toBe(false);
      if (!resolved.ok) expect(resolved.error.code).toBe("config.value.invalid");
    }
  });
});
