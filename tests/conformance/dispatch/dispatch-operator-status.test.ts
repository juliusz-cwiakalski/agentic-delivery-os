/**
 * GH-354 F-1 — the per-ref `status` fold (TC-STATUS-001..008).
 *
 * Every case drives the composed production program (driver D1): the real lane
 * ledger read, the real repository scoping, the real advisory probe contract,
 * the real command definition, and the real projection. The probe verdict is
 * the only injected fact.
 */
import { describe, expect, test } from "bun:test";
import { readOperatorStatus } from "../../../packages/core/src/app/dispatch-lane-view";
import {
  DISPATCH_MAX_ATTEMPT_RECORDS,
  type StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { storeWithReadFailure } from "../../fixtures/dispatch/attempts-harness";
import {
  createOperatorHarness,
  OPERATOR_REF,
  OPERATOR_REPOSITORY,
} from "../../fixtures/dispatch/operator/harness";
import { createFixedProbe, createTableProbe } from "../../fixtures/dispatch/operator/probe";

const LIVE_NOW = "2026-11-19T00:00:00.000Z";

const statusData = (data: unknown) => data as Record<string, unknown>;

describe("TC-STATUS the per-ref status fold", () => {
  test("TC-STATUS-001 a live lane answers delivering, marker, probe, pid, session and lane facts", async () => {
    const probe = createFixedProbe("live");
    const h = createOperatorHarness({ label: "status-live", probe: probe.probe });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "active",
        sessionId: "ses-live",
        attemptId: "attempt-live",
        iterationOrdinal: 2,
        restartsConsumed: 1,
        processId: 4242,
        startedAt: LIVE_NOW,
        recordedAt: LIVE_NOW,
      });
      const before = h.counters.readRecords;
      const json = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
      expect(json.exit).toBe(0);
      const data = statusData(json.data);
      expect(data.query).toBe("status");
      expect(data.delivering).toBe(true);
      expect(data.stale).toBe(false);
      expect(data.marker).toBe("active");
      expect(data.probe).toBe("live");
      expect(data.pid).toBe(4242);
      expect(data.sessionId).toBe("ses-live");
      expect(data.repository).toBe(OPERATOR_REPOSITORY);
      expect(data.ref).toBe(OPERATOR_REF);
      const lane = data.lane as Record<string, unknown>;
      expect(lane.attemptId).toBe("attempt-live");
      expect(lane.harness).toBe("opencode");
      expect(lane.iterationOrdinal).toBe(2);
      expect(lane.restartsConsumed).toBe(1);
      expect(lane.ownerStartedAt).toBe(LIVE_NOW);
      expect(lane.recordedAt).toBe(LIVE_NOW);
      expect(lane.lastToken).toBeUndefined();
      expect(lane.lastOutcome).toBeUndefined();
      expect(json.envelope?.error).toBeUndefined();
      expect(h.counters.readRecords - before).toBe(1);
      expect(probe.calls).toHaveLength(1);

      const humanBefore = h.counters.readRecords;
      const human = await h.run(["dispatch", "status", OPERATOR_REF]);
      expect(human.exit).toBe(0);
      expect(human.stdout).toContain("marker=active");
      expect(human.stdout).toContain("probe=live");
      expect(h.counters.readRecords - humanBefore).toBe(1);
    } finally {
      h.dispose();
    }
  });

  test("TC-STATUS-002 a terminal lane answers not-delivering with lastToken, lastOutcome and recordedAt", async () => {
    for (const verdict of ["live", "dead"] as const) {
      const h = createOperatorHarness({
        label: `status-terminal-${verdict}`,
        probe: createFixedProbe(verdict).probe,
      });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "terminal",
          sessionId: "ses-final",
          attemptId: "attempt-final",
          processId: 4242,
          startedAt: LIVE_NOW,
          lastToken: "pr-open",
          lastOutcome: "completed",
          recordedAt: LIVE_NOW,
        });
        const before = h.counters.readRecords;
        const json = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
        expect(json.exit).toBe(0);
        const data = statusData(json.data);
        expect(data.delivering).toBe(false);
        expect(data.marker).toBe("terminal");
        expect(data.stale).toBe(false);
        expect(data.probe).toBe(verdict);
        const lane = data.lane as Record<string, unknown>;
        expect(lane.lastToken).toBe("pr-open");
        expect(lane.lastOutcome).toBe("completed");
        expect(lane.recordedAt).toBe(LIVE_NOW);
        expect(data.pid).toBe(4242);
        expect(data.sessionId).toBe("ses-final");
        expect(h.counters.readRecords - before).toBe(1);
        expect(h.counters.append).toBe(0);
        expect(h.counters.acquireFence).toBe(0);
      } finally {
        h.dispose();
      }
    }
  });

  test("TC-STATUS-003 an absent ref answers marker=absent with a null lane at exit 0 in both forms", async () => {
    const h = createOperatorHarness({ label: "status-absent" });
    try {
      // Unrelated records for other refs and for another repository.
      h.seedLane({ ref: "GH-999", state: "active", sessionId: "ses-other" });
      h.seedForeignLane(
        { ref: OPERATOR_REF, state: "active", sessionId: "ses-foreign" },
        "github.com/other/repo",
      );
      for (const argv of [
        ["dispatch", "status", OPERATOR_REF],
        ["dispatch", "status", OPERATOR_REF, "--json"],
      ]) {
        const result = await h.run(argv);
        expect(result.exit).toBe(0);
        if (argv.includes("--json")) {
          const data = statusData(result.data);
          expect(data.marker).toBe("absent");
          expect(data.delivering).toBe(false);
          expect(data.stale).toBe(false);
          expect(data.probe).toBe("not-applicable");
          expect(data.pid).toBeNull();
          expect(data.sessionId).toBeNull();
          expect(data.lane).toBeNull();
          expect(result.envelope?.error).toBeUndefined();
        } else {
          expect(result.stdout).toContain("marker=absent");
        }
      }
      // Nothing was fabricated or backfilled for the ref in this repository.
      expect(h.lanes().filter((lane) => lane.ref === OPERATOR_REF)).toHaveLength(1);
    } finally {
      h.dispose();
    }
  });

  test("TC-STATUS-004 a confirmed-gone owner is stale and the read repairs nothing", async () => {
    const h = createOperatorHarness({
      label: "status-stale",
      probe: createFixedProbe("dead").probe,
    });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "active",
        sessionId: "ses-stale",
        processId: 4242,
        startedAt: LIVE_NOW,
      });
      const before = h.ledgerBytes();
      const recordsBefore = h.records().length;
      const json = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
      expect(json.exit).toBe(0);
      const data = statusData(json.data);
      expect(data.delivering).toBe(false);
      expect(data.stale).toBe(true);
      expect(data.marker).toBe("active");
      expect(data.probe).toBe("dead");
      expect(h.ledgerBytes()).toBe(before);
      expect(h.records().length).toBe(recordsBefore);
      expect(h.counters.append).toBe(0);
      expect(h.counters.acquireFence).toBe(0);
    } finally {
      h.dispose();
    }
  });

  test("TC-STATUS-005 the probe is tri-state; unknown never asserts staleness and a reused pid is not live", async () => {
    const rows = [
      {
        label: "unreadable table",
        probe: createTableProbe({ table: "unreadable" }),
        probeValue: "unknown",
        stale: false,
        delivering: true,
      },
      {
        label: "matching start instant",
        probe: createTableProbe({ table: [{ processId: 4242, startedAt: LIVE_NOW }] }),
        probeValue: "live",
        stale: false,
        delivering: true,
      },
      {
        label: "4999 ms inside tolerance",
        probe: createTableProbe({
          table: [{ processId: 4242, startedAt: "2026-11-19T00:00:04.999Z" }],
        }),
        probeValue: "live",
        stale: false,
        delivering: true,
      },
      {
        label: "5001 ms outside tolerance",
        probe: createTableProbe({
          table: [{ processId: 4242, startedAt: "2026-11-19T00:00:05.001Z" }],
        }),
        probeValue: "dead",
        stale: true,
        delivering: false,
      },
      {
        label: "reused pid, unrelated start instant",
        probe: createTableProbe({
          table: [{ processId: 4242, startedAt: "2026-11-18T23:00:00.000Z" }],
        }),
        probeValue: "dead",
        stale: true,
        delivering: false,
      },
    ] as const;

    for (const row of rows) {
      const h = createOperatorHarness({ label: "status-probe", probe: row.probe.probe });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "active",
          sessionId: "ses-probe",
          processId: 4242,
          startedAt: LIVE_NOW,
        });
        const json = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
        const data = statusData(json.data);
        expect(data.probe, row.label).toBe(row.probeValue);
        expect(data.stale, row.label).toBe(row.stale);
        expect(data.delivering, row.label).toBe(row.delivering);
        expect(row.probe.calls, row.label).toHaveLength(1);
        expect(row.probe.calls[0]?.processId, row.label).toBe(4242);
      } finally {
        h.dispose();
      }
    }
  });

  test("TC-STATUS-006 a newer foreign record never wins and no daemon lane is reported", async () => {
    // Store A: only a foreign record for the ref.
    {
      const h = createOperatorHarness({ label: "status-foreign-only" });
      try {
        h.seedForeignLane(
          { ref: OPERATOR_REF, state: "active", sessionId: "ses-foreign" },
          "github.com/other/repo",
        );
        const json = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
        const data = statusData(json.data);
        expect(data.marker).toBe("absent");
        expect(data.lane).toBeNull();
        expect(json.exit).toBe(0);
      } finally {
        h.dispose();
      }
    }

    // Store B: a local active lane plus a daemon lane for the same ref.
    {
      const h = createOperatorHarness({
        label: "status-daemon",
        probe: createFixedProbe("dead").probe,
      });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "active",
          sessionId: "ses-local",
          attemptId: "attempt-local",
        });
        h.seedDaemon({ ref: OPERATOR_REF, state: "delivering", sessionId: "ses-daemon" });
        const daemonBefore = h.records().length;
        const json = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
        const data = statusData(json.data);
        expect(data.sessionId).toBe("ses-local");
        expect((data.lane as Record<string, unknown>).attemptId).toBe("attempt-local");
        expect(data.stale).toBe(true);
        expect(data.probe).toBe("dead");
        expect(h.records().length).toBe(daemonBefore);
      } finally {
        h.dispose();
      }
    }

    // Store C: a local terminal record, then a NEWER foreign active record under
    // the same `dispatch.lanes:<ref>` key. The filter must precede the fold.
    {
      const h = createOperatorHarness({ label: "status-fold-order" });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "terminal",
          sessionId: "ses-local-final",
          attemptId: "attempt-local-final",
          lastToken: "pr-open",
          lastOutcome: "completed",
          recordedAt: LIVE_NOW,
        });
        h.seedForeignLane(
          {
            ref: OPERATOR_REF,
            state: "active",
            sessionId: "ses-foreign-active",
            attemptId: "attempt-foreign-active",
            recordedAt: "2026-11-19T01:00:00.000Z",
          },
          "github.com/other/repo",
        );
        for (const argv of [
          ["dispatch", "status", OPERATOR_REF],
          ["dispatch", "status", OPERATOR_REF, "--json"],
        ]) {
          const result = await h.run(argv);
          expect(result.exit).toBe(0);
          if (argv.includes("--json")) {
            const data = statusData(result.data);
            expect(data.marker).toBe("terminal");
            expect(data.delivering).toBe(false);
            expect(data.sessionId).toBe("ses-local-final");
            expect((data.lane as Record<string, unknown>).attemptId).toBe("attempt-local-final");
            expect(result.stdout).not.toContain("ses-foreign-active");
          }
        }
      } finally {
        h.dispose();
      }
    }

    // Store D: the mirror — a local active record, then a newer foreign terminal.
    {
      const h = createOperatorHarness({
        label: "status-fold-order-mirror",
        probe: createFixedProbe("live").probe,
      });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "active",
          sessionId: "ses-local-active",
          attemptId: "attempt-local-active",
          recordedAt: LIVE_NOW,
        });
        h.seedForeignLane(
          {
            ref: OPERATOR_REF,
            state: "terminal",
            sessionId: "ses-foreign-terminal",
            recordedAt: "2026-11-19T01:00:00.000Z",
          },
          "github.com/other/repo",
        );
        const json = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
        const data = statusData(json.data);
        expect(data.marker).toBe("active");
        expect(data.delivering).toBe(true);
        expect(data.sessionId).toBe("ses-local-active");
      } finally {
        h.dispose();
      }
    }
  });

  test("TC-STATUS-007 every status answer performs one bounded lane read and no write", async () => {
    const h = createOperatorHarness({ label: "status-read-budget" });
    try {
      const states = [
        { state: "active", sessionId: "ses-a" },
        { state: "terminal", sessionId: "ses-t", lastToken: "pr-open", lastOutcome: "completed" },
      ] as const;
      for (const seed of states) {
        h.seedLane({ ref: OPERATOR_REF, ...seed });
        const before = h.counters.readRecords;
        const ledger = h.ledgerBytes();
        const result = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
        expect(result.exit).toBe(0);
        expect(h.counters.readRecords - before).toBe(1);
        expect(h.ledgerBytes()).toBe(ledger);
      }
      expect(h.counters.append).toBe(0);
      expect(h.counters.acquireFence).toBe(0);
      expect(h.counters.releaseFence).toBe(0);
      expect(h.counters.replaceDocument).toBe(0);
    } finally {
      h.dispose();
    }

    // The retained window is applied: 5 001 records read once, bounded to the
    // declared 5 000, with the addressed ref still answered.
    let reads = 0;
    const records = Array.from({ length: DISPATCH_MAX_ATTEMPT_RECORDS + 1 }, (_, index) => ({
      schemaVersion: "delivery.state.v1",
      kind: "dispatch.lane",
      key: `dispatch.lanes:GH-${1000 + index}`,
      sequence: index + 1,
      checksum: "fixture",
      payload: {
        schema: "delivery.dispatch.lane.v1",
        ref: `GH-${1000 + index}`,
        repository: OPERATOR_REPOSITORY,
        attemptId: `attempt-${index}`,
        sessionId: `ses-${index}`,
        harnessKind: "opencode",
        owner: { processId: 4242, startedAt: LIVE_NOW },
        iterationOrdinal: 1,
        restartsConsumed: 0,
        state: "terminal",
        lastToken: "pr-open",
        lastOutcome: "completed",
        recordedAt: LIVE_NOW,
      },
    }));
    const synthetic = {
      readRecords: () => {
        reads += 1;
        return {
          ok: true as const,
          value: {
            records,
            evidence: {
              storePath: "state/ledger.jsonl",
              verification: ["framing", "terminal", "sequence", "checksum"],
              verifiedEmpty: false,
              recordCount: records.length,
            },
          },
        };
      },
    } as unknown as StateStorePort;
    const result = readOperatorStatus({
      store: synthetic,
      repository: OPERATOR_REPOSITORY,
      ref: "GH-1500",
      probe: () => "live",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.marker).toBe("terminal");
      expect(result.data.ref).toBe("GH-1500");
    }
    expect(reads).toBe(1);
  });

  test("TC-STATUS-008 an unreadable lane store keeps its typed state.* identity, never a fabricated absent", async () => {
    const rows = [
      { code: "state.store.torn", exit: 2 },
      { code: "state.permission.denied", exit: 1 },
    ] as const;
    for (const row of rows) {
      const h = createOperatorHarness({
        label: `status-${row.code.replaceAll(".", "-")}`,
        wrap: (store) => storeWithReadFailure(store, "dispatch.lane", row.code),
      });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "active", sessionId: "ses-unreadable" });
        for (const argv of [
          ["dispatch", "status", OPERATOR_REF],
          ["dispatch", "status", OPERATOR_REF, "--json"],
        ]) {
          const result = await h.run(argv);
          expect(result.exit, row.code).toBe(row.exit);
          if (argv.includes("--json")) {
            expect(result.errorCode).toBe(row.code);
            expect(result.data).toBeUndefined();
            const envelope = result.envelope as
              | { readonly data?: unknown; readonly error?: { readonly code: string } }
              | undefined;
            expect(envelope?.data).toBeUndefined();
            expect(envelope?.error?.code).toBe(row.code);
          } else {
            // The human failure summary is single-line and carries no lane text.
            expect(result.stderr).not.toContain("ses-unreadable");
          }
        }
      } finally {
        h.dispose();
      }
    }
  });
});
