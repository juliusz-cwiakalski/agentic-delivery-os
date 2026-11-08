/**
 * TC-STATE-003/006 / TC-CONC-002/003 / TC-VOCAB-004/008 (state halves) — the
 * world rebuilds from verified state; intents apply exactly once; callerPrincipal
 * is additive and historical records stay readable.
 */
import { describe, expect, test } from "bun:test";
import { createBlockerAnswerConsumer } from "../../packages/cli/src/daemon-compose";
import {
  appendDaemonLane,
  declareQueueEntry,
  readDaemonLanes,
  readQueueEntries,
  reconcileDaemon,
} from "../../packages/core/src/app/index";
import {
  DAEMON_LANE_PAYLOAD_SCHEMA,
  type DaemonLaneRecord,
  LOCAL_CALLER_PRINCIPAL,
  QUEUE_ENTRY_SCHEMA,
} from "../../packages/core/src/contracts/index";
import {
  appendBlockerAnswer,
  appendBlockerQuestion,
  readBlockerLedger,
} from "../../packages/core/src/state/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-08T10:00:00Z";

describe("GH-238 daemon-down state mediation", () => {
  test("queue intents land daemon-down, replay idempotently, and are reconciled once", () => {
    const root = makeTempRoot("gh238-mediation");
    try {
      const { store } = openStore(makeIdentity(root));
      const first = declareQueueEntry(store, {
        ref: "GH-1",
        priority: 10,
        recordedAt: NOW,
        fenceToken: "f1",
      });
      const replay = declareQueueEntry(store, {
        ref: "GH-1",
        priority: 10,
        recordedAt: NOW,
        fenceToken: "f2",
      });
      const other = declareQueueEntry(store, {
        ref: "GH-2",
        priority: 20,
        recordedAt: NOW,
        fenceToken: "f3",
      });
      expect(first.ok && replay.ok && other.ok).toBe(true);
      const entries = readQueueEntries(store);
      expect(entries.ok).toBe(true);
      if (entries.ok) expect(entries.records).toHaveLength(2);
      const lane: DaemonLaneRecord = {
        schema: DAEMON_LANE_PAYLOAD_SCHEMA,
        ref: "GH-1",
        state: "delivering",
        spawnOrdinal: 1,
        recordedAt: NOW,
      };
      expect(appendDaemonLane(store, "seed", lane).ok).toBe(true);
      const result = reconcileDaemon({
        store,
        fenceToken: "recon",
        instanceId: "instance-a",
        nowIso: NOW,
        restartBound: 3,
        reconcileMaxLanes: 200,
        recover: {
          readRestarts: () => ({ ok: true, records: [] }),
          appendRestart: (record) => ({ ok: true, appended: true, record }),
          ensureExhaustion: (record) => ({ ok: true, appended: true, record }),
          raiseQuestion: () => ({ ok: true, questionId: "q" }),
        },
        evidence: () => ({ processObservable: true }),
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.record.queue.entries).toBe(2);
    } finally {
      removeRoot(root);
    }
  });

  test("callerPrincipal is written on new intent records and historical records still read", () => {
    const root = makeTempRoot("gh238-principal");
    try {
      const { store } = openStore(makeIdentity(root));
      const question = appendBlockerQuestion(store, {
        fenceToken: "q1",
        record: {
          schemaId: "delivery.blocker.question.v1",
          id: "Q-1",
          type: "decision-needed",
          audience: "coordinator",
          lane: "lane-a",
          ref: "GH-1",
          question: "Which option?",
          options: ["a", "b"],
          askedAt: NOW,
        },
      });
      expect(question.ok).toBe(true);
      const answer = appendBlockerAnswer(store, {
        fenceToken: "q2",
        record: {
          schemaId: "delivery.blocker.answer.v1",
          questionId: "Q-1",
          answeringAudience: "coordinator",
          choice: "a",
          answeredAt: NOW,
          applied: false,
          laneResume: {
            mode: "boundary-note",
            sessionReentry: false,
            capabilitySource: "adapter-declared",
          },
        },
      });
      expect(answer.ok).toBe(true);
      const ledger = readBlockerLedger(store);
      expect(ledger.ok).toBe(true);
      if (ledger.ok) {
        expect(ledger.value.questions[0]?.callerPrincipal).toEqual(LOCAL_CALLER_PRINCIPAL);
        expect(ledger.value.answers[0]?.callerPrincipal).toEqual(LOCAL_CALLER_PRINCIPAL);
        expect(ledger.value.answers[0]?.applied).toBe(false);
        expect(ledger.value.answers[0]?.laneResume.mode).toBe("boundary-note");
      }
      // A historical queue entry without callerPrincipal remains readable.
      const acquired = store.acquireFence("historical");
      expect(acquired.ok).toBe(true);
      if (acquired.ok) {
        const appended = store.append(acquired.value.handle, {
          kind: "queue.entry",
          recordKey: "queue.entries:GH-999",
          payload: {
            schema: QUEUE_ENTRY_SCHEMA,
            ref: "GH-999",
            priority: 1,
            recordedAt: NOW,
          },
        });
        expect(appended.ok).toBe(true);
        store.releaseFence(acquired.value.handle);
      }
      const entries = readQueueEntries(store);
      expect(entries.ok).toBe(true);
      if (entries.ok) expect(entries.records[0]?.callerPrincipal).toBeUndefined();
    } finally {
      removeRoot(root);
    }
  });

  test("an existing store opens verified-empty for daemon keys and keeps them unmodified", () => {
    const root = makeTempRoot("gh238-verified-empty");
    try {
      const { store } = openStore(makeIdentity(root));
      expect(
        declareQueueEntry(store, { ref: "GH-1", priority: 1, recordedAt: NOW, fenceToken: "f" }).ok,
      ).toBe(true);
      const lanes = readDaemonLanes(store);
      expect(lanes.ok).toBe(true);
      if (lanes.ok) {
        expect(lanes.verifiedEmpty).toBe(true);
        expect(lanes.records).toHaveLength(0);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a blocker answer records a lane resume intent only when a lane exists", () => {
    const root = makeTempRoot("gh238-blocker-resume");
    try {
      const { store } = openStore(makeIdentity(root));
      expect(
        appendBlockerQuestion(store, {
          fenceToken: "q1",
          record: {
            schemaId: "delivery.blocker.question.v1",
            id: "Q-1",
            type: "decision-needed",
            audience: "coordinator",
            lane: "GH-1",
            ref: "GH-1",
            question: "Which option?",
            options: ["a", "b"],
            askedAt: NOW,
          },
        }).ok,
      ).toBe(true);
      expect(
        appendBlockerAnswer(store, {
          fenceToken: "q2",
          record: {
            schemaId: "delivery.blocker.answer.v1",
            questionId: "Q-1",
            answeringAudience: "coordinator",
            choice: "a",
            answeredAt: NOW,
            applied: false,
            laneResume: {
              mode: "boundary-note",
              sessionReentry: false,
              capabilitySource: "adapter-declared",
            },
          },
        }).ok,
      ).toBe(true);
      const consumer = createBlockerAnswerConsumer({
        store,
        newFenceToken: () => "resume-fence",
        nowIso: () => NOW,
      });
      expect(consumer()).toEqual({ ok: true, recorded: 0 });
      expect(
        appendDaemonLane(store, "lane-seed", {
          schema: DAEMON_LANE_PAYLOAD_SCHEMA,
          ref: "GH-1",
          state: "delivering",
          sessionId: "session-1",
          spawnOrdinal: 1,
          recordedAt: NOW,
        }).ok,
      ).toBe(true);
      expect(consumer()).toEqual({ ok: true, recorded: 1 });
      const lanes = readDaemonLanes(store);
      expect(lanes.ok).toBe(true);
      if (lanes.ok) {
        expect(lanes.latest?.resumeIntent).toEqual({ questionId: "Q-1", mode: "boundary-note" });
      }
      const ledger = readBlockerLedger(store);
      if (ledger.ok) expect(ledger.value.answers[0]?.applied).toBe(false);
      expect(consumer()).toEqual({ ok: true, recorded: 0 });
    } finally {
      removeRoot(root);
    }
  });
});
