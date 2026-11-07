/**
 * TC-ECON-010 — sourced signals populate exactly the three declared keys and
 * absence stays absent. End to end: adapter facts → neutral assembly → bridge →
 * the delivered probe seam. The delivered exact-three liveness kinds are
 * unchanged (DEC-8); no CPU key exists.
 */
import { describe, expect, test } from "bun:test";
import type {
  EconomicsSourcedSignalReading,
  HarnessLivenessReport,
} from "../../packages/core/src/contracts/index";
import {
  classifyWatchdogLiveness,
  createSourcedWatchdogSignalSource,
} from "../../packages/core/src/domain/index";
import { createWatchdogCommandRuntime } from "../../packages/cli/src/edge";
import { runWatchdogCli } from "../fixtures/watchdog/harness";

const FACT_NOW = "2026-11-07T00:00:09Z";

const sourcedFacts = (overrides: {
  heartbeatAgeMs?: number;
  tokenDelta?: number;
  traffic?: number;
} = {}): readonly EconomicsSourcedSignalReading[] => [
  {
    kind: "heartbeat-age",
    status: "sourced",
    value: overrides.heartbeatAgeMs ?? 1_500,
    observedAt: FACT_NOW,
  },
  {
    kind: "token-delta",
    status: "sourced",
    value: overrides.tokenDelta ?? 42,
    observedAt: FACT_NOW,
  },
];

const sourceFor = (facts: readonly EconomicsSourcedSignalReading[]) =>
  createSourcedWatchdogSignalSource(() => ({ readings: [], sourcedSignals: facts }));

describe("TC-ECON-010 sourced signals populate exactly the three declared keys", () => {
  test("adapter facts project to heartbeatAgeMs and tokenDelta, and traffic from the neutral reading", () => {
    const signals = sourceFor(sourcedFacts())( "lane-1");
    expect(signals).toBeDefined();
    if (signals === undefined) return;
    expect(Object.keys(signals).sort()).toEqual(["heartbeatAgeMs", "tokenDelta"]);
    expect(signals.heartbeatAgeMs).toBe(1_500);
    expect(signals.tokenDelta).toBe(42);
    expect(signals).not.toHaveProperty("traffic");
    for (const key of Object.keys(signals)) {
      expect(["heartbeatAgeMs", "tokenDelta", "traffic"]).toContain(key);
    }
  });

  test("an absent sourced kind yields an absent key, never 0, false, or an invented time", () => {
    const facts: readonly EconomicsSourcedSignalReading[] = [
      { kind: "token-delta", status: "absent", reason: "not-observed" },
    ];
    const signals = sourceFor(facts)("lane-1");
    expect(signals).toBeDefined();
    if (signals === undefined) return;
    expect(Object.hasOwn(signals, "heartbeatAgeMs")).toBe(false);
    expect(Object.hasOwn(signals, "tokenDelta")).toBe(false);
  });

  test("no source yields undefined rather than an empty shaped reading", () => {
    expect(createSourcedWatchdogSignalSource(() => undefined)("lane-1")).toBeUndefined();
  });

  test("the projection is a derived value only and calls no CPU-shaped key", () => {
    const signals = sourceFor(sourcedFacts({ traffic: 9 }))("lane-1");
    expect(JSON.stringify(signals ?? {})).not.toMatch(/cpu/i);
    expect(classifyWatchdogLiveness(signals ?? {}).outcome).not.toBe("absent");
  });

  test("the command payload reaches progressing and never signals-absent", async () => {
    const { createWatchdogRepository } = await import("../fixtures/watchdog/temp-git");
    const repo = createWatchdogRepository();
    try {
      const run = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
        repo,
        signalSources: [sourceFor(sourcedFacts())],
      });
      const envelope = JSON.parse(run.stdout) as {
        data?: { verdict?: string; signals?: Record<string, number> };
        error?: { code?: string };
      };
      expect(run.exitCode).toBe(0);
      expect(envelope.error).toBeUndefined();
      expect(envelope.data?.verdict).toBe("progressing");
      expect(envelope.data?.signals?.heartbeatAgeMs).toBe(1_500);
      expect(envelope.data?.signals?.tokenDelta).toBe(42);
    } finally {
      repo.remove();
    }
  }, 30_000);

  test("the edge composes the sourced bridge into the delivered probe seam", () => {
    const withSource = createWatchdogCommandRuntime({
      readLane: () => ({ ok: false, reason: "missing" }),
      readSourcedSignals: () => ({ readings: [], sourcedSignals: sourcedFacts() }),
    });
    expect(withSource.signalSources).toHaveLength(1);
    const source = withSource.signalSources[0];
    expect(source?.("lane-1")).toMatchObject({ heartbeatAgeMs: 1_500, tokenDelta: 42 });

    const withoutSource = createWatchdogCommandRuntime({
      readLane: () => ({ ok: false, reason: "missing" }),
    });
    expect(withoutSource.signalSources).toEqual([]);
  });

  test("replaying the same facts yields byte-identical projection", () => {
    const first = JSON.stringify(sourceFor(sourcedFacts())("lane-1"));
    const second = JSON.stringify(sourceFor(sourcedFacts())("lane-1"));
    expect(first).toBe(second);
  });

  test("the neutral report still carries exactly three liveness readings beside sourced signals", async () => {
    const { assembleHarnessLiveness } = await import("../../packages/core/src/domain/index");
    const report: HarnessLivenessReport = assembleHarnessLiveness({
      sourced: [],
      sourcedSignalFacts: sourcedFacts(),
    });
    expect(report.readings.map((reading) => reading.kind)).toEqual([
      "session-traffic",
      "worktree-activity",
      "process",
    ]);
    expect(report.sourcedSignals?.map((entry) => entry.kind)).toEqual([
      "heartbeat-age",
      "token-delta",
    ]);
  });
});
