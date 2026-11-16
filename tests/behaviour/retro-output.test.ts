/**
 * TC-RETRO-063 — the envelope/exit matrix, data XOR error, scripted one-line
 * discipline, and human partial output before the diagnostic.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recordRetroRun } from "../../packages/core/src/state/index";
import { conformingDraft } from "../fixtures/action/builders";
import { NOW_MS } from "../fixtures/action/clock";
import { fileAction } from "../fixtures/action/seed";
import {
  appendEvidence,
  auditOutcome,
  auditRecord,
  makeRetroDir,
  mutateContent,
  type RetroFixture,
  runRetro,
  transitionRecord,
} from "../fixtures/retro/harness";

type GoldenCase = {
  readonly id: string;
  readonly scenario: string;
  readonly argv: readonly string[];
  readonly expected: {
    readonly exitCode: number;
    readonly outcome?: string;
    readonly errorCode?: string;
    readonly dataKeys?: readonly string[];
  };
};

const cases = (
  JSON.parse(readFileSync(join(process.cwd(), "tests/golden/retro/cases.json"), "utf8")) as {
    cases: GoldenCase[];
  }
).cases;

const codeOf = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

const seed = (label: string, scenario: string): RetroFixture => {
  const fixture = makeRetroDir(label);
  fixture.scriptDeliveryChanges([
    {
      changeRef: "GH-232",
      completedAt: "2026-11-06T12:00:00Z",
      transitions: [transitionRecord({ changeRef: "GH-232", timestamp: "2026-11-06T12:00:00Z" })],
    },
  ]);
  fixture.scriptAudit(auditOutcome({ records: [auditRecord()] }));
  fixture.scriptStateFamilies("GH-232", {
    transitions: [transitionRecord({ changeRef: "GH-232" })],
    closeouts: [{ outcome: "complete" }],
    telemetry: [],
  });
  fixture.scriptNotes("GH-232", { retroNotes: ["note"] });
  if (scenario === "no-target") {
    expect(
      recordRetroRun(
        fixture.store,
        {
          schemaId: "delivery.retro.run.v1",
          runId: "run-seed",
          level: "change",
          mode: "collect",
          scope: "GH-232",
          counts: { collected: 1, malformed: 0, skippedSource: 0 },
          consumed: [],
          truth: { clean: true, blocking: null, checks: [] },
        },
        "seed-run",
      ).ok,
    ).toBe(true);
  }
  if (scenario === "tamper" || scenario === "malformed") {
    appendEvidence(fixture);
    appendEvidence(fixture);
    if (scenario === "tamper") {
      mutateContent(fixture, 1, (record) => {
        record.payloadRefs = ["text:tampered"];
      });
    } else {
      mutateContent(fixture, 1, (record) => {
        delete record.traceId;
      });
    }
  }
  return fixture;
};

describe("TC-RETRO-063 envelope and exit matrix", () => {
  test("every golden case produces the declared exit and envelope shape", async () => {
    for (const golden of cases.filter((entry) => !entry.scenario.startsWith("action-"))) {
      const fixture = seed(`output-${golden.id}`, golden.scenario);
      const result = await runRetro(golden.argv, fixture, {
        ...(golden.scenario === "denied"
          ? { collect: { context: "delivery-agent" as const } }
          : {}),
      });
      expect(result.exitCode, golden.id).toBe(golden.expected.exitCode);
      const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(Object.keys(parsed).sort(), golden.id).toEqual(
        "error" in parsed ? ["error", "runId"] : ["data"],
      );
      if (golden.expected.errorCode !== undefined) {
        expect(codeOf(parsed.error), golden.id).toBe(golden.expected.errorCode);
        expect(Object.hasOwn(parsed, "data"), golden.id).toBe(false);
      } else {
        expect(Object.hasOwn(parsed, "error"), golden.id).toBe(false);
        const data = parsed.data as Record<string, unknown>;
        if (golden.expected.outcome !== undefined) {
          expect(data.outcome, golden.id).toBe(golden.expected.outcome);
        }
        if (golden.expected.dataKeys !== undefined) {
          expect(Object.keys(data).sort(), golden.id).toEqual([...golden.expected.dataKeys]);
        }
      }
      expect(result.stdout.trimEnd().split("\n")).toHaveLength(1);
      expect(result.stdout.endsWith("\n")).toBe(true);
    }
  });

  test("human partial output is preserved before the diagnostic on exit 1", async () => {
    const fixture = seed("output-human-partial", "malformed");
    const result = await runRetro(["retro", "report"], fixture);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("preserved evidence records");
    expect(result.stderr).toContain("retro.evidence.malformed-entry");
  });
});

/* ---------------------------------------------------------------------- */
/* GH-287: the additive `retro action` verb group golden cases             */
/* ---------------------------------------------------------------------- */

const actionCases = cases.filter((golden) => golden.scenario.startsWith("action-"));

const seedActionsFor = (fixture: RetroFixture, scenario: string): void => {
  const seed = (window: string, overrides: Record<string, unknown> = {}) => {
    const outcome = fileAction(fixture.store, conformingDraft({ window, ...overrides }), {
      actionId: "action-golden",
      filedAt: NOW_MS,
    });
    if (!outcome.ok) throw new Error(`seed failed: ${String(outcome.error.code)}`);
  };
  if (scenario === "action-close" || scenario === "action-list") seed("window-a");
  if (scenario === "action-wip") {
    for (let index = 0; index < 3; index += 1) {
      const outcome = fileAction(fixture.store, conformingDraft({ window: "window-full" }), {
        actionId: `action-golden-${String(index)}`,
        filedAt: NOW_MS,
      });
      if (!outcome.ok) throw new Error("seed failed");
    }
  }
};

const runActionRetro = async (
  argv: readonly string[],
  fixture: RetroFixture,
): Promise<{ readonly exitCode: number; readonly stdout: string }> => {
  const [{ createRetroCommandRuntime }, { createRetroCommandDefinition }, { runCli }, helpers] =
    await Promise.all([
      import("../../packages/cli/src/edge"),
      import("../../packages/cli/src/commands/retro"),
      import("../../packages/cli/src/index"),
      import("../golden/helpers"),
    ]);
  const runtime = createRetroCommandRuntime({
    store: fixture.store,
    stateDirectory: fixture.stateDirectory,
    workspaceId: fixture.workspaceId,
    changesDirectory: "/work/doc/changes",
    fs: { exists: () => false, readText: () => "" },
    clock: { nowMs: () => NOW_MS, nowIso: () => "2026-11-16T12:00:00Z" },
    newRunId: () => "run-action-golden",
    newTraceId: () => "ev-action-golden",
    newFenceToken: () => "fence-action-golden",
    newActionId: () => "action-golden",
    newClosureId: () => "closure-golden",
    collectors: {
      readAuditLedger: () => ({
        ok: true,
        value: {
          verifiedEmpty: true,
          records: [],
          matched: 0,
          truncated: false,
          chain: { verified: true, records: 0, breaks: [], orphans: [], storePath: "audit" },
          storePath: "audit",
        },
      }),
      readStateFamilies: () => ({
        ok: true,
        value: { transitions: [], closeouts: [], telemetry: [] },
      }),
      readNotes: () => ({ ok: true, value: { retroNotes: [] } }),
    },
    readChanges: () => [],
  });
  const stdout = helpers.bufferSink();
  const stderr = helpers.bufferSink();
  const exitCode = await runCli(
    argv,
    { stdout, stderr },
    {
      brand: helpers.SYNTHETIC_BRAND,
      clock: { now: () => 1000 },
      newRunId: () => "run-action-golden-cli",
      secrets: [],
      program: { commands: { retro: createRetroCommandDefinition(runtime) } },
    },
  );
  return { exitCode, stdout: stdout.value };
};

describe("TC-ACTION-010/014 the additive action golden cases", () => {
  test("every action golden case produces the declared exit, envelope, and data keys", async () => {
    for (const golden of actionCases) {
      const fixture = makeRetroDir(`action-${golden.id}`);
      try {
        seedActionsFor(fixture, golden.scenario);
        const result = await runActionRetro(golden.argv, fixture);
        expect(result.exitCode, golden.id).toBe(golden.expected.exitCode);
        const parsed = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
        if (golden.expected.errorCode !== undefined) {
          const error = parsed.error as { readonly code?: string } | undefined;
          expect(error?.code, golden.id).toBe(golden.expected.errorCode);
        } else {
          const data = parsed.data as Record<string, unknown>;
          if (golden.expected.dataKeys !== undefined) {
            expect(Object.keys(data).sort(), golden.id).toEqual([...golden.expected.dataKeys]);
          }
        }
      } finally {
        fixture.cleanup?.();
      }
    }
  });

  test("a refused action filing leaves data.actions empty on the list surface", async () => {
    const fixture = makeRetroDir("action-empty-list");
    try {
      const refused = await runActionRetro(
        [
          "retro",
          "action",
          "file",
          "--owner-kind",
          "agent-role",
          "--verb",
          "add",
          "--tracker",
          "GH-287",
          "--json",
        ],
        fixture,
      );
      expect(refused.exitCode).toBe(1);
      const listed = await runActionRetro(["retro", "action", "list", "--json"], fixture);
      expect(listed.exitCode).toBe(0);
      const data = JSON.parse(listed.stdout.trim()).data as { readonly actions: unknown[] };
      expect(data.actions).toEqual([]);
    } finally {
      fixture.cleanup?.();
    }
  });

  test("an unknown action verb is refused without invoking the registry", async () => {
    const fixture = makeRetroDir("action-unknown-verb");
    try {
      const result = await runActionRetro(["retro", "action", "frobnicate", "--json"], fixture);
      expect(result.exitCode).toBe(1);
      const error = JSON.parse(result.stdout.trim()).error as { readonly code?: string };
      expect(error.code).toBe("input.value.rejected");
    } finally {
      fixture.cleanup?.();
    }
  });
});

describe("TC-ACTION-023 the report fold reads the registry through the edge composition", () => {
  test("a seeded action folds with registry provenance and the four delivered keys", async () => {
    const fixture = makeRetroDir("action-report-edge");
    try {
      const seeded = fileAction(
        fixture.store,
        conformingDraft({ verificationArtifact: "artifact:edge-fold" }),
        { actionId: "action-edge", filedAt: NOW_MS },
      );
      expect(seeded.ok).toBe(true);
      const result = await runActionRetro(["retro", "report", "--json"], fixture);
      expect(result.exitCode).toBe(0);
      const data = JSON.parse(result.stdout.trim()).data as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual([
        "evidenceRefs",
        "findings",
        "followThrough",
        "level",
      ]);
      const fold = data.followThrough as readonly Record<string, unknown>[];
      expect(fold).toHaveLength(1);
      expect(fold[0]).toMatchObject({
        action: "action-edge",
        verdict: "unverified",
        provenance: "registry",
      });
    } finally {
      fixture.cleanup?.();
    }
  });
});
