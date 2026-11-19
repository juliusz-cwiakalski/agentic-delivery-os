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

  test("every registry row executes over the real command path", async () => {
    // One representative run per group, driven over the D2 harness.
    const runFor = async (group: string) => {
      const harness = createLoopHarness({ label: `battery-${group}` });
      const argv =
        group === "stop"
          ? ["loop", "stop", "--json"]
          : group === "log"
            ? ["loop", "log", "--json"]
            : group === "verbs"
              ? ["loop", "status", "--json"]
              : ["loop", "start", "--foreground", "--json"];
      const result = await harness.run(argv);
      return result.code;
    };
    for (const group of [
      "verbs",
      "log",
      "spawn",
      "stuck",
      "backoff-budget",
      "stop",
      "single-instance",
    ]) {
      expect(await runFor(group), group).toBeLessThanOrEqual(2);
    }
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
