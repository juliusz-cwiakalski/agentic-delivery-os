/**
 * TC-F7-004 / AC-F7-3 — the F8 regression, named for the serial-merge churn
 * defect (spec §24.6 Appendix F F8; AC-F2-1, AC-F2-6).
 *
 * Three lifecycle merges are offered from the same base. The suite owns the
 * invariants and reads only the serial fixture's observations:
 *
 * - each invocation performs at most one landing call (the first exactly one,
 *   the non-first none);
 * - no invocation mutates the head — the head the verification bound is the head
 *   the provider was asked to land;
 * - no internal rebase is attempted;
 * - the non-first invocations resolve as the typed `merge.sync-required` refusal,
 *   whose remediation instructs a sync and never a rebase-and-retry.
 *
 * The control SUBSTITUTES the pre-fix attempt (one local rebase-refresh when the
 * request reads `conflicting`) into the same repaired composition — no case
 * executes pre-fix code from an earlier commit (test plan GAP-TP-4, M76, M99).
 * The pre-fix run must fail the head-mutation invariant at a named invocation
 * index, so the production assertion cannot pass vacuously.
 */
import { describe, expect, test } from "bun:test";
import { resolveAppErrorCode } from "../../packages/cli/src/classify";
import {
  runSerialThree,
  type SerialRun,
  serialControlDiffers,
} from "../fixtures/merge/serial-three";

const SYNC_CODE = "merge.sync-required";

/** The suite's own invariant oracle; every violation names the rule and index. */
const serialViolations = (run: SerialRun): readonly string[] => {
  const violations: string[] = [];
  run.observations.forEach((observation, index) => {
    if (observation.landings > 1) {
      violations.push(`landing-call@${observation.label}: ${observation.landings} calls`);
    }
    if (index === 0 && observation.landings !== 1) {
      violations.push(
        `landing-call@${observation.label}: first invocation landed ${observation.landings}`,
      );
    }
    if (index > 0 && observation.landings !== 0) {
      violations.push(
        `landing-call@${observation.label}: a sync refusal landed ${observation.landings}`,
      );
    }
    if (observation.headBefore !== observation.headAfter) {
      violations.push(
        `head-mutation@${observation.label}: ${observation.headBefore}->${observation.headAfter}`,
      );
    }
    if (observation.refreshAttempts !== 0) {
      violations.push(`rebase-attempt@${observation.label}: ${observation.refreshAttempts}`);
    }
    if (index > 0) {
      if (observation.exitCode !== 1) {
        violations.push(`exit@${observation.label}: ${observation.exitCode}`);
      }
      if (observation.refusal.code !== SYNC_CODE) {
        violations.push(`refusal@${observation.label}: ${String(observation.refusal.code)}`);
      }
    }
  });
  return violations;
};

/** The declared control: the pre-fix attempt substituted into the same path. */
const controlViolations = async (): Promise<readonly string[]> =>
  serialViolations(await runSerialThree("pre-fix-substituted"));

describe("F8 defect-f8-serial-merge-churn: one landing, no head mutation, no rebase", () => {
  // assertion: f8.one-landing-per-invocation
  test("the three invocations land 1 / 0 / 0 and never more than once", async () => {
    const run = await runSerialThree("production");
    expect(run.observations.map((observation) => observation.landings)).toEqual([1, 0, 0]);
    expect(run.observations.every((observation) => observation.landings <= 1)).toBe(true);
    expect(run.observations.map((observation) => observation.label)).toEqual([
      "merge-1",
      "merge-2",
      "merge-3",
    ]);
  });

  // assertion: f8.zero-head-mutations
  test("no invocation mutates the head the verification bound", async () => {
    const run = await runSerialThree("production");
    const base = run.observations[0]?.headBefore;
    expect(base).toBeTruthy();
    expect(run.observations.map((observation) => observation.headBefore)).toEqual([
      base,
      base,
      base,
    ]);
    expect(run.observations.map((observation) => observation.headAfter)).toEqual([
      base,
      base,
      base,
    ]);
    expect(
      run.observations.filter((observation) => observation.headBefore !== observation.headAfter),
    ).toEqual([]);
  });

  // assertion: f8.no-rebase-attempt
  test("the git seam records zero rebase-refresh attempts across the sequence", async () => {
    const run = await runSerialThree("production");
    expect(run.observations.map((observation) => observation.refreshAttempts)).toEqual([0, 0, 0]);
  });

  // assertion: f8.typed-sync-refusals
  test("the non-first invocations are merge.sync-required with a sync remediation", async () => {
    const run = await runSerialThree("production");
    const nonFirst = run.observations.slice(1);
    expect(nonFirst.map((observation) => observation.exitCode)).toEqual([1, 1]);
    expect(nonFirst.map((observation) => observation.refusal.code)).toEqual([SYNC_CODE, SYNC_CODE]);
    const row = resolveAppErrorCode(SYNC_CODE);
    expect(row.ok).toBe(true);
    if (!row.ok) return;
    expect(row.entry.domainKind).toBe("merge");
    expect(row.entry.remediationHint.toLowerCase()).toContain("sync");
    expect(row.entry.remediationHint.toLowerCase()).not.toContain("rebase");
    for (const observation of nonFirst) {
      expect(String(observation.refusal.summary)).toContain("sync");
    }
    // The whole production run satisfies every invariant at once.
    expect(serialViolations(run)).toEqual([]);
  });

  // control: f8.substituted-prefix-refresh shape=substituted-derivation
  test("the substituted pre-fix attempt fails the head-mutation invariant by name", async () => {
    const violations = await controlViolations();
    // The pre-fix attempt mutates the head on the first `conflicting` read, and
    // the moved head then voids the SHA-bound verification for the next merge:
    // both consequences are named, at their invocation.
    expect(violations.join("\n")).toContain("head-mutation@merge-2");
    expect(violations.join("\n")).toContain("rebase-attempt@merge-2");
    expect(violations.join("\n")).toContain("refusal@merge-3: merge.gates-stale");
    // The control differs from production on the declared observable.
    const differs = await serialControlDiffers();
    expect(differs.productionHeadMutations).toBe(0);
    expect(differs.preFixHeadMutations).toBe(1);
    expect(differs.preFixHeadMutations).not.toBe(differs.productionHeadMutations);
  });

  // assertion: f8.control-differs-from-production
  test("a control that re-ran the repaired path would report no divergence", async () => {
    // The substitution is the only difference: the same fixture and the same
    // composition, so a control returning the production value fails the pair.
    const production = await runSerialThree("production");
    const substituted = await runSerialThree("pre-fix-substituted");
    expect(serialViolations(production)).toEqual([]);
    expect(serialViolations(substituted)).not.toEqual([]);
    expect(substituted.observations[1]?.headAfter).not.toBe(production.observations[1]?.headAfter);
  });
});
