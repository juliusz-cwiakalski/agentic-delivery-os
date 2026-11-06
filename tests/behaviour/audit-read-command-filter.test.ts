/**
 * TC-GH223-050 — the command filter matches the recorded command token exactly,
 * including raw first tokens recorded for broken invocations.
 */
import { describe, expect, test } from "bun:test";
import { readAuditLedger } from "../../packages/core/src/state/index";
import { appendAuditFacts, makeAuditStore, removeRoot } from "../fixtures/state/harness";

const ids = (read: ReturnType<typeof readAuditLedger>): readonly string[] | undefined =>
  read.ok ? read.value.records.map((record) => record.runId) : undefined;

describe("TC-GH223-050 exact command filter", () => {
  test("normal and raw-token commands are filterable by their recorded token", () => {
    const fixture = makeAuditStore("command-filter");
    try {
      const seed = [
        { runId: "run-status-1", command: "status", outcomeClass: "success" as const },
        { runId: "run-status-extra", command: "status-extra", outcomeClass: "success" as const },
        { runId: "run-broken-dash", command: "--wat", outcomeClass: "user-validation" as const },
        {
          runId: "run-broken-unknown",
          command: "unknown-cmd",
          outcomeClass: "user-validation" as const,
        },
        { runId: "run-status-2", command: "status", outcomeClass: "success" as const },
        { runId: "run-status-3", command: "status", outcomeClass: "success" as const },
      ];
      for (const entry of seed) {
        const appended = appendAuditFacts(fixture.store, entry);
        expect(appended.ok).toBe(true);
      }

      expect(ids(readAuditLedger(fixture.store, { limit: 10, command: "status" }))).toEqual([
        "run-status-1",
        "run-status-2",
        "run-status-3",
      ]);
      expect(ids(readAuditLedger(fixture.store, { limit: 10, command: "status-extra" }))).toEqual([
        "run-status-extra",
      ]);
      const prefix = readAuditLedger(fixture.store, { limit: 10, command: "stat" });
      expect(prefix.ok && prefix.value.matched).toBe(0);
      const caseMiss = readAuditLedger(fixture.store, { limit: 10, command: "Status" });
      expect(caseMiss.ok && caseMiss.value.matched).toBe(0);
      expect(ids(readAuditLedger(fixture.store, { limit: 10, command: "--wat" }))).toEqual([
        "run-broken-dash",
      ]);
      expect(ids(readAuditLedger(fixture.store, { limit: 10, command: "unknown-cmd" }))).toEqual([
        "run-broken-unknown",
      ]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the command filter composes with scope and a bound", () => {
    const fixture = makeAuditStore("command-filter-compose");
    try {
      for (let index = 0; index < 4; index += 1) {
        appendAuditFacts(fixture.store, {
          runId: `run-compose-${index}`,
          command: "status",
          scope: index === 3 ? "workspace-b" : "workspace-a",
        });
      }
      const read = readAuditLedger(fixture.store, {
        limit: 2,
        command: "status",
        scope: "workspace-a",
      });
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.value.matched).toBe(3);
      expect(read.value.records).toHaveLength(2);
      expect(read.value.truncated).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
