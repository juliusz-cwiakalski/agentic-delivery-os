/**
 * TC-HARN-003, TC-HARN-016, TC-HARN-017, TC-HARN-018 (config half) — the
 * typed harness branch, defaults, config-driven selection, validation, and
 * store-location resolution.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  catalogPaths,
  compileTrustedSchema,
  PRODUCTION_CATALOG,
  PRODUCTION_SCHEMA,
  resolveConfig,
  resolveHarnessSettings,
} from "../../packages/core/src/config/index";
import {
  type ConfigValue,
  ERROR_TABLE,
  type HarnessInstance,
  type HarnessKind,
} from "../../packages/core/src/contracts/index";
import {
  type HarnessAdapterRegistration,
  harnessRegistryViolations,
  resolveHarnessInstance,
} from "../../packages/core/src/domain/harness-registry";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import { fileFacts } from "../fixtures/config/facts";
import { createFakeCredentialPort, DECLARED_MODEL_VARIABLE } from "../fixtures/harness/spawn-env";

const ROOT = process.cwd();
const FIXTURES = "tests/fixtures/harness/config";

const loadFixture = (name: string): Record<string, ConfigValue> =>
  (parseYaml(readFileSync(join(ROOT, FIXTURES, name), "utf8")) ?? {}) as Record<
    string,
    ConfigValue
  >;

const resolveFixture = (name: string) =>
  resolveConfig({
    sources: [fileFacts("project-committed", loadFixture(name), 1)],
  });

const DECLARATION = {
  supportedOperations: ["spawn", "deliver", "resume", "steer", "collect", "session-list"],
  lifecycleCapabilities: [
    "headless-spawn",
    "resume-steer-injection",
    "session-introspection",
    "telemetry-extraction",
  ],
  livenessSources: ["session-traffic", "worktree-activity", "process"],
  declaredGaps: [],
} as const;

const makeRegistrations = (calls: string[]): HarnessAdapterRegistration[] =>
  ["opencode", "claude-code"].map((kind) => ({
    kind: kind as HarnessKind,
    create: (input): HarnessInstance => {
      calls.push(kind);
      return {
        kind: input.kind,
        observedVersion: input.observedVersion,
        ...(input.versionWarning === undefined ? {} : { versionWarning: input.versionWarning }),
        capabilities: {
          supportedOperations: [...DECLARATION.supportedOperations],
          lifecycleCapabilities: [...DECLARATION.lifecycleCapabilities],
          livenessSources: [...DECLARATION.livenessSources],
          declaredGaps: [...DECLARATION.declaredGaps],
        },
      };
    },
  }));

const select = async (calls: string[], kind: string) =>
  resolveHarnessInstance({
    kind,
    registrations: makeRegistrations(calls),
    versionProbe: async () => "synthetic-1.2.3",
  });

describe("TC-HARN-016 harness configuration defaults and selection", () => {
  test("an empty configuration resolves the shipped defaults with defaults origins", () => {
    const resolved = resolveConfig();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const shipped = JSON.parse(
      readFileSync(join(ROOT, FIXTURES, "default.resolved.json"), "utf8"),
    ) as unknown;
    expect(resolved.value.values.harness).toEqual(shipped as never);
    expect(canonicalHarnessJson(resolved.value.values.harness)).toBe(canonicalHarnessJson(shipped));
    for (const path of [
      "harness",
      "harness.kind",
      "harness.execution.kind",
      "harness.stores.opencode.databasePath",
      "harness.stores.claude-code.sessionDirectory",
      "harness.environment",
      "harness.environment[0].name",
      "harness.environment[1].name",
      "harness.environment[2].name",
      "harness.environment[2].optional",
      "harness.environment[3].name",
    ]) {
      expect(resolved.value.origins[path]?.layer, path).toBe("defaults");
    }
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(true);
    if (!settings.ok) return;
    expect(settings.value.kind).toBe("opencode");
    expect(settings.value.executionKind).toBe("host");
    expect(settings.value.environment).toEqual([
      { name: "PATH" },
      { name: "HOME" },
      { name: "TMPDIR", optional: true },
      { name: "DELIVERY_WORK_PATH" },
    ]);
  });

  test("claude-selected then opencode-selected resolve through the same path", async () => {
    for (const [fixture, expected] of [
      ["claude-selected.yaml", "claude-code"],
      ["opencode-selected.yaml", "opencode"],
    ] as const) {
      const resolved = resolveFixture(fixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
      expect(settings.ok).toBe(true);
      if (!settings.ok) return;
      expect(settings.value.kind).toBe(expected);
      expect(resolved.value.origins["harness.kind"]?.layer).toBe("project-committed");
      const calls: string[] = [];
      const instance = await select(calls, settings.value.kind);
      expect(instance.ok).toBe(true);
      expect(calls).toEqual([expected]);
    }
  });

  test("the harness branch is discoverable through catalogPaths with origins", () => {
    const paths = catalogPaths(PRODUCTION_CATALOG).map(([path]) => path);
    for (const path of [
      "harness",
      "harness.kind",
      "harness.execution",
      "harness.stores",
      "harness.stores.opencode.databasePath",
      "harness.stores.claude-code.sessionDirectory",
      "harness.environment",
    ]) {
      expect(paths).toContain(path);
    }
    const resolved = resolveFixture("claude-selected.yaml");
    expect(resolved.ok).toBe(true);
    if (resolved.ok)
      expect(resolved.value.origins["harness.kind"]?.layer).toBe("project-committed");
  });
});

describe("TC-HARN-017 harness configuration validation", () => {
  const identities = new Set(ERROR_TABLE.map((entry) => entry.code));

  test("an unknown kind classifies config.value.invalid naming the path and value", () => {
    const resolved = resolveFixture("invalid-unknown-kind.yaml");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(false);
    if (settings.ok) return;
    expect(settings.error.code).toBe("config.value.invalid");
    expect(settings.error.key).toBe("harness.kind");
    expect(identities.has(settings.error.code)).toBe(true);
  });

  test("wrong-typed, empty, and invalid path-shaped store locations classify", () => {
    const wrongType = resolveFixture("invalid-wrong-type-store.yaml");
    expect(wrongType.ok).toBe(false);
    if (!wrongType.ok) {
      expect(wrongType.error.code).toBe("config.value.invalid");
      expect(wrongType.error.layer).toBe("project-committed");
    }
    for (const fixture of ["invalid-empty-string-store.yaml", "invalid-path-shape.yaml"]) {
      const resolved = resolveFixture(fixture);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
      expect(settings.ok).toBe(false);
      if (settings.ok) return;
      expect(settings.error.code).toBe("config.value.invalid");
      expect(settings.error.key).toBe("harness.stores.opencode.databasePath");
      expect(settings.error.layer).toBe("project-committed");
    }
  });

  test("an allowlist literal value is rejected by the secret-forbidden identity", () => {
    const resolved = resolveFixture("invalid-allowlist-literal.yaml");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(false);
    if (settings.ok) return;
    expect(settings.error.code).toBe("config.secret.forbidden");
    expect(settings.error.key).toBe("harness.environment[0]");
    expect(identities.has(settings.error.code)).toBe(true);
    expect(JSON.stringify(settings.error)).not.toContain("synthetic-canary-value");
  });

  test("an unknown branch key classifies config.key.unknown", () => {
    const resolved = resolveFixture("invalid-unknown-key.yaml");
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.error.code).toBe("config.key.unknown");
  });
});

describe("TC-HARN-018 store locations resolve from configuration", () => {
  test("configured store paths reach the settings with no default fallback", () => {
    const resolved = resolveFixture("custom-stores.yaml");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(true);
    if (!settings.ok) return;
    expect(settings.value.opencodeDatabasePath).toBe("/bind-mount/synthetic-store/opencode.db");
    expect(settings.value.claudeCodeSessionDirectory).toBe("/bind-mount/synthetic-sessions");
    expect(settings.value.opencodeDatabasePath).not.toBe(".local/state/opencode/opencode.db");
  });

  test("removing the branch yields the default store location with defaults origin", () => {
    const resolved = resolveFixture("empty.yaml");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(true);
    if (!settings.ok) return;
    expect(settings.value.opencodeDatabasePath).toBe(".local/state/opencode/opencode.db");
    expect(resolved.value.origins["harness.stores.opencode.databasePath"]?.layer).toBe("defaults");
  });
});

describe("TC-HARN-003 harness instance resolution", () => {
  test("the configured kind yields the matching instance and an injected version", async () => {
    const calls: string[] = [];
    const before = await select(calls, "opencode");
    expect(before.ok).toBe(true);
    if (before.ok) {
      expect(before.value.kind).toBe("opencode");
      expect(before.value.observedVersion).toBe("synthetic-1.2.3");
    }
    const changed = await resolveHarnessInstance({
      kind: "opencode",
      registrations: makeRegistrations(calls),
      versionProbe: async () => "synthetic-9.9.9",
    });
    expect(changed.ok).toBe(true);
    if (changed.ok) expect(changed.value.observedVersion).toBe("synthetic-9.9.9");
    expect(calls).toEqual(["opencode", "opencode"]);
  });

  test("an unknown kind classifies with no factory constructed", async () => {
    const calls: string[] = [];
    const result = await select(calls, "pi-dev");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("config.value.invalid");
    expect(result.error.field).toBe("harness.kind");
    expect(result.error.summary ?? "").toContain("pi-dev");
    expect(calls).toEqual([]);
  });

  test("a failing probe yields an explicitly unknown version plus a warning", async () => {
    const calls: string[] = [];
    const result = await resolveHarnessInstance({
      kind: "claude-code",
      registrations: makeRegistrations(calls),
      versionProbe: async () => {
        throw new Error("probe unavailable");
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.observedVersion).toBeNull();
    expect(result.value.versionWarning).toBe("version-probe-failed");
  });

  test("the registry is exhaustive over the closed vocabulary", () => {
    const calls: string[] = [];
    expect(harnessRegistryViolations(makeRegistrations(calls))).toEqual([]);
    expect(harnessRegistryViolations(makeRegistrations(calls).slice(0, 1))).toContain(
      "harness claude-code has no registration",
    );
  });
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const at = (root: unknown, path: readonly string[]): unknown => {
  let current = root;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
};

const HARNESS_ENVIRONMENT_ENTRY_SCHEMA = at(PRODUCTION_SCHEMA, [
  "properties",
  "harness",
  "properties",
  "environment",
  "items",
]);

const validHarnessValues = (environment: readonly unknown[]): Record<string, ConfigValue> => ({
  harness: {
    kind: "opencode",
    execution: { kind: "host" },
    stores: {
      opencode: { databasePath: ".local/state/opencode/opencode.db" },
      "claude-code": { sessionDirectory: ".local/state/claude-code" },
    },
    environment: environment as ConfigValue[],
  },
});

const resolveEnvironment = (environment: readonly unknown[]) =>
  resolveHarnessSettings(validHarnessValues(environment));

describe("TC-HDA-005 exact shipped default allowlist", () => {
  test("required entries are PATH, HOME, DELIVERY_WORK_PATH; TMPDIR is the only optional", () => {
    const resolved = resolveConfig();
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(true);
    if (!settings.ok) return;
    const required = settings.value.environment
      .filter((entry) => !("credentialRef" in entry) && entry.optional !== true)
      .map((entry) => entry.name);
    const optional = settings.value.environment
      .filter((entry) => !("credentialRef" in entry) && entry.optional === true)
      .map((entry) => entry.name);
    expect(required).toEqual(["PATH", "HOME", "DELIVERY_WORK_PATH"]);
    expect(optional).toEqual(["TMPDIR"]);
    const names = settings.value.environment.map((entry) => entry.name);
    expect(names).not.toContain("HARNESS_MODEL");
    expect(names).not.toContain("HARNESS_SMALL_MODEL");
    for (const windows of ["USERPROFILE", "APPDATA"]) expect(names).not.toContain(windows);
  });
});

describe("TC-HDA-002 catalog and generated schema admit optional", () => {
  test("the environment entry schema admits a boolean optional and stays closed", () => {
    const properties = at(HARNESS_ENVIRONMENT_ENTRY_SCHEMA, ["properties"]);
    expect(isRecord(properties)).toBe(true);
    if (!isRecord(properties)) return;
    expect(properties.name).toEqual({ type: "string" });
    expect(properties.credentialRef).toEqual({ type: "string" });
    expect(properties.optional).toEqual({ type: "boolean" });
    expect(properties.value).toEqual({ type: "string" });
    expect(at(HARNESS_ENVIRONMENT_ENTRY_SCHEMA, ["additionalProperties"])).toBe(false);
  });

  test("a valid optional entry passes the trusted schema; a non-boolean fails", () => {
    const schema = compileTrustedSchema(PRODUCTION_CATALOG, true);
    expect(
      schema({ harness: { environment: [{ name: "SYNTHETIC_OPTIONAL", optional: true }] } }),
    ).toBe(true);
    expect(
      schema({ harness: { environment: [{ name: "SYNTHETIC_OPTIONAL", optional: "yes" }] } }),
    ).toBe(false);
  });

  test("resolveConfig rejects a non-boolean marker as config.value.invalid", () => {
    const resolved = resolveFixture("invalid-optional-non-boolean.yaml");
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe("config.value.invalid");
      expect(resolved.error.layer).toBe("project-committed");
    }
  });

  test("the catalog adds the marker to no other branch", () => {
    const providerSchema = at(PRODUCTION_SCHEMA, [
      "properties",
      "provider",
      "properties",
      "entries",
      "additionalProperties",
    ]);
    expect(isRecord(providerSchema)).toBe(true);
    if (isRecord(providerSchema)) expect(providerSchema.properties).not.toHaveProperty("optional");
  });
});

describe("TC-HDA-019 explicit HARNESS_MODEL keeps required-entry semantics", () => {
  test("an explicit declaration fails closed without a model value and forwards a present one", () => {
    const resolved = resolveConfig({
      sources: [
        fileFacts(
          "project-committed",
          { harness: { environment: [{ name: DECLARED_MODEL_VARIABLE }] } },
          1,
        ),
      ],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(true);
    if (!settings.ok) return;
    expect(settings.value.environment).toEqual([{ name: DECLARED_MODEL_VARIABLE }]);

    const descriptor = {
      kind: "host" as const,
      workDirectory: "/synthetic/work/GH-277",
      environment: [{ kind: "variable" as const, name: DECLARED_MODEL_VARIABLE }],
    };
    const missing = buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: {
        OC_ADOS_MAIN_MODEL: "synthetic/ambient-model",
        OC_ADOS_SMALL_MODEL: "synthetic/ambient-small",
      },
      credentials: createFakeCredentialPort().port,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("harness.spawn.variable-missing");
      expect(missing.error.field).toBe(DECLARED_MODEL_VARIABLE);
    }

    const present = buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: { [DECLARED_MODEL_VARIABLE]: "synthetic/model-large" },
      credentials: createFakeCredentialPort().port,
    });
    expect(present.ok).toBe(true);
    if (present.ok) expect(present.value[DECLARED_MODEL_VARIABLE]).toBe("synthetic/model-large");

    const defaults = resolveConfig();
    expect(defaults.ok).toBe(true);
    if (!defaults.ok) return;
    const defaultSettings = resolveHarnessSettings(defaults.value.values, defaults.value.origins);
    expect(defaultSettings.ok).toBe(true);
    if (defaultSettings.ok) {
      expect(defaultSettings.value.environment.map((entry) => entry.name)).not.toContain(
        DECLARED_MODEL_VARIABLE,
      );
    }
  });
});

describe("TC-HDA-020 existing { name } entries keep required semantics", () => {
  const CANARY = "SYNTHETIC_CANARY_VARIABLE";
  const descriptor = {
    kind: "host" as const,
    workDirectory: "/synthetic/work/GH-277",
    environment: [{ kind: "variable" as const, name: CANARY }],
  };

  test("an existing entry resolves with no migration and no marker", () => {
    const resolved = resolveConfig({
      sources: [
        fileFacts("project-committed", { harness: { environment: [{ name: CANARY }] } }, 1),
      ],
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(true);
    if (!settings.ok) return;
    expect(settings.value.environment).toEqual([{ name: CANARY }]);
    expect(settings.value.environment[0]).not.toHaveProperty("optional");

    const missing = buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: {},
      credentials: createFakeCredentialPort().port,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("harness.spawn.variable-missing");
      expect(missing.error.field).toBe(CANARY);
    }

    const present = buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: { [CANARY]: "synthetic-value" },
      credentials: createFakeCredentialPort().port,
    });
    expect(present.ok).toBe(true);
    if (present.ok) expect(present.value[CANARY]).toBe("synthetic-value");
  });
});

describe("TC-HDA-021 optional-marker validation matrix", () => {
  test("only a boolean marker on a non-credential entry is accepted", () => {
    const valid = resolveEnvironment([{ name: "SYNTHETIC_OPTIONAL", optional: true }]);
    expect(valid.ok).toBe(true);
    if (valid.ok)
      expect(valid.value.environment).toEqual([{ name: "SYNTHETIC_OPTIONAL", optional: true }]);

    const credential = resolveEnvironment([
      { name: "SYNTHETIC_CREDENTIAL", credentialRef: "synthetic-reference" },
    ]);
    expect(credential.ok).toBe(true);
    if (credential.ok)
      expect(credential.value.environment).toEqual([
        { name: "SYNTHETIC_CREDENTIAL", credentialRef: "synthetic-reference" },
      ]);
  });

  test("non-boolean, credential-plus-marker, unknown key and literal value classify", () => {
    for (const environment of [
      [{ name: "SYNTHETIC_OPTIONAL", optional: "yes" }],
      [{ name: "SYNTHETIC_OPTIONAL", optional: 1 }],
      [{ name: "SYNTHETIC_CREDENTIAL", optional: true, credentialRef: "synthetic-reference" }],
      [{ name: "SYNTHETIC_OPTIONAL", mystery: true }],
    ]) {
      const resolved = resolveEnvironment(environment);
      expect(resolved.ok).toBe(false);
      if (!resolved.ok) {
        expect(resolved.error.code).toBe("config.value.invalid");
        expect(resolved.error.key).toBe("harness.environment[0]");
        expect(JSON.stringify(resolved.error)).not.toContain("synthetic-reference");
      }
    }
    const literal = resolveEnvironment([{ name: "SYNTHETIC", value: "synthetic-literal-value" }]);
    expect(literal.ok).toBe(false);
    if (!literal.ok) {
      expect(literal.error.code).toBe("config.secret.forbidden");
      expect(literal.error.key).toBe("harness.environment[0]");
      expect(JSON.stringify(literal.error)).not.toContain("synthetic-literal-value");
    }
  });

  test("the credential-plus-marker fixture classifies through resolveConfig", () => {
    const resolved = resolveFixture("invalid-optional-credential.yaml");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(false);
    if (!settings.ok) {
      expect(settings.error.code).toBe("config.value.invalid");
      expect(settings.error.key).toBe("harness.environment[0]");
    }
  });
});
