/**
 * TC-CEREMONY-056 — hermetic posture across every ceremony suite: no live
 * network, no child process, no real `$HOME` read, no live-tree write, and a
 * conditional skip never counts as a pass. A planted skip and a planted network
 * import both fail the same scan.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

const SUITE_DIRECTORIES = [
  "tests/behaviour",
  "tests/structure",
  "tests/golden",
  "tests/checks",
] as const;

const META_SUITES = new Set([
  "tests/checks/ceremony-hermetic.test.ts",
  "tests/checks/ceremony-mutants.test.ts",
  "tests/behaviour/ceremony-performance.test.ts",
  "tests/structure/ceremony-imports.test.ts",
]);

const ceremonySuites = (): readonly string[] => {
  const found: string[] = [];
  for (const directory of SUITE_DIRECTORIES) {
    for (const name of readdirSync(join(ROOT, directory))) {
      const relative = `${directory}/${name}`;
      if (name.startsWith("ceremony-") && name.endsWith(".test.ts") && !META_SUITES.has(relative)) {
        found.push(relative);
      }
    }
  }
  return found.sort();
};

const FORBIDDEN = [
  "test.skip(",
  "test.todo(",
  "describe.skip(",
  "xit(",
  "node:http",
  "node:https",
  "node:net",
  "node:child_process",
  "Bun.spawn",
  "spawnSync(",
  "process.env.HOME",
  'process.env["HOME"]',
] as const;

/** The declared hermetic scan over one suite text. */
export const hermeticViolations = (text: string): readonly string[] =>
  FORBIDDEN.filter((marker) => text.includes(marker));

describe("TC-CEREMONY-056 every ceremony suite is hermetic", () => {
  test("no suite skips, spawns, opens a socket, reads HOME, or writes the live tree", () => {
    const suites = ceremonySuites();
    expect(suites.length).toBeGreaterThanOrEqual(15);
    for (const suite of suites) {
      const text = readFileSync(join(ROOT, suite), "utf8");
      expect(hermeticViolations(text), suite).toEqual([]);
      expect(text.includes("describe(") || text.includes("test("), suite).toBe(true);
      expect(text.includes("writeFileSync(join(ROOT"), suite).toBe(false);
    }
  });

  test("a planted skip fails the scan", () => {
    expect(hermeticViolations("test.skip('later', () => {});")).toContain("test.skip(");
  });

  test("a planted network import fails the scan", () => {
    expect(hermeticViolations('import { fetch } from "node:http";')).toContain("node:http");
  });

  test("a planted HOME read fails the scan", () => {
    expect(hermeticViolations("const home = process.env.HOME;")).toContain("process.env.HOME");
  });

  test("the committed fixtures carry no real home path or network URL", () => {
    const fixtures = join(ROOT, "tests/fixtures/ceremony");
    const walk = (relative: string): string[] => {
      const found: string[] = [];
      for (const entry of readdirSync(join(fixtures, relative), { withFileTypes: true })) {
        const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
        if (entry.isDirectory()) found.push(...walk(next));
        else found.push(next);
      }
      return found;
    };
    for (const fixture of walk("")) {
      const text = readFileSync(join(fixtures, fixture), "utf8");
      expect(text.includes("/home/"), fixture).toBe(false);
      expect(text.includes("http://"), fixture).toBe(false);
      expect(text.includes("https://"), fixture).toBe(false);
    }
  });
});
