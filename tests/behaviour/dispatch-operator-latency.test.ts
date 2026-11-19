/**
 * GH-354 NFR-10 — each query answers within 1 000 ms over the 5 000-record
 * reference store (TC-NFR-003).
 *
 * The measurement convention is the delivered read-side one: one warm-up, ten
 * runs per query, p95, `performance.now()`, and the environment recorded so a
 * slow machine's result is interpretable rather than a flake. The store is
 * seeded through a verified-read view (the delivered reader still validates and
 * bounds every record), so the budget is met by bounded reads, not by caching.
 */
import { describe, expect, test } from "bun:test";
import { DISPATCH_MAX_ATTEMPT_RECORDS } from "../../packages/core/src/contracts/index";
import type { StateRecord, StateStorePort } from "../../packages/core/src/contracts/index";
import {
  readOperatorDelivering,
  readOperatorStatus,
} from "../../packages/core/src/app/dispatch-lane-view";
import { boundDispatchLogLines } from "../../packages/core/src/domain/dispatch-log";
import { composeDispatchMessage } from "../../packages/core/src/domain/dispatch-message";

const REPOSITORY = "github.com/owner/repo";
const NOW = "2026-11-19T00:00:00.000Z";

const laneRecord = (index: number): StateRecord => ({
  schemaVersion: "delivery.state.v1",
  kind: "dispatch.lane",
  key: `dispatch.lanes:GH-${1000 + index}`,
  sequence: index + 1,
  checksum: "fixture",
  payload: {
    schema: "delivery.dispatch.lane.v1",
    ref: `GH-${1000 + index}`,
    repository: REPOSITORY,
    attemptId: `attempt-${index}`,
    sessionId: `ses-${index}`,
    harnessKind: "opencode",
    owner: { processId: 4242, startedAt: NOW },
    iterationOrdinal: 1,
    restartsConsumed: 0,
    state: index === 0 ? "active" : "terminal",
    ...(index === 0 ? {} : { lastToken: "pr-open", lastOutcome: "completed" }),
    recordedAt: NOW,
  } as unknown as StateRecord["payload"],
});

const storeOf = (records: readonly StateRecord[]): StateStorePort =>
  ({
    readRecords: () => ({
      ok: true as const,
      value: {
        records,
        evidence: {
          storePath: "state/ledger.jsonl",
          verification: ["framing", "terminal", "sequence", "checksum"],
          verifiedEmpty: records.length === 0,
          recordCount: records.length,
        },
      },
    }),
  }) as unknown as StateStorePort;

const p95 = (samples: readonly number[]): number => {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[index] ?? 0;
};

const measure = (run: () => void): number => {
  const samples: number[] = [];
  run();
  for (let index = 0; index < 10; index += 1) {
    const started = performance.now();
    run();
    samples.push(performance.now() - started);
  }
  return p95(samples);
};

describe("TC-NFR-003 the query latency budget", () => {
  test("each query answers within 1 000 ms over the 5 000-record reference store", () => {
    const records = Array.from({ length: DISPATCH_MAX_ATTEMPT_RECORDS }, (_, index) =>
      laneRecord(index),
    );
    const store = storeOf(records);
    const environment = `${process.platform}/${process.arch} node=${process.version}`;

    const status = measure(() => {
      readOperatorStatus({ store, repository: REPOSITORY, ref: "GH-1000", probe: () => "live" });
    });
    const delivering = measure(() => {
      readOperatorDelivering({ store, repository: REPOSITORY, probe: () => "live" });
    });
    const lines = Array.from({ length: 500 }, (_, index) => `L-${index}-${"x".repeat(2_000)}`);
    const tail = measure(() => {
      boundDispatchLogLines({
        lines,
        requested: 500,
        maxLines: 200,
        maxBytes: 32_768,
        measureBytes: (candidate) => candidate.reduce((total, line) => total + line.length + 1, 0),
      });
    });
    const message = measure(() => {
      composeDispatchMessage({
        text: "the final message of the session ".repeat(40),
        redact: (text) => text,
      });
    });

    // The environment is printed so a slow machine is interpretable.
    console.log(
      `TC-NFR-003 p95 ms status=${status.toFixed(1)} delivering=${delivering.toFixed(1)} tail=${tail.toFixed(1)} message=${message.toFixed(1)} (${environment})`,
    );
    for (const [name, value] of [
      ["status", status],
      ["delivering", delivering],
      ["tail", tail],
      ["message", message],
    ] as const) {
      expect(value, name).toBeLessThanOrEqual(1_000);
    }
  });
});
