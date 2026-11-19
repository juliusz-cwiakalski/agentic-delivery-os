/**
 * TC-HARNESS-042 (grammar-constant half) — the accepted probe grammar has one
 * home, and the parser consumes that constant rather than a private copy.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HARNESS_VERSION_PROBE_PATTERN } from "../../packages/core/src/contracts/index";
import { normalizeHarnessVersion } from "../../packages/core/src/domain/index";

const ROOT = process.cwd();
const PACKAGE_ROOTS = ["packages/core/src", "packages/adapters/src", "packages/cli/src"];
const WINDOW_SOURCE = "packages/core/src/domain/harness-version-window.ts";

const listTypeScript = (relative: string): string[] => {
  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(join(ROOT, directory), { withFileTypes: true })) {
      const child = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".ts")) files.push(child);
    }
  };
  walk(relative);
  return files;
};

describe("TC-HARNESS-042 the grammar has one home", () => {
  test("exactly one module declares the probe grammar constant", () => {
    const declarations = PACKAGE_ROOTS.flatMap(listTypeScript).filter((file) =>
      /export const HARNESS_VERSION_PROBE_PATTERN\s*=/.test(readFileSync(join(ROOT, file), "utf8")),
    );
    expect(declarations).toEqual(["packages/core/src/contracts/harness.ts"]);
  });

  test("the parser consumes the constant and declares no grammar of its own", () => {
    const source = readFileSync(join(ROOT, WINDOW_SOURCE), "utf8");
    expect(source).toContain("HARNESS_VERSION_PROBE_PATTERN");
    expect(source).not.toMatch(/=\s*\/\^/u);
  });

  test("the grammar is anchored, requires the product token, and takes three numeric parts", () => {
    expect(HARNESS_VERSION_PROBE_PATTERN.source.startsWith("^")).toBe(true);
    expect(HARNESS_VERSION_PROBE_PATTERN.source.endsWith("$")).toBe(true);
    expect(HARNESS_VERSION_PROBE_PATTERN.test("opencode v2.3.2")).toBe(true);
    expect(HARNESS_VERSION_PROBE_PATTERN.test("2.3.2")).toBe(false);
    expect(normalizeHarnessVersion("opencode v2.3.2")).toBe("2.3.2");
  });

  test("the pattern is stateless across repeated evaluation", () => {
    for (let index = 0; index < 3; index += 1) {
      expect(normalizeHarnessVersion("opencode v2.3.2")).toBe("2.3.2");
      expect(normalizeHarnessVersion("opencode v2.2.5")).toBe("2.2.5");
      expect(normalizeHarnessVersion("nonsense")).toBeUndefined();
    }
  });
});
