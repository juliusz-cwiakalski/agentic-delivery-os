/**
 * TC-ECON-033 / TC-ECON-031 — every new outcome emits exactly one valid exclusive
 * v1 envelope inside the `{0, 1, 2}` exit taxonomy, refusal evidence is a
 * non-empty bounded key=value corpus on the existing failure fields, and the
 * error object key set is unchanged (DEC-9).
 */
import { describe, expect, test } from "bun:test";
import type { EconomicsResumeDecision } from "../../packages/core/src/contracts/index";
import {
  assertEnvelopeContract,
} from "../../packages/testkit/src/result-conformance";
import { runCli, type CliDependencies, type CommandProgram } from "../../packages/cli/src/index";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";
import { runWatchdogCli } from "../fixtures/watchdog/harness";
import { createWatchdogRepository } from "../fixtures/watchdog/temp-git";
import { createSourcedWatchdogSignalSource, parseRefusalCorpus } from "../../packages/core/src/domain/index";

const ERROR_KEYS = ["code", "category", "retryable", "consequence", "remediationHint", "summary"];

const resultFor = (decision: EconomicsResumeDecision): unknown => {
  switch (decision.outcome) {
    case "attach-continue":
      return { data: { mode: "attach-continue", restarts: 0, resumeAmplification: null } };
    case "admit-restart":
      return { data: { restarts: decision.record.ordinal, resumeAmplification: 0.25 } };
    case "refuse":
      return {
        error: { kind: "dispatch", code: decision.code, summary: decision.corpus },
      };
    case "unevaluable":
      return {
        error: { kind: "state", code: decision.code, summary: decision.corpus },
      };
  }
};

const runEconomicsOutcome = async (
  decision: EconomicsResumeDecision,
): Promise<{ readonly exitCode: number; readonly envelope: Record<string, unknown> }> => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const program: CommandProgram = {
    commands: {
      economics: {
        flags: [],
        positionals: { max: 0 },
        handler: () => resultFor(decision) as never,
      },
    },
  };
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => 100 },
    newRunId: () => "run-envelope-fixture",
    secrets: [],
    program,
  };
  const exitCode = await runCli(["economics", "--json"], { stdout, stderr }, deps);
  return { exitCode, envelope: JSON.parse(stdout.value) as Record<string, unknown> };
};

const decisions: readonly { readonly id: string; readonly decision: EconomicsResumeDecision }[] = [
  {
    id: "attach-continue",
    decision: {
      outcome: "attach-continue",
      mode: "attach-continue",
      sessionId: "ses_fixture_1",
      treeRoot: "ses_fixture_1",
      ordinalConsumed: false,
      evidence: "attach-and-continue",
    },
  },
  {
    id: "restart-within-budget",
    decision: {
      outcome: "admit-restart",
      record: {
        schemaId: "delivery.economics.restart.v1",
        workItemRef: "GH-235",
        runId: "run-envelope-fixture",
        sessionId: "ses_fixture_1",
        ordinal: 1,
        reason: "session-interrupted",
        repayTokens: { inputTokens: 100, outputTokens: 0 },
        observedUniqueProgressTokens: 400,
        recordedAt: "2026-11-07T00:00:00Z",
      },
      evidence: "restart ordinal 1 recorded",
    },
  },
  {
    id: "past-budget",
    decision: {
      outcome: "refuse",
      code: "dispatch.restart-budget-exceeded",
      exitCode: 1,
      reason: "budget exhausted",
      corpus: "reason=dispatch.restart-budget-exceeded; restarts=3; historyRef=economics/GH-235",
    },
  },
  {
    id: "uneconomical",
    decision: {
      outcome: "refuse",
      code: "dispatch.resume-uneconomical",
      exitCode: 1,
      reason: "uneconomical",
      corpus: "reason=dispatch.resume-uneconomical; repayTokens=900; economicsRef=economics/GH-235",
    },
  },
  {
    id: "unevaluable-budget",
    decision: {
      outcome: "unevaluable",
      code: "state.store.torn",
      exitCode: 2,
      reason: "torn",
      corpus: "reason=state.store.torn; historyRef=economics/GH-235",
    },
  },
];

describe("TC-ECON-033 every new outcome emits one valid exclusive envelope", () => {
  for (const { id, decision } of decisions) {
    test(`${id} envelope is valid, exclusive, and inside the exit taxonomy`, async () => {
      const { exitCode, envelope } = await runEconomicsOutcome(decision);
      expect(assertEnvelopeContract(envelope)).toEqual([]);
      const payload = JSON.stringify(envelope);
      expect(payload.match(/"schemaVersion"/g)).toHaveLength(1);
      for (const field of ["schemaVersion", "runId", "exitCode", "timing"]) {
        expect(Object.hasOwn(envelope, field)).toBe(true);
      }
      expect(Object.hasOwn(envelope, "data")).not.toBe(Object.hasOwn(envelope, "error"));
      expect(envelope.exitCode).toBe(exitCode);
      expect([0, 1, 2]).toContain(exitCode);
      if (envelope.error !== undefined) {
        const error = envelope.error as Record<string, unknown>;
        for (const key of Object.keys(error)) {
          expect(ERROR_KEYS).toContain(key);
        }
        expect(String(error.summary).length).toBeGreaterThan(0);
        expect(String(error.summary).length).toBeLessThanOrEqual(512);
        expect(parseRefusalCorpus(String(error.summary)).reason).toBe(error.code);
      }
    });
  }

  test("exit 0 only for success, exit 1 for refusals, exit 2 for source-unavailable", async () => {
    const successes = decisions.filter(
      (entry) => entry.decision.outcome === "attach-continue" || entry.decision.outcome === "admit-restart",
    );
    for (const entry of successes) {
      const { exitCode } = await runEconomicsOutcome(entry.decision);
      expect(exitCode, entry.id).toBe(0);
    }
    const refusals = decisions.filter((entry) => entry.decision.outcome === "refuse");
    for (const entry of refusals) {
      const { exitCode } = await runEconomicsOutcome(entry.decision);
      expect(exitCode, entry.id).toBe(1);
    }
    const unavailable = decisions.filter((entry) => entry.decision.outcome === "unevaluable");
    for (const entry of unavailable) {
      const { exitCode } = await runEconomicsOutcome(entry.decision);
      expect(exitCode, entry.id).toBe(2);
    }
  });

  test("no stderr envelope is emitted under --json", async () => {
    const stdout = bufferSink();
    const stderr = bufferSink();
    const program: CommandProgram = {
      commands: {
        economics: {
          flags: [],
          positionals: { max: 0 },
          handler: () => resultFor(decisions[2]!.decision) as never,
        },
      },
    };
    await runCli(
      ["economics", "--json"],
      { stdout, stderr },
      {
        brand: SYNTHETIC_BRAND,
        clock: { now: () => 100 },
        newRunId: () => "run-envelope-fixture",
        secrets: [],
        program,
      },
    );
    expect(stderr.value).not.toContain("schemaVersion");
  });

  test("the three liveness outcomes are mutually exclusive and jointly exhaustive", async () => {
    const repo = createWatchdogRepository();
    try {
      const run = async (facts: Parameters<typeof createSourcedWatchdogSignalSource>[0]) => {
        const runResult = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
          repo,
          signalSources: [createSourcedWatchdogSignalSource(facts)],
        });
        return { exitCode: runResult.exitCode, envelope: JSON.parse(runResult.stdout) as Record<string, unknown> };
      };
      const progressing = await run(() => ({
        readings: [{ kind: "session-traffic", status: "sourced", value: 1, observedAt: "t" }],
        sourcedSignals: [{ kind: "token-delta", status: "sourced", value: 4, observedAt: "t" }],
      }));
      const stalled = await run(() => ({
        readings: [{ kind: "session-traffic", status: "sourced", value: 0, observedAt: "t" }],
        sourcedSignals: [
          { kind: "heartbeat-age", status: "sourced", value: 400_000, observedAt: "t" },
          { kind: "token-delta", status: "sourced", value: 0, observedAt: "t" },
        ],
      }));
      const absent = await run(() => ({ readings: [], sourcedSignals: [] }));

      expect(progressing.exitCode).toBe(0);
      expect(Object.hasOwn(progressing.envelope, "data")).toBe(true);
      expect(Object.hasOwn(progressing.envelope, "error")).toBe(false);

      expect(stalled.exitCode).toBe(1);
      expect((stalled.envelope.error as Record<string, unknown>).code).toBe(
        "watchdog.liveness-stalled",
      );
      expect(Object.hasOwn(stalled.envelope, "data")).toBe(false);

      expect(absent.exitCode).toBe(2);
      expect((absent.envelope.error as Record<string, unknown>).code).toBe(
        "watchdog.signals-absent",
      );
      for (const outcome of [progressing, stalled, absent]) {
        expect(assertEnvelopeContract(outcome.envelope)).toEqual([]);
      }
      expect(stalled.exitCode).toBe(1);
      expect(absent.exitCode).toBe(2);
    } finally {
      repo.remove();
    }
  }, 30_000);
});
