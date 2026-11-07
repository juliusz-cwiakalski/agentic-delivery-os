/**
 * TC-GH223-044 — reservation-failure scenario: the reservation append fails,
 * nothing is consumed, no gap finding is reported, and the ordinal is reused.
 */
import { describe, expect, test } from "bun:test";
import { readAuditLedger, verifyAuditChain } from "../../packages/core/src/state/index";
import {
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

describe("TC-GH223-044 reservation failure", () => {
  test("a failed reservation consumes nothing and claims no gap", async () => {
    const fixture = makeAuditStore("reservation-failure");
    try {
      seedAuditPairs(fixture.store, 1);
      const armed = armAppendFailure(fixture.edge, 1);
      const degraded = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-failed-reservation",
        ticks: [2000, 2013],
      });
      armed.restore();
      expect(degraded.exitCode).toBe(0);
      expect(degraded.stderr).toContain("state.write.failed");
      expect(reservationPayloadsOf(fixture.store)).toHaveLength(1);
      expect(invocationPayloadsOf(fixture.store)).toHaveLength(1);

      const read = readAuditLedger(fixture.store, { limit: 10 });
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.chain.orphans).toEqual([]);
        expect(read.value.chain.breaks).toEqual([]);
      }
      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok && verdict.value.orphans).toEqual([]);

      const next = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-after-failed-reservation",
        ticks: [3000, 3013],
      });
      expect(next.exitCode).toBe(0);
      const records = invocationPayloadsOf(fixture.store);
      expect(records.map((record) => record.auditSeq)).toEqual([1, 2]);
      expect(records[1]?.runId).toBe("run-after-failed-reservation");
      expect(parsedLines(ledgerText(fixture.identity))).toBe(true);
      expect(reservationPayloadsOf(fixture.store)).toHaveLength(2);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
