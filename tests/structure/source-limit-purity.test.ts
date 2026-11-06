/**
 * GH-251 TC-UTF8LIMIT-007 — the byte-length helper is pure and code-point based,
 * and introduces no runtime-specific import or dependency edge.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const YAML_PARSER = "packages/adapters/src/file/yaml-parser.ts";
const PM_NOTES_PARSER = "packages/adapters/src/file/pm-notes-parser.ts";

const helperBody = (source: string): string => {
  const start = source.indexOf("const utf8ByteLength");
  const end = source.indexOf("\n};", start);
  if (start < 0 || end < 0) throw new Error("utf8ByteLength helper not found");
  return source.slice(start, end + 3);
};

describe("TC-UTF8LIMIT-007 byte-length helper purity", () => {
  for (const relative of [YAML_PARSER, PM_NOTES_PARSER]) {
    test(`${relative} helper computes from code points without runtime APIs`, () => {
      const body = helperBody(readFileSync(join(ROOT, relative), "utf8"));
      for (const forbidden of [
        "TextEncoder",
        "Buffer",
        "encodeURIComponent",
        "process",
        "Bun",
        "Math.random",
      ]) {
        expect(body).not.toContain(forbidden);
      }
      expect(body).toContain("codePointAt");
      expect(body).toContain("0x7f");
      expect(body).toContain("0x7ff");
      expect(body).toContain("0xffff");
      expect(body).toContain("bytes += 4");
    });
  }

  test("the YAML parser imports no runtime-specific specifier", () => {
    const source = readFileSync(join(ROOT, YAML_PARSER), "utf8");
    expect(source).not.toMatch(/from\s+"(?:node|bun):/);
  });

  test("the pm-notes parser adds no runtime import beyond its pre-existing node:fs reader", () => {
    const source = readFileSync(join(ROOT, PM_NOTES_PARSER), "utf8");
    expect(source).not.toMatch(/from\s+"bun:/);
    const runtimeSpecifiers = [...source.matchAll(/from\s+"(node:[^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(runtimeSpecifiers).toEqual(["node:fs"]);
  });
});
