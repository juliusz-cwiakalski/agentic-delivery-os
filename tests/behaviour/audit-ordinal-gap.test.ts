/**
 * TC-GH223-039 — the two-phase append failure matrix: an orphan reservation is
 * durable gap evidence; a failed reservation consumes nothing and claims no gap.
 */
import { describe, expect, test } from "bun:test";
import { readAuditLedger } from "../../packages/core/src/state/index";
import {
  appendAuditFacts,
  armAppendFailure,
  invocationPayloadsOf,
  ledgerText,
  makeAuditStore,
  removeRoot,
  reservationPayloadsOf,
  seedAuditPairs,
} from "../fixtures/state/harness";
import { programFor, runAudited } from "./audit-run-support";

const parsedLines = (text: string): boolean =>
  text
    .split("\n")
    .filter((line) => line !== "")
    .every((line) => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });

describe("TC-GH223-039 two-phase failure matrix", () => {
  test("scenario (a): the reservation lands, the invocation is absent, the next ordinal advances", async () => {
    const fixture = makeAuditStore("matrix-orphan");
    try {
      const first = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-matrix-1",
      });
      expect(first.exitCode).toBe(0);
      const armed = armAppendFailure(fixture.edge, 2);
      const degraded = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-matrix-2",
      });
      armed.restore();
      expect(degraded.exitCode).toBe(0);
      expect(degraded.stderr).toContain("state.write.failed");
      expect(invocationPayloadsOf(fixture.store).map((record) => record.auditSeq)).toEqual([1]);
      const reservations = reservationPayloadsOf(fixture.store);
      expect(reservations.map((reservation) => reservation.auditSeq)).toEqual([1, 2]);
      expect(reservations[1]?.chainValue).toEqual(expect.any(String));

      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.chain.orphans).toEqual([
          { auditSeq: 2, runId: "run-matrix-2", position: expect.any(Number) },
        ]);
        expect(read.value.chain.verified).toBe(true);
      }
      expect(parsedLines(ledgerText(fixture.identity))).toBe(true);

      const third = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-matrix-3",
      });
      expect(third.exitCode).toBe(0);
      expect(invocationPayloadsOf(fixture.store).map((record) => record.auditSeq)).toEqual([1, 3]);

      const after = readAuditLedger(fixture.store, { limit: 10 });
      expect(after.ok && after.value.chain.orphans.map((entry) => entry.auditSeq)).toEqual([2]);
      expect(after.ok && after.value.chain.verified).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("scenario (b): the reservation fails, nothing is consumed, the ordinal is reallocated", async () => {
    const fixture = makeAuditStore("matrix-failed-reservation");
    try {
      seedAuditPairs(fixture.store, 1);
      const armed = armAppendFailure(fixture.edge, 1);
      const degraded = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-matrix-failed",
      });
      armed.restore();
      expect(degraded.exitCode).toBe(0);
      expect(degraded.stderr).toContain("state.write.failed");
      expect(reservationPayloadsOf(fixture.store)).toHaveLength(1);
      expect(invocationPayloadsOf(fixture.store)).toHaveLength(1);

      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.value.chain.orphans).toEqual([]);

      const appended = appendAuditFacts(fixture.store, {
        runId: "run-matrix-reallocated",
        startedAt: 3000,
      });
      expect(appended.ok).toBe(true);
      if (appended.ok) expect(appended.value.auditSeq).toBe(2);
      expect(parsedLines(ledgerText(fixture.identity))).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
