/**
 * TC-TELEMETRY-028 / 029 — the brief cites the spend numbers with the
 * reconciliation disclosure on every telemetry-present render, and renders the
 * classified absence (never zeros, never silence) when telemetry is absent.
 * The closed surface catalog grows by exactly the one declared spend surface.
 */
import { describe, expect, test } from "bun:test";
import {
  BRIEF_SURFACE_ORDER,
  type SpendDigestSection,
  type StatusFacts,
} from "../../packages/core/src/contracts/index";
import { projectBrief, spendDigestSection } from "../../packages/core/src/domain/index";
import { readSpendLedger } from "../../packages/core/src/state/index";
import { baseFacts, briefRuntime, runBriefCli } from "../fixtures/brief/harness";
import {
  foldTelemetryStore,
  makeBaselineRecord,
  makeStepRecord,
  removeRoot,
  RUN_A,
  SESSION_A,
  T1,
  tokens,
} from "../fixtures/telemetry";

const roots: string[] = [];

const cleanup = (): void => {
  for (const root of roots.splice(0)) removeRoot(root);
};

const presentProjection = (): SpendDigestSection => {
  const fixture = foldTelemetryStore(
    {
      steps: [
        makeStepRecord({
          runId: RUN_A,
          sessionId: SESSION_A,
          agentRole: "coder",
          model: "model-alpha",
          tokens: tokens({ input: 100, output: 50 }),
          calls: 1,
          cost: 0.01,
          finishedAt: T1,
        }),
      ],
      baselines: [
        makeBaselineRecord({
          runId: RUN_A,
          sessionId: SESSION_A,
          tokens: tokens({ input: 100, output: 50 }),
        }),
      ],
    },
    "brief-spend",
  );
  roots.push(fixture.root);
  const read = readSpendLedger(fixture.store, "GH-291");
  if (!read.ok) throw new Error(`read failed: ${read.error.code}`);
  return spendDigestSection(read.value);
};

const factsWith = (spend: SpendDigestSection): StatusFacts => ({ ...baseFacts(), spend });

const parseData = (stdout: string): Record<string, unknown> => {
  const envelope = JSON.parse(stdout) as { readonly data?: Record<string, unknown> };
  const data = envelope.data;
  if (data === undefined) throw new Error("data missing");
  return data;
};

describe("TC-TELEMETRY-028 brief cites spend with the reconciliation disclosure", () => {
  test("the machine payload cites figures and the stated disclosure", async () => {
    const projection = presentProjection();
    const facts = factsWith(projection);
    const brief = projectBrief(facts);
    expect(brief.spend?.state).toBe("present");
    if (brief.spend?.state !== "present") return;
    expect(brief.spend.roles.map((entry) => entry.value)).toEqual(["coder"]);
    expect(brief.spend.models.map((entry) => entry.value)).toEqual(["model-alpha"]);
    expect(brief.spend.reconciliation).toEqual({
      verdict: "within",
      tolerance: 0.02,
      basis: "stream-ingest",
    });
    const run = await runBriefCli(["--json", "brief"], briefRuntime(facts));
    expect(run.exitCode).toBe(0);
    const spend = parseData(run.stdout).spend as Record<string, unknown>;
    expect(spend.state).toBe("present");
    expect(spend.reconciliation).toEqual(brief.spend.reconciliation);
    cleanup();
  });

  test("the human render cites the numbers and the disclosure", async () => {
    const facts = factsWith(presentProjection());
    const run = await runBriefCli(["brief"], briefRuntime(facts));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("spend  present  total 150 tokens");
    expect(run.stdout).toContain("roles coder:150");
    expect(run.stdout).toContain("models model-alpha:150");
    expect(run.stdout).toContain("reconcile within (tolerance 0.02, basis stream-ingest)");
    cleanup();
  });

  test("the closed catalog grows by exactly the declared spend surface", () => {
    expect(BRIEF_SURFACE_ORDER).toEqual([
      "tracker",
      "changes-and-prs",
      "ci",
      "lanes-or-queue",
      "providers",
      "parked-work",
      "typed-questions",
      "spend",
      "gate-sla-states",
      "lane-queue-engine",
    ]);
    const brief = projectBrief(factsWith(presentProjection()));
    expect(brief.surfaces.map((surface) => surface.id)).toEqual([...BRIEF_SURFACE_ORDER]);
    // The two placeholders keep their delivered states.
    expect(brief.placeholders.map((entry) => entry.capability)).toEqual([
      "gate-sla-states",
      "lane-queue-engine",
    ]);
    cleanup();
  });
});

describe("TC-TELEMETRY-029 brief renders classified absence instead of zeros", () => {
  test("an absent delivery renders the classified absence, never zeros", async () => {
    const facts = factsWith({ state: "observed", captured: false });
    const run = await runBriefCli(["brief"], briefRuntime(facts));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain("spend  absent  spend.telemetry-absent");
    expect(run.stdout).not.toContain("total 0 tokens");
    expect(run.stdout).not.toContain("roles none");
    const brief = projectBrief(facts);
    expect(brief.spend).toEqual({ state: "absent", code: "spend.telemetry-absent" });
  });

  test("the paired present control cites figures (non-vacuity)", async () => {
    const run = await runBriefCli(["brief"], briefRuntime(factsWith(presentProjection())));
    expect(run.stdout).toContain("spend  present");
    expect(run.stdout).not.toContain("spend  absent");
    cleanup();
  });

  test("no zero-valued spend figure appears anywhere in the absent render", async () => {
    const facts = factsWith({ state: "observed", captured: false });
    const run = await runBriefCli(["--json", "brief"], briefRuntime(facts));
    const spend = parseData(run.stdout).spend as Record<string, unknown>;
    expect(spend).toEqual({ state: "absent", code: "spend.telemetry-absent" });
    expect(JSON.stringify(spend)).not.toContain("tokensByClass");
  });
});
