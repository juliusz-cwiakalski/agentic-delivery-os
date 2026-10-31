/**
 * TC-PHASE-006 — every malformed pm-notes class blocks the write path with the
 * same pinned lint identity as standalone lint (AC-L1, PIN-7).
 *
 * Each case mutates a target that is not the defective or omitted phase, so the
 * staged entry change cannot legitimately repair the defect (A-T9). Every case
 * asserts exit 1, a valid envelope, zero ledger records, unchanged target
 * bytes, and no append; the valid control mutates exactly once.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  createPhaseCallRecorder,
  PHASE_REF,
  type PhaseCallRecorder,
  type PhaseHarness,
  type PhaseRun,
  withoutPhase,
  withPhaseHarness,
} from "./phase-support";
import {
  documentOf,
  entryOf,
  loadPmNotes,
  mutated,
  readPmNotesFixture,
} from "./pm-notes-lint-support";

const ROOT = process.cwd();
const FULL = readFileSync(join(ROOT, "tests/fixtures/phase/full-open.yaml"), "utf8");
const MALFORMED = readPmNotesFixture("malformed/unparseable-orphaned-indentation.yaml.txt");

type MalformedCase = {
  readonly name: string;
  readonly text: string;
  readonly canary: string;
  /** Phase targeted by `complete`; never the defective/omitted phase. */
  readonly target: string;
  /** Phase targeted by `reopen`; a completed entry the fixture still has. */
  readonly reopenTarget: string;
  readonly expected: string;
};

const textFrom = (
  base: ReturnType<typeof loadPmNotes>,
  canary: string,
  mutate: (document: Record<string, unknown>) => void,
): string => stringify(documentOf(mutated(base, canary, mutate)));

const fullMissingDeliveryMode = (): string =>
  textFrom(loadPmNotes("valid/full-complete.yaml"), "planted-payload-keys-1001", (document) => {
    delete document.delivery_mode;
  });

const fullWrongTypedTopLevel = (): string =>
  textFrom(loadPmNotes("valid/full-complete.yaml"), "planted-payload-type-1002", (document) => {
    document.change_id = 42;
  });

const fullNonTimestamp = (): string =>
  textFrom(loadPmNotes("valid/full-complete.yaml"), "planted-payload-type-1003", (document) => {
    entryOf(document, "delivery").started = 42;
  });

const fullMissingCompleted = (): string =>
  textFrom(loadPmNotes("valid/full-complete.yaml"), "planted-payload-keys-1004", (document) => {
    delete entryOf(document, "delivery").completed;
  });

const fullMissingStarted = (): string =>
  textFrom(loadPmNotes("valid/full-complete.yaml"), "planted-payload-keys-1005", (document) => {
    delete entryOf(document, "delivery").started;
  });

const fullUnknownVariant = (): string =>
  textFrom(loadPmNotes("valid/full-complete.yaml"), "planted-payload-variant-1006", (document) => {
    document.variant = "compressed";
  });

const liteMissingPhase = (): string =>
  textFrom(loadPmNotes("valid/lite-six.yaml"), "planted-payload-phases-1007", (document) => {
    delete (document.phases as Record<string, unknown>).quality_gates;
  });

const CASES: readonly MalformedCase[] = [
  {
    name: "unparseable document → lint.notes.malformed",
    text: MALFORMED,
    canary: "planted-payload-unparseable-0001",
    target: "delivery",
    reopenTarget: "clarify_scope",
    expected: "lint.notes.malformed",
  },
  {
    name: "wrong-typed top-level value → lint.notes.malformed",
    text: fullWrongTypedTopLevel(),
    canary: "planted-payload-type-1002",
    target: "delivery",
    reopenTarget: "clarify_scope",
    expected: "lint.notes.malformed",
  },
  {
    name: "non-timestamp phase value → lint.notes.malformed",
    text: fullNonTimestamp(),
    canary: "planted-payload-type-1003",
    target: "system_spec_update",
    reopenTarget: "clarify_scope",
    expected: "lint.notes.malformed",
  },
  {
    name: "missing top-level key → lint.keys.missing",
    text: fullMissingDeliveryMode(),
    canary: "planted-payload-keys-1001",
    target: "delivery",
    reopenTarget: "clarify_scope",
    expected: "lint.keys.missing",
  },
  {
    name: "entry missing completed → lint.keys.missing",
    text: fullMissingCompleted(),
    canary: "planted-payload-keys-1004",
    target: "system_spec_update",
    reopenTarget: "clarify_scope",
    expected: "lint.keys.missing",
  },
  {
    name: "entry missing started → lint.keys.missing",
    text: fullMissingStarted(),
    canary: "planted-payload-keys-1005",
    target: "system_spec_update",
    reopenTarget: "clarify_scope",
    expected: "lint.keys.missing",
  },
  {
    name: "unknown variant → lint.variant.unknown",
    text: fullUnknownVariant(),
    canary: "planted-payload-variant-1006",
    target: "delivery",
    reopenTarget: "clarify_scope",
    expected: "lint.variant.unknown",
  },
  {
    name: "LITE missing a pinned phase → lint.phases.incomplete",
    text: liteMissingPhase(),
    canary: "planted-payload-phases-1007",
    target: "delivery",
    reopenTarget: "clarify_scope",
    expected: "lint.phases.incomplete",
  },
];

const errorOf = (run: PhaseRun): Record<string, unknown> => {
  const error = run.envelope?.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    throw new Error("expected an error envelope");
  }
  return error as Record<string, unknown>;
};

const expectBlocked = (
  run: PhaseRun,
  harness: PhaseHarness,
  recorder: PhaseCallRecorder,
  expected: string,
  before: string,
  canary: string,
): void => {
  expect(run.exitCode).toBe(1);
  expect(assertEnvelopeContract(run.envelope)).toEqual([]);
  expect(run.envelope?.data).toBeUndefined();
  expect(errorOf(run)).toMatchObject({ code: expected, consequence: "not_landed" });
  expect(harness.rawLedgerLines()).toEqual([]);
  expect(harness.targetText()).toBe(before);
  expect(harness.store.fenceStatus().held).toBe(false);
  expect(recorder.calls).not.toContain("appendTransition");
  expect(recorder.calls).not.toContain("writePmNotes");
  expect(run.stdout).not.toContain(canary);
  expect(run.stderr).not.toContain(canary);
};

describe("TC-PHASE-006 write-path lint blocks every malformed class", () => {
  for (const malformed of CASES) {
    test(`${malformed.name}`, async () => {
      const recorder = createPhaseCallRecorder();
      await withPhaseHarness(
        malformed.text,
        async (harness) => {
          const before = harness.targetText();
          // Fixture liveness: the planted mutation is present before lint runs.
          expect(before).toContain(malformed.canary);

          const complete = await harness.run(["complete", PHASE_REF, malformed.target]);
          expectBlocked(complete, harness, recorder, malformed.expected, before, malformed.canary);

          const reopen = await harness.run([
            "reopen",
            PHASE_REF,
            malformed.reopenTarget,
            "a supplied reason",
          ]);
          expectBlocked(reopen, harness, recorder, malformed.expected, before, malformed.canary);
        },
        `lint-${malformed.target}`,
        undefined,
        { recorder },
      );
    });
  }

  test("the valid control mutates with exactly one new record per landing", async () => {
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
          "valid control reopen",
        ]);
        expect(reopened.exitCode).toBe(0);
        expect(harness.transitionPayloads()).toHaveLength(2);
        expect(harness.transitionPayloads()[1]).toMatchObject({
          operation: "reopen",
          phaseId: "delivery",
          reason: "valid control reopen",
        });
      },
      "write-path-valid",
    );
  });

  test("a missing target fails lint.target.missing, never a state code", async () => {
    const recorder = createPhaseCallRecorder();
    await withPhaseHarness(
      FULL,
      async (harness) => {
        const run = await harness.run(["complete", PHASE_REF, "delivery"]);
        expect(run.exitCode).toBe(1);
        expect(errorOf(run)).toMatchObject({ code: "lint.target.missing" });
        expect(harness.rawLedgerLines()).toEqual([]);
        expect(recorder.calls).not.toContain("readRegistry");
        expect(recorder.calls).not.toContain("appendTransition");
      },
      "write-path-missing",
      undefined,
      { recorder, omitTarget: true },
    );
  });

  test("an unrelated missing required phase fails incomplete and lands nothing", async () => {
    const incomplete = withoutPhase(withoutPhase(FULL, "review_fix"), "dor_check");
    await withPhaseHarness(
      incomplete,
      async (harness) => {
        const before = harness.targetText();
        const run = await harness.run(["complete", PHASE_REF, "review_fix"]);
        expect(run.exitCode).toBe(1);
        expect(assertEnvelopeContract(run.envelope)).toEqual([]);
        expect(errorOf(run)).toMatchObject({
          code: "lint.phases.incomplete",
          consequence: "not_landed",
        });
        expect(String(errorOf(run).summary)).toContain("dor_check");
        expect(harness.rawLedgerLines()).toEqual([]);
        expect(harness.targetText()).toBe(before);
      },
      "write-path-unrelated",
    );
  });
});
