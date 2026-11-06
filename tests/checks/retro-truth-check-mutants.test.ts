/**
 * TC-RETRO-047 — disabling any pipeline-truth check produces the prohibited
 * observable, so the check suite is removal-sensitive.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateRetroTruthChecks } from "../../packages/core/src/domain/retro";
import { auditOutcome, auditRecord } from "../fixtures/retro/harness";
import type { RetroTruthCheckId } from "../../packages/core/src/contracts/index";

type Mutant = {
  readonly id: string;
  readonly disabled: readonly RetroTruthCheckId[];
  readonly expected: RetroTruthCheckId | "all";
};

const mutants = (
  JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/retro/truth-mutants/mutants.json"), "utf8"),
  ) as { mutants: Mutant[] }
).mutants;

const triggered = {
  audit: auditOutcome({
    records: [auditRecord()],
    orphans: [{ auditSeq: 1, runId: "orphan", position: 2 }],
    verified: false,
  }),
  collected: 0,
  completed: true,
  hasCloseout: false,
  orphanEvidenceRefs: ["ev-orphan"],
  danglingRefs: ["ev-dangling"],
  auditChainEvidenceRef: "ev-chain",
};

describe("TC-RETRO-047 truth-check mutants", () => {
  test("the unmutated control triggers every check", () => {
    const control = evaluateRetroTruthChecks(triggered);
    expect(control.checks.find((check) => check.id === "C-01")?.outcome).toBe("finding");
    expect(control.checks.find((check) => check.id === "C-02")?.outcome).toBe("blocked");
    expect(control.checks.find((check) => check.id === "C-03")?.outcome).toBe("finding");
    expect(control.checks.find((check) => check.id === "C-04")?.outcome).toBe("finding");
    expect(control.checks.find((check) => check.id === "C-05")?.outcome).toBe("blocked");
    expect(control.clean).toBe(false);
    expect(control.blocking).toBe("retro.evidence.tamper-flagged");
  });

  test("every disable-mutant changes the observable the check owns", () => {
    for (const mutant of mutants) {
      const mutated = evaluateRetroTruthChecks(triggered, { disabled: mutant.disabled });
      if (mutant.expected === "all") {
        expect(mutated.checks.every((check) => check.outcome === "passed"), mutant.id).toBe(true);
        expect(mutated.clean, mutant.id).toBe(true);
        expect(mutated.blocking, mutant.id).toBe(null);
        continue;
      }
      const target = mutated.checks.find((check) => check.id === mutant.expected);
      expect(target?.outcome, mutant.id).toBe("passed");
      const controlTarget = evaluateRetroTruthChecks(triggered).checks.find(
        (check) => check.id === mutant.expected,
      );
      expect(controlTarget?.outcome).not.toBe(target?.outcome);
    }
  });
});
