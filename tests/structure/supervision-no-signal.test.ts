/**
 * TC-SUP-063 (structure half) — the never-signal discipline: no supervision
 * module contains a kill, spawn, signal, or process-spawn marker (GH-295
 * AC-F7-1, DEC-7, NG-3).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SUPERVISE_MODULES = [
  "packages/core/src/contracts/supervise.ts",
  "packages/core/src/domain/supervise.ts",
  "packages/core/src/domain/supervise-text.ts",
  "packages/core/src/app/supervise.ts",
  "packages/cli/src/commands/supervise.ts",
] as const;

export const SIGNAL_MARKERS = [
  "kill",
  "SIGTERM",
  "SIGKILL",
  "SIGINT",
  "process.kill",
  "spawn(",
  "execFile(",
  "child_process",
] as const;

describe("TC-SUP-063 no supervision module can signal a process", () => {
  test("the marker scan finds zero hits", () => {
    const violations: string[] = [];
    for (const file of SUPERVISE_MODULES) {
      const path = join(ROOT, file);
      if (!existsSync(path)) continue;
      const text = readFileSync(path, "utf8");
      for (const marker of SIGNAL_MARKERS) {
        if (text.includes(marker)) violations.push(`${file}: ${marker}`);
      }
    }
    expect(violations).toEqual([]);
  });

  test("the mutation adding a kill call is detected by the scan", () => {
    const mutated = `${readFileSync(join(ROOT, "packages/core/src/app/supervise.ts"), "utf8")}\nprocess.kill(1);\n`;
    expect(SIGNAL_MARKERS.some((marker) => mutated.includes(marker))).toBe(true);
  });
});
