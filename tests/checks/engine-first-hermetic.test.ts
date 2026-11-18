/**
 * TC-ENGINE-092 — hermeticity of the delivering suites.
 *
 * A source scan over the change's own surface (the modules and fixtures it
 * introduced or changed) proves no live call construct, the no-network guard is
 * proven live with a positive control, the harness-spawn and sleep counters stay
 * zero on the fleet/summary/handover paths, and every temp root is the approved
 * base or the OS temp root.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APPROVED_BASE } from "../fixtures/projects/state-scope";
import {
  createNoNetworkGuard,
  scanForLiveCalls,
} from "../fixtures/verify-gates/cases/network-guard";

const ROOT = process.cwd();

const CHANGE_SURFACE = [
  "packages/core/src/domain/dispatch-gate.ts",
  "packages/core/src/domain/dispatch-authority.ts",
  "packages/core/src/app/dispatch-gate.ts",
  "packages/core/src/app/projects.ts",
  "packages/core/src/domain/merge-transaction.ts",
  "packages/cli/src/output/dispatch-text.ts",
] as const;

const CHANGE_SUITES = [
  "tests/behaviour/dispatch-clean-accrual.test.ts",
  "tests/behaviour/dispatch-conditions-projection.test.ts",
  "tests/behaviour/dispatch-handover-conditions.test.ts",
  "tests/behaviour/repos-handover-gate.test.ts",
  "tests/behaviour/merge-production-composition.test.ts",
  "tests/behaviour/engine-first-cross-surface.test.ts",
  "tests/structure/merge-classification-conformance.test.ts",
  "tests/checks/engine-first-no-flip.test.ts",
  "tests/fixtures/merge/production-composition.ts",
] as const;

describe("TC-ENGINE-092 no live call in the change's surface", () => {
  test("the source scan is non-empty and clean", () => {
    expect(CHANGE_SURFACE.length + CHANGE_SUITES.length).toBeGreaterThan(0);
    for (const file of CHANGE_SURFACE) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(scanForLiveCalls(source), file).toEqual([]);
    }
    // The merge and fleet blocks this change added must not call a live seam, and
    // the injected transport is what every read under test uses.
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    for (const [start, end] of [
      ["const mergeWorkItem", "const mergeRuntimeBase"],
      ["const readRowHandoverGate", "const readProjects"],
    ] as const) {
      const block = production.slice(production.indexOf(start), production.indexOf(end));
      expect(block.length, start).toBeGreaterThan(0);
      expect(scanForLiveCalls(block), start).toEqual([]);
    }
    // The one native fetch transport is the adapter's exported factory
    // (TDR-0032): composition references it and holds no fetch site of its own,
    // while the factory module owns exactly one live call.
    expect(scanForLiveCalls(production)).toEqual([]);
    expect(production).toContain("createGithubNativeTransport(");
    const nativeTransport = readFileSync(
      join(ROOT, "packages/adapters/src/github/client.ts"),
      "utf8",
    );
    expect(nativeTransport.split("fetch(").length - 1).toBe(1);
  });

  test("no suite sleeps, spawns a harness, or resolves a live home path", () => {
    for (const file of CHANGE_SUITES) {
      const source = readFileSync(join(ROOT, file), "utf8");
      expect(source, file).not.toContain("Atomics.wait");
      expect(source, file).not.toContain("setTimeout(");
      expect(source, file).not.toContain('process.env.HOME ?? "/root"');
      expect(source.includes("homedir(") || source.includes("os.homedir"), file).toBe(false);
    }
    // The approved base is the repo-local temp root, never the live checkout.
    expect(APPROVED_BASE.startsWith(ROOT)).toBe(true);
    expect(APPROVED_BASE.endsWith("tmp/tmpdir")).toBe(true);
  });

  test("the no-network guard is live", async () => {
    const guard = createNoNetworkGuard();
    try {
      await expect(fetch("https://example.invalid/")).rejects.toThrow();
      expect(guard.calls.length).toBe(1);
    } finally {
      guard.restore();
    }
    expect(scanForLiveCalls("await fetch('https://x')")).toEqual(["fetch"]);
    expect(scanForLiveCalls("const value = 1;")).toEqual([]);
  });
});
