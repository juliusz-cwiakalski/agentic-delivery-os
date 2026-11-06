/**
 * TC-GH223-001 (success, void success, text mode), TC-GH223-002 (classified
 * failures), TC-GH223-003 (unknown failures), and TC-GH223-004 (broken
 * invocations) — exactly one invocation record plus its reservation per run.
 */
import { describe, expect, test } from "bun:test";
import type { CommandProgram } from "../../packages/cli/src/index";
import { AUDIT_INVOCATION_FIELDS } from "../../packages/core/src/contracts/index";
import {
  auditPairsOf,
  invocationPayloadsOf,
  makeAuditStore,
  removeRoot,
  reservationPayloadsOf,
} from "../fixtures/state/harness";
import { BROKEN_ARGV, programFor, runAudited } from "./audit-run-support";

const invocationFor = (
  store: Parameters<typeof invocationPayloadsOf>[0],
  runId: string,
): Record<string, unknown> => {
  const payload = invocationPayloadsOf(store).find((record) => record.runId === runId);
  if (payload === undefined) throw new Error(`invocation missing for ${runId}`);
  return payload;
};

describe("TC-GH223-001 success, void, and text-mode invocations", () => {
  test("success, void success, and text mode each append one invocation + reservation", async () => {
    const fixture = makeAuditStore("outcomes-success");
    try {
      const first = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-gh223-0001",
        ticks: [1000, 1013],
        repo: "repo-1",
      });
      const second = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("void"),
        runId: "run-gh223-0002",
        ticks: [2000, 2005],
      });
      const third = await runAudited(fixture, {
        argv: ["status"],
        program: programFor("success"),
        runId: "run-gh223-0003",
        ticks: [3000, 3001],
      });
      expect([first.exitCode, second.exitCode, third.exitCode]).toEqual([0, 0, 0]);
      expect(third.stdout).toBe("");

      const pairs = auditPairsOf(fixture.store);
      expect(pairs).toHaveLength(3);
      expect(pairs.map((pair) => pair.auditSeq)).toEqual([1, 2, 3]);
      for (const pair of pairs) {
        expect(pair.reservation.auditSeq).toBe(pair.invocation.auditSeq);
        expect(Object.keys(pair.reservation)).toEqual([
          "schemaId",
          "auditSeq",
          "runId",
          "chainValue",
        ]);
      }
      expect(reservationPayloadsOf(fixture.store)).toHaveLength(3);
      expect(invocationPayloadsOf(fixture.store)).toHaveLength(3);

      const run1 = invocationFor(fixture.store, "run-gh223-0001");
      expect(Object.keys(run1).sort()).toEqual(
        [
          "schemaId",
          ...AUDIT_INVOCATION_FIELDS.filter((field) => field !== "agentIdentity"),
        ].sort(),
      );
      expect(run1.command).toBe("status");
      expect(run1.arguments).toEqual(["--json", "status"]);
      expect(run1.exitCode).toBe(0);
      expect(run1.timing).toEqual({ totalMs: 13 });
      expect(run1.resultSchemaVersion).toBe("delivery.result.v1");
      expect(run1.resultSchemaVersion).not.toBe("delivery.audit.invocation.v1");
      expect(run1.outcomeClass).toBe("success");
      expect(run1.scope).toBe("workspace-a");
      expect(run1.repo).toBe("repo-1");
      expect(run1.startedAt).toBe(1000);
      expect(run1.auditSeq).toBe(1);
      expect(typeof run1.chainValue).toBe("string");
      expect(Object.hasOwn(run1, "agentIdentity")).toBe(false);

      expect(invocationFor(fixture.store, "run-gh223-0002").startedAt).toBe(2000);
      expect(invocationFor(fixture.store, "run-gh223-0003").startedAt).toBe(3000);
      // Auditing is independent of the machine channel.
      expect(invocationFor(fixture.store, "run-gh223-0003").arguments).toEqual(["status"]);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-002 classified failures", () => {
  test("user and platform failures carry their exit code and outcome class", async () => {
    const fixture = makeAuditStore("outcomes-classified");
    try {
      const user = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("classified-user"),
        runId: "run-classified-user",
      });
      const platform = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("classified-platform"),
        runId: "run-classified-platform",
      });
      expect(user.exitCode).toBe(1);
      expect(platform.exitCode).toBe(2);
      const userEnvelope = JSON.parse(user.stdout) as { error: { code: string } };
      expect(userEnvelope.error.code).toBe("input.value.rejected");

      const pairs = auditPairsOf(fixture.store);
      expect(pairs).toHaveLength(2);
      const userRecord = invocationFor(fixture.store, "run-classified-user");
      const platformRecord = invocationFor(fixture.store, "run-classified-platform");
      expect(userRecord.exitCode).toBe(1);
      expect(userRecord.outcomeClass).toBe("user-validation");
      expect(platformRecord.exitCode).toBe(2);
      expect(platformRecord.outcomeClass).toBe("platform-provider");
      expect(userRecord.command).toBe("status");
      expect(platformRecord.command).toBe("status");
      for (const reservation of reservationPayloadsOf(fixture.store)) {
        expect(Object.hasOwn(reservation, "arguments")).toBe(false);
        expect(Object.hasOwn(reservation, "outcomeClass")).toBe(false);
        expect(Object.hasOwn(reservation, "agentIdentity")).toBe(false);
        expect(Object.hasOwn(reservation, "command")).toBe(false);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-003 unknown failures", () => {
  test("thrown Error, thrown non-Error, and malformed results are audited once each", async () => {
    const fixture = makeAuditStore("outcomes-unknown");
    try {
      const nonError: CommandProgram = {
        commands: {
          status: {
            handler: () => {
              throw "synthetic non-error thrown value";
            },
          },
        },
      };
      const malformed: CommandProgram = {
        commands: { status: { handler: () => ({ malformed: true }) } },
      };
      const runs = [
        await runAudited(fixture, {
          argv: ["--json", "status"],
          program: programFor("unknown"),
          runId: "run-unknown-error",
        }),
        await runAudited(fixture, {
          argv: ["--json", "status"],
          program: nonError,
          runId: "run-unknown-non-error",
        }),
        await runAudited(fixture, {
          argv: ["--json", "status"],
          program: malformed,
          runId: "run-unknown-malformed",
        }),
      ];
      expect(runs.map((run) => run.exitCode)).toEqual([2, 2, 2]);
      for (const run of runs) {
        const envelope = JSON.parse(run.stdout) as { error: { code: string } };
        expect(envelope.error.code).toBe("fallback.internal");
        expect(run.stdout).not.toContain("synthetic unknown failure");
      }
      expect(invocationPayloadsOf(fixture.store)).toHaveLength(3);
      for (const runId of ["run-unknown-error", "run-unknown-non-error", "run-unknown-malformed"]) {
        const record = invocationFor(fixture.store, runId);
        expect(record.outcomeClass).toBe("platform-provider");
        expect(record.exitCode).toBe(2);
        expect(record.command).toBe("status");
        expect(record.scope).toBe("workspace-a");
        expect(Number.isInteger(record.startedAt)).toBe(true);
        expect(typeof record.auditSeq).toBe("number");
        const text = JSON.stringify(record);
        expect(text).not.toContain("partial");
        expect(text).not.toContain(" at ");
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-004 broken invocations", () => {
  test("every broken shape preserves raw tokens and appends one pair", async () => {
    const fixture = makeAuditStore("outcomes-broken");
    try {
      const cases = [
        { argv: BROKEN_ARGV.unknownCommand, command: "nope", runId: "run-broken-unknown" },
        { argv: BROKEN_ARGV.unknownFlag, command: "status", runId: "run-broken-flag" },
        { argv: BROKEN_ARGV.missingValue, command: "status", runId: "run-broken-value" },
        { argv: BROKEN_ARGV.conflictingFlags, command: "status", runId: "run-broken-conflict" },
      ];
      for (const entry of cases) {
        const run = await runAudited(fixture, {
          argv: entry.argv,
          program: programFor("success"),
          runId: entry.runId,
        });
        expect(run.exitCode).toBe(1);
        const envelope = JSON.parse(run.stdout) as { error: { code: string } };
        expect(envelope.error.code).toBe("fallback.invocation");
      }
      expect(auditPairsOf(fixture.store)).toHaveLength(4);
      for (const entry of cases) {
        const record = invocationFor(fixture.store, entry.runId);
        expect(record.command).toBe(entry.command);
        expect(record.arguments).toEqual([...entry.argv]);
        expect(record.exitCode).toBe(1);
        expect(record.outcomeClass).toBe("user-validation");
        expect(Number.isInteger(record.startedAt)).toBe(true);
        expect(record.scope).toBe("workspace-a");
      }
      for (const reservation of reservationPayloadsOf(fixture.store)) {
        expect(Object.keys(reservation)).toEqual(["schemaId", "auditSeq", "runId", "chainValue"]);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});
