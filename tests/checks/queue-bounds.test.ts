/**
 * TC-SCHED-011 / TC-VOCAB-005 (GH-237) — structural bounds that are
 * environment-independent, and the absence of any capacity, bandwidth,
 * concurrency, or CI-slot key or code path.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QUEUE_BLOCKING_REASONS,
  QUEUE_LANE_IDLE_REASONS,
  QUEUE_MAX_DEPLOY_READS,
  QUEUE_MAX_EDGES_PER_ENTRY,
  QUEUE_MAX_ENTRIES,
  QUEUE_MAX_EVALUATED_CANDIDATES,
  QUEUE_MAX_FINDINGS,
  QUEUE_MAX_HUMAN_BYTES,
  QUEUE_MAX_HUMAN_LINES,
  QUEUE_MAX_LANES,
  QUEUE_MAX_MACHINE_BYTES,
  QUEUE_MAX_NEXT_ACTIONS,
  QUEUE_MAX_REASONS,
} from "../../packages/core/src/contracts/index";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/index";
import { computeQueueSchedule } from "../../packages/core/src/domain/index";
import {
  makeFacts,
  type EntrySpec,
} from "../fixtures/queue/schedule/harness";

const ROOT = process.cwd();

const corpus = (count: number, edgeCount: number): EntrySpec[] =>
  Array.from({ length: count }, (_, index) => ({
    ref: `GH-${2000 + index}`,
    repository: `github.com/owner/repo-${String(index % 25)}`,
    priority: (index * 11) % 100,
    edges:
      index < edgeCount
        ? [`GH-${2000 + ((index * 3 + 1) % count)}`]
        : [],
  }));

describe("TC-SCHED-011 structural bounds", () => {
  test("the declared caps are the NFR-9 values", () => {
    expect(QUEUE_MAX_ENTRIES).toBe(500);
    expect(QUEUE_MAX_EDGES_PER_ENTRY).toBe(32);
    expect(QUEUE_MAX_NEXT_ACTIONS).toBe(20);
    expect(QUEUE_MAX_LANES).toBe(200);
    expect(QUEUE_MAX_FINDINGS).toBe(20);
    expect(QUEUE_MAX_REASONS).toBe(8);
    expect(QUEUE_MAX_MACHINE_BYTES).toBe(65_536);
    expect(QUEUE_MAX_HUMAN_LINES).toBe(40);
    expect(QUEUE_MAX_HUMAN_BYTES).toBe(8_192);
    expect(QUEUE_MAX_EVALUATED_CANDIDATES).toBe(32);
    expect(QUEUE_MAX_DEPLOY_READS).toBe(3);
  });

  test("a corpus above each cap carries an explicit truncation marker", () => {
    const facts = makeFacts(corpus(600, 40));
    const schedule = computeQueueSchedule(facts, { next: 100 });
    expect(schedule.entries.length).toBeLessThanOrEqual(500);
    expect(schedule.nextActions.length).toBeLessThanOrEqual(20);
    expect(schedule.truncated).toBe(true);
    expect(schedule.evaluatedCandidates).toBe(32);
  });

  test("a corpus at the caps is complete without silent cuts", () => {
    const facts = makeFacts(corpus(500, 40));
    const schedule = computeQueueSchedule(facts, { next: 20 });
    expect(schedule.entries).toHaveLength(500);
    expect(schedule.nextActions.length).toBeLessThanOrEqual(20);
    // More than 32 entries always means the readiness window is explicit.
    expect(schedule.evaluatedCandidates).toBe(32);
  });

  test("no capacity, bandwidth, concurrency, or CI-slot key exists in the catalog", () => {
    const queue = PRODUCTION_CATALOG.queue;
    expect(queue).toBeDefined();
    const fields = queue?.type === "object" ? Object.keys(queue.fields) : [];
    expect(fields).toEqual(["lease-ttl", "park-recheck"]);
    for (const forbidden of ["capacity", "bandwidth", "concurrency", "ci-slot", "slots"]) {
      expect(fields).not.toContain(forbidden);
      expect(fields.some((field) => field.includes(forbidden))).toBe(false);
    }
    expect(readFileSync(join(ROOT, "packages/core/src/config/defaults.ts"), "utf8")).not.toMatch(
      /capacity|bandwidth|concurrency|ci-slot/i,
    );
  });

  test("no capacity term enters the declared reason vocabularies", () => {
    for (const forbidden of ["capacity", "bandwidth", "concurrency", "ci-slot"]) {
      expect((QUEUE_BLOCKING_REASONS as readonly string[]).includes(forbidden)).toBe(false);
      expect((QUEUE_LANE_IDLE_REASONS as readonly string[]).includes(forbidden)).toBe(false);
    }
  });
});
