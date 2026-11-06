/**
 * TC-GH223-022 — SC-M1-23: a scripted invocation is audited and trimmed
 * end-to-end (`lanes list --json` stand-in, lane identity, planted secret).
 */
import { describe, expect, test } from "bun:test";
import type { CommandProgram } from "../../packages/cli/src/index";
import { assertScriptedProjection } from "../../packages/testkit/src/result-conformance";
import {
  auditRecordsOf,
  invocationPayloadsOf,
  makeAuditStore,
  removeRoot,
  reservationPayloadsOf,
} from "../fixtures/state/harness";
import { IDENTITY_VARIABLE, programFor, runAudited } from "./audit-run-support";

const LANES_DATA = { lanes: [{ id: "lane-7", agent: "pm", state: "active" }] };

const lanesProgram = (): CommandProgram => ({
  commands: {
    lanes: {
      handler: (invocation) => {
        if (invocation.positionals.includes("boom")) throw { kind: "input" };
        return { data: LANES_DATA };
      },
      positionals: { max: 2 },
    },
  },
});

const recordFor = (
  store: Parameters<typeof invocationPayloadsOf>[0],
  runId: string,
): Record<string, unknown> => {
  const record = invocationPayloadsOf(store).find((payload) => payload.runId === runId);
  if (record === undefined) throw new Error(`audit record missing for ${runId}`);
  return record;
};

describe("TC-GH223-022 SC-M1-23 scripted invocation audited and trimmed", () => {
  test("lane invocation is trimmed, audited, and free of the planted secret", async () => {
    const fixture = makeAuditStore("scenario-m1-23");
    try {
      const secret = "planted-fake-scenario-secret";
      const environment = { [IDENTITY_VARIABLE]: "pm-lane-7" };
      const first = await runAudited(fixture, {
        argv: ["--json", "lanes", "list", secret],
        program: lanesProgram(),
        runId: "run-scenario-1",
        ticks: [1000, 1013],
        mode: "scripted",
        environment,
        secrets: [secret],
      });
      expect(first.exitCode).toBe(0);
      expect(first.stdout).not.toContain(secret);
      expect(first.stderr).not.toContain(secret);
      const line = first.stdout.trimEnd();
      expect(line.includes("\n")).toBe(false);
      const parsed = JSON.parse(line) as Record<string, unknown>;
      expect(Object.keys(parsed)).toEqual(["data"]);
      for (const token of ["schemaVersion", "runId", "timing"]) {
        expect(line).not.toContain(token);
      }
      expect(assertScriptedProjection(first.stdout)).toEqual([]);

      const record = recordFor(fixture.store, "run-scenario-1");
      expect(record.command).toBe("lanes");
      expect(record.arguments).toEqual(["--json", "lanes", "list", "[redacted]"]);
      expect(record.exitCode).toBe(0);
      expect(record.resultSchemaVersion).toBe("delivery.result.v1");
      expect(record.startedAt).toBe(1000);
      expect(record.agentIdentity).toEqual({ kind: "claimed", value: "pm-lane-7" });
      expect(record.auditSeq).toBe(1);

      const second = await runAudited(fixture, {
        argv: ["--json", "lanes", "list"],
        program: lanesProgram(),
        runId: "run-scenario-2",
        ticks: [2000, 2013],
        mode: "scripted",
        environment,
        secrets: [secret],
      });
      expect(second.exitCode).toBe(0);
      const rerun = recordFor(fixture.store, "run-scenario-2");
      expect(rerun.startedAt).toBe(2000);
      expect(rerun.auditSeq).toBe(2);
      expect(rerun.runId).not.toBe(record.runId);

      const failure = await runAudited(fixture, {
        argv: ["--json", "lanes", "boom"],
        program: lanesProgram(),
        runId: "run-scenario-failure",
        ticks: [3000, 3013],
        mode: "scripted",
        environment,
        secrets: [secret],
      });
      expect(failure.exitCode).toBe(1);
      const failureLine = JSON.parse(failure.stdout) as { error: unknown; runId: string };
      expect(Object.keys(failureLine).sort()).toEqual(["error", "runId"]);
      expect(failureLine.runId).toBe("run-scenario-failure");
      expect(recordFor(fixture.store, "run-scenario-failure")).toBeDefined();

      const identityCases = [{}, { [IDENTITY_VARIABLE]: "" }, { [IDENTITY_VARIABLE]: "   " }];
      for (const [index, identityCase] of identityCases.entries()) {
        const runId = `run-scenario-identity-${index}`;
        await runAudited(fixture, {
          argv: ["--json", "lanes", "list"],
          program: lanesProgram(),
          runId,
          ticks: [4000, 4013],
          mode: "scripted",
          environment: identityCase,
          secrets: [secret],
        });
        const identityRecord = recordFor(fixture.store, runId);
        expect(Object.hasOwn(identityRecord, "agentIdentity")).toBe(false);
      }

      expect(invocationPayloadsOf(fixture.store)).toHaveLength(6);
      expect(reservationPayloadsOf(fixture.store)).toHaveLength(6);
      const text = auditRecordsOf(fixture.store)
        .map((record) => JSON.stringify(record))
        .join("\n");
      expect(text).not.toContain(secret);
      for (const reservation of reservationPayloadsOf(fixture.store)) {
        expect(Object.keys(reservation)).toEqual(["schemaId", "auditSeq", "runId", "chainValue"]);
      }
      expect(programFor("success")).toBeDefined();
    } finally {
      removeRoot(fixture.root);
    }
  });
});
