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
  PRODUCTION_CATALOG,
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
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import { fileFacts } from "../fixtures/config/facts";

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
      "harness.environment[0].name",
    ]) {
      expect(resolved.value.origins[path]?.layer, path).toBe("defaults");
    }
    const settings = resolveHarnessSettings(resolved.value.values, resolved.value.origins);
    expect(settings.ok).toBe(true);
    if (!settings.ok) return;
    expect(settings.value.kind).toBe("opencode");
    expect(settings.value.executionKind).toBe("host");
    expect(settings.value.environment).toEqual([
      { name: "HARNESS_MODEL" },
      { name: "HARNESS_SMALL_MODEL" },
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
