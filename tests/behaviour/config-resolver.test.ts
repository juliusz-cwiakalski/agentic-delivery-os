import { describe, expect, test } from "bun:test";
import { resolveConfig, type ConfigCatalog } from "../../packages/core/src/index";
import { fileFacts } from "../fixtures/config/facts";

const winners = {
  "x-test": {
    type: "object",
    fields: {
      nested: {
        type: "object",
        fields: {
          first: {
            type: "string",
            env: true,
            flag: "--first",
            default: "default-first",
            defaultOrigin: {
              layer: "defaults",
              file: "tests/fixtures/config/catalog.ts",
              line: 15,
            },
          },
          second: { type: "string" },
        },
      },
      list: { type: "array", items: { type: "number" }, env: true, flag: "--list" },
    },
  },
} as const satisfies ConfigCatalog;

describe("TC-CONFIG-001/002 real production resolver with typed catalog", () => {
  test("every one of seven layers wins, with recursive maps and replaced lists", () => {
    const fileLayers = ["system", "user-global", "project-committed", "project-local"] as const;
    const sources = fileLayers.map((layer, index) =>
      fileFacts(
        layer,
        {
          "x-test": {
            nested: { first: layer, ...(index === 0 ? { second: "survives" } : {}) },
            list: [index, index + 1],
          },
        },
        8 + index,
      ),
    );
    const first = resolveConfig({ catalog: winners });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.values).toEqual({ "x-test": { nested: { first: "default-first" } } });
    expect(first.value.origins["x-test.nested.first"]).toEqual({
      layer: "defaults",
      file: "tests/fixtures/config/catalog.ts",
      line: 15,
    });
    for (let count = 1; count <= fileLayers.length; count++) {
      const result = resolveConfig({ catalog: winners, sources: sources.slice(0, count) });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect((result.value.values["x-test"] as Record<string, unknown>).nested).toEqual({
        first: fileLayers[count - 1],
        second: "survives",
      });
      expect(result.value.origins["x-test.nested.first"]).toMatchObject({
        layer: fileLayers[count - 1],
        line: 7 + count,
      });
      expect(
        Object.keys(result.value.origins).filter((key) => key.startsWith("x-test.list[")),
      ).toHaveLength(2);
    }
    const environment = {
      FIXTURE_X_TEST__NESTED__FIRST: "environment",
      FIXTURE_X_TEST__LIST: "[44]",
    };
    const env = resolveConfig({
      catalog: winners,
      sources,
      environmentPrefix: "FIXTURE_",
      environment,
    });
    expect(env.ok).toBe(true);
    if (!env.ok) return;
    expect(env.value.origins["x-test.nested.first"]).toEqual({
      layer: "environment",
      env: "FIXTURE_X_TEST__NESTED__FIRST",
    });
    expect(env.value.origins["x-test.list[1]"]).toBeUndefined();
    const flags = { "--first": "cli", "--list": "[55,66,77]" };
    const cli = resolveConfig({
      catalog: winners,
      sources,
      environmentPrefix: "FIXTURE_",
      environment,
      flags,
    });
    expect(cli.ok).toBe(true);
    if (!cli.ok) return;
    expect((cli.value.values["x-test"] as Record<string, unknown>).list).toEqual([55, 66, 77]);
    expect(cli.value.origins["x-test.nested.first"]).toEqual({ layer: "cli", flag: "--first" });
    expect(cli.value.origins["x-test.list[0]"]).toEqual({ layer: "cli", flag: "--list" });
    expect(cli.value.origins["x-test.nested.second"]).toMatchObject({ layer: "system" });
    expect(cli.value.loadedFiles.map((item) => item.layer)).toEqual(fileLayers);
    expect(
      resolveConfig({
        catalog: winners,
        sources,
        environmentPrefix: "FIXTURE_",
        environment,
        flags,
      }),
    ).toEqual(cli);
  });

  test("reset removes inherited values and all descendant origins before setting", () => {
    const lower = fileFacts(
      "system",
      { "x-test": { nested: { first: "lower", second: "old" }, list: [1, 2] } },
      4,
    );
    const higher = fileFacts(
      "project-local",
      { "x-test": { nested: { first: "higher" }, list: [3] } },
      10,
      ["x-test.nested", "x-test.list"],
    );
    const resolved = resolveConfig({ catalog: winners, sources: [higher, lower] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.values).toEqual({ "x-test": { nested: { first: "higher" }, list: [3] } });
    expect(resolved.value.origins["x-test.nested.second"]).toBeUndefined();
    expect(resolved.value.origins["x-test.list[1]"]).toBeUndefined();
    for (const reset of [
      ["x-test.nope"],
      ["x-test.nested.third"],
      ["not-there"],
      ["x-test..nested"],
    ]) {
      const failed = resolveConfig({
        catalog: winners,
        sources: [lower, fileFacts("project-local", {}, 10, reset)],
      });
      expect(failed.ok).toBe(false);
      if (!failed.ok) expect(failed.error.code).toBe("config.reset.invalid");
    }
  });
});
