/**
 * TC-GH223-009 (generic audit-write fault, torn store) and TC-GH223-010
 * (shared-fence contention and exhaustion) — the command outcome never changes.
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync, existsSync } from "node:fs";
import {
  armAppendExhaustion,
  auditRecordsOf,
  invocationPayloadsOf,
  ledgerDigest,
  ledgerPath,
  makeAuditStore,
  removeRoot,
  reopenStore,
} from "../fixtures/state/harness";
import { programFor, runAudited } from "./audit-run-support";

const digestOrAbsent = (path: string, identity: Parameters<typeof ledgerDigest>[0]): string =>
  existsSync(path) ? ledgerDigest(identity) : "absent";

describe("TC-GH223-009 generic audit-write degradation", () => {
  test("a generic append fault leaves both outcomes and exit codes unchanged", async () => {
    const fixture = makeAuditStore("write-failure");
    try {
      fixture.edge.arm(["append-before-flush"]);
      const success = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-write-fail-success",
      });
      const failure = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("classified-user"),
        runId: "run-write-fail-user",
      });
      fixture.edge.disarm();

      expect(success.exitCode).toBe(0);
      expect(failure.exitCode).toBe(1);
      const successEnvelope = JSON.parse(success.stdout) as { data: unknown };
      expect(successEnvelope.data).toEqual({ message: "all good", count: 2 });
      const failureEnvelope = JSON.parse(failure.stdout) as { error: { code: string } };
      expect(failureEnvelope.error.code).toBe("input.value.rejected");
      expect(success.stderr).toContain("state.write.failed");
      expect(failure.stderr).toContain("state.write.failed");
      expect(fixture.edge.raised).toContain("append-before-flush");
      expect(auditRecordsOf(fixture.store)).toEqual([]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a torn ledger keeps the command outcome and appends nothing", async () => {
    const fixture = makeAuditStore("write-failure-torn");
    try {
      appendFileSync(ledgerPath(fixture.identity), '{"broken":');
      const before = digestOrAbsent(ledgerPath(fixture.identity), fixture.identity);
      const run = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-torn-audit",
      });
      expect(run.exitCode).toBe(0);
      expect(JSON.parse(run.stdout)).toMatchObject({ data: { message: "all good", count: 2 } });
      expect(run.stderr).toContain("state.store.torn");
      expect(digestOrAbsent(ledgerPath(fixture.identity), fixture.identity)).toBe(before);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-010 shared-fence contention and exhaustion", () => {
  test("a held shared fence and reservation exhaustion consume nothing", async () => {
    const contention = makeAuditStore("fence-contention");
    try {
      const first = await runAudited(contention, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-contention-1",
      });
      expect(first.exitCode).toBe(0);
      const holder = reopenStore(contention.identity);
      const acquired = holder.store.acquireFence("other-writer");
      expect(acquired.ok).toBe(true);
      const before = ledgerDigest(contention.identity);
      const blocked = await runAudited(contention, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-contention-2",
      });
      expect(blocked.exitCode).toBe(0);
      expect(blocked.stderr).toContain("state.lock.busy");
      expect(ledgerDigest(contention.identity)).toBe(before);
      if (acquired.ok) holder.store.releaseFence(acquired.value.handle);
      const third = await runAudited(contention, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-contention-3",
      });
      expect(third.exitCode).toBe(0);
      const ordinals = invocationPayloadsOf(contention.store).map((record) => record.auditSeq);
      expect(ordinals).toEqual([1, 2]);
    } finally {
      removeRoot(contention.root);
    }

    const exhaustion = makeAuditStore("append-exhaustion");
    try {
      await runAudited(exhaustion, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-exhaustion-1",
      });
      const before = ledgerDigest(exhaustion.identity);
      exhaustion.edge.armExhaustion(["append-before-flush"]);
      const degraded = await runAudited(exhaustion, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-exhaustion-2",
      });
      exhaustion.edge.disarm();
      expect(degraded.exitCode).toBe(0);
      expect(degraded.stderr).toContain("state.storage.exhausted");
      expect(ledgerDigest(exhaustion.identity)).toBe(before);
      await runAudited(exhaustion, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-exhaustion-3",
      });
      expect(invocationPayloadsOf(exhaustion.store).map((record) => record.auditSeq)).toEqual([
        1, 2,
      ]);
    } finally {
      removeRoot(exhaustion.root);
    }
  });

  test("invocation-append exhaustion lands the reservation and loses the invocation", async () => {
    const fixture = makeAuditStore("second-append-exhaustion");
    try {
      await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-second-1",
      });
      const armed = armAppendExhaustion(fixture.edge, 2);
      const degraded = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-second-2",
      });
      armed.restore();
      expect(degraded.exitCode).toBe(0);
      expect(degraded.stderr).toContain("state.storage.exhausted");
      expect(invocationPayloadsOf(fixture.store).map((record) => record.runId)).toEqual([
        "run-second-1",
      ]);
      const reservations = auditRecordsOf(fixture.store).filter(
        (record) => record.kind === "audit.reservation",
      );
      expect(reservations).toHaveLength(2);
      expect(((reservations[1]?.payload ?? {}) as Record<string, unknown>).auditSeq).toBe(2);

      await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-second-3",
      });
      expect(invocationPayloadsOf(fixture.store).map((record) => record.auditSeq)).toEqual([1, 3]);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
