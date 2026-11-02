/** TC-VGATES-059 — default verify-gates paths make zero live network calls. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  createNoNetworkGuard,
  scanForLiveCalls,
} from "../fixtures/verify-gates/cases/network-guard";

const ROOT = process.cwd();

/** Production edge and default harness modules that must never call the network. */
const DEFAULT_MODULES = [
  "packages/cli/src/edge.ts",
  "packages/cli/src/commands/verify.ts",
  "packages/cli/src/commands/verify-gates.ts",
  "tests/fixtures/verify-gates/cases/harness.ts",
  "tests/fixtures/verify-gates/cases/facts.ts",
] as const;

describe("TC-VGATES-059 no live calls", () => {
  test("the guard rejects a forbidden call and records it", async () => {
    const guard = createNoNetworkGuard();
    try {
      await expect(globalThis.fetch("https://api.github.example.com")).rejects.toThrow(
        /must not perform a live network call/,
      );
      expect(guard.calls).toHaveLength(1);
    } finally {
      guard.restore();
    }
  });

  test("the production edge and default harness contain no live-call construct", () => {
    for (const relative of DEFAULT_MODULES) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      expect(scanForLiveCalls(source), relative).toEqual([]);
    }
  });

  test("the source scan detects each forbidden construct", () => {
    expect(scanForLiveCalls('await globalThis.fetch("https://example.com")')).toContain("fetch");
    expect(scanForLiveCalls('import { request } from "node:https";')).toContain("node:http");
    expect(scanForLiveCalls("await Bun.connect({ hostname: 'example.com' });")).toContain(
      "Bun.connect",
    );
    expect(scanForLiveCalls("const total = 1 + 1;")).toEqual([]);
  });

  test("the in-process gates suite evaluates under the guard with zero calls", async () => {
    const guard = createNoNetworkGuard();
    try {
      const result = await runVerify(combinedRuntime(), ["gates", "GH-178"]);
      expect(result.exitCode).toBe(0);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });
});
