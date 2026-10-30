import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "../../packages/core/src/index";

describe("TC-CONFIG-023 pure root API and unchanged composition declaration", () => {
  test("root exports the one production resolver and canonical schema without a public config subpath", () => {
    expect(typeof core.resolveConfig).toBe("function");
    expect(typeof core.generateConfigSchema).toBe("function");
    expect(core.PRODUCTION_CATALOG).toEqual({});
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
    const first = core.resolveConfig(options);
    for (let i = 0; i < 20; i++) expect(core.resolveConfig(options)).toEqual(first);
    expect(environment).toEqual({ SOME_HOST_VALUE: "not a config input" });
  });
});
