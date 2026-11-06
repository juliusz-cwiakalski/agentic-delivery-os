/**
 * TC-GH223-043 — reservation-orphan scenario: the invocation append fails after
 * the reservation lands; the finding survives filters and is not a chain break.
 */
import { describe, expect, test } from "bun:test";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { readAuditLedger, verifyAuditChain } from "../../packages/core/src/state/index";
import {
  armAppendFailure,
  invocationPayloadsOf,
  makeAuditStore,
  removeRoot,
  reservationPayloadsOf,
  seedAuditPairs,
} from "../fixtures/state/harness";
import { programFor, runAudited } from "./audit-run-support";

describe("TC-GH223-043 reservation orphan", () => {
  test("the orphan is reported in-band even when filters match no invocation", async () => {
    const fixture = makeAuditStore("reservation-orphan");
    try {
      seedAuditPairs(fixture.store, 1);
      const armed = armAppendFailure(fixture.edge, 2);
      const degraded = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-orphan-2",
        ticks: [2000, 2013],
      });
      armed.restore();
      expect(degraded.exitCode).toBe(0);
      expect(degraded.stderr).toContain("state.write.failed");
      expect(invocationPayloadsOf(fixture.store).map((record) => record.auditSeq)).toEqual([1]);

      const orphan = reservationPayloadsOf(fixture.store).find(
        (reservation) => reservation.auditSeq === 2,
      );
      expect(orphan).toBeDefined();
      expect(Object.keys(orphan ?? {})).toEqual(["schemaId", "auditSeq", "runId", "chainValue"]);
      expect(typeof orphan?.chainValue).toBe("string");
      expect(Object.hasOwn(orphan ?? {}, "arguments")).toBe(false);
      expect(Object.hasOwn(orphan ?? {}, "outcomeClass")).toBe(false);
      expect(Object.hasOwn(orphan ?? {}, "agentIdentity")).toBe(false);

      const unfiltered = readAuditLedger(fixture.store, { limit: 10 });
      expect(unfiltered.ok && unfiltered.value.chain.orphans).toEqual([
        { auditSeq: 2, runId: "run-orphan-2", position: expect.any(Number) },
      ]);
      const filtered = readAuditLedger(fixture.store, {
        limit: 10,
        scope: "workspace-z",
        repo: "repo-z",
        command: "no-such-command",
        from: 9000,
        to: 9500,
      });
      expect(filtered.ok).toBe(true);
      if (filtered.ok) {
        expect(filtered.value.records).toEqual([]);
        expect(filtered.value.chain.orphans.map((finding) => finding.auditSeq)).toEqual([2]);
        expect(filtered.value.chain.orphans[0]?.runId).toBe("run-orphan-2");
      }

      const verdict = verifyAuditChain(fixture.store);
      expect(verdict.ok && verdict.value.verified).toBe(true);
      if (verdict.ok) {
        expect(verdict.value.breaks).toEqual([]);
        expect(verdict.value.orphans.map((finding) => finding.auditSeq)).toEqual([2]);
      }

      // Exactly one invocation for runs 1 and 3; none for the degraded run.
      await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-orphan-3",
        ticks: [3000, 3013],
      });
      const runIds = invocationPayloadsOf(fixture.store).map((record) => record.runId);
      expect(runIds).toHaveLength(2);
      expect(runIds).toContain("run-orphan-3");
      expect(
        invocationPayloadsOf(fixture.store).some((record) => record.runId === "run-orphan-2"),
      ).toBe(false);

      const codes = new Set(
        (ERROR_TABLE as readonly { code: string }[]).map((entry) => entry.code),
      );
      expect(codes.has("audit.orphan")).toBe(false);
      expect(codes.has("audit.chain.break")).toBe(false);
      expect(fixture.store.fenceStatus().held).toBe(false);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
