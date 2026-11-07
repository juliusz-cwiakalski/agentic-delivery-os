/**
 * TC-WATCHDOG-042/043 and GH-235 TC-ECON-030/031 — a CPU-only reading can never
 * classify `stalled`, verdict-bearing data carries `verdict`/`signals`/`evidence`,
 * and a sourced lane now reaches `progressing` (exit 0) or a corroborated
 * `stalled` classified refusal (exit 1) while a source-less lane keeps exit 2.
 */
import { describe, expect, test } from "bun:test";
import {
  WATCHDOG_SIGNAL_KEYS,
  WATCHDOG_STALL_HEARTBEAT_MS,
  WATCHDOG_VERDICTS,
  type WatchdogSignals,
} from "../../packages/core/src/contracts/index";
import {
  buildWatchdogTeardownData,
  buildWatchdogVerdictData,
  classifyWatchdogLiveness,
} from "../../packages/core/src/domain/watchdog";
import { createSourcedWatchdogSignalSource } from "../../packages/core/src/domain/index";

/** Probe an undeclared CPU fact without widening the real input type. */
const withUndeclaredCpu = (cpu: unknown): WatchdogSignals =>
  ({ cpu }) as unknown as WatchdogSignals;

const outcomeOf = (signals: WatchdogSignals): string => {
  const evaluation = classifyWatchdogLiveness(signals);
  return evaluation.outcome === "absent" ? "absent" : evaluation.verdict;
};

describe("TC-WATCHDOG-042 a CPU-only reading can never classify stalled", () => {
  test("absent and undefined declared signals classify as the absent outcome", () => {
    for (const signals of [{}] as readonly WatchdogSignals[]) {
      const evaluation = classifyWatchdogLiveness(signals);
      expect(evaluation.outcome).toBe("absent");
      if (evaluation.outcome === "absent") {
        expect(evaluation.evidence.length).toBeGreaterThan(0);
        expect(evaluation.evidence).toContain("unknown");
      }
    }
  });

  test("CPU-busy, CPU-idle, CPU-high, CPU-low and an explicit cpu field are all absent", () => {
    for (const signals of [
      withUndeclaredCpu("busy"),
      withUndeclaredCpu("idle"),
      withUndeclaredCpu(99),
      withUndeclaredCpu(0.1),
    ]) {
      const evaluation = classifyWatchdogLiveness(signals);
      expect(evaluation.outcome).toBe("absent");
    }
  });

  test("stalled requires corroboration across declared progress signals", () => {
    const highHeartbeat = WATCHDOG_STALL_HEARTBEAT_MS + 1_000;
    expect(outcomeOf({ heartbeatAgeMs: highHeartbeat })).toBe("progressing");
    expect(outcomeOf({ heartbeatAgeMs: highHeartbeat, tokenDelta: 0 })).toBe("progressing");
    expect(outcomeOf({ heartbeatAgeMs: highHeartbeat, traffic: 0 })).toBe("progressing");
    expect(outcomeOf({ tokenDelta: 0, traffic: 0 })).toBe("progressing");
    expect(outcomeOf({ heartbeatAgeMs: highHeartbeat, tokenDelta: 0, traffic: 0 })).toBe("stalled");
    expect(outcomeOf({ heartbeatAgeMs: highHeartbeat, tokenDelta: 0, traffic: 7 })).toBe(
      "progressing",
    );
  });

  test("a mutant that maps CPU-busy alone to stalled is not the delivered classifier", () => {
    const mutant = (cpu: string): string => (cpu === "busy" ? "stalled" : "progressing");
    expect(mutant("busy")).toBe("stalled");
    expect(classifyWatchdogLiveness(withUndeclaredCpu("busy")).outcome).not.toBe("verdict");
  });
});

describe("TC-WATCHDOG-043 verdict-bearing data carries verdict, signals, and evidence", () => {
  test("the sourced-fact fixture projects through the data builder", () => {
    const signals: WatchdogSignals = {
      heartbeatAgeMs: 1_500,
      tokenDelta: 42,
      traffic: 9,
    };
    const evaluation = classifyWatchdogLiveness(signals);
    expect(evaluation.outcome).toBe("verdict");
    if (evaluation.outcome !== "verdict") return;
    const data = buildWatchdogVerdictData({
      probe: "liveness",
      lane: "lane-1",
      verdict: evaluation.verdict,
      signals: evaluation.signals,
      evidence: evaluation.evidence,
    });
    expect(WATCHDOG_VERDICTS).toContain(data.verdict);
    expect(Object.keys(data.signals).sort()).toEqual([...WATCHDOG_SIGNAL_KEYS].sort());
    expect(typeof data.evidence).toBe("string");
    expect(data.evidence.length).toBeGreaterThan(0);
  });

  test("preflight admission and teardown success data also carry verdict and evidence", () => {
    const preflight = buildWatchdogVerdictData({
      probe: "preflight",
      lane: "lane-1",
      verdict: "ok",
      evidence: "checkout clean on base main",
    });
    expect(preflight.verdict).toBe("ok");
    expect(preflight.evidence.length).toBeGreaterThan(0);
    expect(preflight.signals).toEqual({});

    const teardown = buildWatchdogTeardownData({
      lane: "lane-1",
      verdict: "ok",
      evidence: "restored checkout to base main",
      actions: [
        {
          kind: "restore-checkout",
          observation: "checkout restored",
          evidence: "restore checkout to base main",
        },
      ],
      memory: [
        {
          path: ".ai/memory/agents/watchdog-fixture/README.md",
          status: "preserved",
          evidence: "publication preserved in place (untracked)",
        },
      ],
    });
    expect(teardown.verdict).toBe("ok");
    expect(teardown.evidence.length).toBeGreaterThan(0);
    expect(teardown.actions).toHaveLength(1);
    expect(teardown.memory[0]?.status).toBe("preserved");
  });
});

describe("TC-WATCHDOG-040 absent signal sources classify as unknown, exit 2, no verdict", () => {
  const repoRun = async (
    signalSources: readonly ((lane: string) => WatchdogSignals | undefined)[] = [],
  ) => {
    const { createWatchdogRepository } = await import("../fixtures/watchdog/temp-git");
    const { runWatchdogCli, parseEnvelope, normalizeEnvelopeText } = await import(
      "../fixtures/watchdog/harness"
    );
    const repo = createWatchdogRepository();
    try {
      const first = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
        repo,
        signalSources,
      });
      const second = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
        repo,
        signalSources,
      });
      return {
        first,
        second,
        envelope: parseEnvelope(first),
        replayEqual:
          JSON.stringify(normalizeEnvelopeText(first, repo.directory)) ===
          JSON.stringify(normalizeEnvelopeText(second, repo.directory)),
      };
    } finally {
      repo.remove();
    }
  };

  test("FIX-NO-SIGNALS exits 2 with watchdog.signals-absent and no verdict anywhere", async () => {
    const { first, envelope, replayEqual } = await repoRun();
    expect(first.exitCode).toBe(2);
    expect(envelope.exitCode).toBe(2);
    expect(envelope).not.toHaveProperty("data");
    const error = envelope.error as Record<string, unknown>;
    expect(error.code).toBe("watchdog.signals-absent");
    expect(error.category).toBe("platform");
    expect(error.retryable).toBe(true);
    expect(error.consequence).toBe("not_landed");
    expect(String(error.remediationHint).length).toBeGreaterThan(0);
    expect(String(error.summary)).toContain("unknown");
    const payload = JSON.stringify(envelope);
    expect(payload).not.toContain('"verdict"');
    expect(payload).not.toContain("stalled");
    expect(payload).not.toContain("progressing");
    expect(payload).not.toContain('"ok"');
    expect(replayEqual).toBe(true);
  }, 30_000);

  test("FIX-PREFILL: a source carrying only an undeclared CPU fact still classifies absent", async () => {
    const cpuOnlySource = () => ({ cpu: "busy" }) as unknown as WatchdogSignals;
    const { first, envelope } = await repoRun([cpuOnlySource]);
    expect(first.exitCode).toBe(2);
    const error = envelope.error as Record<string, unknown>;
    expect(error.code).toBe("watchdog.signals-absent");
    expect(JSON.stringify(envelope)).not.toContain('"verdict"');
  }, 30_000);
});

const sourcedRun = async (facts: {
  readonly readings?: readonly {
    readonly kind: "session-traffic" | "worktree-activity" | "process";
    readonly status: "sourced";
    readonly value: number;
    readonly observedAt: string;
  }[];
  readonly sourcedSignals?: readonly {
    readonly kind: "heartbeat-age" | "token-delta";
    readonly status: "sourced";
    readonly value: number;
    readonly observedAt: string;
  }[];
}) => {
  const { createWatchdogRepository } = await import("../fixtures/watchdog/temp-git");
  const { runWatchdogCli, parseEnvelope } = await import("../fixtures/watchdog/harness");
  const repo = createWatchdogRepository();
  try {
    const run = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
      repo,
      signalSources: [createSourcedWatchdogSignalSource(() => facts)],
    });
    return { run, envelope: parseEnvelope(run) };
  } finally {
    repo.remove();
  }
};

describe("TC-ECON-030/031 a sourced lane reaches progressing or the stalled refusal", () => {
  test("a sourced progressing lane stays exit 0 with data.verdict and populated signals", async () => {
    const { run, envelope } = await sourcedRun({
      readings: [
        { kind: "session-traffic", status: "sourced", value: 9, observedAt: "t" },
      ],
      sourcedSignals: [
        { kind: "heartbeat-age", status: "sourced", value: 1_000, observedAt: "t" },
        { kind: "token-delta", status: "sourced", value: 42, observedAt: "t" },
      ],
    });
    expect(run.exitCode).toBe(0);
    expect(envelope).not.toHaveProperty("error");
    const data = envelope.data as { verdict?: string; signals?: Record<string, number> };
    expect(data.verdict).toBe("progressing");
    expect(data.signals?.heartbeatAgeMs).toBe(1_000);
    expect(data.signals?.tokenDelta).toBe(42);
    expect(data.signals?.traffic).toBe(9);
  }, 30_000);

  test("a fully corroborated sourced stall is the classified refusal at exit 1 with no verdict", async () => {
    const { run, envelope } = await sourcedRun({
      readings: [
        { kind: "session-traffic", status: "sourced", value: 0, observedAt: "t" },
      ],
      sourcedSignals: [
        { kind: "heartbeat-age", status: "sourced", value: 400_000, observedAt: "t" },
        { kind: "token-delta", status: "sourced", value: 0, observedAt: "t" },
      ],
    });
    expect(run.exitCode).toBe(1);
    expect(envelope).not.toHaveProperty("data");
    const error = envelope.error as Record<string, unknown>;
    expect(error.code).toBe("watchdog.liveness-stalled");
    expect(error.category).toBe("user");
    expect(error.retryable).toBe(false);
    expect(error.consequence).toBe("not_landed");
    expect(String(error.summary).length).toBeGreaterThan(0);
    const payload = JSON.stringify(envelope);
    expect(payload).not.toContain('"verdict"');
    expect(payload).not.toContain('"data"');
  }, 30_000);

  test("a source-less lane keeps the classified unknown answer at exit 2", async () => {
    const { run, envelope } = await sourcedRun({ readings: [], sourcedSignals: [] });
    expect(run.exitCode).toBe(2);
    const error = envelope.error as Record<string, unknown>;
    expect(error.code).toBe("watchdog.signals-absent");
    expect(JSON.stringify(envelope)).not.toContain('"verdict"');
  }, 30_000);
});
