/**
 * TC-CONFIG-007/010/012/013/017/021 — real YAML 1.2 parser facts, safe failures,
 * true positions, alias bounds and the actual Node-selected host-switch guard.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseConfigYaml } from "@delivery-os/adapters/file";
import { type ConfigCatalog, resolveConfig } from "@delivery-os/core";

const ROOT = process.cwd();
const FIXTURES = join(ROOT, "tests/fixtures/config/yaml");
const PROBE = join(ROOT, "tests/fixtures/config/parser-probe.ts");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");
const parseFixture = (name: string) => parseConfigYaml(fixture(name), "system", `fixtures/${name}`);

describe("TC-CONFIG-010 YAML shapes, positions and aliases", () => {
  test("records actual node, list, empty collection, alias and scalar lines", () => {
    const parsed = parseFixture("positions.yaml");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.facts.values).toEqual({
      $schema: "local",
      "x-test": {
        nested: { first: "system", second: 7 },
        list: ["one", "two"],
        emptyMap: {},
        emptyList: [],
        aliasSource: { value: "alias-value" },
        aliasUse: { value: "alias-value" },
        block: "line-a\nline-b\n",
        flow: { a: 1, b: [2, 3] },
      },
    });
    // F-5: each origin carries the winning value node's 1-based start line, so a
    // collection's line is its own node line (after its key), not the key line.
    const file = "fixtures/positions.yaml";
    expect(parsed.facts.origins).toMatchObject({
      $schema: { layer: "system", file, line: 1 },
      "x-test": { layer: "system", file, line: 3 },
      "x-test.nested": { layer: "system", file, line: 4 },
      "x-test.nested.first": { layer: "system", file, line: 4 },
      "x-test.nested.second": { layer: "system", file, line: 5 },
      "x-test.list": { layer: "system", file, line: 7 },
      "x-test.list[0]": { layer: "system", file, line: 7 },
      "x-test.list[1]": { layer: "system", file, line: 8 },
      "x-test.emptyMap": { layer: "system", file, line: 9 },
      "x-test.emptyList": { layer: "system", file, line: 10 },
      "x-test.aliasSource": { layer: "system", file, line: 12 },
      "x-test.aliasSource.value": { layer: "system", file, line: 12 },
      "x-test.aliasUse": { layer: "system", file, line: 12 },
      "x-test.aliasUse.value": { layer: "system", file, line: 12 },
      "x-test.block": { layer: "system", file, line: 14 },
      "x-test.flow": { layer: "system", file, line: 17 },
      "x-test.flow.a": { layer: "system", file, line: 17 },
      "x-test.flow.b": { layer: "system", file, line: 17 },
      "x-test.flow.b[0]": { layer: "system", file, line: 17 },
      "x-test.flow.b[1]": { layer: "system", file, line: 17 },
    });
    expect(parsed.facts.origins[""]).toBeUndefined();
    expect(parsed.facts.loadedFile).toEqual({ layer: "system", file });
  });

  test("interpolation text stays literal so the catalog resolver rejects it", () => {
    const parsed = parseFixture("interpolation.yaml");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const catalog = {
      "x-test": {
        type: "object",
        fields: {
          oldValue: { type: "string" },
          localPath: { type: "string" },
        },
      },
    } as const satisfies ConfigCatalog;
    const xTest = parsed.facts.values["x-test"];
    if (!xTest || Array.isArray(xTest) || typeof xTest !== "object") {
      throw new Error("fixture mapping missing");
    }
    for (const key of ["oldValue", "localPath"] as const) {
      const values = { "x-test": { [key]: xTest[key] } };
      const result = resolveConfig({
        catalog,
        sources: [{ ...parsed.facts, values }],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("config.interpolation.rejected");
    }
  });
});

describe("TC-CONFIG-007 malformed and unsupported YAML fails safely", () => {
  test("rejects duplicate, non-string, multiple, custom-tag, merge, cyclic, non-JSON and root-sequence input", () => {
    for (const name of [
      "duplicates.yaml",
      "nonstring-key.yaml",
      "multiple.yaml",
      "custom-tag.yaml",
      "merge.yaml",
      "cyclic.yaml",
      "nonjson.yaml",
      "root-sequence.yaml",
      "malformed.yaml",
      "empty.yaml",
    ]) {
      const parsed = parseFixture(name);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.error.code).toBe("config.file.malformed");
      expect(parsed.error).toMatchObject({
        kind: "config",
        layer: "system",
        file: `fixtures/${name}`,
      });
      expect(JSON.stringify(parsed.error)).not.toContain("PARSER-CANARY");
      expect(parsed.error).not.toHaveProperty("message");
      expect(parsed.error).not.toHaveProperty("stack");
    }
  });

  test("bounds alias expansion", () => {
    const aliases = Array.from({ length: 101 }, (_, index) => `  a${index}: *base`).join("\n");
    const parsed = parseConfigYaml(
      `base: &base\n  value: one\n${aliases}\n`,
      "system",
      "alias-flood.yaml",
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe("config.file.malformed");
      expect(parsed.error).not.toHaveProperty("line");
    }
  });
});

describe("TC-CONFIG-021 actual host switches block before parsing", () => {
  const result = (
    file: string,
    env: Record<string, string>,
  ): { stdout: string; stderr: string } => {
    const childEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) childEnv[key] = value;
    }
    delete childEnv.LOG_TOKENS;
    delete childEnv.LOG_STREAM;
    const output = spawnSync("bun", ["run", PROBE, join(FIXTURES, file)], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...childEnv, ...env },
    });
    return { stdout: output.stdout ?? "", stderr: output.stderr ?? "" };
  };

  test("LOG_TOKENS and LOG_STREAM reject with no source canary and no parse", () => {
    for (const env of [
      { LOG_TOKENS: "1" },
      { LOG_STREAM: "1" },
      { LOG_TOKENS: "1", LOG_STREAM: "1" },
    ]) {
      const blocked = result("canary.yaml", env);
      expect(blocked.stdout).toContain("config.value.invalid");
      expect(blocked.stdout).not.toContain("PARSER-CANARY");
      expect(blocked.stderr).not.toContain("PARSER-CANARY");
      const malformed = result("malformed.yaml", env);
      expect(malformed.stdout).toContain("config.value.invalid");
      expect(malformed.stdout).not.toContain("config.file.malformed");
    }
  });

  test("unset and empty switches still parse the same source", () => {
    for (const env of [{}, { LOG_TOKENS: "" }, { LOG_STREAM: "" }]) {
      const allowed = result("canary.yaml", env);
      expect(allowed.stdout).toContain('"ok":true');
      expect(allowed.stdout).toContain("PARSER-CANARY");
    }
  });
});
