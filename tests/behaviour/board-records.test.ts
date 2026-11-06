/**
 * TC-SLA-009, TC-SLA-010, and TC-SLA-011 — the EVT-1 decision record is
 * durable, append-only, exactly once per gate identity, and every torn or
 * malformed history fails closed with an existing `state.*` identity.
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync, chmodSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { classifyDomainKind } from "../../packages/cli/src/classify";
import {
  type OwnerGateSlaDecisionRecord,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import { evaluateOwnerGateSla } from "../../packages/core/src/domain/owner-gate-sla";
import {
  appendOwnerGateSlaDecision,
  readOwnerGateSlaDecisions,
} from "../../packages/core/src/state/index";
import {
  BOARD_NOW_ISO,
  BOARD_NOW_MS,
  HOUR_MS,
  shippedPolicy,
  waiverGate,
} from "../fixtures/board/matrix";
import {
  createTestEdge,
  ledgerLines,
  ledgerPath,
  ledgerText,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
  type TestEdge,
} from "../fixtures/state/harness";
import {
  guardStore,
  type LedgerRecord,
  ledgerRecords,
  resealLedgerRecord,
  writeLedgerRecords,
} from "./verify-support";

const decisionFor = (gate = waiverGate("GH-501", 73 * HOUR_MS)): OwnerGateSlaDecisionRecord => {
  const evaluation = evaluateOwnerGateSla({
    audience: "owner",
    nowMs: BOARD_NOW_MS,
    nowIso: BOARD_NOW_ISO,
    policy: shippedPolicy(),
    gates: [gate],
    decisions: [],
  });
  const decision = evaluation.decisionsToApply[0];
  if (decision === undefined) throw new Error("fixture produced no decision");
  return decision;
};

type Ledger = ReturnType<typeof openStore>["store"];

const withLedger = (
  body: (context: {
    readonly store: Ledger;
    readonly identity: ReturnType<typeof makeIdentity>;
    readonly edge: TestEdge;
  }) => void,
): void => {
  const root = makeTempRoot("gh229-records");
  try {
    const identity = makeIdentity(root, { workspaceId: "owner-gate-sla-records" });
    const edge = createTestEdge();
    const { store } = openStore(identity, { edge });
    body({ store, identity, edge });
  } finally {
    removeRoot(root);
  }
};

const appendOne = (store: Ledger, decision: OwnerGateSlaDecisionRecord): void => {
  const appended = appendOwnerGateSlaDecision(store, { decision, fenceToken: "fence-records" });
  if (!appended.ok) throw new Error(appended.error.code);
};

describe("TC-SLA-009 EVT-1 content, durability, and append-only history", () => {
  test("exactly one LF-terminated record lands with the declared closed payload", () => {
    withLedger(({ store, identity }) => {
      const beforeRead = readOwnerGateSlaDecisions(store);
      expect(beforeRead.ok).toBe(true);
      if (beforeRead.ok) {
        expect(beforeRead.value.verifiedEmpty).toBe(true);
        expect(beforeRead.value.recordCount).toBe(0);
      }
      const before = existsSync(ledgerPath(identity)) ? ledgerText(identity) : "";
      const decision = decisionFor();
      appendOne(store, decision);
      const after = ledgerText(identity);
      expect(after.startsWith(before)).toBe(true);
      expect(ledgerLines(after)).toHaveLength(1);
      expect(after.endsWith("\n")).toBe(true);

      const ledger = ledgerRecords(identity)[0];
      expect(ledger?.kind).toBe("owner-gate.decision");
      expect(ledger?.key).toBe(`owner-gate.decisions:${decision.gateId}`);
      expect(ledger?.sequence).toBe(1);
      expect(typeof ledger?.checksum).toBe("string");
      const payload = ledger?.payload as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(
        [
          "appliedAt",
          "appliedDefault",
          "clockSource",
          "gateId",
          "gateKind",
          "schemaId",
          "thresholdCrossedMs",
          "workItemRef",
        ].sort(),
      );
      expect(payload).not.toHaveProperty("title");
      expect(payload).not.toHaveProperty("body");
      expect(payload).not.toHaveProperty("comment");
      expect(payload).not.toHaveProperty("credential");
    });
  });

  test("a reopened store returns the same durable record through a verified read", () => {
    withLedger(({ store, identity }) => {
      const decision = decisionFor();
      appendOne(store, decision);
      const reopened = openStore(identity).store;
      const read = readOwnerGateSlaDecisions(reopened);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.recordCount).toBe(1);
        expect(read.value.records[0]).toEqual(decision);
      }
    });
  });

  test("the state schema version is unchanged and no derived document is replaced", () => {
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    withLedger(({ store, identity }) => {
      appendOne(store, decisionFor());
      expect(
        readdirSync(identity.stateDirectory).filter((name) => name.startsWith("documents.")),
      ).toEqual([]);
      expect(existsSync(`${identity.stateDirectory}/provider-parks.json`)).toBe(false);
    });
  });

  test("privacy canaries and a planted credential never enter the ledger bytes", () => {
    withLedger(({ store, identity }) => {
      const gate = waiverGate("GH-502", 73 * HOUR_MS, { waivedBy: "planted-board-waiver" });
      appendOne(store, decisionFor(gate));
      const text = readFileSync(ledgerPath(identity), "utf8");
      expect(text).not.toContain("planted-board-waiver");
      expect(text).not.toContain("planted-board-credential");
    });
  });
});

describe("TC-SLA-010 idempotency by gate identity", () => {
  test("the first application is authoritative and a replay is a no-op", () => {
    withLedger(({ store, identity }) => {
      const decision = decisionFor();
      appendOne(store, decision);
      const lines = ledgerLines(ledgerText(identity)).length;
      const replay = appendOwnerGateSlaDecision(store, {
        decision,
        fenceToken: "fence-replay",
      });
      expect(replay.ok).toBe(true);
      if (replay.ok) {
        expect(replay.value.appended).toBe(false);
        expect(replay.value.record).toEqual(decision);
      }
      expect(ledgerLines(ledgerText(identity)).length).toBe(lines);
      expect(readOwnerGateSlaDecisions(store).ok).toBe(true);
    });
  });

  test("a process-boundary reopen replay is also a no-op with exactly one record", () => {
    withLedger(({ store, identity }) => {
      const decision = decisionFor();
      appendOne(store, decision);
      const reopened = openStore(identity).store;
      const replay = appendOwnerGateSlaDecision(reopened, {
        decision,
        fenceToken: "fence-reopened-replay",
      });
      expect(replay.ok).toBe(true);
      if (replay.ok) expect(replay.value.appended).toBe(false);
      const read = readOwnerGateSlaDecisions(reopened);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.recordCount).toBe(1);
    });
  });

  test("the recorded default wins over a changed policy after application", () => {
    withLedger(({ store }) => {
      const decision = decisionFor(waiverGate("GH-503", 73 * HOUR_MS));
      appendOne(store, decision);
      const read = readOwnerGateSlaDecisions(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const evaluation = evaluateOwnerGateSla({
        audience: "owner",
        nowMs: BOARD_NOW_MS,
        nowIso: BOARD_NOW_ISO,
        policy: {
          comparator: ">=",
          escalationThresholdMs: 24 * HOUR_MS,
          expiryThresholdMs: 72 * HOUR_MS,
          rows: [
            {
              kind: "waiver",
              class: "waiver",
              neverMerge: false,
              defaultable: false,
              default: null,
            },
          ],
        },
        gates: [waiverGate("GH-503", 73 * HOUR_MS)],
        decisions: read.value.records,
      });
      expect(evaluation.gates[0]?.slaState).toBe("default-applied");
      expect(evaluation.gates[0]?.default).toBe("owner-review-first");
      expect(evaluation.decisionsToApply).toEqual([]);
    });
  });

  test("distinct gate identities are never over-suppressed", () => {
    withLedger(({ store }) => {
      const first = decisionFor(waiverGate("GH-504", 73 * HOUR_MS));
      const second = decisionFor(waiverGate("GH-504-v2", 73 * HOUR_MS));
      expect(first.gateId).not.toBe(second.gateId);
      appendOne(store, first);
      appendOne(store, second);
      const read = readOwnerGateSlaDecisions(store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.recordCount).toBe(2);
    });
  });

  test("stable gate ids under reversed facts produce one record per gate", () => {
    withLedger(({ store }) => {
      const gates = [waiverGate("GH-505", 73 * HOUR_MS), waiverGate("GH-506", 73 * HOUR_MS)];
      for (const gate of gates) appendOne(store, decisionFor(gate));
      for (const gate of [...gates].reverse()) {
        const replay = appendOwnerGateSlaDecision(store, {
          decision: decisionFor(gate),
          fenceToken: "fence-stable",
        });
        expect(replay.ok).toBe(true);
        if (replay.ok) expect(replay.value.appended).toBe(false);
      }
      const read = readOwnerGateSlaDecisions(store);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.recordCount).toBe(2);
        expect(new Set(read.value.records.map((record) => record.gateId)).size).toBe(2);
      }
    });
  });

  test("a deliberately duplicated append is detected as torn, not silently accepted", () => {
    withLedger(({ store }) => {
      const decision = decisionFor();
      appendOne(store, decision);
      const acquired = store.acquireFence("fence-duplicate");
      expect(acquired.ok).toBe(true);
      if (!acquired.ok) return;
      const duplicated = store.append(acquired.value.handle, {
        kind: "owner-gate.decision",
        recordKey: `owner-gate.decisions:${decision.gateId}`,
        payload: {
          schemaId: decision.schemaId,
          gateId: decision.gateId,
          gateKind: decision.gateKind,
          workItemRef: decision.workItemRef,
          appliedDefault: decision.appliedDefault,
          appliedAt: decision.appliedAt,
          thresholdCrossedMs: decision.thresholdCrossedMs,
          clockSource: decision.clockSource,
        },
      });
      expect(duplicated.ok).toBe(true);
      store.releaseFence(acquired.value.handle);
      const read = readOwnerGateSlaDecisions(store);
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.store.torn");
    });
  });
});

describe("TC-SLA-011 torn and malformed history fails closed", () => {
  const tornCases: Array<{
    readonly label: string;
    readonly mutate: (records: LedgerRecord[]) => void;
  }> = [
    {
      label: "wrong kind",
      mutate: (records) => {
        const record = records[0];
        if (record !== undefined) record.kind = "document";
      },
    },
    {
      label: "missing field",
      mutate: (records) => {
        const record = records[0];
        if (record === undefined) return;
        const payload = record.payload as Record<string, unknown>;
        delete payload.gateId;
        resealLedgerRecord(record);
      },
    },
    {
      label: "undeclared default",
      mutate: (records) => {
        const record = records[0];
        if (record === undefined) return;
        const payload = record.payload as Record<string, unknown>;
        payload.appliedDefault = "invented-default";
        resealLedgerRecord(record);
      },
    },
    {
      label: "checksum mismatch",
      mutate: (records) => {
        const record = records[0];
        if (record === undefined) return;
        const payload = record.payload as Record<string, unknown>;
        payload.gateKind = "waiver-v2";
      },
    },
  ];

  for (const testCase of tornCases) {
    test(`${testCase.label} is classified as state.store.torn with zero appends`, () => {
      withLedger(({ store, identity }) => {
        appendOne(store, decisionFor());
        const records = ledgerRecords(identity);
        testCase.mutate(records);
        writeLedgerRecords(identity, records);
        const recorder = { calls: [] as string[] };
        const guarded = guardStore(store, recorder, { throwOnMutation: false });
        const read = readOwnerGateSlaDecisions(guarded.store);
        expect(read.ok).toBe(false);
        if (!read.ok) expect(read.error.code).toBe("state.store.torn");
        const append = appendOwnerGateSlaDecision(guarded.store, {
          decision: decisionFor(),
          fenceToken: "fence-torn",
        });
        expect(append.ok).toBe(false);
        if (!append.ok) expect(append.error.code).toBe("state.store.torn");
        expect(recorder.calls).not.toContain("append");
        expect(recorder.calls).not.toContain("acquireFence");
      });
    });
  }

  test("a truncated final line is classified as torn, never verified-empty", () => {
    withLedger(({ store, identity }) => {
      appendOne(store, decisionFor());
      appendFileSync(ledgerPath(identity), "{not-json}\n");
      const read = readOwnerGateSlaDecisions(store);
      expect(read.ok).toBe(false);
      if (!read.ok) expect(read.error.code).toBe("state.store.torn");
    });
  });

  test("permission denial keeps state.permission.denied and appends nothing", () => {
    withLedger(({ store, identity }) => {
      appendOne(store, decisionFor());
      chmodSync(identity.stateDirectory, 0o755);
      const violated = openStore(identity).store;
      const read = readOwnerGateSlaDecisions(violated);
      expect(read.ok).toBe(false);
      if (!read.ok) {
        expect(read.error.code).toBe("state.permission.denied");
        expect(classifyDomainKind("state", read.error.code).projectionClass).toBe(
          "user-validation",
        );
      }
      chmodSync(identity.stateDirectory, 0o700);
    });
  });

  test("fence contention keeps state.lock.busy, applies nothing, and duplicates nothing", () => {
    withLedger(({ store }) => {
      const other = store;
      const held = other.acquireFence("fence-held");
      expect(held.ok).toBe(true);
      if (!held.ok) return;
      const append = appendOwnerGateSlaDecision(store, {
        decision: decisionFor(),
        fenceToken: "fence-blocked",
      });
      expect(append.ok).toBe(false);
      if (!append.ok) {
        expect(append.error.code).toBe("state.lock.busy");
        expect(classifyDomainKind("state", append.error.code).projectionClass).toBe(
          "platform-provider",
        );
      }
      other.releaseFence(held.value.handle);
    });
  });

  test("a read-only invocation performs zero fences and zero appends", () => {
    withLedger(({ store }) => {
      const recorder = { calls: [] as string[] };
      const guarded = guardStore(store, recorder, { throwOnMutation: false });
      const read = readOwnerGateSlaDecisions(guarded.store);
      expect(read.ok).toBe(true);
      expect(recorder.calls).not.toContain("append");
      expect(recorder.calls).not.toContain("acquireFence");
    });
  });

  test("a gate already 100 h old on first sight applies exactly once", () => {
    withLedger(({ store }) => {
      const decision = decisionFor(waiverGate("GH-510", 100 * HOUR_MS));
      appendOne(store, decision);
      appendOne(store, decision);
      const read = readOwnerGateSlaDecisions(store);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.recordCount).toBe(1);
    });
  });
});
