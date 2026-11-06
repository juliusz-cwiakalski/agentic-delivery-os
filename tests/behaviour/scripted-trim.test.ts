/**
 * TC-GH223-014..TC-GH223-017 — scripted-mode rendering is one minified line;
 * the trimmed context is retained in the audit record. TC-022's channel rules
 * are asserted here too.
 */
import { describe, expect, test } from "bun:test";
import { assertScriptedProjection } from "../../packages/testkit/src/result-conformance";
import { createNoSpawnGuard } from "../fixtures/result/no-spawn-guard";
import {
  appendAuditFacts,
  invocationPayloadsOf,
  makeAuditStore,
  removeRoot,
} from "../fixtures/state/harness";
import { BROKEN_ARGV, programFor, runAudited } from "./audit-run-support";

const recordFor = (
  store: Parameters<typeof invocationPayloadsOf>[0],
  runId: string,
): Record<string, unknown> => {
  const record = invocationPayloadsOf(store).find((payload) => payload.runId === runId);
  if (record === undefined) throw new Error(`audit record missing for ${runId}`);
  return record;
};

const oneLine = (text: string): boolean =>
  text.endsWith("\n") && text.indexOf("\n") === text.length - 1;

describe("TC-GH223-014/015 scripted success and void", () => {
  test("success is one minified data line and the audit record keeps the context", async () => {
    const fixture = makeAuditStore("scripted-success");
    try {
      const run = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("success"),
        runId: "run-scripted-success",
        ticks: [1000, 1013],
        mode: "scripted",
      });
      expect(run.exitCode).toBe(0);
      expect(oneLine(run.stdout)).toBe(true);
      expect(run.stdout).toBe('{"data":{"message":"all good","count":2}}\n');
      expect(Object.keys(JSON.parse(run.stdout) as object)).toEqual(["data"]);
      for (const token of ["schemaVersion", "runId", "exitCode", "timing"]) {
        expect(run.stdout).not.toContain(token);
      }
      expect(assertScriptedProjection(run.stdout)).toEqual([]);

      const record = recordFor(fixture.store, "run-scripted-success");
      expect(record.runId).toBe("run-scripted-success");
      expect(record.resultSchemaVersion).toBe("delivery.result.v1");
      expect(record.timing).toEqual({ totalMs: 13 });
      expect(record.exitCode).toBe(0);
      expect(record.outcomeClass).toBe("success");
    } finally {
      removeRoot(fixture.root);
    }
  });

  test('TC-GH223-015 void success renders exactly {"data":{}}', async () => {
    const fixture = makeAuditStore("scripted-void");
    try {
      const run = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("void"),
        runId: "run-scripted-void",
        mode: "scripted",
      });
      expect(run.stdout).toBe('{"data":{}}\n');
      expect(JSON.parse(run.stdout)).toEqual({ data: {} });
      const record = recordFor(fixture.store, "run-scripted-void");
      expect(record.outcomeClass).toBe("success");
      expect(record.exitCode).toBe(0);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-016/017 scripted failure projection", () => {
  test("classified failures carry full error fields and a top-level runId", async () => {
    const fixture = makeAuditStore("scripted-failures");
    try {
      const user = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("classified-user"),
        runId: "run-scripted-user",
        mode: "scripted",
      });
      const platform = await runAudited(fixture, {
        argv: ["--json", "status"],
        program: programFor("classified-platform"),
        runId: "run-scripted-platform",
        mode: "scripted",
      });
      expect(user.exitCode).toBe(1);
      expect(platform.exitCode).toBe(2);
      for (const [run, runId] of [
        [user, "run-scripted-user"],
        [platform, "run-scripted-platform"],
      ] as const) {
        expect(oneLine(run.stdout)).toBe(true);
        const parsed = JSON.parse(run.stdout) as {
          error: Record<string, unknown>;
          runId: string;
        };
        expect(Object.keys(parsed).sort()).toEqual(["error", "runId"]);
        expect(parsed.runId).toBe(runId);
        expect(parsed.error).toMatchObject({
          code: expect.any(String),
          category: expect.any(String),
          retryable: expect.any(Boolean),
          consequence: expect.any(String),
          remediationHint: expect.any(String),
        });
        expect(Object.hasOwn(parsed.error, "runId")).toBe(false);
        for (const token of ["schemaVersion", "exitCode", "timing"]) {
          expect(run.stdout).not.toContain(token);
        }
        expect(assertScriptedProjection(run.stdout)).toEqual([]);
        const record = recordFor(fixture.store, runId);
        expect(record.resultSchemaVersion).toBe("delivery.result.v1");
        expect(record.exitCode).toBe(run.exitCode);
        expect(record.outcomeClass).toBe(
          runId === "run-scripted-user" ? "user-validation" : "platform-provider",
        );
      }
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("unknown and broken invocations use the same projection; every run is audited once", async () => {
    const fixture = makeAuditStore("scripted-unknown-broken");
    try {
      const runs = [
        await runAudited(fixture, {
          argv: ["--json", "status"],
          program: programFor("unknown"),
          runId: "run-scripted-unknown",
          mode: "scripted",
        }),
        await runAudited(fixture, {
          argv: BROKEN_ARGV.unknownCommand,
          program: programFor("success"),
          runId: "run-scripted-broken",
          mode: "scripted",
        }),
      ];
      expect(runs.map((run) => run.exitCode)).toEqual([2, 1]);
      for (const [run, runId] of [
        [runs[0], "run-scripted-unknown"],
        [runs[1], "run-scripted-broken"],
      ] as const) {
        if (run === undefined) continue;
        const parsed = JSON.parse(run.stdout) as { error: { code: string }; runId: string };
        expect(parsed.runId).toBe(runId);
        expect(Object.keys(parsed).sort()).toEqual(["error", "runId"]);
        expect(run.stdout).not.toContain(" at ");
        expect(run.stdout).not.toContain("/home/");
        expect(assertScriptedProjection(run.stdout)).toEqual([]);
        expect(recordFor(fixture.store, runId)).toBeDefined();
      }
      expect(invocationPayloadsOf(fixture.store)).toHaveLength(2);
    } finally {
      removeRoot(fixture.root);
    }
  });
});

describe("TC-GH223-014 no-spawn guard", () => {
  test("a scripted run spawns nothing and touches no real stream", async () => {
    const fixture = makeAuditStore("scripted-nospawn");
    try {
      const guard = createNoSpawnGuard();
      guard.install();
      try {
        const run = await runAudited(fixture, {
          argv: ["--json", "status"],
          program: programFor("success"),
          runId: "run-scripted-nospawn",
          mode: "scripted",
        });
        expect(run.exitCode).toBe(0);
      } finally {
        guard.restore();
      }
      expect(guard.violations).toEqual([]);
      appendAuditFacts(fixture.store, { runId: "run-guard-control" });
    } finally {
      removeRoot(fixture.root);
    }
  });
});
