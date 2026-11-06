/**
 * TC-MERGE-039 — no default merge or deploy path performs a live call; the
 * throwing fetch guard is proven live by a deliberate-call control.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMergeHarness, MERGE_CLOCK_MS, verificationRecord } from "../fixtures/merge/harness";
import { createDeployHarness } from "../fixtures/verify-deploy/harness";
import {
  createNoNetworkGuard,
  scanForLiveCalls,
} from "../fixtures/verify-gates/cases/network-guard";

const ROOT = process.cwd();
const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const DEFAULT_MODULES = [
  "packages/cli/src/edge.ts",
  "packages/cli/src/commands/merge.ts",
  "packages/cli/src/commands/verify-deploy.ts",
  "packages/cli/src/output/merge-text.ts",
  "packages/cli/src/output/deploy-text.ts",
  "packages/core/src/domain/merge-transaction.ts",
  "packages/adapters/src/git/merge.ts",
  "packages/adapters/src/github/deploy-trace.ts",
  "tests/fixtures/merge/harness.ts",
  "tests/fixtures/verify-deploy/harness.ts",
] as const;

describe("TC-MERGE-039 no live calls on any default merge or deploy path", () => {
  test("the production modules and default harnesses contain no live-call construct", () => {
    for (const relative of DEFAULT_MODULES) {
      const source = readFileSync(join(ROOT, relative), "utf8");
      expect(scanForLiveCalls(source), relative).toEqual([]);
    }
  });

  test("the guard is installed and records a deliberate call (positive control)", async () => {
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

  test("merge success and refusal paths make zero live calls", async () => {
    const guard = createNoNetworkGuard();
    try {
      const success = createMergeHarness();
      const stale = createMergeHarness();
      try {
        success.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
        stale.seedVerification(verificationRecord({ verifiedAt: isoAt(-31 * MINUTE) }));
        expect((await success.run()).exitCode).toBe(0);
        expect((await stale.run()).exitCode).toBe(1);
      } finally {
        success.cleanup();
        stale.cleanup();
      }
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });

  test("deploy verified and read-fault paths make zero live calls", async () => {
    const guard = createNoNetworkGuard();
    try {
      const verified = createDeployHarness();
      const fault = createDeployHarness({
        trace: { ok: false, code: "provider.payload.invalid" },
      });
      expect((await verified.run()).exitCode).toBe(0);
      expect((await fault.run()).exitCode).toBe(2);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });

  test("the deploy trace read goes through the injected transport with no retry or pagination", () => {
    const source = readFileSync(join(ROOT, "packages/adapters/src/github/deploy-trace.ts"), "utf8");
    expect(source).toContain("options.transport.send");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toContain("while (");
    expect(code).not.toMatch(/retry|paginat/i);
  });

  test("a future module bypassing the scan is caught by the module list", () => {
    expect(DEFAULT_MODULES.some((file) => file.includes("commands/merge"))).toBe(true);
    expect(DEFAULT_MODULES.some((file) => file.includes("verify-deploy"))).toBe(true);
  });
});
