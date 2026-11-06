/**
 * TC-REGRESS-008 — local latency bounds on the dry-run and template paths.
 * No network, no sleep; p95 over 20 samples with one warm-up.
 */
import { describe, expect, test } from "bun:test";
import { seedDirtyTree, validMessage } from "./commit-support";
import { withCommitHarness } from "../fixtures/commit/harness";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

const p95 = (samples: readonly number[]): number => {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
};

describe("TC-REGRESS-008 dry-run and template latency", () => {
  test("dry-run p95 stays under 2 s across 20 samples", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        for (let index = 0; index < 21; index += 1) {
          harness.coreTransport.push({ kind: "success", message: validMessage() });
        }
        await harness.runCommit(["GH-310", "--dry-run"]);
        const samples: number[] = [];
        for (let index = 0; index < 20; index += 1) {
          const started = performance.now();
          const run = await harness.runCommit(["GH-310", "--dry-run"]);
          samples.push(performance.now() - started);
          expect(run.exitCode).toBe(0);
        }
        expect(p95(samples)).toBeLessThan(2000);
      },
      { seedFiles: SEED },
    );
  });

  test("template-fallback commit p95 stays under 5 s", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const samples: number[] = [];
        for (let index = 0; index < 5; index += 1) {
          const started = performance.now();
          const run = await harness.runCommit(["GH-310", "--dry-run"]);
          samples.push(performance.now() - started);
          expect(run.exitCode).toBe(0);
        }
        const started = performance.now();
        const run = await harness.runCommit(["GH-310"]);
        samples.push(performance.now() - started);
        expect(run.exitCode).toBe(0);
        expect(p95(samples)).toBeLessThan(5000);
      },
      {
        seedFiles: SEED,
        availability: {
          coreInference: { available: false },
          harnessOneShot: { available: false },
        },
      },
    );
  });
});
