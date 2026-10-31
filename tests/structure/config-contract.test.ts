import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateConfigSchema, PRODUCTION_CATALOG, resolveConfig } from "@delivery-os/core";

describe("TC-CONFIG-023 pure root API and unchanged composition declaration", () => {
  test("root exports the one production resolver and canonical schema without a public config subpath", () => {
    expect(typeof resolveConfig).toBe("function");
    expect(typeof generateConfigSchema).toBe("function");
    expect(Object.keys(PRODUCTION_CATALOG)).toEqual(["provider"]);
    expect(PRODUCTION_CATALOG.provider.type).toBe("object");
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "packages/core/package.json"), "utf8"),
    ) as { exports: Record<string, unknown> };
    expect(Object.keys(manifest.exports)).not.toContain("./config");
    const root = readFileSync(join(process.cwd(), "packages/core/src/index.ts"), "utf8");
    expect(root).toContain("export declare function createRuntime");
  });

  test("repeated pure resolution neither reads environment nor alters injected facts", () => {
    const environment = Object.freeze({ SOME_HOST_VALUE: "not a config input" });
    const options = Object.freeze({ environment });
    const first = resolveConfig(options);
    for (let i = 0; i < 20; i++) expect(resolveConfig(options)).toEqual(first);
    expect(environment).toEqual({ SOME_HOST_VALUE: "not a config input" });
  });
});
