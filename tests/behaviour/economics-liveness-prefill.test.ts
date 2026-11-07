/**
 * TC-ECON-020 — a large prefilling or resuming session is never stalled
 * (SC-M1-14). Every size x duration x source-shape row classifies progressing at
 * exit 0 with populated signals, no restart event, no ordinal, and no kill,
 * spawn, or lane mutation.
 */
import { afterEach, describe, expect, test } from "bun:test";
import type { HarnessLivenessFacts } from "../../packages/core/src/contracts/index";
import { createSourcedWatchdogSignalSource } from "../../packages/core/src/domain/index";
import { PREFILL_CASES } from "../fixtures/economics/cases";
import { mutationCalls, runWatchdogCli, runnerSideEffectCalls } from "../fixtures/watchdog/harness";
import {
  createWatchdogRepository,
  type WatchdogTempRepository,
} from "../fixtures/watchdog/temp-git";

const repos: WatchdogTempRepository[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) repo.remove();
});

const repo = (): WatchdogTempRepository => {
  const created = createWatchdogRepository();
  repos.push(created);
  return created;
};

const OBSERVED_AT = "2026-11-07T00:00:09Z";

const factsFor = (
  heartbeatAgeMs: number,
  tokenDelta = 0,
  traffic?: number,
): HarnessLivenessFacts => ({
  readings:
    traffic === undefined
      ? []
      : [{ kind: "session-traffic", status: "sourced", value: traffic, observedAt: OBSERVED_AT }],
  sourcedSignals: [
    {
      kind: "heartbeat-age",
      status: "sourced",
      value: heartbeatAgeMs,
      observedAt: OBSERVED_AT,
    },
    { kind: "token-delta", status: "sourced", value: tokenDelta, observedAt: OBSERVED_AT },
  ],
});

describe("TC-ECON-020 a large prefilling or resuming session is never stalled", () => {
  test("the committed matrix meets the floor of three sizes x three durations x four shapes", () => {
    expect(PREFILL_CASES.length).toBeGreaterThanOrEqual(36);
    expect(new Set(PREFILL_CASES.map((entry) => entry.size)).size).toBe(3);
    expect(new Set(PREFILL_CASES.map((entry) => entry.duration)).size).toBe(3);
    expect(new Set(PREFILL_CASES.map((entry) => entry.sourceShape)).size).toBe(4);
  });

  test("every row classifies progressing with populated signals and no lane action", async () => {
    const shared = repo();
    for (const entry of PREFILL_CASES) {
      const facts = factsFor(
        entry.signals.heartbeatAgeMs,
        entry.signals.tokenDelta ?? 0,
        entry.signals.traffic,
      );
      const run = await runWatchdogCli(["watchdog", "liveness", "lane-1", "--json"], {
        repo: shared,
        signalSources: [createSourcedWatchdogSignalSource(() => facts)],
      });
      const envelope = JSON.parse(run.stdout) as {
        data?: { verdict?: string; signals?: Record<string, number> };
        error?: { code?: string };
      };
      expect(run.exitCode, entry.id).toBe(0);
      expect(envelope.error, entry.id).toBeUndefined();
      expect(envelope.data?.verdict, entry.id).toBe("progressing");
      expect(Object.keys(envelope.data?.signals ?? {}).length, entry.id).toBeGreaterThan(0);
      expect(envelope.data?.signals?.traffic, entry.id).toBe(entry.signals.traffic);
      expect(runnerSideEffectCalls(run.runtimeCalls), entry.id).toEqual([]);
      expect(mutationCalls(run.runtimeCalls), entry.id).toEqual([]);
      expect(
        run.runtimeCalls.some((call) => call.includes("state")),
        entry.id,
      ).toBe(false);
    }
  }, 120_000);

  test("the verdict holds at and beyond the stall bound when delta or traffic rises", () => {
    for (const entry of PREFILL_CASES.filter(
      (candidate) => candidate.sourceShape === "rising-both-beyond-bound",
    )) {
      const facts = factsFor(
        entry.signals.heartbeatAgeMs,
        entry.signals.tokenDelta ?? 0,
        entry.signals.traffic,
      );
      const signals = createSourcedWatchdogSignalSource(() => facts)("lane-1");
      expect(signals?.heartbeatAgeMs ?? 0).toBeGreaterThanOrEqual(300_000);
      expect(signals?.traffic, entry.id).toBe(entry.signals.traffic);
      expect((signals?.tokenDelta ?? 0) > 0 || (signals?.traffic ?? 0) > 0).toBe(true);
    }
  });
});
