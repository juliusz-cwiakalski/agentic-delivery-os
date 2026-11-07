/**
 * TC-GH223-028 (bounded/filtered reads), TC-GH223-030 (torn/unknown/empty
 * classification), and TC-GH223-042 (exact scope/repo semantics).
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync, readFileSync } from "node:fs";
import {
  AUDIT_INVOCATION_RECORD_KIND,
  type AuditInvocationFacts,
} from "../../packages/core/src/contracts/index";
import { appendAuditInvocation, readAuditLedger } from "../../packages/core/src/state/index";
import {
  ledgerDigest,
  ledgerPath,
  listStoreFiles,
  makeAuditStore,
  removeRoot,
  seedAuditPairs,
} from "../fixtures/state/harness";

const records = [
  {
    runId: "run-read-01",
    command: "status",
    outcomeClass: "success",
    scope: "workspace-a",
    repo: "repo-1",
    startedAt: 1000,
  },
  {
    runId: "run-read-02",
    command: "status-extra",
    outcomeClass: "user-validation",
    scope: "workspace-a",
    startedAt: 2000,
  },
  {
    runId: "run-read-03",
    command: "db",
    outcomeClass: "platform-provider",
    scope: "workspace-b",
    repo: "repo-2",
    startedAt: 3000,
  },
  {
    runId: "run-read-04",
    command: "status",
    outcomeClass: "success",
    scope: "workspace-a",
    repo: "repo-2",
    startedAt: 4000,
  },
  {
    runId: "run-read-05",
    command: "--wat",
    outcomeClass: "user-validation",
    scope: "workspace-a",
    startedAt: 5000,
  },
  {
    runId: "run-read-06",
    command: "unknown-cmd",
    outcomeClass: "user-validation",
    scope: "workspace-a",
    startedAt: 6000,
  },
] as const;

const seedReadStore = (label: string) => {
  const fixture = makeAuditStore(label);
  const acquired = fixture.store.acquireFence("interleaved");
  if (acquired.ok) {
    fixture.store.append(acquired.value.handle, {
      kind: "phase.transition",
      recordKey: "phase.transitions:GH-223",
      payload: { phase: "delivery" },
    });
    fixture.store.releaseFence(acquired.value.handle);
  }
  for (const record of records) {
    const appended = appendAuditInvocation(fixture.store, {
      runId: record.runId,
      command: record.command,
      arguments: [record.command, "--json"],
      exitCode: 0,
      timing: { totalMs: 1 },
      resultSchemaVersion: "delivery.result.v1",
      outcomeClass: record.outcomeClass,
      scope: record.scope,
      ...("repo" in record ? { repo: record.repo } : {}),
      startedAt: record.startedAt,
    });
    if (!appended.ok) throw new Error(appended.error.code);
  }
  return fixture;
};

describe("TC-GH223-028 bounded filtered reads", () => {
  test("scope, command, outcome, window, and bound filters return verified matches", () => {
    const fixture = seedReadStore("read-filters");
    try {
      const store = fixture.store;
      const scopeMatch = readAuditLedger(store, { limit: 10, scope: "workspace-a" });
      expect(scopeMatch.ok).toBe(true);
      if (scopeMatch.ok) {
        expect(scopeMatch.value.matched).toBe(5);
        expect(scopeMatch.value.records.every((record) => record.scope === "workspace-a")).toBe(
          true,
        );
      }
      const scopeMiss = readAuditLedger(store, { limit: 10, scope: "workspace-c" });
      expect(scopeMiss.ok && scopeMiss.value.matched).toBe(0);

      const command = readAuditLedger(store, { limit: 10, command: "status" });
      expect(command.ok && command.value.records.map((record) => record.runId)).toEqual([
        "run-read-01",
        "run-read-04",
      ]);

      const outcome = readAuditLedger(store, { limit: 10, outcomeClass: "platform-provider" });
      expect(outcome.ok && outcome.value.records.map((record) => record.runId)).toEqual([
        "run-read-03",
      ]);

      const window = readAuditLedger(store, { limit: 10, from: 2000, to: 4000 });
      expect(window.ok && window.value.records.map((record) => record.startedAt)).toEqual([
        2000, 3000, 4000,
      ]);
      const fromOnly = readAuditLedger(store, { limit: 10, from: 3000 });
      expect(fromOnly.ok && fromOnly.value.records.map((record) => record.startedAt)).toEqual([
        3000, 4000, 5000, 6000,
      ]);
      const toOnly = readAuditLedger(store, { limit: 10, to: 2500 });
      expect(toOnly.ok && toOnly.value.records.map((record) => record.startedAt)).toEqual([
        1000, 2000,
      ]);

      const clipped = readAuditLedger(store, { limit: 2, scope: "workspace-a" });
      expect(clipped.ok).toBe(true);
      if (clipped.ok) {
        expect(clipped.value.records).toHaveLength(2);
        expect(clipped.value.matched).toBe(5);
        expect(clipped.value.truncated).toBe(true);
      }
      const unclipped = readAuditLedger(store, { limit: 50, scope: "workspace-a" });
      expect(unclipped.ok && unclipped.value.truncated).toBe(false);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("reads acquire no fence, write nothing, and leave the store byte-identical", () => {
    const fixture = seedReadStore("read-readonly");
    try {
      const beforeDigest = ledgerDigest(fixture.identity);
      const beforeFiles = listStoreFiles(fixture.identity.stateDirectory);
      const beforeText = readFileSync(ledgerPath(fixture.identity), "utf8");
      for (const query of [
        { limit: 10 },
        { limit: 3, scope: "workspace-a" },
        { limit: 2, from: 2000, to: 5000 },
        { limit: 10, command: "status" },
      ]) {
        const read = readAuditLedger(fixture.store, query);
        expect(read.ok).toBe(true);
        expect(fixture.store.fenceStatus().held).toBe(false);
      }
      expect(ledgerDigest(fixture.identity)).toBe(beforeDigest);
      expect(readFileSync(ledgerPath(fixture.identity), "utf8")).toBe(beforeText);
      expect(listStoreFiles(fixture.identity.stateDirectory)).toEqual(beforeFiles);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-030 torn/unknown classification", () => {
  test("a torn store fails classified even with filters", () => {
    const fixture = seedReadStore("read-torn");
    try {
      appendFileSync(ledgerPath(fixture.identity), '{"broken":');
      const read = readAuditLedger(fixture.store, { limit: 5, scope: "workspace-a" });
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.store.torn");
        expect(read.error.kind).toBe("state");
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("verified-empty is explicit and distinct from torn and unknown", () => {
    const fixture = makeAuditStore("read-empty");
    try {
      const read = readAuditLedger(fixture.store, { limit: 5 });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.verifiedEmpty).toBe(true);
        expect(read.value.records).toEqual([]);
        expect(read.value.chain.verified).toBe(true);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("an unknown payload classification is not masked by filters", () => {
    const fixture = makeAuditStore("read-unknown");
    try {
      seedAuditPairs(fixture.store, 1);
      const acquired = fixture.store.acquireFence("unknown");
      if (acquired.ok) {
        fixture.store.append(acquired.value.handle, {
          kind: AUDIT_INVOCATION_RECORD_KIND,
          recordKey: "audit.invocations",
          payload: { schemaId: "delivery.audit.invocation.v1" },
        });
        fixture.store.releaseFence(acquired.value.handle);
      }
      const read = readAuditLedger(fixture.store, { limit: 5, scope: "workspace-z" });
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.store.unknown");
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-042 exact scope/repo filtering", () => {
  test("scope and repo match exactly and repo-absent records are excluded only when constrained", () => {
    const fixture = makeAuditStore("read-scope-repo");
    try {
      const cases = [
        { runId: "run-a-r1", scope: "A", repo: "R1" },
        { runId: "run-a-absent", scope: "A" },
        { runId: "run-b-r2", scope: "B", repo: "R2" },
        { runId: "run-a-r2", scope: "A", repo: "R2" },
      ] as const;
      for (const entry of cases) {
        const read = appendThrough(fixture.store, {
          runId: entry.runId,
          command: "status",
          scope: entry.scope,
          ...("repo" in entry ? { repo: entry.repo } : {}),
        });
        expect(read).toBe(true);
      }

      const scopeA = readAuditLedger(fixture.store, { limit: 10, scope: "A" });
      expect(scopeA.ok && scopeA.value.records.map((record) => record.runId)).toEqual([
        "run-a-r1",
        "run-a-absent",
        "run-a-r2",
      ]);
      const aR1 = readAuditLedger(fixture.store, { limit: 10, scope: "A", repo: "R1" });
      expect(aR1.ok && aR1.value.records.map((record) => record.runId)).toEqual(["run-a-r1"]);
      const r2 = readAuditLedger(fixture.store, { limit: 10, repo: "R2" });
      expect(r2.ok && r2.value.records.map((record) => record.runId)).toEqual([
        "run-b-r2",
        "run-a-r2",
      ]);
      const caseMiss = readAuditLedger(fixture.store, { limit: 10, scope: "a" });
      expect(caseMiss.ok && caseMiss.value.matched).toBe(0);
      const prefixMiss = readAuditLedger(fixture.store, { limit: 10, repo: "R" });
      expect(prefixMiss.ok && prefixMiss.value.matched).toBe(0);
      const unfiltered = readAuditLedger(fixture.store, { limit: 10 });
      expect(unfiltered.ok && unfiltered.value.records.map((record) => record.runId)).toEqual([
        "run-a-r1",
        "run-a-absent",
        "run-b-r2",
        "run-a-r2",
      ]);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

const appendThrough = (
  store: Parameters<typeof appendAuditInvocation>[0],
  overrides: Partial<AuditInvocationFacts>,
): boolean =>
  appendAuditInvocation(store, {
    runId: overrides.runId ?? "run-helper",
    command: overrides.command ?? "status",
    arguments: [overrides.command ?? "status"],
    exitCode: 0,
    timing: { totalMs: 1 },
    resultSchemaVersion: "delivery.result.v1",
    outcomeClass: overrides.outcomeClass ?? "success",
    scope: overrides.scope ?? "workspace-a",
    startedAt: overrides.startedAt ?? 1000,
    ...(overrides.repo === undefined ? {} : { repo: overrides.repo }),
    ...(overrides.agentIdentity === undefined ? {} : { agentIdentity: overrides.agentIdentity }),
  }).ok;
