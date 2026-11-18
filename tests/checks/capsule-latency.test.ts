/**
 * TC-CAP-056 / NFR-8 — measured latency on reference fixtures.
 *
 * Budgets: apply p95 ≤ 120 s; diff scan ≤ 5 s; session attribution ≤ 5 s;
 * retro-registry read ≤ 2 s. The measured values are recorded in the change
 * evidence artifact; a miss is reported, never tuned away.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import {
  CAPSULE_MAX_EVENTS,
  type HarnessTelemetryCapture,
} from "../../packages/core/src/contracts/index";
import { parseCapsuleEvents } from "../../packages/core/src/domain/capsule";
import { evaluateDiffSweep } from "../../packages/core/src/domain/closeout-diff-sweep";
import {
  createBunSqliteStoreOpener,
  createOpencodeTelemetryExtractor,
} from "../../packages/adapters/src/harness/index";
import { readRetroRegistry, seedRetroRegistry } from "../../packages/core/src/state/index";
import { makeIdentity, openStore, removeRoot } from "../fixtures/state/harness";
import { buildOpencodeStore, WORK_ITEM_REF } from "../fixtures/harness/opencode-store/build";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import { runCloseoutCli } from "../fixtures/closeout/cli";
import { makeFacts } from "../fixtures/closeout/harness";

const measure = (runs: number, body: () => void | Promise<void>): number[] => {
  const values: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    const started = performance.now();
    const result = body();
    if (result instanceof Promise) throw new Error("async bodies are measured separately");
    values.push(performance.now() - started);
  }
  return values;
};

const p95 = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
};

describe("TC-CAP-056 measured latency", () => {
  test("capsule validation of a full reference capsule stays under two seconds", () => {
    const events = Array.from({ length: CAPSULE_MAX_EVENTS }, (_, index) => ({
      schemaId: "delivery.capsule.event.v1" as const,
      sequence: index + 1,
      eventKey: `key-${index + 1}`,
      workItemRef: "GH-183",
      runId: "run-1",
      kind: (index === 0 ? "capsule.opened" : "phase.transition") as
        | "capsule.opened"
        | "phase.transition",
      writer: "closeout" as const,
      occurredAt: "2026-11-07T00:00:00Z",
      payload:
        index === 0
          ? { contractVersion: "delivery.capsule.v1", workItemRef: "GH-183" }
          : { phaseId: String(index), operation: "complete", outcome: "landed" },
    }));
    const text = `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;
    const started = performance.now();
    const report = parseCapsuleEvents(text);
    const elapsed = performance.now() - started;
    expect(report.ok).toBe(true);
    console.log(`latency capsule-validation=${elapsed.toFixed(1)}ms budget=2000ms`);
    expect(elapsed).toBeLessThan(2_000);
  });

  test("merged-diff scan of a one-MiB reference diff is under five seconds", () => {
    const line = "+// TODO close-todo GH-183 remove this guard\n";
    const text = `+++ b/src/file.ts\n${line.repeat(Math.floor((1024 * 1024) / line.length))}`;
    const diff = { text, files: 1, squashSha: "a".repeat(40), parentSha: "b".repeat(40) };
    const values = measure(3, () => {
      evaluateDiffSweep({ diff, workItemRef: "GH-183" });
    });
    const value = p95(values);
    console.log(`latency diff-scan=${value.toFixed(1)}ms budget=5000ms`);
    expect(value).toBeLessThan(5_000);
  });

  test("session attribution over the reference store is under five seconds", () => {
    const store = buildOpencodeStore({ variant: "full" });
    try {
      const values = measure(3, () => {
        const result = createOpencodeTelemetryExtractor({
          opener: (path) => createBunSqliteStoreOpener()(path),
          storePath: store.path,
          now: () => "2026-11-07T00:00:00Z",
        }).extract({ workItemRef: WORK_ITEM_REF, runId: "run-latency" });
        if (!result.ok) throw new Error(result.error.summary ?? "extraction failed");
        const capture: HarnessTelemetryCapture = result.value;
        if (capture.records.length === 0) throw new Error("no records");
      });
      const value = p95(values);
      console.log(`latency session-attribution=${value.toFixed(1)}ms budget=5000ms`);
      expect(value).toBeLessThan(5_000);
    } finally {
      rmSync(store.directory, { recursive: true, force: true });
    }
  });

  test("the retro-registry read is under two seconds", () => {
    const root = mkdtempSync(join(tmpdir(), "gh240-latency-retro-"));
    try {
      const identity = makeIdentity(root);
      const { store } = openStore(identity);
      const seeded = seedRetroRegistry(store, "fence-latency");
      expect(seeded.ok).toBe(true);
      const values = measure(5, () => {
        const read = readRetroRegistry(store);
        if (!read.ok) throw new Error(read.error.code);
      });
      const value = p95(values);
      console.log(`latency retro-read=${value.toFixed(1)}ms budget=2000ms`);
      expect(value).toBeLessThan(2_000);
    } finally {
      removeRoot(root);
    }
  });

  test("closeout apply p95 over the reference fixture is under 120 s", async () => {
    const values: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const tree = makeChangeTree({
        ref: "GH-183",
        month: "2026-11",
        name: `2026-11-01--GH-183--latency-${index}`,
      });
      try {
        const started = performance.now();
        const run = await runCloseoutCli(["--json", "closeout", "GH-183", "--apply"], {
          capsule: makeCapsuleRuntime(tree.changes),
          facts: makeFacts(),
        });
        values.push(performance.now() - started);
        expect(run.exitCode).toBe(0);
      } finally {
        tree.cleanup();
      }
    }
    const value = p95(values);
    console.log(`latency closeout-apply-p95=${value.toFixed(1)}ms budget=120000ms`);
    expect(value).toBeLessThan(120_000);
  }, 120_000);
});
