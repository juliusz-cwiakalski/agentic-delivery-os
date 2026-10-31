/**
 * TC-PHASE-005 — matrix rows 7-8: reopen grammar and canonical phase
 * vocabulary reject with `input.value.rejected` before target resolution or
 * any state inspection (AC-L3, D4).
 *
 * A recording runtime seam proves zero inspections, and a deliberately
 * wrongly-ordered control proves the ordering assertion is live: on a missing
 * target it would surface `lint.target.missing` instead.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CommandDefinition } from "../../packages/cli/src/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  createPhaseCallRecorder,
  PHASE_REF,
  type PhaseCallRecorder,
  type PhaseHarness,
  type PhaseRun,
  withPhaseHarness,
} from "./phase-support";
import { readPmNotesFixture } from "./pm-notes-lint-support";

const ROOT = process.cwd();
const FULL = readFileSync(join(ROOT, "tests/fixtures/phase/full-open.yaml"), "utf8");
const MALFORMED = readPmNotesFixture("malformed/unparseable-orphaned-indentation.yaml.txt");
const INSPECTION_CALLS = ["readPmNotes", "readRegistry", "stageEntry", "appendTransition"];

const errorOf = (run: PhaseRun): Record<string, unknown> => {
  const error = run.envelope?.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    throw new Error("expected an error envelope");
  }
  return error as Record<string, unknown>;
};

const stateInspectionCalls = (recorder: PhaseCallRecorder): string[] =>
  recorder.calls.filter((call) => INSPECTION_CALLS.includes(call));

const assertGrammarFirst = (recorder: PhaseCallRecorder): void => {
  const inspected = stateInspectionCalls(recorder);
  if (inspected.length > 0)
    throw new Error(`state inspected before grammar: ${inspected.join(", ")}`);
};

const expectRejection = (run: PhaseRun, recorder: PhaseCallRecorder): void => {
  expect(run.exitCode).toBe(1);
  expect(assertEnvelopeContract(run.envelope)).toEqual([]);
  expect(run.envelope?.data).toBeUndefined();
  expect(errorOf(run)).toMatchObject({
    code: "input.value.rejected",
    category: "user",
    consequence: "not_landed",
  });
  expect(stateInspectionCalls(recorder)).toEqual([]);
};

const expectUntouched = (harness: PhaseHarness, before: string): void => {
  expect(harness.rawLedgerLines()).toEqual([]);
  expect(harness.targetText()).toBe(before);
};

describe("TC-PHASE-005 row 7: reason-less reopen rejects before state inspection", () => {
  test("a valid target rejects missing and empty reasons with zero inspections", async () => {
    const recorder = createPhaseCallRecorder();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const before = harness.targetText();

        const missingReason = await harness.run(["reopen", PHASE_REF, "delivery"]);
        expectRejection(missingReason, recorder);
        expectUntouched(harness, before);

        const emptyReason = await harness.run(["reopen", PHASE_REF, "delivery", "   "]);
        expectRejection(emptyReason, recorder);
        expectUntouched(harness, before);

        expect(recorder.calls).toEqual([]);
      },
      "row7-valid",
      undefined,
      { recorder },
    );
  });

  test("a malformed target rejects the same way (grammar precedes parsing)", async () => {
    const recorder = createPhaseCallRecorder();
    await withPhaseHarness(
      MALFORMED,
      async (harness) => {
        const before = harness.targetText();
        const missingReason = await harness.run(["reopen", PHASE_REF, "delivery"]);
        expectRejection(missingReason, recorder);
        const emptyReason = await harness.run(["reopen", PHASE_REF, "delivery", ""]);
        expectRejection(emptyReason, recorder);
        expectUntouched(harness, before);
        expect(recorder.calls).toEqual([]);
      },
      "row7-malformed",
      undefined,
      { recorder },
    );
  });

  test("a missing target rejects the same way (never lint.target.missing)", async () => {
    const recorder = createPhaseCallRecorder();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const missingReason = await harness.run(["reopen", PHASE_REF, "delivery"]);
        expectRejection(missingReason, recorder);
        const emptyReason = await harness.run(["reopen", PHASE_REF, "delivery", "  "]);
        expectRejection(emptyReason, recorder);
        expect(harness.rawLedgerLines()).toEqual([]);
        expect(recorder.calls).toEqual([]);
      },
      "row7-missing",
      undefined,
      { recorder, omitTarget: true },
    );
  });
});

describe("TC-PHASE-005 row 8: unknown phase ids reject before state inspection", () => {
  test("an unknown canonical id and a real corpus opaque key both reject", async () => {
    const recorder = createPhaseCallRecorder();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const before = harness.targetText();
        for (const args of [
          ["complete", PHASE_REF, "unknown_phase"],
          ["reopen", PHASE_REF, "ci_remediation", "an opaque corpus key"],
        ] as const) {
          const run = await harness.run(args);
          expectRejection(run, recorder);
          expectUntouched(harness, before);
        }
        expect(recorder.calls).toEqual([]);
      },
      "row8-valid",
      undefined,
      { recorder },
    );
  });

  test("row 8 rejects identically against malformed and missing targets", async () => {
    const malformedRecorder = createPhaseCallRecorder();
    await withPhaseHarness(
      MALFORMED,
      async (harness) => {
        const run = await harness.run(["complete", PHASE_REF, "unknown_phase"]);
        expectRejection(run, malformedRecorder);
        expect(harness.rawLedgerLines()).toEqual([]);
        expect(malformedRecorder.calls).toEqual([]);
      },
      "row8-malformed",
      undefined,
      { recorder: malformedRecorder },
    );

    const missingRecorder = createPhaseCallRecorder();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await harness.run(["complete", PHASE_REF, "unknown_phase"]);
        expectRejection(run, missingRecorder);
        expect(harness.rawLedgerLines()).toEqual([]);
        expect(missingRecorder.calls).toEqual([]);
      },
      "row8-missing",
      undefined,
      { recorder: missingRecorder, omitTarget: true },
    );
  });

  test("neither case yields a lint or state code", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const reasonless = await harness.run(["reopen", PHASE_REF, "delivery"]);
        const unknown = await harness.run(["complete", PHASE_REF, "unknown_phase"]);
        for (const run of [reasonless, unknown]) {
          const code = errorOf(run).code;
          expect(typeof code).toBe("string");
          expect(String(code).startsWith("lint.")).toBe(false);
          expect(String(code).startsWith("state.")).toBe(false);
        }
      },
      "row8-codes",
    );
  });
});

describe("TC-PHASE-005 positive controls and the wrongly-ordered control", () => {
  test("a reasoned reopen and a canonical complete succeed and mutate", async () => {
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const completed = await harness.run(["complete", PHASE_REF, "delivery"]);
        expect(completed.exitCode).toBe(0);
        expect(harness.transitionPayloads()).toHaveLength(1);

        const reopened = await harness.run([
          "reopen",
          PHASE_REF,
          "delivery",
          "reopened to prove the positive control",
        ]);
        expect(reopened.exitCode).toBe(0);
        expect(harness.transitionPayloads()).toHaveLength(2);
        expect(harness.transitionPayloads()[1]).toMatchObject({
          operation: "reopen",
          phaseId: "delivery",
          reason: "reopened to prove the positive control",
        });
      },
      "row7-positive",
    );
  });

  test("a wrongly-ordered implementation is caught by the recording seam", async () => {
    const recorder = createPhaseCallRecorder();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const wronglyOrdered: CommandDefinition = {
          positionals: { max: 4 },
          humanSuccess: true,
          handler: ({ positionals }) => {
            const [subcommand, changeRef, , reason] = positionals;
            // Deliberate defect: resolve the target before validating grammar.
            const read = harness.runtime.readPmNotes(changeRef ?? "");
            if (subcommand !== "reopen") return { data: {} };
            if (reason === undefined || reason.trim().length === 0) {
              if (!read.ok) {
                const code =
                  read.reason === "missing" ? "lint.target.missing" : "lint.notes.malformed";
                return { error: { kind: "lint", code, summary: "target failed first" } };
              }
              return {
                error: { kind: "input", code: "input.value.rejected", summary: "reason required" },
              };
            }
            return { data: {} };
          },
        };

        const correct = await harness.run(["reopen", PHASE_REF, "delivery"]);
        expectRejection(correct, recorder);
        expect(recorder.calls).toEqual([]);

        const mutant = await harness.runDefinition(wronglyOrdered, [
          "reopen",
          PHASE_REF,
          "delivery",
        ]);
        expect(mutant.exitCode).toBe(1);
        expect(errorOf(mutant)).toMatchObject({ code: "input.value.rejected" });
        expect(recorder.calls).toContain("readPmNotes");
        expect(() => assertGrammarFirst(recorder)).toThrow("state inspected before grammar");
      },
      "wrong-order-valid",
      undefined,
      { recorder },
    );
  });

  test("the missing-target case proves what a wrongly-ordered command would return", async () => {
    const recorder = createPhaseCallRecorder();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const wronglyOrdered: CommandDefinition = {
          positionals: { max: 4 },
          humanSuccess: true,
          handler: ({ positionals }) => {
            const [, changeRef] = positionals;
            const read = harness.runtime.readPmNotes(changeRef ?? "");
            if (!read.ok) {
              const code =
                read.reason === "missing" ? "lint.target.missing" : "lint.notes.malformed";
              return { error: { kind: "lint", code, summary: "target resolved before grammar" } };
            }
            return { error: { kind: "input", code: "input.value.rejected", summary: "later" } };
          },
        };

        const correct = await harness.run(["reopen", PHASE_REF, "delivery"]);
        expectRejection(correct, recorder);

        const mutant = await harness.runDefinition(wronglyOrdered, [
          "reopen",
          PHASE_REF,
          "delivery",
        ]);
        expect(mutant.exitCode).toBe(1);
        expect(errorOf(mutant)).toMatchObject({ code: "lint.target.missing" });
        expect(recorder.calls).toContain("readPmNotes");
      },
      "wrong-order-missing",
      undefined,
      { recorder, omitTarget: true },
    );
  });
});
