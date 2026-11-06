/**
 * TC-GH223-005 (assembly/field-set/boundary/two-phase order) and
 * TC-GH223-006 (re-run) — the audit consumer composes the public state port
 * and writes a reservation then its invocation under one shared fence.
 */
import { describe, expect, test } from "bun:test";
import {
  AUDIT_CHAIN_ANCHOR,
  AUDIT_INVOCATION_FIELDS,
  AUDIT_INVOCATION_PAYLOAD_SCHEMA,
  AUDIT_INVOCATION_RECORD_KIND,
  AUDIT_RESERVATION_PAYLOAD_SCHEMA,
  AUDIT_RESERVATION_RECORD_KIND,
  type AuditInvocationFacts,
  type StateStorePort,
} from "../../packages/core/src/contracts/index";
import {
  appendAuditInvocation,
  assembleAuditInvocation,
  assembleAuditReservation,
  auditChainValue,
  createAuditBoundary,
  readAuditChainKey,
  readAuditLedger,
  verifyAuditChain,
} from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  auditFactsFor,
  auditPairsOf,
  auditRecordsOf,
  invocationPayloadsOf,
  makeAuditStore,
  readKeyArtifactValue,
  removeRoot,
  reservationPayloadsOf,
  seedAuditPairs,
} from "../fixtures/state/harness";

const invocationKeys = (payload: Record<string, unknown>): string[] => Object.keys(payload);

describe("TC-GH223-005 audit assembly and field sets", () => {
  test("the pure assembly emits the exact reservation and invocation payloads", () => {
    const key = "a".repeat(64);
    const reservation = assembleAuditReservation(1, "run-1", key, AUDIT_CHAIN_ANCHOR);
    expect(Object.keys(reservation)).toEqual(["schemaId", "auditSeq", "runId", "chainValue"]);
    expect(reservation.schemaId).toBe(AUDIT_RESERVATION_PAYLOAD_SCHEMA);
    expect(reservation.chainValue.length).toBeGreaterThan(0);

    const facts = auditFactsFor({ runId: "run-1", repo: "repo-1" });
    const invocation = assembleAuditInvocation(facts, 1, key, reservation.chainValue);
    expect(invocationKeys(invocation as unknown as Record<string, unknown>).sort()).toEqual(
      ["schemaId", ...AUDIT_INVOCATION_FIELDS.filter((field) => field !== "agentIdentity")].sort(),
    );
    expect(invocation.resultSchemaVersion).toBe("delivery.result.v1");
    expect(invocation.resultSchemaVersion).not.toBe(AUDIT_INVOCATION_PAYLOAD_SCHEMA);
    expect(invocation.repo).toBe("repo-1");
    expect(invocation.chainValue).not.toBe(reservation.chainValue);
  });

  test("assembled invocation chains from its reservation, not from the anchor", () => {
    const key = "b".repeat(64);
    const reservation = assembleAuditReservation(2, "run-2", key, "previous-link");
    const facts = auditFactsFor({ runId: "run-2" });
    const invocation = assembleAuditInvocation(facts, 2, key, reservation.chainValue);
    const content: Record<string, unknown> = {
      ...(invocation as unknown as Record<string, unknown>),
    };
    delete content.chainValue;
    expect(auditChainValue(key, reservation.chainValue, content as never)).toBe(
      invocation.chainValue,
    );
  });

  test("a stored pair shares one ordinal and the reservation immediately precedes it", () => {
    const fixture = makeAuditStore("field-sets");
    try {
      const appended = appendAuditFacts(fixture.store, {
        runId: "run-fields",
        repo: "repo-1",
        startedAt: 5000,
      });
      expect(appended.ok).toBe(true);
      if (!appended.ok) return;
      expect(appended.value.auditSeq).toBe(1);
      expect(appended.value.invocationSequence).toBe(appended.value.reservationSequence + 1);

      const records = auditRecordsOf(fixture.store);
      expect(records.map((record) => record.kind)).toEqual([
        AUDIT_RESERVATION_RECORD_KIND,
        AUDIT_INVOCATION_RECORD_KIND,
      ]);
      const [reservation] = reservationPayloadsOf(fixture.store);
      const [invocation] = invocationPayloadsOf(fixture.store);
      if (reservation === undefined || invocation === undefined) throw new Error("pair missing");
      expect(Object.keys(reservation)).toEqual(["schemaId", "auditSeq", "runId", "chainValue"]);
      expect(reservation.auditSeq).toBe(invocation.auditSeq);
      expect(reservation.runId).toBe("run-fields");
      expect(Object.hasOwn(reservation, "arguments")).toBe(false);
      expect(Object.hasOwn(reservation, "outcomeClass")).toBe(false);
      expect(Object.hasOwn(reservation, "agentIdentity")).toBe(false);

      expect(invocation.scope).toBe("workspace-a");
      expect(invocation.repo).toBe("repo-1");
      expect(invocation.startedAt).toBe(5000);
      expect(invocation.resultSchemaVersion).toBe("delivery.result.v1");
      expect(invocation.outcomeClass).toBe("success");
      expect(Object.hasOwn(invocation, "agentIdentity")).toBe(false);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("repo is absent (not null or empty) when the command has no target", () => {
    const fixture = makeAuditStore("no-repo");
    try {
      appendAuditFacts(fixture.store, { runId: "run-no-repo" });
      const [invocation] = invocationPayloadsOf(fixture.store);
      expect(invocation).toBeDefined();
      expect(Object.hasOwn(invocation as Record<string, unknown>, "repo")).toBe(false);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the boundary refuses a missing field, wrong schema, wrong repo type, and reservation metadata", () => {
    const fixture = makeAuditStore("boundary");
    try {
      const boundary = createAuditBoundary(fixture.store);
      const acquired = fixture.store.acquireFence("boundary-test");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      try {
        const handle = acquired.value.handle;
        const key = "c".repeat(64);
        const reservation = assembleAuditReservation(1, "run-b", key, AUDIT_CHAIN_ANCHOR);
        const invocation = assembleAuditInvocation(
          auditFactsFor({ runId: "run-b", startedAt: 1000 }),
          1,
          key,
          reservation.chainValue,
        );
        const attempts = [
          boundary.append(handle, {
            kind: AUDIT_RESERVATION_RECORD_KIND,
            recordKey: "audit.invocations",
            payload: { ...reservation, arguments: ["x"] } as never,
          }),
          boundary.append(handle, {
            kind: AUDIT_INVOCATION_RECORD_KIND,
            recordKey: "audit.invocations",
            payload: { ...invocation, schemaId: "delivery.audit.invocation.v2" } as never,
          }),
          boundary.append(handle, {
            kind: AUDIT_INVOCATION_RECORD_KIND,
            recordKey: "audit.invocations",
            payload: { ...invocation, repo: 7 } as never,
          }),
          boundary.append(handle, {
            kind: AUDIT_INVOCATION_RECORD_KIND,
            recordKey: "audit.invocations",
            payload: { ...invocation, outcomeClass: "mystery" } as never,
          }),
          boundary.append(handle, {
            kind: AUDIT_INVOCATION_RECORD_KIND,
            recordKey: "audit.invocations",
            payload: { ...invocation, auditSeq: undefined } as never,
          }),
        ];
        for (const attempt of attempts) {
          expect(attempt.ok).toBe(false);
          if (!attempt.ok) expect(attempt.error.code).toBe("state.store.unknown");
        }
      } finally {
        fixture.store.releaseFence(acquired.value.handle);
      }
      expect(auditRecordsOf(fixture.store)).toEqual([]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("one fence acquisition orders read, reservation append, invocation append, release", () => {
    const fixture = makeAuditStore("call-order");
    try {
      const calls: string[] = [];
      const real = fixture.store;
      const spy: StateStorePort = {
        identity: real.identity,
        read: (request) => {
          calls.push("read");
          return real.read(request);
        },
        readRecords: () => {
          calls.push("readRecords");
          return real.readRecords();
        },
        append: (handle, request) => {
          calls.push(`append:${request.kind}`);
          return real.append(handle, request);
        },
        replaceDocument: (handle, request) => real.replaceDocument(handle, request),
        acquireFence: (token) => {
          calls.push("acquireFence");
          return real.acquireFence(token);
        },
        releaseFence: (handle) => {
          calls.push("releaseFence");
          return real.releaseFence(handle);
        },
        fenceStatus: () => real.fenceStatus(),
        recoverFence: (token) => real.recoverFence(token),
        checkIntegrity: () => real.checkIntegrity(),
        repairTornTail: () => real.repairTornTail(),
        salvage: (handle) => real.salvage(handle),
        readStoreArtifact: (request) => real.readStoreArtifact(request),
        ensureStoreArtifact: (request) => real.ensureStoreArtifact(request),
      };
      const appended = appendAuditInvocation(spy, auditFactsFor({ runId: "run-order" }));
      expect(appended.ok).toBe(true);
      expect(calls.filter((call) => call === "acquireFence")).toHaveLength(1);
      expect(calls.filter((call) => call === "releaseFence")).toHaveLength(1);
      const firstRead = calls.indexOf("readRecords");
      const reservationAppend = calls.indexOf(`append:${AUDIT_RESERVATION_RECORD_KIND}`);
      const invocationAppend = calls.indexOf(`append:${AUDIT_INVOCATION_RECORD_KIND}`);
      const release = calls.indexOf("releaseFence");
      expect(firstRead).toBeGreaterThan(-1);
      expect(reservationAppend).toBeGreaterThan(firstRead);
      expect(invocationAppend).toBeGreaterThan(reservationAppend);
      expect(release).toBeGreaterThan(invocationAppend);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-006 identical re-run appends a second pair", () => {
  test("two runs produce two pairs with distinct runIds, timestamps, and ordinals", () => {
    const fixture = makeAuditStore("rerun");
    try {
      const facts = (runId: string, startedAt: number): AuditInvocationFacts =>
        auditFactsFor({ runId, startedAt });
      const first = appendAuditInvocation(fixture.store, facts("run-gh223-0101", 1000));
      const second = appendAuditInvocation(fixture.store, facts("run-gh223-0102", 2000));
      expect(first.ok && second.ok).toBe(true);
      if (!first.ok || !second.ok) return;
      expect(first.value.auditSeq).toBe(1);
      expect(second.value.auditSeq).toBe(2);

      const pairs = auditPairsOf(fixture.store);
      expect(pairs).toHaveLength(2);
      expect(pairs.map((pair) => pair.invocation.runId)).toEqual([
        "run-gh223-0101",
        "run-gh223-0102",
      ]);
      expect(pairs.map((pair) => pair.invocation.startedAt)).toEqual([1000, 2000]);
      expect(pairs[0]?.invocation.command).toBe(pairs[1]?.invocation.command);
      expect(reservationPayloadsOf(fixture.store)).toHaveLength(2);
      expect(invocationPayloadsOf(fixture.store)).toHaveLength(2);

      const chain = verifyAuditChain(fixture.store);
      expect(chain.ok).toBe(true);
      if (chain.ok) {
        expect(chain.value.verified).toBe(true);
        expect(chain.value.breaks).toEqual([]);
      }
      const key = readAuditChainKey(fixture.store);
      expect(key.ok).toBe(true);
      if (key.ok) expect(readKeyArtifactValue(fixture.identity)).toBe(key.value);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-008 additive kinds interleave safely", () => {
  test("audit pairs interleave with another consumer without ordinal gaps", () => {
    const fixture = makeAuditStore("interleave");
    try {
      const acquired = fixture.store.acquireFence("seed-other");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      fixture.store.append(acquired.value.handle, {
        kind: "phase.transition",
        recordKey: "phase.transitions:GH-223",
        payload: { phase: "delivery" },
      });
      fixture.store.releaseFence(acquired.value.handle);

      seedAuditPairs(fixture.store, 3);
      const again = fixture.store.acquireFence("seed-other-2");
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      fixture.store.append(again.value.handle, {
        kind: "closeout.operation",
        recordKey: "closeout.operations:GH-223",
        payload: { operation: "noop" },
      });
      fixture.store.releaseFence(again.value.handle);

      const pairs = auditPairsOf(fixture.store);
      expect(pairs.map((pair) => pair.auditSeq)).toEqual([1, 2, 3]);
      const chain = verifyAuditChain(fixture.store);
      expect(chain.ok).toBe(true);
      if (chain.ok) {
        expect(chain.value.verified).toBe(true);
        expect(chain.value.breaks).toEqual([]);
      }
      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.records.map((record) => record.runId)).toHaveLength(3);
      expect(auditRecordsOf(fixture.store)).toHaveLength(6);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
