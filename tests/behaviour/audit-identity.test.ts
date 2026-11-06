/**
 * TC-GH223-011 (identity present, verbatim + claimed) and TC-GH223-012
 * (absent/empty/whitespace-only is absent, never inferred).
 */
import { describe, expect, test } from "bun:test";
import { invocationPayloadsOf, makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { IDENTITY_VARIABLE, programFor, runAudited } from "./audit-run-support";

const recordFor = (
  store: Parameters<typeof invocationPayloadsOf>[0],
  runId: string,
): Record<string, unknown> => {
  const record = invocationPayloadsOf(store).find((payload) => payload.runId === runId);
  if (record === undefined) throw new Error(`record missing for ${runId}`);
  return record;
};

describe("TC-GH223-011 identity present", () => {
  test("the value is recorded verbatim with the explicit claimed marker", async () => {
    const fixture = makeAuditStore("identity-present");
    try {
      await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-identity-present",
        environment: { [IDENTITY_VARIABLE]: "pm-lane-7" },
      });
      const record = recordFor(fixture.store, "run-identity-present");
      expect(record.agentIdentity).toEqual({ kind: "claimed", value: "pm-lane-7" });
      const serialized = JSON.stringify(record.agentIdentity);
      expect(serialized).not.toContain("verified");
      expect(serialized).not.toContain("authenticated");

      await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("void"),
        runId: "run-identity-verbatim",
        environment: { [IDENTITY_VARIABLE]: "  QA-Lane-03 / MiXeD-Ünïcode  " },
      });
      const verbatim = recordFor(fixture.store, "run-identity-verbatim");
      expect(verbatim.agentIdentity).toEqual({
        kind: "claimed",
        value: "  QA-Lane-03 / MiXeD-Ünïcode  ",
      });
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("identity does not change the outcome, exit code, or scope", async () => {
    const fixture = makeAuditStore("identity-neutral");
    try {
      const withIdentity = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-with-identity",
        environment: { [IDENTITY_VARIABLE]: "pm-lane-7" },
      });
      const withoutIdentity = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-without-identity",
      });
      expect(withIdentity.exitCode).toBe(withoutIdentity.exitCode);
      const left = recordFor(fixture.store, "run-with-identity");
      const right = recordFor(fixture.store, "run-without-identity");
      expect(left.exitCode).toBe(right.exitCode);
      expect(left.outcomeClass).toBe(right.outcomeClass);
      expect(left.scope).toBe(right.scope);
      expect(left.command).toBe(right.command);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-012 identity absent is never inferred", () => {
  test("absent, empty, and whitespace-only all record no identity", async () => {
    const fixture = makeAuditStore("identity-absent");
    try {
      const inferenceEnvironment = {
        USER: "operator",
        HOSTNAME: "synthetic-host",
        SESSION_ID: "session-123",
        PWD: "/work",
      };
      const cases = [
        { runId: "run-id-absent", environment: inferenceEnvironment },
        {
          runId: "run-id-empty",
          environment: { ...inferenceEnvironment, [IDENTITY_VARIABLE]: "" },
        },
        {
          runId: "run-id-whitespace",
          environment: { ...inferenceEnvironment, [IDENTITY_VARIABLE]: "   \t " },
        },
      ];
      for (const entry of cases) {
        await runAudited(fixture, {
          argv: ["--json", "status"],
          program: programFor("success"),
          runId: entry.runId,
          environment: entry.environment,
        });
      }
      for (const entry of cases) {
        const record = recordFor(fixture.store, entry.runId);
        expect(Object.hasOwn(record, "agentIdentity")).toBe(false);
        const text = JSON.stringify(record);
        expect(text).not.toContain("operator");
        expect(text).not.toContain("synthetic-host");
        expect(text).not.toContain("session-123");
        expect(text).not.toContain("/work");
      }
      const shapes = cases.map((entry) => {
        const record = recordFor(fixture.store, entry.runId);
        return Object.keys(record).sort();
      });
      expect(shapes[0]).toEqual(shapes[1]);
      expect(shapes[1]).toEqual(shapes[2]);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
