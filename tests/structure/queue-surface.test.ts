/**
 * TC-F6-011 — the queue surface gained no verb, record kind, state key or flag
 * (GH-349 AC-F6-3, API-7, NFR-6).
 *
 * Four exact-set equalities over the delivered declarations: the command's verb
 * list (derived from the delivered handler's own dispatch arms, not from a copy
 * of the expectation), the record-kind set, the store-key builder set, and the
 * flag grammar. Each comparison fails in both directions: an added member names
 * the unexpected value and a removed member names the missing one, so the pin
 * cannot be satisfied by widening or narrowing the set.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { QueueCommandRuntime } from "../../packages/cli/src/commands/queue";
import { createQueueCommandDefinition } from "../../packages/cli/src/commands/queue";
import {
  queueDependencyRecordKey,
  queueEntryRecordKey,
  queueIncidentRecordKey,
  queueLeaseRecordKey,
  queueParkRecordKey,
  queueRemovalRecordKey,
} from "../../packages/core/src/app/index";
import {
  QUEUE_DEPENDENCY_KEY_PREFIX,
  QUEUE_DEPENDENCY_RECORD_KIND,
  QUEUE_ENTRY_KEY_PREFIX,
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_GRAPH_DOCUMENT_NAME,
  QUEUE_INCIDENT_KEY_PREFIX,
  QUEUE_INCIDENT_RECORD_KIND,
  QUEUE_LEASE_KEY_PREFIX,
  QUEUE_LEASE_RECORD_KIND,
  QUEUE_PARK_KEY_PREFIX,
  QUEUE_PARK_RECORD_KIND,
  QUEUE_RECORD_DECLARATIONS,
  QUEUE_REMOVAL_KEY_PREFIX,
  QUEUE_REMOVAL_RECORD_KIND,
} from "../../packages/core/src/contracts/index";

const QUEUE_SOURCE = "packages/cli/src/commands/queue.ts";

/** The delivered verb set, in dispatch order. */
const DELIVERED_VERBS = [
  "ready",
  "list",
  "plan",
  "add",
  "prioritize",
  "dep",
  "remove",
  "reconcile",
  "claim",
  "release",
] as const;

/** The delivered record kinds. */
const DELIVERED_RECORD_KINDS = [
  "queue.entry",
  "queue.dependency",
  "queue.lease",
  "queue.park",
  "queue.incident",
  "queue.removal",
] as const;

/** The delivered store key prefixes. */
const DELIVERED_KEY_PREFIXES = [
  "queue.entries:",
  "queue.deps:",
  "queue.leases:",
  "queue.parks:",
  "queue.incidents:",
  "queue.removals:",
] as const;

/** The delivered flag grammar. */
const DELIVERED_FLAGS = [
  "--next",
  "--priority",
  "--dep",
  "--holder",
  "--park",
  "--until",
  "--reason",
  "--ref",
  "--project",
  "--watch",
] as const;

/** Flags that consume a value (the grammar's `requiresValue` contract). */
const DELIVERED_VALUE_FLAGS = [
  "--next",
  "--priority",
  "--dep",
  "--holder",
  "--park",
  "--until",
  "--reason",
  "--ref",
  "--project",
] as const;

const sorted = (values: Iterable<string>): readonly string[] => [...values].sort();

/**
 * Exact-set comparison: a missing member and an unexpected member each produce a
 * named divergence (never a count-only assertion).
 */
const exactSetDivergence = (
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): string | undefined => {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const unexpected = actual.filter((value) => !expectedSet.has(value));
  const duplicated = actual.filter((value, index) => actual.indexOf(value) !== index);
  if (missing.length > 0) return `${label} is missing ${missing.join(", ")}`;
  if (unexpected.length > 0) return `${label} gained unexpected ${unexpected.join(", ")}`;
  if (duplicated.length > 0) return `${label} duplicates ${duplicated.join(", ")}`;
  if (actual.length !== expected.length)
    return `${label} length ${actual.length}, declared ${expected.length}`;
  return undefined;
};

const assertExactSet = (
  actual: readonly string[],
  expected: readonly string[],
  label: string,
): void => {
  const divergence = exactSetDivergence(actual, expected, label);
  if (divergence !== undefined) throw new Error(divergence);
};

/** A runtime that is never invoked: the surface pin reads the definition only. */
const never = (): never => {
  throw new Error("the queue surface pin does not invoke the runtime");
};

const surfaceRuntime = (): QueueCommandRuntime => ({
  readSchedule: never,
  add: never,
  prioritize: never,
  dep: never,
  claim: never,
  release: never,
  remove: never,
  depRemove: never,
  reconcile: async () => never(),
});

describe("TC-F6-011 the queue verb set is exactly the delivered one", () => {
  test("the handler's dispatch arms equal the delivered ten verbs", () => {
    const source = readFileSync(join(process.cwd(), QUEUE_SOURCE), "utf8");
    const derived = sorted(
      [...source.matchAll(/subcommand === "([a-z]+)"/gu)].map((match) => match[1] ?? ""),
    );
    expect(exactSetDivergence(derived, DELIVERED_VERBS, "verb set")).toBeUndefined();
    expect(derived).toEqual(sorted(DELIVERED_VERBS));
  });

  test("the comparison fails both ways: an added verb and a removed verb are named", () => {
    expect(() =>
      assertExactSet([...DELIVERED_VERBS, "enqueue"], DELIVERED_VERBS, "verb set"),
    ).toThrow(/unexpected enqueue/);
    expect(() =>
      assertExactSet(
        DELIVERED_VERBS.filter((verb) => verb !== "reconcile"),
        DELIVERED_VERBS,
        "verb set",
      ),
    ).toThrow(/missing reconcile/);
  });
});

describe("TC-F6-011 the record-kind and state-key sets are exactly the delivered one", () => {
  test("six record kinds and six key prefixes, with the builders carrying the prefix", () => {
    const kinds = sorted(QUEUE_RECORD_DECLARATIONS.map((declaration) => declaration.kind));
    expect(exactSetDivergence(kinds, DELIVERED_RECORD_KINDS, "record kinds")).toBeUndefined();
    expect(kinds).toEqual(sorted(DELIVERED_RECORD_KINDS));
    expect([
      QUEUE_ENTRY_RECORD_KIND,
      QUEUE_DEPENDENCY_RECORD_KIND,
      QUEUE_LEASE_RECORD_KIND,
      QUEUE_PARK_RECORD_KIND,
      QUEUE_INCIDENT_RECORD_KIND,
      QUEUE_REMOVAL_RECORD_KIND,
    ]).toEqual([...DELIVERED_RECORD_KINDS]);

    const prefixes = sorted([
      QUEUE_ENTRY_KEY_PREFIX,
      QUEUE_DEPENDENCY_KEY_PREFIX,
      QUEUE_LEASE_KEY_PREFIX,
      QUEUE_PARK_KEY_PREFIX,
      QUEUE_INCIDENT_KEY_PREFIX,
      QUEUE_REMOVAL_KEY_PREFIX,
    ]);
    expect(exactSetDivergence(prefixes, DELIVERED_KEY_PREFIXES, "key prefixes")).toBeUndefined();
    expect(prefixes).toEqual(sorted(DELIVERED_KEY_PREFIXES));
    expect(QUEUE_GRAPH_DOCUMENT_NAME).toBe("queue-graph.json");

    // The builders are the prefix plus the declared identity, byte for byte.
    expect(queueEntryRecordKey("GH-1")).toBe(`${QUEUE_ENTRY_KEY_PREFIX}GH-1`);
    expect(queueDependencyRecordKey("GH-1")).toBe(`${QUEUE_DEPENDENCY_KEY_PREFIX}GH-1`);
    expect(queueLeaseRecordKey("host/owner/name")).toBe(`${QUEUE_LEASE_KEY_PREFIX}host/owner/name`);
    expect(queueParkRecordKey("GH-1")).toBe(`${QUEUE_PARK_KEY_PREFIX}GH-1`);
    expect(queueIncidentRecordKey("host/owner/name")).toBe(
      `${QUEUE_INCIDENT_KEY_PREFIX}host/owner/name`,
    );
    expect(queueRemovalRecordKey("GH-1")).toBe(`${QUEUE_REMOVAL_KEY_PREFIX}GH-1`);
  });

  test("the comparison fails both ways for a kind and a key prefix", () => {
    expect(() =>
      assertExactSet(
        [...DELIVERED_RECORD_KINDS, "queue.notice"],
        DELIVERED_RECORD_KINDS,
        "record kinds",
      ),
    ).toThrow(/unexpected queue.notice/);
    expect(() =>
      assertExactSet(
        DELIVERED_RECORD_KINDS.filter((kind) => kind !== "queue.park"),
        DELIVERED_RECORD_KINDS,
        "record kinds",
      ),
    ).toThrow(/missing queue.park/);
    expect(() =>
      assertExactSet(
        [...DELIVERED_KEY_PREFIXES, "queue.notes:"],
        DELIVERED_KEY_PREFIXES,
        "key prefixes",
      ),
    ).toThrow(/unexpected queue.notes:/);
  });
});

describe("TC-F6-011 the flag grammar is exactly the delivered one", () => {
  test("ten flags, nine value-taking, no duplicate, and no new member", () => {
    const definition = createQueueCommandDefinition(surfaceRuntime());
    const flags = definition.flags ?? [];
    expect(exactSetDivergence(flags, DELIVERED_FLAGS, "flag grammar")).toBeUndefined();
    expect(flags).toEqual(DELIVERED_FLAGS);
    const valueFlags = definition.requiresValue ?? [];
    expect(
      exactSetDivergence(valueFlags, DELIVERED_VALUE_FLAGS, "value-flag grammar"),
    ).toBeUndefined();
    expect(valueFlags).toEqual(DELIVERED_VALUE_FLAGS);
    // `--watch` is the one streaming-only flag: accepted, never value-taking.
    expect(flags).toContain("--watch");
    expect(valueFlags).not.toContain("--watch");
  });

  test("the comparison fails both ways: a new flag and a removed flag are named", () => {
    expect(() =>
      assertExactSet([...DELIVERED_FLAGS, "--force"], DELIVERED_FLAGS, "flag grammar"),
    ).toThrow(/unexpected --force/);
    expect(() =>
      assertExactSet(
        DELIVERED_FLAGS.filter((flag) => flag !== "--reason"),
        DELIVERED_FLAGS,
        "flag grammar",
      ),
    ).toThrow(/missing --reason/);
  });
});
