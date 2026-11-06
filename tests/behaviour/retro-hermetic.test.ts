/**
 * TC-RETRO-062 — hermeticity, no ambient reads, and fixture key hygiene.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRetroKeyContainment } from "../../scripts/checks/retro-key-containment";

const ROOT = process.cwd();
const FORBIDDEN = [
  "node:child_process",
  "child_process",
  "spawnSync",
  "spawn(",
  "execFile",
  "process.env",
  "os.homedir",
  "$HOME",
  "fetch(",
  "http.get",
  "https.get",
  "/home/",
] as const;

const listFiles = (relative: string): string[] => {
  const results: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(join(ROOT, current), { withFileTypes: true })) {
      const next = `${current}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (/\.(ts|json|txt|jsonl)$/.test(entry.name)) results.push(next);
    }
  };
  walk(relative);
  return results.sort();
};

export const scanHermetic = (root: string, files: readonly string[]): string[] => {
  const failures: string[] = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (const marker of FORBIDDEN) {
      if (text.includes(marker)) failures.push(`${file}: ${marker}`);
    }
  }
  return failures;
};

const retroSuites = (): string[] => [
  ...listFiles("tests/behaviour").filter(
    (file) => /retro-.*\.test\.ts$/.test(file) && !file.endsWith("retro-hermetic.test.ts"),
  ),
  ...listFiles("tests/fixtures/retro"),
  ...listFiles("tests/golden/retro"),
];

describe("TC-RETRO-062 retro hermeticity", () => {
  test("retro suites and fixtures have no spawn, network, home, or ambient environment dependency", () => {
    const files = retroSuites();
    expect(files.length).toBeGreaterThan(0);
    expect(scanHermetic(ROOT, files)).toEqual([]);
  });

  test("a planted spawn and a planted key-shaped literal are both caught", () => {
    const directory = mkdtempSync(join(tmpdir(), "retro-hermetic-"));
    mkdirSync(join(directory, "tests/behaviour"), { recursive: true });
    mkdirSync(join(directory, "tests/fixtures/retro"), { recursive: true });
    writeFileSync(
      join(directory, "tests/behaviour/retro-probe.test.ts"),
      'import { spawn } from "node:child_process";\n',
    );
    expect(
      scanHermetic(directory, ["tests/behaviour/retro-probe.test.ts"]).some((failure) =>
        failure.includes("child_process"),
      ),
    ).toBe(true);

    writeFileSync(
      join(directory, "tests/fixtures/retro/bad.json"),
      JSON.stringify({ key: "a".repeat(64) }),
    );
    expect(
      checkRetroKeyContainment({
        root: directory,
        roots: ["tests/fixtures/retro"],
      }).failures.length,
    ).toBeGreaterThan(0);
  });

  test("the committed fixture key is the only key-shaped occurrence", () => {
    expect(
      checkRetroKeyContainment({
        root: ROOT,
        roots: ["tests/fixtures/retro", "tests/golden/retro"],
      }).failures,
    ).toEqual([]);
  });
});
