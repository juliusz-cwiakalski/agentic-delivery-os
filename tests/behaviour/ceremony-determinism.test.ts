/**
 * TC-CEREMONY-050 (determinism half) and TC-CEREMONY-053 — identical injected
 * inputs produce byte-identical artifacts and human text, folds are
 * permutation-invariant, and the bounded human output never truncates the
 * verdict line.
 */
import { describe, expect, test } from "bun:test";
import {
  ceremonyRunDurationMs,
  foldCeremonyPhaseDurations,
  foldCeremonyRunVerdict,
} from "../../packages/core/src/state/index";
import { renderCeremonyText } from "../../packages/cli/src/output/ceremony-text";
import { prepareBuiltin, runPrepared } from "../fixtures/ceremony/builtins";
import { stepRecord } from "../fixtures/ceremony/state";

const briefText = (harness: ReturnType<typeof prepareBuiltin>["harness"]): string => {
  for (const content of harness.artifactContents.values()) {
    if ((JSON.parse(content) as { schemaId?: string }).schemaId === "delivery.brief.v1") {
      return content;
    }
  }
  throw new Error("brief missing");
};

describe("TC-CEREMONY-050/053 determinism", () => {
  test("two independent runs render byte-identical artifacts and human text", () => {
    const first = prepareBuiltin("morning-brief");
    const second = prepareBuiltin("morning-brief");
    try {
      const firstRun = runPrepared(first);
      const secondRun = runPrepared(second);
      expect(firstRun.ok && secondRun.ok).toBe(true);
      expect(briefText(second.harness)).toBe(briefText(first.harness));
      if (firstRun.ok && secondRun.ok) {
        expect(renderCeremonyText(secondRun.data)).toBe(renderCeremonyText(firstRun.data));
      }
    } finally {
      first.harness.dispose();
      second.harness.dispose();
    }
  });

  test("step folds are permutation-invariant", () => {
    const steps = [
      stepRecord({
        index: 1,
        phaseIndex: 0,
        startedAtMs: 10,
        endedAtMs: 30,
        durationMs: 20,
        outcome: "verified",
      }),
      stepRecord({
        index: 2,
        phaseIndex: 0,
        startedAtMs: 30,
        endedAtMs: 80,
        durationMs: 50,
        outcome: "verified",
      }),
      stepRecord({
        index: 3,
        phaseIndex: 1,
        startedAtMs: 80,
        endedAtMs: 90,
        durationMs: 10,
        outcome: "dry-run",
      }),
    ];
    const baseline = {
      verdict: foldCeremonyRunVerdict(steps),
      duration: ceremonyRunDurationMs(steps),
      phases: foldCeremonyPhaseDurations(steps),
    };
    const shuffled = [steps[2], steps[0], steps[1]] as typeof steps;
    expect(foldCeremonyRunVerdict(shuffled)).toBe(baseline.verdict);
    expect(ceremonyRunDurationMs(shuffled)).toBe(baseline.duration);
    expect(foldCeremonyPhaseDurations(shuffled)).toEqual(baseline.phases);
  });

  test("a long run keeps the verdict line and stays within 32 lines", () => {
    const steps = Array.from({ length: 60 }, (_, index) => ({
      index: index + 1,
      kind: "collect",
      outcome: "verified",
      verification: "verified",
    }));
    const text = renderCeremonyText({
      ceremony: "long",
      runId: "run-long",
      window: { start: "a", end: "b" },
      verdict: "verified",
      steps,
    });
    const lines = text.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeLessThanOrEqual(32);
    expect(lines[lines.length - 1]).toBe("verdict: verified");
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(6_144);
  });
});
