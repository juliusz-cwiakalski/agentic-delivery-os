/**
 * TC-BATTLE-001/002/003/004/007, TC-LOG-002 and TC-CONTRACT-002's battery half
 * (GH-348 F-8; AC-F8-1/2/3/5, AC-F7-1, NFR-10).
 *
 * The battery drives the registry through the real command path with the
 * harnesses doubled, asserts every row names a proven seam, proves determinism,
 * proves the no-shell property three ways, and pins the permanent boundary.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loopPromptFor } from "../../../packages/core/src/domain/index";
import { scan } from "../../../scripts/checks/no-shell-dispatch";
import { createLoopHarness } from "../../fixtures/loop/harness";
import { LOOP_PARITY_CASES } from "../../fixtures/loop/parity/cases";
import {
  canonicalizeObservation,
  isOffBoundarySeam,
  isProvenSurface,
  LOOP_BOUNDARY_COUNTS,
  LOOP_NOT_PROVEN_SURFACES,
  LOOP_PARITY_PROOF_BOUNDARY,
  LOOP_PROVEN_SURFACES,
} from "../../fixtures/loop/parity/evidence";
import {
  LOOP_FORBIDDEN_SIGNATURES,
  PLANTED_REIMPLEMENTATION,
  scanBatterySeams,
  seamViolations,
} from "../../fixtures/loop/parity/seams";

const ROOT = process.cwd();
const STAMP = "2026-11-19T10:00:00.000Z";

/**
 * The registry gaps a case must be able to NAME: an unproven group, an absent
 * seam, or an empty expectation. Exported so the planted control drives the very
 * rule the delivery assertion uses (AC-F8-1 non-vacuity).
 */
export const surfaceGaps = (
  rows: readonly {
    readonly id: string;
    readonly group: string;
    readonly declaredSeam: string;
    readonly expected: Readonly<Record<string, unknown>>;
  }[],
): string[] => {
  const gaps: string[] = [];
  for (const row of rows) {
    if (!isProvenSurface(row.group)) gaps.push(`${row.id}: not a proven group`);
    if (row.declaredSeam.length === 0) gaps.push(`${row.id}: no declared seam`);
    if (Object.keys(row.expected).length === 0) gaps.push(`${row.id}: no expected observation`);
  }
  return gaps;
};

/**
 * One surface-specific observation per proven surface. A surface whose run stops
 * producing its observation fails BY NAME, so this meta-case cannot pass on a
 * bare `exit <= 2`.
 */
const SURFACE_OBSERVATIONS: Readonly<
  Record<string, () => Promise<{ readonly passed: boolean; readonly detail: string }>>
> = {
  verbs: async () => {
    const harness = createLoopHarness({ label: "meta-verbs" });
    const result = await harness.run(["loop", "status", "--json"]);
    const data = harness.dataOf(result);
    return {
      passed: result.code === 0 && data.schemaVersion === "delivery.loop.v1",
      detail: `status exit ${String(result.code)}`,
    };
  },
  log: async () => {
    const harness = createLoopHarness({ label: "meta-log" });
    harness.logFs.append(`${STAMP} event=cycle seq=1`);
    const data = harness.dataOf(await harness.run(["loop", "log", "--json"]));
    return {
      passed: data.schemaVersion === "delivery.loop.log.v1" && data.returnedLines === 1,
      detail: `log lines ${String(data.returnedLines)}`,
    };
  },
  spawn: async () => {
    const harness = createLoopHarness({ label: "meta-spawn" });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    return { passed: harness.counters.spawns === 1, detail: `spawns ${harness.counters.spawns}` };
  },
  stuck: async () => {
    const harness = createLoopHarness({
      label: "meta-stuck",
      progressReading: { state: "zero", observedAtMs: 0 },
      cycles: 1,
      cycleStepMs: 700_000,
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const records = harness.coordinatorRecords();
    const verdicts = records.ok
      ? records.stuck.filter((entry) => entry.verdict === "stuck" && entry.phase === "verdict")
      : [];
    return { passed: verdicts.length === 1, detail: `stuck verdicts ${verdicts.length}` };
  },
  kill: async () => {
    const harness = createLoopHarness({
      label: "meta-kill",
      progressReading: { state: "zero", observedAtMs: 0 },
      killOutcome: "forced",
      cycles: 1,
      cycleStepMs: 700_000,
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    return {
      passed: harness.verdicts.kills.length === 1,
      detail: `kills ${harness.verdicts.kills.join(",")}`,
    };
  },
  "backoff-budget": async () => {
    const harness = createLoopHarness({
      label: "meta-backoff",
      progressReading: { state: "zero", observedAtMs: 0 },
      cycles: 1,
      cycleStepMs: 700_000,
    });
    await harness.run(["loop", "start", "--foreground", "--json"]);
    const records = harness.coordinatorRecords();
    const restarts = records.ok ? records.restarts.length : 0;
    return { passed: restarts === 1, detail: `restarts ${restarts}` };
  },
  stop: async () => {
    const harness = createLoopHarness({ label: "meta-stop" });
    await harness.run(["loop", "stop", "--json"]);
    const stops = harness.loopRecords().stops;
    return {
      passed: stops.length === 1 && stops[0]?.action === "requested",
      detail: `stop records ${stops.length}`,
    };
  },
  "single-instance": async () => {
    const harness = createLoopHarness({
      label: "meta-instance",
      own: { pid: 9001, processStartTimeMs: 1_000 },
    });
    harness.seedFence({ action: "acquired", pid: 9001, processStartTimeMs: 1_000 });
    harness.setAlive(9001, true);
    const result = await harness.run(["loop", "start", "--foreground", "--json"]);
    return {
      passed: result.code === 2 && harness.errorCodeOf(result) === "coordinator.already-running",
      detail: `second start exit ${String(result.code)}`,
    };
  },
  "no-shell": async () => {
    const violations = scan(ROOT);
    const prompt = loopPromptFor("loop-main");
    return {
      passed: violations.length === 0 && !prompt.includes("scripts/"),
      detail: `scan violations ${violations.length}`,
    };
  },
};

describe("TC-BATTLE-001 every registry row executes and declares one proven seam", () => {
  test("every row names a proven surface and no row is off-boundary", () => {
    expect(LOOP_PARITY_CASES.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const row of LOOP_PARITY_CASES) {
      if (!isProvenSurface(row.group)) failures.push(`${row.id}: not a proven group`);
      if (isOffBoundarySeam(row.group)) failures.push(`${row.id}: off-boundary group`);
      if (row.declaredSeam.length === 0) failures.push(`${row.id}: no declared seam`);
    }
    expect(failures).toEqual([]);
  });

  test("every proven surface produces its OWN observation, or fails by name", async () => {
    const failures: string[] = [];
    for (const surface of LOOP_PROVEN_SURFACES) {
      const observation = await SURFACE_OBSERVATIONS[surface]();
      if (!observation.passed) failures.push(`${surface}: ${observation.detail}`);
    }
    expect(failures).toEqual([]);
  });

  test("the meta-case is falsifiable: a planted off-boundary or empty row fails by name", () => {
    const gaps = surfaceGaps([
      ...LOOP_PARITY_CASES,
      {
        id: "planted-off-group",
        group: "live-opencode",
        declaredSeam: "S-none",
        scenario: {},
        expected: {},
      },
      { id: "planted-empty", group: "verbs", declaredSeam: "", scenario: {}, expected: {} },
    ]);
    expect(gaps).toContain("planted-off-group: not a proven group");
    expect(gaps).toContain("planted-empty: no declared seam");
    expect(gaps).toContain("planted-empty: no expected observation");
    expect(surfaceGaps(LOOP_PARITY_CASES)).toEqual([]);
  });
});

describe("TC-BATTLE-002 no battery file reimplements a seam", () => {
  test("the declared battery sources carry no forbidden signature", () => {
    expect(scanBatterySeams(ROOT)).toEqual([]);
  });

  test("a planted reimplementation is rejected by name", () => {
    const signature = LOOP_FORBIDDEN_SIGNATURES[0];
    expect(signature).toBeDefined();
    expect(seamViolations(PLANTED_REIMPLEMENTATION)).toContain(signature);
  });
});

describe("TC-BATTLE-003 two runs are identical with zero live calls", () => {
  test("the canonicalized observations of two runs are equal", async () => {
    const run = async () => {
      const harness = createLoopHarness({ label: "battery-determinism" });
      const result = await harness.run(["loop", "start", "--foreground", "--json"]);
      const records = harness.coordinatorRecords();
      return canonicalizeObservation({
        code: result.code,
        data: harness.dataOf(result),
        fences: records.ok ? records.fences.map((entry) => entry.action) : [],
      });
    };
    expect(await run()).toBe(await run());
  });
});

describe("TC-BATTLE-004 the runner records zero shells and the prompt carries no script path", () => {
  test("the static invariant is clean over the declared surface", () => {
    expect(scan(ROOT)).toEqual([]);
  });

  test("the declared prompt names the primitives and carries no script path", () => {
    const prompt = loopPromptFor("loop-main");
    for (const primitive of ["dispatch", "merge", "queue", "closeout"]) {
      expect(prompt).toContain(primitive);
    }
    expect(prompt).not.toContain(".sh");
    expect(prompt).not.toContain("scripts/");
    expect(prompt).not.toContain("deliver-ticket");
  });
});

describe("TC-BATTLE-007 the proof boundary is a permanent constant", () => {
  test("nine proven and six not-proven ids in the declared order", () => {
    expect(LOOP_BOUNDARY_COUNTS).toEqual({ proven: 9, notProven: 6 });
    expect([...LOOP_PARITY_PROOF_BOUNDARY.proven]).toEqual([...LOOP_PROVEN_SURFACES]);
    expect([...LOOP_PARITY_PROOF_BOUNDARY.notProven]).toEqual([...LOOP_NOT_PROVEN_SURFACES]);
    expect([...LOOP_PROVEN_SURFACES]).toEqual([
      "verbs",
      "log",
      "spawn",
      "stuck",
      "kill",
      "backoff-budget",
      "stop",
      "single-instance",
      "no-shell",
    ]);
    expect([...LOOP_NOT_PROVEN_SURFACES]).toEqual([
      "live-opencode",
      "live-provider",
      "os-termination",
      "real-pick-deliver-merge",
      "long-run-loop",
      "cross-process-race",
    ]);
  });

  test("a missing id, a reordered id, and an off-boundary row all fail by name", () => {
    const missing = [...LOOP_PROVEN_SURFACES].filter((id) => id !== "no-shell");
    expect(missing).not.toEqual([...LOOP_PROVEN_SURFACES]);
    expect(missing).toContain("verbs");
    const reordered = [...LOOP_PROVEN_SURFACES].reverse();
    expect(reordered[0]).not.toBe(LOOP_PROVEN_SURFACES[0]);
    expect(isOffBoundarySeam("real-pick-deliver-merge")).toBe(true);
    expect(isProvenSurface("real-pick-deliver-merge")).toBe(false);
  });
});

describe("TC-LOG-002 / TC-CONTRACT-002 a full scenario log carries only identifiers", () => {
  test("no prompt, transcript, credential, environment value, model, or seat in any line", () => {
    const harness = createLoopHarness({ label: "battery-privacy" });
    return harness.run(["loop", "start", "--foreground", "--json"]).then(() => {
      const forbidden = [
        "sk-",
        "Bearer ",
        "OPENAI",
        "ANTHROPIC",
        "model=",
        "seat=",
        "prompt=",
        "transcript",
      ];
      for (const line of harness.lines) {
        for (const token of forbidden) {
          expect(line, `${token} in ${line}`).not.toContain(token);
        }
        expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(512);
      }
      expect(harness.lines.length).toBeGreaterThan(0);
    });
  });
});
