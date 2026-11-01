/**
 * TC-CLOSE-007/008 — read-only commands never import the closeout write path,
 * and the read-only repository reader gains no spawn surface.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const READ_ONLY_COMMANDS = [
  "packages/cli/src/commands/status.ts",
  "packages/cli/src/commands/queue.ts",
  "packages/cli/src/commands/verify.ts",
];
const FORBIDDEN = [
  "domain/closeout",
  "closeout-run",
  "adapters/git",
  "createGitBranchSeam",
];
const REPO_READER = "packages/adapters/src/repo/index.ts";
const SPAWN_MARKERS = ["node:child_process", "Bun.spawn", "Deno.Command", "execFile", "spawn("];

const importViolations = (root: string, files: readonly string[]): string[] => {
  const violations: string[] = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (const marker of FORBIDDEN) {
      if (text.includes(marker)) violations.push(`${file}: forbidden import ${marker}`);
    }
  }
  return violations;
};

const spawnViolations = (root: string, file: string): string[] => {
  const text = readFileSync(join(root, file), "utf8");
  return SPAWN_MARKERS.filter((marker) => text.includes(marker)).map(
    (marker) => `${file}: spawn marker ${marker}`,
  );
};

describe("TC-CLOSE-007 read-only command isolation", () => {
  test("the scan is non-empty and the three read-only commands are clean", () => {
    expect(READ_ONLY_COMMANDS.length).toBe(3);
    expect(importViolations(ROOT, READ_ONLY_COMMANDS)).toEqual([]);
  });

  test("a planted closeout import fails naming the file", () => {
    const root = mkdtempSync(join(tmpdir(), "closeout-imports-"));
    const file = join(root, READ_ONLY_COMMANDS[0] as string);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, 'import { buildCloseoutPlan } from "../../core/domain/closeout";\n');
    try {
      const failures = importViolations(root, [READ_ONLY_COMMANDS[0] as string]);
      expect(failures.some((message) => message.includes("domain/closeout"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-CLOSE-008 repository reader stays no-spawn", () => {
  test("the read-only repo reader contains no spawn surface", () => {
    expect(spawnViolations(ROOT, REPO_READER)).toEqual([]);
  });

  test("a planted spawn in a copied repo reader fails naming the marker", () => {
    const root = mkdtempSync(join(tmpdir(), "repo-reader-"));
    const file = join(root, REPO_READER);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${readFileSync(join(ROOT, REPO_READER), "utf8")}\nimport "node:child_process";\n`);
    try {
      const failures = spawnViolations(root, REPO_READER);
      expect(failures.some((message) => message.includes("node:child_process"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
