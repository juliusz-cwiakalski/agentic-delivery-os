/**
 * TC-QLC-001 (contract half, GH-292 Phase 1) — the removal truth at the seam
 * level: the declared `queue.removal` record, the append-position presence rule
 * (DM-2), the exact refusal set, the park withdrawal order, the derived-document
 * replacement, and the dependency-edge removal semantics. The CLI verbs and
 * their payload envelopes are mounted in a later phase; this suite pins the
 * mutation seams and the fold predicate they feed.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  declareQueueEntry,
  queueGraphDocumentPath,
  readQueueEntries,
  readQueueFold,
  readQueueRemovals,
  removeQueueDependency,
  removeQueueEntry,
} from "../../packages/core/src/app/index";
import {
  QUEUE_ERROR_CODES,
  QUEUE_REMOVAL_KEY_PREFIX,
  QUEUE_REMOVAL_REASONS,
  QUEUE_REMOVAL_RECORD_KIND,
  QUEUE_REMOVAL_SCHEMA,
  type QueueRemovalReason,
} from "../../packages/core/src/contracts/index";
import { type AuditStoreFixture, makeAuditStore, removeRoot } from "../fixtures/state/harness";

const ROOT = process.cwd();
const NOW_ISO = "2026-11-12T10:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
const REPO = "host/owner/name";
const REPO_ROOT = "/work/repo-alpha";

type RecordKinds = {
  readonly records: readonly {
    readonly kind: string;
    readonly payloadSchema: string;
    readonly keyPrefix: string;
    readonly identityField: string;
  }[];
};

const recordKinds = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/queue/state/kinds/record-kinds.json"), "utf8"),
) as RecordKinds;
const removalFixture = recordKinds.records.find((record) => record.kind === "queue.removal");

const stores: AuditStoreFixture[] = [];
const freshStore = (): AuditStoreFixture => {
  const fixture = makeAuditStore("queue-removal-contract");
  stores.push(fixture);
  return fixture;
};
afterEach(() => {
  for (const fixture of stores.splice(0)) removeRoot(fixture.root);
});

const seedEntry = (store: AuditStoreFixture["store"], ref: string, recordedAt = NOW_ISO): void => {
  const result = declareQueueEntry(store, {
    ref,
    repository: REPO,
    repositoryRoot: REPO_ROOT,
    priority: 1,
    recordedAt,
    fenceToken: `seed-${ref}`,
  });
  expect(result.ok).toBe(true);
};

const remove = (
  store: AuditStoreFixture["store"],
  input: {
    readonly ref: string;
    readonly reason?: QueueRemovalReason;
    readonly recordedAt?: string;
  },
) =>
  removeQueueEntry(store, {
    ref: input.ref,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    recordedAt: input.recordedAt ?? NOW_ISO,
    nowMs: NOW_MS,
    fenceToken: `remove-${input.ref}`,
  });

describe("TC-QLC-001 the removal record is declared once", () => {
  test("the declared kind, schema, key prefix, identity, and vocabulary are exact", () => {
    expect(QUEUE_REMOVAL_RECORD_KIND).toBe(removalFixture?.kind);
    expect(QUEUE_REMOVAL_SCHEMA).toBe(removalFixture?.payloadSchema);
    expect(QUEUE_REMOVAL_KEY_PREFIX).toBe(removalFixture?.keyPrefix);
    expect(removalFixture?.identityField).toBe("ref");
    expect([...QUEUE_REMOVAL_REASONS]).toEqual(["landed", "abandoned", "superseded", "reconciled"]);
    expect(QUEUE_ERROR_CODES).toContain("queue.reason-missing");
    expect(QUEUE_ERROR_CODES).toContain("queue.single-flight");
  });

  test("the removal ledger validates kind, schema, and reason on read", () => {
    const fixture = freshStore();
    seedEntry(fixture.store, "GH-241");
    const refused = remove(fixture.store, { ref: "GH-241" });
    expect(refused).toEqual({
      ok: false,
      kind: "queue",
      code: "queue.reason-missing",
      ref: "GH-241",
    });
    const landed = remove(fixture.store, { ref: "GH-241", reason: "landed" });
    expect(landed.ok).toBe(true);
    const removals = readQueueRemovals(fixture.store);
    expect(removals.ok).toBe(true);
    if (!removals.ok) return;
    expect(removals.records.map((record) => record.schema)).toEqual([QUEUE_REMOVAL_SCHEMA]);
    expect(removals.records.map((record) => record.reason)).toEqual(["landed"]);
    const ledger = fixture.store.readRecords();
    expect(ledger.ok).toBe(true);
    if (!ledger.ok) return;
    expect(
      ledger.value.records
        .filter((record) => record.key.startsWith(QUEUE_REMOVAL_KEY_PREFIX))
        .map((record) => record.kind),
    ).toEqual([QUEUE_REMOVAL_RECORD_KIND]);
  });
});

describe("TC-QLC-001 the refusal set is exact and pre-append", () => {
  test("a reason outside the vocabulary and a non-canonical ref are input refusals", () => {
    const fixture = freshStore();
    seedEntry(fixture.store, "GH-241");
    const before = fixture.store.readRecords();
    expect(before.ok).toBe(true);
    const badReason = remove(fixture.store, {
      ref: "GH-241",
      reason: "deleted" as QueueRemovalReason,
    });
    expect(badReason).toEqual({
      ok: false,
      kind: "input",
      code: "input.value.rejected",
      detail: "reason deleted is outside the declared removal vocabulary",
    });
    const badRef = remove(fixture.store, { ref: "nope", reason: "abandoned" });
    expect(badRef).toMatchObject({ ok: false, kind: "input", code: "input.value.rejected" });
    const after = fixture.store.readRecords();
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(after.value.records.length).toBe(before.value.records.length);
  });

  test("an absent or already-removed ref is queue.entry.unobserved with zero appends", () => {
    const fixture = freshStore();
    seedEntry(fixture.store, "GH-241");
    expect(remove(fixture.store, { ref: "GH-999", reason: "abandoned" })).toMatchObject({
      ok: false,
      kind: "queue",
      code: "queue.entry.unobserved",
      ref: "GH-999",
    });
    expect(remove(fixture.store, { ref: "GH-241", reason: "abandoned" })).toMatchObject({
      ok: true,
    });
    const before = fixture.store.readRecords();
    expect(before.ok).toBe(true);
    const again = remove(fixture.store, { ref: "GH-241", reason: "abandoned" });
    expect(again).toMatchObject({ ok: false, kind: "queue", code: "queue.entry.unobserved" });
    const after = fixture.store.readRecords();
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(after.value.records.length).toBe(before.value.records.length);
  });
});

describe("TC-QLC-001 presence follows append position (DM-2)", () => {
  test("a removed ref leaves the fold, the reads, and the derived document", () => {
    const fixture = freshStore();
    seedEntry(fixture.store, "GH-241");
    const before = readQueueFold(fixture.store);
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.value.entries.map((entry) => entry.ref)).toEqual(["GH-241"]);
    const landed = remove(fixture.store, { ref: "GH-241", reason: "abandoned" });
    expect(landed.ok).toBe(true);
    if (!landed.ok) return;
    expect(landed.value.fold.entries).toEqual([]);
    expect(landed.value.graph.entries).toEqual([]);
    const fold = readQueueFold(fixture.store);
    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    expect(fold.value.entries).toEqual([]);
    expect(fold.value.entryRecords).toEqual([]);
    const entries = readQueueEntries(fixture.store);
    expect(entries.ok).toBe(true);
    if (!entries.ok) return;
    expect(entries.latest).toEqual([]);
    expect(entries.records).toEqual([]);
    const document = JSON.parse(readFileSync(queueGraphDocumentPath(fixture.identity), "utf8")) as {
      entries: readonly unknown[];
    };
    expect(document.entries).toEqual([]);
  });

  test("a re-declared ref is present again with no record deleted, even at equal recordedAt", () => {
    const fixture = freshStore();
    seedEntry(fixture.store, "GH-241");
    expect(remove(fixture.store, { ref: "GH-241", reason: "abandoned" })).toMatchObject({
      ok: true,
    });
    const removalsBefore = readQueueRemovals(fixture.store);
    expect(removalsBefore.ok).toBe(true);
    if (!removalsBefore.ok) return;
    const removalBytes = JSON.stringify(removalsBefore.records);
    // The re-declaration carries the SAME recordedAt as the removal; presence
    // must decide by append position, never by timestamp text.
    seedEntry(fixture.store, "GH-241", NOW_ISO);
    const fold = readQueueFold(fixture.store);
    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    expect(fold.value.entries.map((entry) => entry.ref)).toEqual(["GH-241"]);
    const removalsAfter = readQueueRemovals(fixture.store);
    expect(removalsAfter.ok).toBe(true);
    if (!removalsAfter.ok) return;
    expect(JSON.stringify(removalsAfter.records)).toBe(removalBytes);
  });

  test("a removal appended after the entry at equal recordedAt removes the entry", () => {
    const fixture = freshStore();
    seedEntry(fixture.store, "GH-241", NOW_ISO);
    const landed = remove(fixture.store, { ref: "GH-241", reason: "landed", recordedAt: NOW_ISO });
    expect(landed.ok).toBe(true);
    const fold = readQueueFold(fixture.store);
    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    expect(fold.value.entries).toEqual([]);
  });

  test("a store with no removal records folds to the delivered identity", () => {
    const fixture = freshStore();
    seedEntry(fixture.store, "GH-241");
    seedEntry(fixture.store, "GH-242");
    const fold = readQueueFold(fixture.store);
    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    expect(fold.value.entries.map((entry) => entry.ref)).toEqual(["GH-241", "GH-242"]);
    expect(readQueueRemovals(fixture.store)).toMatchObject({
      ok: true,
      records: [],
      verifiedEmpty: true,
    });
  });
});
