/**
 * TC-PSCAN-009 — non-pilot fixtures and prompts carry no secret-shaped values
 * and the commit safety scan is unchanged. Pilot data is scanned in phase 9.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FIXTURES = [
  "tests/fixtures/prompt-inventory",
  "tests/fixtures/key-register",
  "tests/fixtures/help-guide",
  "tests/fixtures/entrypoint",
  "tests/fixtures/dispatch",
  "tests/fixtures/plan/summary",
  "tests/golden/plan",
];

const PATTERNS: readonly RegExp[] = [
  /ghp_[A-Za-z0-9]{20,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /xox[bap]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/,
];

const files = (directory: string): readonly string[] => {
  const found: string[] = [];
  const walk = (relative: string): void => {
    const entries = (() => {
      try {
        return readdirSync(join(ROOT, directory, relative), { withFileTypes: true });
      } catch {
        return [];
      }
    })();
    for (const entry of entries) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else found.push(`${directory}/${next}`);
    }
  };
  walk("");
  return found;
};

describe("TC-PSCAN-009 non-pilot fixture privacy", () => {
  test("no fixture carries a real secret shape", () => {
    const failures: string[] = [];
    for (const directory of FIXTURES) {
      for (const file of files(directory)) {
        const text = readFileSync(join(ROOT, file), "utf8");
        if (PATTERNS.some((pattern) => pattern.test(text))) failures.push(file);
      }
    }
    expect(failures).toEqual([]);
  });

  test("the canary mutant is detected", () => {
    const canary = `ghp_${"a".repeat(36)}`;
    expect(PATTERNS[0]?.test(canary)).toBe(true);
  });

  test("the commit safety scan is still wired before staging", () => {
    const act = readFileSync(join(ROOT, "packages/core/src/domain/commit-act.ts"), "utf8");
    const safety = act.indexOf("ports.safety.scan");
    const stage = act.indexOf("ports.git.stage");
    expect(safety).toBeGreaterThan(0);
    expect(stage).toBeGreaterThan(safety);
  });
});
