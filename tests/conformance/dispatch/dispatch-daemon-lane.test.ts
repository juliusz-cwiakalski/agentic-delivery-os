/**
 * TC-DAEMON-002 (phase 9) — a daemon-driven lane starts, records, observes,
 * collects, and resumes through the delivered seam; the daemon path appends
 * exactly one attempt record that agrees field-for-field with a one-shot
 * dispatch over the same evidence, and a replay/resume appends none.
 */
import { describe, expect, test } from "bun:test";
import { runDispatch } from "../../../packages/core/src/app/dispatch";
import { recordDaemonDispatchResult } from "../../../packages/core/src/app/daemon-dispatch-result";
import { readDispatchAttempts } from "../../../packages/core/src/app/dispatch-ledger";
import { runSupervisionCycle } from "../../../packages/core/src/app/daemon-supervision";
import { createLaneLaunchPlanner } from "../../../packages/core/src/domain/lane-launch-plan";
import { createLaneExecutor } from "../../../packages/adapters/src/daemon/lane-executor";
import {
  COMPLETED_EVIDENCE,
  createDispatchState,
  createScriptedHarness,
} from "../../fixtures/dispatch/harness";
import { readsFrom } from "../../fixtures/dispatch/golden/harness";

const NOW = "2026-11-08T10:00:00.000Z";
const repository = "github.com/owner/repo";
const descriptor = { kind: "host" as const, workDirectory: "/tmp", environment: [] };

const readAttempts = (store: ReturnType<typeof createDispatchState>["store"]) => {
  const read = readDispatchAttempts(store);
  if (!read.ok) throw new Error("attempt read failed");
  return read.records;
};

/** Run the one-shot path over the same evidence and truth reads. */
const oneShotRecord = async () => {
  const state = createDispatchState("daemon-one-shot");
  try {
    const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
    const result = await runDispatch({
      store: state.store,
      fenceToken: state.fenceToken,
      harness: scripted.port,
      harnessKind: "opencode",
      descriptor,
      prompt: "deliver GH-239",
      ref: "GH-239",
      evidenceClass: "pilot",
      repository,
      handoverState: "dual-run",
      nowIso: () => NOW,
      newAttemptId: () => "attempt-one-shot",
      newDivergenceId: () => "DIV-ONE-SHOT",
      readTruth: async () => readsFrom(),
      claimLease: () => ({ ok: true, leaseId: "lease-1" }),
      releaseLease: () => true,
      phaseLedger: { completed: 3, total: 9, variant: "full" },
    });
    if (!result.ok) throw new Error(`one-shot failed: ${result.error.code}`);
    return result.attempt;
  } finally {
    state.dispose();
  }
};

describe("TC-DAEMON-002 daemon lane matches one-shot classification and recording", () => {
  test("the lane starts, records, observes, collects, resumes, and records once", async () => {
    const state = createDispatchState("daemon-lane");
    try {
      const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
      const executor = createLaneExecutor({
        session: scripted.port,
        planner: createLaneLaunchPlanner({
          declaredEnvironment: ["HOME"],
          lifecyclePrompt: (request) => `deliver ${request.ref}`,
        }),
        descriptor,
      });
      const reads = readsFrom();
      const result = await runSupervisionCycle({
        store: state.store,
        fenceToken: state.fenceToken,
        ports: {
          executor,
          nextAction: () => ({ ref: "GH-239", repository, weightClass: "standard" }),
          claim: () => ({ ok: true, leaseId: "lease-1" }),
          release: () => true,
          nowIso: () => NOW,
          onCollected: async ({ action, lane, handle, collected }) => {
            recordDaemonDispatchResult({
              store: state.store,
              fenceToken: state.fenceToken,
              ref: action.ref,
              repository,
              sessionId: handle.sessionId,
              spawnOrdinal: lane.spawnOrdinal,
              harnessKind: "opencode",
              evidenceClass: "pilot",
              handoverState: "dual-run",
              evidence: COMPLETED_EVIDENCE,
              collected,
              reads,
              nowIso: NOW,
              newDivergenceId: () => "DIV-DAEMON",
            });
          },
        },
      });
      expect(result.mode).toBe("completed");
      expect(scripted.calls).toContain("spawn");
      expect(scripted.calls).toContain("collect");

      const attempts = readAttempts(state.store);
      expect(attempts).toHaveLength(1);
      expect(attempts[0]?.attemptId).toContain("daemon-GH-239-session-1-");

      // A resume through the executor adds no second record for the same attempt.
      const handle = { sessionId: "session-1", harnessKind: "opencode" };
      expect(await executor.resume({ handle, mode: "attach-continue", questionId: "q-1" })).toBe(
        true,
      );
      const replay = recordDaemonDispatchResult({
        store: state.store,
        fenceToken: state.fenceToken,
        ref: "GH-239",
        repository,
        sessionId: "session-1",
        spawnOrdinal: attempts[0]?.spawnOrdinal ?? 1,
        harnessKind: "opencode",
        evidenceClass: "pilot",
        handoverState: "dual-run",
        evidence: COMPLETED_EVIDENCE,
        collected: { ok: true },
        reads,
        nowIso: NOW,
        newDivergenceId: () => "DIV-DAEMON",
      });
      expect(replay.ok).toBe(true);
      if (replay.ok) expect(replay.appended).toBe(false);
      expect(readAttempts(state.store)).toHaveLength(1);
    } finally {
      state.dispose();
    }
  });

  test("the daemon record agrees with a one-shot record over the same evidence", async () => {
    const state = createDispatchState("daemon-parity");
    try {
      const reads = readsFrom();
      const recorded = recordDaemonDispatchResult({
        store: state.store,
        fenceToken: state.fenceToken,
        ref: "GH-239",
        repository,
        sessionId: "session-1",
        spawnOrdinal: 1,
        harnessKind: "opencode",
        evidenceClass: "pilot",
        handoverState: "dual-run",
        evidence: COMPLETED_EVIDENCE,
        collected: { ok: true },
        reads,
        nowIso: NOW,
        newDivergenceId: () => "DIV-DAEMON",
      });
      expect(recorded.ok).toBe(true);
      if (!recorded.ok) return;
      const daemonRecord = readAttempts(state.store)[0];
      const oneShot = await oneShotRecord();
      expect(daemonRecord?.token).toBe(oneShot.token);
      expect(daemonRecord?.outcome).toBe(oneShot.outcome);
      expect(daemonRecord?.comparison).toEqual(oneShot.comparison);
      expect(daemonRecord?.corroboration).toEqual(oneShot.corroboration);
      expect(daemonRecord?.evidenceClass).toBe(oneShot.evidenceClass);
    } finally {
      state.dispose();
    }
  });
});

/* ------------------------------------------------------------------------- */
/* TC-PARITY-006 — the daemon path inherits the shared derivation (AC-F8-*)   */
/* ------------------------------------------------------------------------- */

import { deriveDispatchResult } from "../../../packages/core/src/domain/dispatch-result";
import { readOk, artifacts, prNone, prMerged, tracker, ledger as ledgerFacts } from "../../fixtures/dispatch/truth";

describe("TC-PARITY-006 the daemon path inherits the shared derivation", () => {
  const rows = [
    {
      label: "tracker-done",
      reads: readsFrom({ tracker: readOk(tracker({ state: "done" })) }),
      token: "merged",
    },
    {
      label: "tracker-done-blocking",
      reads: readsFrom({ tracker: readOk(tracker({ state: "done", blocking: true })) }),
      token: "merged",
    },
    {
      label: "already-merged-pr",
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 2, pr: prMerged() })),
        phasesComplete: true,
      }),
      token: "merged",
    },
    {
      label: "commits-complete",
      reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "complete" })) }),
      token: "finished",
    },
    {
      label: "commits-incomplete",
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 2, pmNotes: "incomplete" })),
      }),
      token: "partial",
    },
    {
      label: "complete-ledger-with-commits",
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone, pmNotes: "complete" })),
        ledger: readOk(
          ledgerFacts({ completed: 9, total: 9, progressed: false, workRemaining: false }),
        ),
      }),
      token: "finished",
    },
  ] as const;

  for (const row of rows) {
    test(`${row.label}: the daemon token and the one-shot token agree`, async () => {
      const state = createDispatchState(`daemon-parity-006-${row.label}`);
      try {
        const recorded = recordDaemonDispatchResult({
          store: state.store,
          fenceToken: state.fenceToken,
          ref: "GH-239",
          repository,
          sessionId: "session-1",
          spawnOrdinal: 1,
          harnessKind: "opencode",
          evidenceClass: "pilot",
          handoverState: "dual-run",
          evidence: COMPLETED_EVIDENCE,
          collected: { ok: true },
          reads: row.reads,
          nowIso: NOW,
          newDivergenceId: () => `DIV-${row.label}`,
        });
        expect(recorded.ok).toBe(true);
        const daemon = readAttempts(state.store)[0];
        expect(daemon?.token, row.label).toBe(row.token);
        // The one-shot path over the very same facts.
        const oneShot = deriveDispatchResult({
          harness: {
            ok: true,
            value: { outcome: "completed", token: "finished", exitStatus: 0, spawnRefused: false },
          },
          artifacts: row.reads.artifacts,
          ledger: row.reads.ledger,
          tracker: row.reads.tracker,
          restarts: { count: 0, bound: 3 },
          handoverState: "dual-run",
        });
        expect(oneShot.token, row.label).toBe(daemon?.token);
        if (row.label === "tracker-done" || row.label === "tracker-done-blocking") {
          // The arm-aware tracker-only corroboration is inherited on the daemon
          // path, and absent pm-notes/CI raise no false-success incident.
          expect(daemon?.corroboration).toEqual({
            pmNotes: "not-applicable",
            tracker: "satisfied",
            ci: "not-applicable",
          });
          expect(daemon?.falseSuccess).toBe(false);
        }
        if (row.label === "already-merged-pr") {
          // This arm keeps the token-keyed requirement: all three sources are
          // consulted, never the tracker-only triple.
          expect(daemon?.corroboration.pmNotes).not.toBe("not-applicable");
          expect(daemon?.corroboration.ci).not.toBe("not-applicable");
        }
      } finally {
        state.dispose();
      }
    });
  }
});
