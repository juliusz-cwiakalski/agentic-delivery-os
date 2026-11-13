/**
 * TC-TELEMETRY-031 — every rendered spend summary states the telemetry state
 * and, when telemetry is present, the reconciliation tolerance. No path applies
 * the tolerance silently: the command (human and machine), the digest, the
 * brief, and the retro citation all carry the disclosure (AC-N1-1, DM-3, DM-4).
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  aggregateStatus,
  projectBrief,
  renderBriefHuman,
} from "../../packages/core/src/domain/index";
import { collectRetro, reportRetro } from "../../packages/core/src/domain/retro";
import { baseFacts } from "../fixtures/brief/harness";
import {
  auditOutcome,
  collectDeps,
  makeRetroDir,
  reportDeps,
  transitionRecord,
} from "../fixtures/retro/harness";
import { runSpendCli, spendRuntimeOver } from "../fixtures/spend/harness";
import {
  foldTelemetryStore,
  makeBaselineRecord,
  makeStepRecord,
  RUN_A,
  removeRoot,
  SESSION_A,
  T1,
  tokens,
} from "../fixtures/telemetry";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const presentStore = (label: string) => {
  const fixture = foldTelemetryStore(
    {
      steps: [
        makeStepRecord({
          runId: RUN_A,
          sessionId: SESSION_A,
          tokens: tokens({ input: 60, output: 40 }),
          calls: 1,
          cost: 0.01,
          finishedAt: T1,
        }),
      ],
      baselines: [
        makeBaselineRecord({
          runId: RUN_A,
          sessionId: SESSION_A,
          tokens: tokens({ input: 60, output: 40 }),
        }),
      ],
    },
    label,
  );
  roots.push(fixture.root);
  return fixture;
};

const absentStore = (label: string) => {
  const fixture = foldTelemetryStore({}, label);
  roots.push(fixture.root);
  return fixture;
};

const unavailableBaselineStore = (label: string) => {
  const fixture = foldTelemetryStore(
    { steps: [makeStepRecord({ sessionId: SESSION_A, tokens: tokens({ input: 30 }) })] },
    label,
  );
  roots.push(fixture.root);
  return fixture;
};

const commandHuman = async (fixture: ReturnType<typeof presentStore>): Promise<string> => {
  const run = await runSpendCli(["spend", "--ref", "GH-291"], spendRuntimeOver(fixture.store));
  return run.stdout;
};

const commandJson = async (
  fixture: ReturnType<typeof presentStore>,
): Promise<Record<string, unknown>> => {
  const run = await runSpendCli(
    ["--json", "spend", "--ref", "GH-291"],
    spendRuntimeOver(fixture.store),
  );
  const envelope = JSON.parse(run.stdout) as { readonly data?: Record<string, unknown> };
  if (envelope.data === undefined) throw new Error("data missing");
  return envelope.data;
};

describe("TC-TELEMETRY-031 every summary states telemetry state and tolerance", () => {
  test("command human and machine states carry the state and the stated tolerance", async () => {
    const fixture = presentStore("disclosure-command");
    const human = await commandHuman(fixture);
    expect(human).toContain("telemetry  present");
    expect(human).toContain("reconcile  within (tolerance 0.02");
    const data = await commandJson(fixture);
    expect(data.telemetryState).toBe("present");
    const reconciliation = data.reconciliation as Record<string, unknown>;
    expect(reconciliation.tolerance).toBe(0.02);
    expect(reconciliation.verdict).toBe("within");
  });

  test("the digest projection states the same state and disclosure", async () => {
    const fixture = presentStore("disclosure-digest");
    const run = await runSpendCli(
      ["--json", "spend", "--ref", "GH-291"],
      spendRuntimeOver(fixture.store),
    );
    const data = JSON.parse(run.stdout).data as Record<string, unknown>;
    const digest = aggregateStatus({ ...baseFacts(), spend: data as never });
    const section = digest.sections.find((entry) => entry.id === "spend");
    expect(section).toBeDefined();
    if (section === undefined) return;
    expect(section.spend?.telemetryState).toBe("present");
    expect(section.spend?.reconciliation?.tolerance).toBe(0.02);
  });

  test("the brief states the disclosure on a present render", () => {
    const fixture = presentStore("disclosure-brief");
    const read = fixture.store;
    expect(read).toBeDefined();
    const data = {
      state: "observed",
      captured: true,
      tokensByClass: { input: 60, output: 40, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
      restarts: 0,
      ratio: 1,
      telemetryState: "present",
      reconciliation: {
        basis: "stream-ingest",
        harnessTotals: { input: 60, output: 40, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
        observedTotals: { input: 60, output: 40, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
        tolerance: 0.02,
        verdict: "within",
        excludedBaselineSessions: 0,
      },
      byRole: [],
      byModel: [],
    } as const;
    const brief = projectBrief({ ...baseFacts(), spend: data });
    const human = renderBriefHuman(brief, SYNTHETIC_BRAND);
    expect(human).toContain("spend  present");
    expect(human).toContain("tolerance 0.02");
  });

  test("the retro citation states the tolerance on a present report", () => {
    const fixture = makeRetroDir("disclosure-retro");
    fixture.scriptDeliveryChanges([
      {
        changeRef: "GH-291",
        completedAt: "2026-11-06T10:00:00Z",
        transitions: [transitionRecord({ changeRef: "GH-291", timestamp: "2026-11-06T10:00:00Z" })],
      },
    ]);
    fixture.scriptAudit(auditOutcome({ records: [] }));
    fixture.scriptStateFamilies("GH-291", {
      transitions: [transitionRecord({ changeRef: "GH-291" })],
      closeouts: [{ outcome: "complete" }],
      telemetry: [],
    });
    fixture.scriptNotes("GH-291", { retroNotes: [] });
    const base = collectDeps(fixture);
    const collected = collectRetro(
      collectDeps(fixture, {
        collectors: {
          ...base.collectors,
          readSpend: () => ({
            state: "present",
            tokensByClass: { input: 1, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
            roles: [],
            models: [],
            timing: [],
            reconciliation: { verdict: "within", tolerance: 0.02, basis: "stream-ingest" },
          }),
        },
      }),
    );
    expect(collected.ok).toBe(true);
    const report = reportRetro(reportDeps(fixture));
    expect(report.ok).toBe(true);
    if (!report.ok || !("findings" in report.data)) return;
    const spend = report.data.spend;
    if (spend === undefined || spend.state !== "present") throw new Error("spend citation missing");
    expect(spend.reconciliation?.tolerance).toBe(0.02);
  });

  test("absent and unavailable-baseline stores still state a disclosure", async () => {
    const absent = absentStore("disclosure-absent");
    const absentRun = await runSpendCli(
      ["--json", "spend", "--ref", "GH-291"],
      spendRuntimeOver(absent.store),
    );
    expect(absentRun.exitCode).toBe(1);
    expect(absentRun.stdout).toContain("spend.telemetry-absent");
    expect(absentRun.stdout).not.toContain("tokensByClass");

    const unavailable = unavailableBaselineStore("disclosure-unavailable");
    const human = await commandHuman(unavailable);
    expect(human).toContain("telemetry  present");
    expect(human).toContain("reconcile  unavailable (tolerance 0.02");
  });

  test("no path renders a reconciliation claim without the stated tolerance", async () => {
    const fixture = presentStore("disclosure-no-silent");
    for (const output of [
      await commandHuman(fixture),
      JSON.stringify(await commandJson(fixture)),
    ]) {
      const claims = output.match(/reconcile|verdict|within|outside|unavailable/gu) ?? [];
      if (claims.length === 0) continue;
      expect(output).toContain("0.02");
    }
  });
});
