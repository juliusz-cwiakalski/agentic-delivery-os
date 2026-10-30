import { describe, expect, test } from "bun:test";
import { resolveConfig, type ConfigCatalog } from "../../packages/core/src/index";
import { FIXTURE_CATALOG } from "../fixtures/config/catalog";
import { fileFacts } from "../fixtures/config/facts";

const base = {
  FIXTURE_X_TEST__REQUIREDVALUE: "required",
  FIXTURE_X_TEST__CREDENTIAL: "SECRET-CANARY",
};
const run = (options: Parameters<typeof resolveConfig>[0] = {}) =>
  resolveConfig({
    catalog: FIXTURE_CATALOG,
    environmentPrefix: "FIXTURE_",
    environment: base,
    ...options,
  });

describe("TC-CONFIG-012/013/016 typed conversion, restrictions and warnings", () => {
  test("unmapped prefixed keys fail; exact exclusions do not blanket-ignore names", () => {
    const env = { ...base, FIXTURE_UNKNOWN: "secret", FIXTURE_CONFIG: "selector" };
    const missing = run({ environment: env, excludedEnvironmentNames: ["FIXTURE_CONFIG"] });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe("config.environment.unmapped");
    const excluded = run({
      environment: { ...base, FIXTURE_CONFIG: "selector" },
      excludedEnvironmentNames: ["FIXTURE_CONFIG"],
    });
    expect(excluded.ok).toBe(true);
    const bad = run({ environment: { ...base, FIXTURE_X_TEST__NESTED__SECOND: "not-a-number" } });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("config.value.invalid");
    const unknownFlag = run({ flags: { "--undeclared": "x" } });
    expect(unknownFlag.ok).toBe(false);
    if (!unknownFlag.ok) expect(unknownFlag.error.code).toBe("config.key.unknown");
  });

  test("no shadowing or reset makes forbidden file input or interpolation safe", () => {
    for (const layer of ["system", "user-global", "project-committed", "project-local"] as const) {
      const secret = run({
        sources: [fileFacts(layer, { "x-test": { credential: "UNREGISTERED-SECRET" } }, 2)],
      });
      expect(secret.ok).toBe(false);
      if (!secret.ok) {
        expect(secret.error.code).toBe("config.secret.forbidden");
        expect(JSON.stringify(secret.error)).not.toContain("UNREGISTERED-SECRET");
      }
    }
    for (const value of ["${SOME:-default}", "{env:SOME}"]) {
      const result = run({ sources: [fileFacts("system", { "x-test": { oldValue: value } }, 2)] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("config.interpolation.rejected");
    }
    const path = run({
      sources: [fileFacts("project-local", { "x-test": { localPath: "/machine" } }, 2)],
    });
    expect(path.ok).toBe(false);
    if (!path.ok) expect(path.error.code).toBe("config.path.forbidden");
    const systemPath = run({
      sources: [fileFacts("system", { "x-test": { localPath: "/machine" } }, 2)],
    });
    expect(systemPath.ok).toBe(true);
    const cliPath = run({
      flags: { "--first": "safe" },
      sources: [
        fileFacts("project-committed", { "x-test": { credential: "UNREGISTERED-SECRET" } }, 2),
      ],
    });
    expect(cliPath.ok).toBe(false);
  });

  test("typed defaults cannot evade source restrictions", () => {
    const catalog = {
      "x-secret": {
        type: "string",
        source: "environment-only",
        default: "unsafe",
        defaultOrigin: { layer: "defaults", file: "tests/fixtures/config/catalog.ts", line: 11 },
      },
    } as const satisfies ConfigCatalog;
    const result = resolveConfig({ catalog });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("config.secret.forbidden");
    const machine = {
      "x-path": {
        type: "string",
        source: "machine-path",
        default: "/machine",
        defaultOrigin: { layer: "defaults", file: "tests/fixtures/config/catalog.ts", line: 11 },
        flag: "--path",
      },
    } as const satisfies ConfigCatalog;
    const invalidDefault = resolveConfig({ catalog: machine });
    expect(invalidDefault.ok).toBe(false);
    if (!invalidDefault.ok) expect(invalidDefault.error.code).toBe("config.path.forbidden");
    const invalidFlag = resolveConfig({
      catalog: { "x-path": { type: "string", source: "machine-path", flag: "--path" } },
      flags: { "--path": "/machine" },
    });
    expect(invalidFlag.ok).toBe(false);
    if (!invalidFlag.ok) expect(invalidFlag.error.code).toBe("config.path.forbidden");
  });

  test("deprecation and shadowing warn without values; strict fails without partial output", () => {
    const source = fileFacts(
      "system",
      { "x-test": { oldValue: "CANARY", nested: { first: "override" } } },
      4,
    );
    const loose = run({ sources: [source] });
    expect(loose.ok).toBe(true);
    if (loose.ok) {
      expect(loose.value.warnings).toContainEqual({
        kind: "deprecated",
        layer: "system",
        key: "x-test.oldValue",
      });
      expect(loose.value.warnings).toContainEqual({
        kind: "shadowed",
        layer: "system",
        key: "x-test.nested.first",
      });
      expect(JSON.stringify(loose.value.warnings)).not.toContain("CANARY");
    }
    const strict = run({ sources: [source], strict: true });
    expect(strict.ok).toBe(false);
    if (!strict.ok) {
      expect(strict.error.code).toBe("config.warning.strict");
      expect(strict).not.toHaveProperty("value");
    }
  });
});
