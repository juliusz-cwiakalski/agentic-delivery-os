/**
 * TC-ECON-021 — stall requires the full corroboration; partial readings
 * progress. The matrix covers every present-value combination plus the
 * bound-1/bound/bound+1 rows; each stalled outcome carries the bounded key=value
 * corpus, and criterion-drop mutants flip at least one row.
 */
import { describe, expect, test } from "bun:test";
import {
  WATCHDOG_STALL_HEARTBEAT_MS,
  type WatchdogSignals,
  WATCHDOG_SIGNAL_KEYS,
} from "../../packages/core/src/contracts/index";
import { classifyWatchdogLiveness, parseRefusalCorpus } from "../../packages/core/src/domain/index";
import { CORROBORATION_CASES } from "../fixtures/economics/cases";
import { runWatchdogCli } from "../fixtures/watchdog/harness";
import { createWatchdogRepository } from "../fixtures/watchdog/temp-git";
import { createSourcedWatchdogSignalSource as source } from "../../packages/core/src/domain/index";

const outcomeOf = (signals: WatchdogSignals): string => {
  const evaluation = classifyWatchdogLiveness(signals);
  return evaluation.outcome === "absent" ? "absent" : evaluation.verdict;
};

const signalsOf = (entry: (typeof CORROBORATION_CASES)[number]): WatchdogSignals => ({
  ...(entry.heartbeatAgeMs === undefined ? {} : { heartbeatAgeMs: entry.heartbeatAgeMs }),
  ...(entry.tokenDelta === undefined ? {} : { tokenDelta: entry.tokenDelta }),
  ...(entry.traffic === undefined ? {} : { traffic: entry.traffic }),
});

/** A mutant classifier that drops one corroboration criterion. */
const mutantClassifier = (
  drop: "traffic" | "token-delta" | "bound",
): ((signals: WatchdogSignals) => string) => {
  return (signals) => {
    const heartbeat = signals.heartbeatAgeMs;
    const boundOk =
      drop === "bound"
        ? typeof heartbeat === "number"
        : (heartbeat ?? -1) >= WATCHDOG_STALL_HEARTBEAT_MS;
    const deltaOk = drop === "token-delta" ? true : signals.tokenDelta === 0;
    const trafficOk = drop === "traffic" ? true : signals.traffic === 0;
    return boundOk && deltaOk && trafficOk ? "stalled" : "progressing";
  };
};

describe("TC-ECON-021 stall requires the full corroboration", () => {
  test("the matrix covers every present-value combination and the bound boundaries", () => {
    expect(CORROBORATION_CASES.length).toBeGreaterThanOrEqual(36);
    expect(CORROBORATION_CASES.some((entry) => entry.id === "corroboration-bound-minus-one")).toBe(
      true,
    );
    expect(CORROBORATION_CASES.some((entry) => entry.id === "corroboration-bound-exact")).toBe(
      true,
    );
    expect(CORROBORATION_CASES.some((entry) => entry.id === "corroboration-bound-plus-one")).toBe(
      true,
    );
  });

  test("stalled classifies only when heartbeat >= bound AND tokenDelta 0 AND traffic 0", () => {
    let stalledRows = 0;
    for (const entry of CORROBORATION_CASES) {
      const signals = signalsOf(entry);
      const expectedStall =
        typeof signals.heartbeatAgeMs === "number" &&
        (signals.heartbeatAgeMs ?? 0) >= WATCHDOG_STALL_HEARTBEAT_MS &&
        signals.tokenDelta === 0 &&
        signals.traffic === 0;
      expect(outcomeOf(signals), entry.id).toBe(
        expectedStall ? "stalled" : entry.expected === "absent" ? "absent" : "progressing",
      );
      if (expectedStall) stalledRows += 1;
    }
    expect(stalledRows).toBeGreaterThan(0);
  });

  test("every other present-signal combination progresses and absence never stalls", () => {
    for (const entry of CORROBORATION_CASES) {
      if (entry.expected === "stalled") continue;
      const signals = signalsOf(entry);
      expect(outcomeOf(signals), entry.id).toBe(entry.expected);
    }
    expect(outcomeOf({ tokenDelta: 0, traffic: 0 })).toBe("progressing");
    expect(
      outcomeOf({ tokenDelta: 0, traffic: 0, heartbeatAgeMs: WATCHDOG_STALL_HEARTBEAT_MS - 1 }),
    ).toBe("progressing");
  });

  test("an absent signal is never coerced to 0 anywhere in the projection", () => {
    const facts = [
      { kind: "token-delta" as const, status: "absent" as const, reason: "not-observed" as const },
      {
        kind: "heartbeat-age" as const,
        status: "absent" as const,
        reason: "not-observed" as const,
      },
    ];
    const signals = source(() => ({ readings: [], sourcedSignals: facts }))("lane-1");
    expect(signals).toEqual({});
    expect(Object.values(signals ?? {})).not.toContain(0);
  });

  test("the classifier is pure and deterministic", () => {
    const signals: WatchdogSignals = {
      heartbeatAgeMs: WATCHDOG_STALL_HEARTBEAT_MS,
      tokenDelta: 0,
      traffic: 0,
    };
    expect(classifyWatchdogLiveness(signals)).toEqual(classifyWatchdogLiveness(signals));
  });

  test("a corroborated stall carries the bounded stable corpus on the CLI failure fields", async () => {
    const repo = createWatchdogRepository();
    try {
      const facts = {
        readings: [
          {
            kind: "session-traffic" as const,
            status: "sourced" as const,
            value: 0,
            observedAt: "t",
          },
        ],
        sourcedSignals: [
          {
            kind: "heartbeat-age" as const,
            status: "sourced" as const,
            value: 400_000,
            observedAt: "t",
          },
          { kind: "token-delta" as const, status: "sourced" as const, value: 0, observedAt: "t" },
        ],
      };
      const run = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
        repo,
        signalSources: [source(() => facts)],
      });
      const envelope = JSON.parse(run.stdout) as { error?: { code?: string; summary?: string } };
      expect(run.exitCode).toBe(1);
      expect(envelope.error?.code).toBe("watchdog.liveness-stalled");
      const corpus = parseRefusalCorpus(envelope.error?.summary ?? "");
      expect(Object.keys(corpus)).toEqual([
        "reason",
        "heartbeatAgeMs",
        "tokenDelta",
        "traffic",
        "stallBoundMs",
      ]);
      expect(corpus.reason).toBe("watchdog.liveness-stalled");
      expect(corpus.heartbeatAgeMs).toBe("400000");
      expect(corpus.tokenDelta).toBe("0");
      expect(corpus.traffic).toBe("0");
      expect((envelope.error?.summary ?? "").length).toBeLessThanOrEqual(512);
    } finally {
      repo.remove();
    }
  }, 30_000);

  test("criterion-drop mutants each flip at least one matrix row", () => {
    for (const drop of ["traffic", "token-delta", "bound"] as const) {
      const mutant = mutantClassifier(drop);
      const flipped = CORROBORATION_CASES.filter(
        (entry) => mutant(signalsOf(entry)) !== outcomeOf(signalsOf(entry)),
      );
      expect(flipped.length, drop).toBeGreaterThan(0);
    }
  });

  test("no CPU-shaped key exists in the projection", () => {
    const signals = source(() => ({
      readings: [],
      sourcedSignals: [
        { kind: "heartbeat-age" as const, status: "sourced" as const, value: 1, observedAt: "t" },
      ],
    }))("lane-1");
    expect(JSON.stringify(signals ?? {})).not.toMatch(/cpu/i);
    for (const key of Object.keys(signals ?? {})) {
      expect(WATCHDOG_SIGNAL_KEYS as readonly string[]).toContain(key);
    }
  });
});
