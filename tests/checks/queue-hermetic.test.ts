/**
 * TC-SCHED-014 / TC-SCHED-013 (GH-237) — the scheduling battery is hermetic:
 * no live network, credentials, real sleeps, sockets, or ambient globals; the
 * pass is deterministic over 100 runs; a missing fixture fails naming itself.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { computeQueueSchedule } from "../../packages/core/src/domain/index";
import { scan, scopedFiles } from "../../scripts/checks/ambient-globals";
import {
  makeFacts,
  type EntrySpec,
} from "../fixtures/queue/schedule/harness";

const ROOT = process.cwd();

const QUEUE_MODULES = [
  "packages/core/src/contracts/queue.ts",
  "packages/core/src/domain/queue-graph.ts",
  "packages/core/src/domain/queue-readiness.ts",
  "packages/core/src/domain/queue-weight.ts",
  "packages/core/src/domain/queue-deploy-gate.ts",
  "packages/core/src/domain/queue-rank.ts",
  "packages/core/src/domain/queue-precedence.ts",
  "packages/core/src/domain/queue-lease.ts",
  "packages/core/src/domain/queue-park.ts",
  "packages/core/src/domain/queue-lanes.ts",
  "packages/core/src/app/queue.ts",
  "packages/cli/src/commands/queue.ts",
  "packages/cli/src/commands/lanes.ts",
  "packages/cli/src/edge.ts",
] as const;

const corpus: readonly EntrySpec[] = [
  { ref: "GH-301", repository: "github.com/owner/repo-alpha", close: "merge-ready", priority: 9 },
  { ref: "GH-302", repository: "github.com/owner/repo-beta", close: "in-review", priority: 1 },
  {
    ref: "GH-303",
    repository: "github.com/owner/repo-alpha",
    priority: 2,
    park: { state: "active", cause: "provider-quota", recheckMs: 300000 },
  },
  { ref: "GH-304", repository: "github.com/owner/repo-gamma", priority: 5 },
];

const requireFixture = (relative: string): string => {
  const path = join(ROOT, relative);
  if (!existsSync(path)) throw new Error(`missing fixture: ${relative}`);
  return readFileSync(path, "utf8");
};

describe("TC-SCHED-014 hermetic guarantees", () => {
  test("every scheduling module is inside the ambient scan and the scan is clean", () => {
    const scoped = new Set(scopedFiles(ROOT));
    for (const module of QUEUE_MODULES) {
      if (!module.startsWith("packages/core/src/contracts/") && !module.startsWith("packages/core/src/domain/")) {
        continue;
      }
      expect(scoped.has(module), module).toBe(true);
    }
    expect(scan(ROOT)).toEqual([]);
  });

  test("the new modules import no runtime API and contain no forbidden call", () => {
    for (const module of QUEUE_MODULES) {
      if (module === "packages/cli/src/edge.ts") continue;
      const source = readFileSync(join(ROOT, module), "utf8");
      expect(source, module).not.toMatch(/from "node:|from "bun:/);
      expect(source, module).not.toMatch(/\bfetch\s*\(/);
      expect(source, module).not.toMatch(/child_process|Bun\.spawn/);
      expect(source, module).not.toMatch(/\bsetTimeout\s*\(|\bsetInterval\s*\(/);
      expect(source, module).not.toMatch(/Date\.now|Math\.random/);
    }
  });

  test("a throwing fetch guard observes zero calls during a schedule", () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => {
      calls += 1;
      throw new Error("network is forbidden");
    }) as typeof fetch;
    try {
      computeQueueSchedule(makeFacts(corpus), { next: 3 });
    } finally {
      globalThis.fetch = original;
    }
    expect(calls).toBe(0);
  });

  test("100 runs over identical facts are byte-identical", () => {
    const baseline = JSON.stringify(computeQueueSchedule(makeFacts(corpus), { next: 20 }));
    for (let run = 0; run < 100; run += 1) {
      expect(JSON.stringify(computeQueueSchedule(makeFacts(corpus), { next: 20 }))).toBe(baseline);
    }
  });

  test("a missing fixture fails naming the missing fixture", () => {
    expect(() => requireFixture("tests/fixtures/queue/golden/does-not-exist.json")).toThrow(
      "tests/fixtures/queue/golden/does-not-exist.json",
    );
    expect(requireFixture("tests/fixtures/queue/golden/queue-plan.json").length).toBeGreaterThan(0);
  });

  test("the deploy-read budget is bounded and memoized", () => {
    const facts = makeFacts([
      { ref: "GH-300", repository: "github.com/owner/repo-alpha", workItem: { state: "observed", deliveryState: "done", labels: ["priority:high"], blockedBy: [] } },
      { ref: "GH-310", repository: "github.com/owner/repo-beta", close: "merge-ready", edges: ["GH-300"] },
    ], {
      deploy: {
        expectations: { "GH-300": { state: "not-declared" } },
        verdicts: {},
      },
    });
    const schedule = computeQueueSchedule(facts);
    expect(schedule.deployReads).toBeLessThanOrEqual(3);
  });
});
