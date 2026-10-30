/**
 * TC-EXIT-001 / TC-EXIT-003 (structure half) — the projection is exhaustive,
 * total, deterministic, and lives only in the standalone CLI.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  type ProjectionClass,
} from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const entries = ERROR_TABLE as readonly ErrorTableEntry[];
const CLASSES: ProjectionClass[] = ["success", "user-validation", "platform-provider"];

const contractsFiles = (): string[] =>
  readdirSync(join(ROOT, "packages/core/src/contracts"))
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => `packages/core/src/contracts/${entry}`);

const numericExitFailures = (files: Array<{ path: string; text: string }>): string[] => {
  const failures: string[] = [];
  for (const file of files) {
    if (/\bexitCode\s*:\s*\d/.test(file.text)) {
      failures.push(`${file.path}: numeric exitCode property`);
    }
    if (/\b(?:success|user-validation|platform-provider)["']?\s*:\s*\d/.test(file.text)) {
      failures.push(`${file.path}: numeric exit map`);
    }
  }
  return failures;
};

describe("TC-EXIT-001 projection mapping", () => {
  test("the three classes map to the fixed codes", () => {
    expect(projectExitCode("success")).toBe(0);
    expect(projectExitCode("user-validation")).toBe(1);
    expect(projectExitCode("platform-provider")).toBe(2);
  });

  test("every table entry projects into {0,1,2}", () => {
    const expected: Record<ProjectionClass, number> = {
      success: 0,
      "user-validation": 1,
      "platform-provider": 2,
    };
    for (const entry of entries) {
      const code = projectExitCode(entry.projectionClass);
      expect([0, 1, 2]).toContain(code);
      expect(code).toBe(expected[entry.projectionClass]);
    }
  });

  test("unknown or undefined input is rejected, never defaulted", () => {
    for (const value of ["other", "", undefined, null, 0]) {
      expect(() => projectExitCode(value as unknown as ProjectionClass)).toThrow();
    }
  });

  test("success projects to 0 without a table entry", () => {
    expect(projectExitCode("success")).toBe(0);
    expect(entries.every((entry) => entry.projectionClass !== "success")).toBe(true);
  });

  test("projection is deterministic and performs no ambient read", () => {
    const originalNow = Date.now;
    const originalRandom = Math.random;
    Date.now = () => {
      throw new Error("clock read");
    };
    Math.random = () => {
      throw new Error("randomness read");
    };
    try {
      for (const projectionClass of CLASSES) {
        const first = projectExitCode(projectionClass);
        for (let index = 0; index < 5; index += 1) {
          expect(projectExitCode(projectionClass)).toBe(first);
        }
      }
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
    }
  });
});

describe("TC-EXIT-003 projection confinement (structure half)", () => {
  test("exit derivation exists only under packages/cli", () => {
    const contracts = contractsFiles().map((path) => ({
      path,
      text: readFileSync(join(ROOT, path), "utf8"),
    }));
    expect(numericExitFailures(contracts)).toEqual([]);
    for (const entry of entries) {
      expect(Object.hasOwn(entry, "exitCode")).toBe(false);
    }
  });

  test("a temp-copy numeric exit map in contracts fails by name", () => {
    const failures = numericExitFailures([
      {
        path: "packages/core/src/contracts/probe.ts",
        text: 'export const exitCodeMap = { success: 0, "user-validation": 1 };',
      },
    ]);
    expect(failures.some((message) => message.includes("probe.ts"))).toBe(true);
  });
});
