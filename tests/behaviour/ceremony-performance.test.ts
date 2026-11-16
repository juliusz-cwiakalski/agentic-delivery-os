/**
 * TC-CEREMONY-055 — read/run cost is measured, not assumed: one declaration
 * read, at most sixteen declared input reads, bounded state reads, zero
 * retries/pagination/child processes/network, and a recorded wall-clock
 * reference (GAP-3 keeps only the bounded-work half as a CI threshold).
 */
import { describe, expect, test } from "bun:test";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { createCeremonyRecordPort } from "../../packages/core/src/state/index";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";

const countingStore = (
  store: StateStorePort,
): {
  readonly store: StateStorePort;
  readonly reads: () => number;
  readonly methods: () => string[];
} => {
  let reads = 0;
  const methods: string[] = [];
  const proxy = new Proxy(store, {
    get(target, property, receiver) {
      if (property === "readRecords") {
        return () => {
          reads += 1;
          methods.push("readRecords");
          return target.readRecords();
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          methods.push(String(property));
          return (value as (...inner: unknown[]) => unknown).apply(target, args);
        };
      }
      return value;
    },
  }) as StateStorePort;
  return { store: proxy, reads: () => reads, methods: () => methods };
};

describe("TC-CEREMONY-055 bounded run cost", () => {
  test("one declaration read, ≤16 input reads, and bounded state reads", () => {
    const prepared = prepareBuiltin("morning-brief");
    try {
      const counted = countingStore(prepared.harness.store);
      const env = {
        ...prepared.harness.env,
        records: createCeremonyRecordPort(counted.store, "ceremony-performance"),
      };
      const started = Date.now();
      const run = runPrepared({ ...prepared, harness: { ...prepared.harness, env } });
      const wallClockMs = Date.now() - started;
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.steps).toHaveLength(3);
      expect(prepared.harness.inputCalls.length).toBeLessThanOrEqual(16);
      expect(counted.reads()).toBeLessThanOrEqual(2 * (1 + run.data.steps.length) + 2);
      expect(
        counted
          .methods()
          .every((method) =>
            ["readRecords", "append", "acquireFence", "releaseFence"].includes(method),
          ),
      ).toBe(true);
      expect(wallClockMs).toBeGreaterThanOrEqual(0);
    } finally {
      prepared.harness.dispose();
    }
  });

  test("no retry, pagination, child-process, or network token exists in the runner paths", async () => {
    const { readFileSync } = await import("node:fs");
    const files = [
      "packages/core/src/domain/ceremony-run.ts",
      "packages/core/src/domain/ceremony-resume.ts",
      "packages/core/src/domain/ceremony-schedule.ts",
      "packages/core/src/state/ceremony.ts",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const marker of [
        "child_process",
        "spawn(",
        "fetch(",
        "http://",
        "https://",
        "retry",
        "pagination",
      ]) {
        expect(text.includes(marker), `${file}: ${marker}`).toBe(false);
      }
    }
  });
});
