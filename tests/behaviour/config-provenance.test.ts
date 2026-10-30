import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { originLabel, resolveConfig } from "../../packages/core/src/index";
import type { ConfigOrigin } from "../../packages/core/src/contracts/config";
import { FIXTURE_CATALOG } from "../fixtures/config/catalog";
import { fileFacts } from "../fixtures/config/facts";

describe("TC-CONFIG-017 actual positions, replacement and labels", () => {
  test("fixture default source line is a real declaration, not an invented number", () => {
    const text = readFileSync(join(process.cwd(), "tests/fixtures/config/catalog.ts"), "utf8");
    const first = FIXTURE_CATALOG["x-test"].fields.nested.fields.first;
    const line = first.defaultOrigin.line;
    expect(text.split("\n")[line - 1]).toContain('default: "default-first"');
    expect(text).toContain(`line: ${line}`);
    expect(originLabel(first.defaultOrigin)).toBe(
      `layer=defaults file=tests/fixtures/config/catalog.ts line=${line}`,
    );
  });

  test("fixture source-copy line insertion independently invalidates the declared default position", () => {
    const fixture = join(process.cwd(), "tests/fixtures/config/catalog.ts");
    const directory = mkdtempSync(join(process.cwd(), "tmp", "tmpdir", "fixture-line-"));
    const copy = join(directory, "catalog.ts");
    const declarationLine = (source: string): number => {
      const offset = source.indexOf('default: "default-first"');
      expect(offset).toBeGreaterThanOrEqual(0);
      return source.slice(0, offset).split("\n").length;
    };
    try {
      cpSync(fixture, copy);
      const declared = FIXTURE_CATALOG["x-test"].fields.nested.fields.first.defaultOrigin.line;
      expect(declarationLine(readFileSync(copy, "utf8"))).toBe(declared);
      writeFileSync(copy, `\n${readFileSync(copy, "utf8")}`);
      expect(declarationLine(readFileSync(copy, "utf8"))).toBe(declared + 1);
      expect(declarationLine(readFileSync(copy, "utf8"))).not.toBe(declared);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("collection origins are replaced wholesale, unaffected siblings survive", () => {
    const lower = fileFacts(
      "system",
      { "x-test": { nested: { first: "old", second: 2 }, list: ["a", "b"] } },
      7,
    );
    const higher = fileFacts("user-global", { "x-test": { list: ["new"] } }, 16);
    const result = resolveConfig({
      catalog: FIXTURE_CATALOG,
      sources: [lower, higher],
      environmentPrefix: "FIXTURE_",
      environment: {
        FIXTURE_X_TEST__REQUIREDVALUE: "required",
        FIXTURE_X_TEST__CREDENTIAL: "SECRET-CANARY",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.origins["x-test.nested.second"]).toEqual({
      layer: "system",
      file: "fixtures/system.yaml",
      line: 7,
    });
    expect(result.value.origins["x-test.list[0]"]).toEqual({
      layer: "user-global",
      file: "fixtures/user-global.yaml",
      line: 16,
    });
    expect(result.value.origins["x-test.list[1]"]).toBeUndefined();
    expect(result.value.origins["x-test.credential"]).toEqual({
      layer: "environment",
      env: "FIXTURE_X_TEST__CREDENTIAL",
    });
    expect(originLabel(result.value.origins["x-test.credential"] as ConfigOrigin)).toBe(
      "layer=environment env=FIXTURE_X_TEST__CREDENTIAL",
    );
  });

  test("file facts lacking real node positions fail closed, rather than fabricating lines", () => {
    const source = fileFacts("system", { "x-test": { oldValue: "value" } }, 5);
    const result = resolveConfig({
      catalog: FIXTURE_CATALOG,
      sources: [{ ...source, origins: {} }],
      environmentPrefix: "FIXTURE_",
      environment: {
        FIXTURE_X_TEST__REQUIREDVALUE: "required",
        FIXTURE_X_TEST__CREDENTIAL: "SECRET-CANARY",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("config.value.invalid");
      expect(result.error).not.toHaveProperty("line");
    }
  });
});
