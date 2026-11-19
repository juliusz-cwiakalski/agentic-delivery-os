/**
 * TC-F7-003 / AC-F7-2 — the F4 regression, named for the stale-mirror defect:
 * the convergence branch took the FIRST matching completion in history while the
 * fold defines completion as the LATEST (spec §24.6 Appendix F F4; AC-F5-1,
 * AC-F5-2, API-6).
 *
 * The suite owns three oracles over the repaired path:
 *
 * 1. complete → reopen → re-complete leaves the SECOND completion on the fold,
 *    on `phase list` and in the document, with the pre-reopen value absent from
 *    both surfaces and the no-op re-run reporting the same value;
 * 2. a hand-edited document completion yields exactly one
 *    `lint.phases.divergent` naming the phase, a document-only completion is not
 *    flagged, and detection performs zero writes and acquires zero fences;
 * 3. the control SUBSTITUTES the pre-fix derivation (the first matching
 *    completion in the full history) for the repaired one. It asserts the
 *    substituted value differs from the production value BEFORE the equalities —
 *    so a control that returns the fixed value fails by name, and no case claims
 *    to execute pre-fix code from an earlier commit (test plan M75, M99).
 */
import { describe, expect, test } from "bun:test";
import { parsePmNotesText } from "../../packages/adapters/src/file/pm-notes-parser";
import type { LintCommandRuntime } from "../../packages/cli/src/commands/lint";
import type { PhaseTransitionRecord } from "../../packages/core/src/contracts/index";
import { foldPhaseState } from "../../packages/core/src/state/index";
import { divergencePair } from "../fixtures/lint/divergence";
import {
  completionRecord,
  documentCompletedOf,
  phaseNotesText,
  preFixCompletionLookup,
  reopenedThenRecompleted,
  T1,
  T2,
} from "../fixtures/phase/history";
import { PHASE_REF, type PhaseHarness, withPhaseHarness } from "./phase-support";
import { runLint, runtimeForValue } from "./pm-notes-lint-command-support";

const PHASE = "delivery";

const dataOf = (run: { envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const data = run.envelope?.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

const errorOf = (run: { envelope?: Record<string, unknown> }): Record<string, unknown> => {
  const error = run.envelope?.error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    throw new Error("expected a failure envelope");
  }
  return error as Record<string, unknown>;
};

/** The fold's completion for the phase — the one truth the mirror must reproduce. */
const foldCompleted = (harness: PhaseHarness, phaseId = PHASE): string | null =>
  foldPhaseState(PHASE_REF, transitionsOf(harness)).phases[phaseId]?.completed ?? null;

/** The verified ledger history the harness holds. */
const transitionsOf = (harness: PhaseHarness): readonly PhaseTransitionRecord[] =>
  harness.transitionPayloads().map((payload) => payload as unknown as PhaseTransitionRecord);

/** The document's completion, read through the delivered parser. */
const documentCompleted = (harness: PhaseHarness, phaseId = PHASE): string | null => {
  const parsed = parsePmNotesText(harness.targetText(), harness.targetPath);
  if (!parsed.ok) throw new Error("the written document is not parseable");
  return documentCompletedOf(parsed.value, phaseId);
};

/** The `phase list` projection's completion for the phase. */
const listCompleted = async (harness: PhaseHarness, phaseId = PHASE): Promise<string | null> => {
  const run = await harness.run(["list", PHASE_REF]);
  expect(run.exitCode).toBe(0);
  const phases = dataOf(run).phases as Record<string, { readonly completed?: unknown }> | undefined;
  const completed = phases?.[phaseId]?.completed;
  return typeof completed === "string" ? completed : null;
};

/** The `evidence.completedAt` a no-op envelope reports. */
const noOpCompletedAt = (run: { envelope?: Record<string, unknown> }): unknown => {
  const evidence = dataOf(run).evidence;
  return typeof evidence === "object" && evidence !== null
    ? (evidence as { readonly completedAt?: unknown }).completedAt
    : undefined;
};

describe("F4 defect-f4-phase-mirror: the second completion reaches every surface", () => {
  // assertion: f4.second-completion-on-three-surfaces
  test("complete → reopen → re-complete leaves the second value on fold, list and document", async () => {
    await withPhaseHarness(
      phaseNotesText(),
      async (harness) => {
        const first = await harness.run(["complete", PHASE_REF, PHASE]);
        expect(first.exitCode).toBe(0);
        const firstCompletion = foldCompleted(harness);
        expect(firstCompletion).not.toBeNull();
        expect(documentCompleted(harness)).toBe(firstCompletion);
        expect(await listCompleted(harness)).toBe(firstCompletion);

        const reopened = await harness.run(["reopen", PHASE_REF, PHASE, "scope reopened"]);
        expect(reopened.exitCode).toBe(0);
        expect(foldCompleted(harness)).toBeNull();
        expect(documentCompleted(harness)).toBeNull();
        expect(await listCompleted(harness)).toBeNull();

        const second = await harness.run(["complete", PHASE_REF, PHASE]);
        expect(second.exitCode).toBe(0);
        const secondCompletion = foldCompleted(harness);
        expect(secondCompletion).not.toBeNull();
        expect(secondCompletion).not.toBe(firstCompletion);

        // The three surfaces agree on the second completion, and the pre-reopen
        // value is absent from the document and from the projection (API-6).
        expect(documentCompleted(harness)).toBe(secondCompletion);
        expect(await listCompleted(harness)).toBe(secondCompletion);
        expect(harness.targetText()).not.toContain(firstCompletion as string);
        const listed = JSON.stringify(await harness.run(["list", PHASE_REF]));
        expect(listed).not.toContain(`"completed":"${firstCompletion as string}"`);
        expect(listed).toContain(`"completed":"${secondCompletion as string}"`);
      },
      "defect-f4-mirror",
    );
  });

  // control: f4.substituted-history-lookup shape=substituted-derivation
  test("the pre-fix history lookup yields T1, so the equalities discriminate", async () => {
    await withPhaseHarness(
      phaseNotesText(),
      async (harness) => {
        const first = await harness.run(["complete", PHASE_REF, PHASE]);
        expect(first.exitCode).toBe(0);
        const firstCompletion = foldCompleted(harness);
        const reopened = await harness.run(["reopen", PHASE_REF, PHASE, "scope reopened"]);
        expect(reopened.exitCode).toBe(0);
        const second = await harness.run(["complete", PHASE_REF, PHASE]);
        expect(second.exitCode).toBe(0);
        const secondCompletion = foldCompleted(harness);
        expect(secondCompletion).not.toBeNull();
        expect(firstCompletion).not.toBeNull();

        // The substituted derivation is the first matching completion in history.
        const retired = preFixCompletionLookup(transitionsOf(harness), PHASE);
        // Inequality first: a control that returned the fixed value fails here.
        expect(retired).not.toBe(secondCompletion);
        expect(retired).toBe(firstCompletion);
        // The repaired surfaces carry the second value, not the substituted one.
        expect(foldCompleted(harness)).not.toBe(retired);
        expect(documentCompleted(harness)).not.toBe(retired);
        expect(await listCompleted(harness)).not.toBe(retired);
      },
      "defect-f4-control",
    );
  });

  // assertion: f4.no-op-reports-the-fold
  test("the no-op re-run reports the fold's completion and appends nothing", async () => {
    await withPhaseHarness(
      phaseNotesText(),
      async (harness) => {
        await harness.run(["complete", PHASE_REF, PHASE]);
        await harness.run(["reopen", PHASE_REF, PHASE, "scope reopened"]);
        await harness.run(["complete", PHASE_REF, PHASE]);
        const completion = foldCompleted(harness);
        const recordsBefore = harness.transitionPayloads().length;
        const rerun = await harness.run(["complete", PHASE_REF, PHASE]);
        expect(rerun.exitCode).toBe(0);
        expect(dataOf(rerun).outcome).toBe("no-op");
        expect(noOpCompletedAt(rerun)).toBe(completion);
        expect(harness.transitionPayloads()).toHaveLength(recordsBefore);
        // The no-op reports the fold's second value, never the first one.
        expect(noOpCompletedAt(rerun)).not.toBe(
          preFixCompletionLookup(transitionsOf(harness), PHASE),
        );
      },
      "defect-f4-noop",
    );
  });
});

describe("F4 defect-f4-phase-mirror: divergence is reported, never repaired", () => {
  const REF = "GH-179";
  const registryWith = (fold: ReturnType<typeof foldPhaseState>) => () => ({
    ok: true as const,
    verifiedEmpty: false,
    recordCount: 1,
    verification: ["verified"],
    projection: { present: true },
    fold,
  });

  // assertion: f4.hand-edited-completion-is-named
  test("a hand-edited completion yields one lint.phases.divergent naming the phase", async () => {
    const pair = divergencePair(
      { [PHASE]: { started: T1, completed: T1 } },
      [completionRecord(PHASE, T2)],
      REF,
    );
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(1);
      const error = errorOf(run);
      expect(error.code).toBe("lint.phases.divergent");
      const summary = String(error.summary);
      expect(summary).toContain(`phases.${PHASE}.completed`);
      expect(summary).toContain(`document=${T1}`);
      expect(summary).toContain(`fold=${T2}`);
      // Detected once, with no success payload beside it and no repair command.
      expect(run.envelope?.data).toBeUndefined();
      expect(JSON.stringify(run.envelope).split("lint.phases.divergent").length - 1).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  // assertion: f4.document-only-completion-is-excluded
  test("a document-only completion is not flagged and the compared count stays zero", async () => {
    const pair = divergencePair({ [PHASE]: { started: T1, completed: T1 } }, [], REF);
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    try {
      const run = await runLint(fixture.runtime, [REF, "--pm-notes", "--registry"]);
      expect(run.exitCode).toBe(0);
      expect(run.envelope?.error).toBeUndefined();
      expect(dataOf(run).divergence).toEqual({ compared: 0, findings: 0 });
    } finally {
      fixture.cleanup();
    }
  });

  // assertion: f4.detection-performs-zero-writes-and-fences
  test("detection performs zero writes and acquires zero fences", async () => {
    const pair = divergencePair(
      { [PHASE]: { started: T1, completed: T1 } },
      [completionRecord(PHASE, T2)],
      REF,
    );
    const fixture = runtimeForValue(pair.document, registryWith(pair.fold));
    const counters = {
      pmNotesReads: 0,
      registryReads: 0,
      documentWrites: 0,
      appends: 0,
      fences: 0,
      clockReads: 0,
    };
    const trap = (name: keyof typeof counters) => () => {
      counters[name] += 1;
      throw new Error(`detection reached ${String(name)}`);
    };
    const base = fixture.runtime;
    const counting = {
      ...base,
      readPmNotes: (changeRef: string) => {
        counters.pmNotesReads += 1;
        return base.readPmNotes(changeRef);
      },
      readRegistry: (changeRef: string) => {
        counters.registryReads += 1;
        return base.readRegistry(changeRef);
      },
      writePmNotes: trap("documentWrites"),
      appendTransition: trap("appends"),
      newFenceToken: trap("fences"),
      nowIso: trap("clockReads"),
    } as unknown as LintCommandRuntime;
    try {
      const first = await runLint(counting, [REF, "--pm-notes", "--registry"]);
      const second = await runLint(counting, [REF, "--pm-notes", "--registry"]);
      expect(first.exitCode).toBe(1);
      expect(second.exitCode).toBe(1);
      expect(errorOf(first)).toEqual(errorOf(second));
      expect(counters.pmNotesReads).toBe(2);
      expect(counters.registryReads).toBe(2);
      expect(counters.documentWrites).toBe(0);
      expect(counters.appends).toBe(0);
      expect(counters.fences).toBe(0);
      expect(counters.clockReads).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });
});

/**
 * The control pair the meta-check reads: the fold's completion and the retired
 * derivation's value over the same three-record history.
 */
export const controlDiffers = (): {
  readonly production: string | null;
  readonly preFix: string | null;
} => {
  const history = reopenedThenRecompleted();
  const fold = foldPhaseState("GH-349", history);
  return {
    production: fold.phases[PHASE]?.completed ?? null,
    preFix: preFixCompletionLookup(history, PHASE),
  };
};
