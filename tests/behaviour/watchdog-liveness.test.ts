/**
 * TC-WATCHDOG-042 and TC-WATCHDOG-043 (classifier/builder halves) — a CPU-only
 * reading can never classify `stalled`, and verdict-bearing data carries
 * `verdict`, `signals`, and `evidence`. The command-level halves land with the
 * wired CLI.
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

/** Probe an undeclared CPU fact without widening the real input type. */
const withUndeclaredCpu = (cpu: unknown): WatchdogSignals =>
  ({ cpu } as unknown) as WatchdogSignals;

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
    expect(
      outcomeOf({ heartbeatAgeMs: highHeartbeat, tokenDelta: 0, traffic: 0 }),
    ).toBe("stalled");
    expect(
      outcomeOf({ heartbeatAgeMs: highHeartbeat, tokenDelta: 0, traffic: 7 }),
    ).toBe("progressing");
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
