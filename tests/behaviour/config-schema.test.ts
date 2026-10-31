import { describe, expect, test } from "bun:test";
import {
  BOOTSTRAP_DESCRIPTOR,
  type ConfigCatalog,
  generateConfigSchema,
  PRODUCTION_CATALOG,
  PRODUCTION_SCHEMA,
  resolveConfig,
} from "../../packages/core/src/index";
import { FIXTURE_CATALOG } from "../fixtures/config/catalog";
import { fileFacts } from "../fixtures/config/facts";

describe("TC-CONFIG-008/009/011 canonical schema, partial and final", () => {
  test("empty production is empty, without bootstrap/test keys or invented origins", () => {
    expect(BOOTSTRAP_DESCRIPTOR.workingName).toEqual({ type: "string", required: true });
    expect(PRODUCTION_CATALOG).toEqual({});
    expect(PRODUCTION_SCHEMA).toEqual(generateConfigSchema(PRODUCTION_CATALOG));
    const result = resolveConfig();
    expect(result).toMatchObject({ ok: true, value: { values: {}, origins: {} } });
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
      expect(metadata.value.values).toEqual({ "x-vendor": { list: [null, true, { nested: 2 }] } });
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
