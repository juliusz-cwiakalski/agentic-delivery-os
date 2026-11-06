/**
 * TC-RETRO-063 — the envelope/exit matrix, data XOR error, scripted one-line
 * discipline, and human partial output before the diagnostic.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { recordRetroRun } from "../../packages/core/src/state/index";
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
    for (const golden of cases) {
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
