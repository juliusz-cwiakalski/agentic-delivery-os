/**
 * TC-ACTION-032 — offline hermetic posture for every action suite: no skip, no
 * socket, no spawned process, no `$HOME` read, no live-tree write; a planted
 * violation fails the same scan (NFR-4).
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();

const SUITE_DIRECTORIES = ["tests/behaviour", "tests/checks", "tests/structure"] as const;

/** Suites that name the forbidden markers as data rather than executing them. */
const META_SUITES = new Set([
  "tests/checks/action-hermetic.test.ts",
  "tests/structure/action-imports.test.ts",
]);

const actionSuites = (): readonly string[] => {
  const found: string[] = [];
  for (const directory of SUITE_DIRECTORIES) {
    for (const name of readdirSync(join(ROOT, directory))) {
      const relative = `${directory}/${name}`;
      if (name.startsWith("action-") && name.endsWith(".test.ts") && !META_SUITES.has(relative)) {
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
  "$HOME",
] as const;

const violationsIn = (text: string): string[] =>
  FORBIDDEN.filter((marker) => text.includes(marker));

describe("TC-ACTION-032 the action suites are hermetic", () => {
  test("every action suite is offline by construction", () => {
    const suites = actionSuites();
    expect(suites.length).toBeGreaterThanOrEqual(15);
    const failures: string[] = [];
    for (const suite of suites) {
      const text = readFileSync(join(ROOT, suite), "utf8");
      for (const marker of violationsIn(text)) failures.push(`${suite}: ${marker}`);
    }
    expect(failures).toEqual([]);
  });

  test("every store-touching action suite constructs its temp root through the harness", () => {
    const failures: string[] = [];
    for (const suite of actionSuites()) {
      if (suite.startsWith("tests/structure/") || suite.startsWith("tests/checks/")) continue;
      const text = readFileSync(join(ROOT, suite), "utf8");
      const touchesStore =
        text.includes("fileAction(") ||
        text.includes("closeAction(") ||
        text.includes("listActions(") ||
        text.includes("makeActionStore");
      if (!touchesStore) continue;
      const usesTempRoot =
        text.includes("makeActionStore") ||
        text.includes("makeTempRoot") ||
        text.includes("makeRetroDir");
      if (!usesTempRoot) failures.push(`${suite}: no temp-root discipline`);
    }
    expect(failures).toEqual([]);
  });

  test("a planted skip and a planted socket import are both detected", () => {
    const root = mkdtempSync(join(tmpdir(), "action-hermetic-"));
    try {
      const clean = join(root, "tests/behaviour");
      mkdirSync(clean, { recursive: true });
      writeFileSync(join(clean, "action-clean.test.ts"), "test('ok', () => {});\n");
      const planted = join(clean, "action-planted.test.ts");
      writeFileSync(planted, 'test.skip("x", () => {});\nimport "node:net";\n');
      const plantedText = readFileSync(planted, "utf8");
      expect(violationsIn(plantedText)).toContain("test.skip(");
      expect(violationsIn(plantedText)).toContain("node:net");
      expect(violationsIn(readFileSync(join(clean, "action-clean.test.ts"), "utf8"))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
