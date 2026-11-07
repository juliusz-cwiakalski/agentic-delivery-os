/**
 * TC-SCHED-001 / TC-SCHED-002 / TC-SCHED-015 (GH-237) — the queue declaration
 * graph: canonical identity, repository-key normalization, fenced entry/edge
 * appends carrying the internal-only recorded root, cycle refusal before
 * append, replay idempotence, superseding projection, and the rebuildable
 * derived document.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  canonicalQueueRef,
  foldQueueGraph,
  normalizeRepositoryKey,
} from "../../packages/core/src/domain/index";
import {
  addQueueDependency,
  declareQueueEntry,
  prioritizeQueueEntry,
  queueDependencyRecordKey,
  queueEntryRecordKey,
  queueGraphDocumentPath,
  readQueueDependencies,
  readQueueEntries,
  readQueueFold,
} from "../../packages/core/src/state/index";
import { makeAuditStore } from "../fixtures/state/harness";

const ROOT = process.cwd();
const NOW = "2026-11-07T10:00:00Z";
const REPO = "github.com/owner/repo-alpha";
const ROOT_PATH = "/home/user/checkouts/repo-alpha";

const readJson = <T>(relative: string): T =>
  JSON.parse(readFileSync(`${ROOT}/${relative}`, "utf8")) as T;

const cycleSeed = readJson<{
  seed: { producer: string; edgeTo: string; consumer: string; firstEdge: string };
  expectedCyclePath: string[];
}>("tests/fixtures/queue/graph/cycle/seed.json");
const bindingCases = readJson<{
  rows: Array<{ remote: string; key: string | null }>;
  control: { ref: string; repository: string; repositoryRoot: string };
}>("tests/fixtures/queue/graph/binding/cases.json");
const keys = readJson<{
  entryKey: string;
  dependencyKey: string;
  leaseKey: string;
  parkKey: string;
  incidentKey: string;
  graphDocument: string;
}>("tests/fixtures/queue/state/graph/keys.json");

const storeOf = (label: string) => makeAuditStore(`queue-${label}`);

const recordCount = (store: ReturnType<typeof storeOf>["store"]): number => {
  const read = store.readRecords();
  if (!read.ok) throw new Error(`read failed: ${read.error.code}`);
  return read.value.records.length;
};

const documentOf = (identity: ReturnType<typeof storeOf>["identity"]): unknown =>
  JSON.parse(readFileSync(queueGraphDocumentPath(identity), "utf8")) as unknown;

describe("TC-SCHED-001 canonical identity and repository keys", () => {
  test("canonical refs uppercase the prefix and normalize the numeric suffix", () => {
    expect(canonicalQueueRef("gh-010")).toBe("GH-10");
    expect(canonicalQueueRef("GH-10")).toBe("GH-10");
    expect(canonicalQueueRef("gh-7")).toBe("GH-7");
    expect(canonicalQueueRef("GH-010")).toBe("GH-10");
    expect(canonicalQueueRef("not a ref")).toBeUndefined();
    expect(canonicalQueueRef("GH-")).toBeUndefined();
  });

  test("repository-key normalization removes protocol, credentials, userinfo, and .git", () => {
    for (const row of bindingCases.rows) {
      const actual = normalizeRepositoryKey(row.remote);
      expect(actual, row.remote).toBe(row.key ?? undefined);
    }
  });

  test("the declared record keys are the Appendix D spellings", () => {
    expect(queueEntryRecordKey("gh-301")).toBe(keys.entryKey);
    expect(queueDependencyRecordKey("GH-301")).toBe(keys.dependencyKey);
    expect(keys.graphDocument).toBe("queue-graph.json");
  });
});

describe("TC-SCHED-001 entry, edge, cycle, and replay", () => {
  test("a seeded edge to a not-yet-declared producer is retained in the fold", () => {
    const { store } = storeOf("seed");
    const seeded = declareQueueEntry(store, {
      ref: cycleSeed.seed.producer,
      repository: REPO,
      repositoryRoot: ROOT_PATH,
      priority: 5,
      edges: [cycleSeed.seed.edgeTo],
      recordedAt: NOW,
      fenceToken: "seed-1",
    });
    expect(seeded.ok).toBe(true);
    const fold = readQueueFold(store);
    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    expect(fold.value.edges).toContainEqual({
      consumer: cycleSeed.seed.producer,
      producer: cycleSeed.seed.edgeTo,
    });
    const consumer = fold.value.entries.find((entry) => entry.ref === cycleSeed.seed.producer);
    expect(consumer?.edges).toEqual([cycleSeed.seed.edgeTo]);
    // The producer has no entry; the edge is retained, never dropped.
    expect(fold.value.entries.some((entry) => entry.ref === cycleSeed.seed.edgeTo)).toBe(false);
  });

  test("add lands the entry and its first edge under one fence, then a cycle is refused before append", () => {
    const { store, identity } = storeOf("cycle");
    expect(
      declareQueueEntry(store, {
        ref: cycleSeed.seed.producer,
        repository: REPO,
        repositoryRoot: ROOT_PATH,
        priority: 10,
        edges: [cycleSeed.seed.edgeTo],
        recordedAt: NOW,
        fenceToken: "f-1",
      }).ok,
    ).toBe(true);
    const added = declareQueueEntry(store, {
      ref: cycleSeed.seed.consumer,
      repository: REPO,
      repositoryRoot: ROOT_PATH,
      priority: 5,
      edges: [cycleSeed.seed.firstEdge],
      recordedAt: NOW,
      fenceToken: "f-2",
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.value.result).toBe("added");
    expect(added.value.entry.ref).toBe(cycleSeed.seed.consumer);
    expect(added.value.entry.repository).toBe(REPO);
    expect(added.value.entry.repositoryRoot).toBe(ROOT_PATH);
    expect(added.value.edges).toEqual([cycleSeed.seed.firstEdge]);

    const entries = readQueueEntries(store);
    expect(entries.ok).toBe(true);
    if (entries.ok) {
      const record = entries.records.find((entry) => entry.ref === cycleSeed.seed.consumer);
      expect(record?.repository).toBe(REPO);
      expect(record?.repositoryRoot).toBe(ROOT_PATH);
    }

    const beforeCount = recordCount(store);
    const beforeDocument = documentOf(identity);
    const refused = addQueueDependency(store, {
      ref: cycleSeed.seed.consumer,
      onRef: cycleSeed.seed.producer,
      recordedAt: NOW,
      fenceToken: "f-3",
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.kind).toBe("queue");
      expect(refused.code).toBe("queue.dependency-cycle");
      if (refused.code === "queue.dependency-cycle") {
        expect([...refused.path]).toEqual(cycleSeed.expectedCyclePath);
      }
    }
    expect(recordCount(store)).toBe(beforeCount);
    expect(documentOf(identity)).toEqual(beforeDocument);

    const replayed = addQueueDependency(store, {
      ref: cycleSeed.seed.consumer,
      onRef: cycleSeed.seed.producer,
      recordedAt: NOW,
      fenceToken: "f-4",
    });
    expect(replayed.ok).toBe(false);
    expect(recordCount(store)).toBe(beforeCount);
  });

  test("the derived graph document folds no repository root and equals a rebuild", () => {
    const { store, identity } = storeOf("document");
    expect(
      declareQueueEntry(store, {
        ref: "GH-301",
        repository: REPO,
        repositoryRoot: ROOT_PATH,
        priority: 5,
        edges: ["GH-300"],
        recordedAt: NOW,
        fenceToken: "d-1",
      }).ok,
    ).toBe(true);
    const fold = readQueueFold(store);
    expect(fold.ok).toBe(true);
    if (!fold.ok) return;
    const document = documentOf(identity) as { entries: Array<Record<string, unknown>> };
    expect(document).toEqual({
      schema: "delivery.queue.graph.v1",
      entries: fold.value.entries,
    });
    for (const entry of document.entries) {
      expect(Object.hasOwn(entry, "repositoryRoot")).toBe(false);
      expect(JSON.stringify(entry)).not.toContain(ROOT_PATH);
    }
    const rebuilt = JSON.parse(
      JSON.stringify({ schema: "delivery.queue.graph.v1", entries: foldQueueGraph(fold.value.entryRecords, fold.value.dependencyRecords).entries }),
    ) as unknown;
    expect(document).toEqual(rebuilt);
  });
});

describe("TC-SCHED-002 replay, priority, and superseding projection", () => {
  test("identical replays append nothing and report noop", () => {
    const { store } = storeOf("replay");
    const first = declareQueueEntry(store, {
      ref: "GH-300",
      repository: REPO,
      repositoryRoot: ROOT_PATH,
      priority: 10,
      recordedAt: NOW,
      fenceToken: "r-1",
    });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.result).toBe("added");
    const beforeCount = recordCount(store);
    const replay = declareQueueEntry(store, {
      ref: "GH-300",
      repository: REPO,
      repositoryRoot: ROOT_PATH,
      priority: 10,
      recordedAt: "2026-11-07T10:05:00Z",
      fenceToken: "r-2",
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.value.result).toBe("noop");
    expect(recordCount(store)).toBe(beforeCount);

    const withEdge = declareQueueEntry(store, {
      ref: "GH-301",
      repository: REPO,
      repositoryRoot: ROOT_PATH,
      priority: 5,
      edges: ["GH-300"],
      recordedAt: NOW,
      fenceToken: "r-3",
    });
    expect(withEdge.ok).toBe(true);
    const edgeCount = recordCount(store);
    const dependencyReplay = addQueueDependency(store, {
      ref: "GH-301",
      onRef: "GH-300",
      recordedAt: "2026-11-07T10:06:00Z",
      fenceToken: "r-4",
    });
    expect(dependencyReplay.ok).toBe(true);
    if (dependencyReplay.ok) expect(dependencyReplay.value.result).toBe("noop");
    expect(recordCount(store)).toBe(edgeCount);
  });

  test("priority is latest-wins with no schema bump and reorders only inside one class", () => {
    const { store } = storeOf("priority");
    expect(
      declareQueueEntry(store, {
        ref: "GH-301",
        repository: REPO,
        repositoryRoot: ROOT_PATH,
        priority: 5,
        recordedAt: NOW,
        fenceToken: "p-1",
      }).ok,
    ).toBe(true);
    const updated = prioritizeQueueEntry(store, {
      ref: "GH-301",
      priority: 2,
      recordedAt: NOW,
      fenceToken: "p-2",
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.value.result).toBe("updated");
      expect(updated.value.entry.priority).toBe(2);
    }
    const fold = readQueueFold(store);
    if (fold.ok) {
      expect(fold.value.entries.find((entry) => entry.ref === "GH-301")?.priority).toBe(2);
    }
    const unchanged = prioritizeQueueEntry(store, {
      ref: "GH-301",
      priority: 2,
      recordedAt: "2026-11-07T10:07:00Z",
      fenceToken: "p-3",
    });
    expect(unchanged.ok).toBe(true);
    if (unchanged.ok) expect(unchanged.value.result).toBe("noop");
    const missing = prioritizeQueueEntry(store, {
      ref: "GH-999",
      priority: 1,
      recordedAt: NOW,
      fenceToken: "p-4",
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok && missing.kind === "queue") {
      expect(missing.code).toBe("queue.entry.unobserved");
    }
  });

  test("a superseding entry replaces the prior projection by identity exactly once", () => {
    const { store } = storeOf("supersede");
    expect(
      declareQueueEntry(store, {
        ref: "GH-301",
        repository: REPO,
        repositoryRoot: ROOT_PATH,
        priority: 10,
        edges: ["GH-300"],
        recordedAt: NOW,
        fenceToken: "s-1",
      }).ok,
    ).toBe(true);
    const superseded = declareQueueEntry(store, {
      ref: "GH-301",
      priority: 1,
      recordedAt: NOW,
      fenceToken: "s-2",
    });
    expect(superseded.ok).toBe(true);
    if (superseded.ok) {
      expect(superseded.value.result).toBe("updated");
      expect(superseded.value.entry.priority).toBe(1);
      expect(superseded.value.entry.repository).toBe(REPO);
      expect(superseded.value.edges).toEqual(["GH-300"]);
    }
    const fold = readQueueFold(store);
    if (fold.ok) {
      expect(fold.value.entries.filter((entry) => entry.ref === "GH-301")).toHaveLength(1);
    }
    const dependencies = readQueueDependencies(store);
    expect(dependencies.ok).toBe(true);
    if (dependencies.ok) {
      expect(
        dependencies.records.filter((record) => record.ref === "GH-301"),
      ).toHaveLength(1);
    }
  });
});

describe("TC-SCHED-015 unresolved binding is recorded but carries no key", () => {
  test("an entry with no resolvable binding has neither repository nor root", () => {
    const { store } = storeOf("binding");
    const unresolved = declareQueueEntry(store, {
      ref: "GH-320",
      priority: 100,
      recordedAt: NOW,
      fenceToken: "b-1",
    });
    expect(unresolved.ok).toBe(true);
    if (unresolved.ok) {
      expect(unresolved.value.entry.repository).toBeUndefined();
      expect(unresolved.value.entry.repositoryRoot).toBeUndefined();
    }
    const fold = readQueueFold(store);
    if (fold.ok) {
      const entry = fold.value.entries.find((candidate) => candidate.ref === "GH-320");
      expect(entry?.repository).toBeUndefined();
    }
  });

  test("a control entry resolves the normalized key and records its root", () => {
    const { store } = storeOf("binding-control");
    const control = declareQueueEntry(store, {
      ref: bindingCases.control.ref,
      repository: bindingCases.control.repository,
      repositoryRoot: bindingCases.control.repositoryRoot,
      recordedAt: NOW,
      fenceToken: "bc-1",
    });
    expect(control.ok).toBe(true);
    if (control.ok) {
      expect(control.value.entry.repository).toBe("github.com/owner/repo-alpha");
      expect(control.value.entry.repositoryRoot).toBe(bindingCases.control.repositoryRoot);
    }
  });

  test("a key without a root, or a root without a key, is rejected before append", () => {
    const { store } = storeOf("binding-invalid");
    const before = recordCount(store);
    const noRoot = declareQueueEntry(store, {
      ref: "GH-321",
      repository: REPO,
      priority: 1,
      recordedAt: NOW,
      fenceToken: "bi-1",
    });
    expect(noRoot.ok).toBe(false);
    if (!noRoot.ok) expect(noRoot.kind).toBe("input");
    const noKey = declareQueueEntry(store, {
      ref: "GH-322",
      repositoryRoot: ROOT_PATH,
      priority: 1,
      recordedAt: NOW,
      fenceToken: "bi-2",
    });
    expect(noKey.ok).toBe(false);
    expect(recordCount(store)).toBe(before);
  });
});

describe("fail-closed ledger reads", () => {
  test("a wrong kind under an entry key is a classified state failure", () => {
    const { store, identity } = storeOf("wrong-kind");
    const acquired = store.acquireFence("wk-1");
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    try {
      const appended = store.append(acquired.value.handle, {
        kind: "queue.entryx",
        recordKey: "queue.entries:GH-999",
        payload: { schema: "delivery.queue.entry.v1", ref: "GH-999" },
      });
      expect(appended.ok).toBe(true);
    } finally {
      store.releaseFence(acquired.value.handle);
    }
    expect(identity.stateDirectory.length).toBeGreaterThan(0);
    const read = readQueueEntries(store);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.store.torn");
  });

  test("a schema-mismatched payload is incompatible, never a fabricated entry", () => {
    const { store } = storeOf("schema-mismatch");
    const acquired = store.acquireFence("sm-1");
    expect(acquired.ok).toBe(true);
    if (!acquired.ok) return;
    try {
      store.append(acquired.value.handle, {
        kind: "queue.entry",
        recordKey: "queue.entries:GH-998",
        payload: {
          schema: "delivery.queue.entry.v2",
          ref: "GH-998",
          priority: 1,
          recordedAt: NOW,
        },
      });
    } finally {
      store.releaseFence(acquired.value.handle);
    }
    const read = readQueueEntries(store);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.code).toBe("state.schema.mismatch");
  });
});
