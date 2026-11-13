/**
 * TC-TELEMETRY-037 — every spend invocation lands its delivered command-audit
 * record, and an audit-write failure is a diagnostic that never changes the
 * outcome, report, or exit (§10, §21).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { runSpendCli, spendRuntimeOver } from "../fixtures/spend/harness";
import {
  foldTelemetryStore,
  makeBaselineRecord,
  makeStepRecord,
  removeRoot,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const seeded = (label: string) => {
  const fixture = foldTelemetryStore(
    {
      steps: [makeStepRecord({ sessionId: "ses_audit", tokens: tokens({ input: 12 }) })],
      baselines: [makeBaselineRecord({ sessionId: "ses_audit", tokens: tokens({ input: 12 }) })],
    },
    label,
  );
  roots.push(fixture.root);
  return fixture;
};

describe("TC-TELEMETRY-037 invocation audit composes", () => {
  test("each invocation lands one audit record with its run id and outcome", async () => {
    const fixture = seeded("audit-compose");
    const records: Array<Record<string, unknown>> = [];
    const run = await runSpendCli(
      ["--json", "spend", "--ref", "GH-291"],
      spendRuntimeOver(fixture.store),
      {
        runId: "run-audit-fixture",
        audit: {
          scope: "workspace-a",
          record: (facts) => {
            records.push(facts as unknown as Record<string, unknown>);
            return { ok: true };
          },
        },
      },
    );
    expect(run.exitCode).toBe(0);
    expect(records).toHaveLength(1);
    const facts = records[0];
    expect(facts?.runId).toBe("run-audit-fixture");
    expect(facts?.command).toBe("spend");
    expect(facts?.exitCode).toBe(0);
  });

  test("an audit-write failure is a diagnostic and never changes the outcome", async () => {
    const fixture = seeded("audit-failure");
    const run = await runSpendCli(
      ["--json", "spend", "--ref", "GH-291"],
      spendRuntimeOver(fixture.store),
      {
        audit: { scope: "workspace-a", record: () => ({ ok: false, code: "state.write.failed" }) },
      },
    );
    expect(run.exitCode).toBe(0);
    expect(run.stderr).toContain("state.write.failed");
    const envelope = JSON.parse(run.stdout) as { readonly data?: Record<string, unknown> };
    expect(envelope.data?.telemetryState).toBe("present");
    const reconciliation = envelope.data?.reconciliation as Record<string, unknown>;
    expect(reconciliation.verdict).toBe("within");
  });

  test("the absent invocation also lands its audit record without changing the exit", async () => {
    const fixture = foldTelemetryStore({}, "audit-absent");
    roots.push(fixture.root);
    const records: Array<Record<string, unknown>> = [];
    const run = await runSpendCli(
      ["--json", "spend", "--ref", "GH-291"],
      spendRuntimeOver(fixture.store),
      {
        audit: {
          scope: "workspace-a",
          record: (facts) => {
            records.push(facts as unknown as Record<string, unknown>);
            return { ok: true };
          },
        },
      },
    );
    expect(run.exitCode).toBe(1);
    expect(records).toHaveLength(1);
    expect(records[0]?.exitCode).toBe(1);
    expect(records[0]?.outcomeClass).toBe("user-validation");
  });
});
