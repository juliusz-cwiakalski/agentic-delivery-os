/**
 * TC-F5-001..003 — the pm-notes mirror is derived from the post-transition fold
 * on every document branch (F-5, API-6, TDR-0055 §2/§3).
 *
 * The F4 regression is the named case: complete → reopen → re-complete leaves the
 * SECOND completion on the fold, `phase list` and the document, and the no-op
 * re-run reports that same value. The retired derivation (the first matching
 * completion in history) is SUBSTITUTED as the control — no case executes pre-fix
 * code from an earlier commit (test plan M99).
 */
import { describe, expect, test } from "bun:test";
import { parsePmNotesText } from "../../packages/adapters/src/file/pm-notes-parser";
import type { PhaseTransitionRecord } from "../../packages/core/src/contracts/index";
import { foldPhaseState, readChangeTransitionsTolerant } from "../../packages/core/src/state/index";
import {
  COMMIT_CHANGE_DIRECTORY,
  type CommitHarness,
  withCommitHarness,
} from "../fixtures/commit/harness";
import {
  documentCompletedOf,
  documentStartedOf,
  phaseNotesBranch,
  phaseNotesText,
  preFixCompletionLookup,
  T1,
  T2,
} from "../fixtures/phase/history";
import {
  appendCompletionRecord,
  appendTelemetryRecord,
  COMMIT_REF,
  commitCount,
  dataOf,
  transitionPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const NOTES = `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-pm-notes.yaml`;
const PHASE = "delivery";

const dirty = (harness: CommitHarness, value: string): void => {
  harness.repo.write("src/existing.ts", `export const v = ${value};\n`);
};

/** The verified ledger history for the fixture change. */
const transitionsOf = (harness: CommitHarness): readonly PhaseTransitionRecord[] => {
  const read = readChangeTransitionsTolerant(harness.store, COMMIT_REF);
  if (!read.ok) throw new Error(`registry read failed: ${read.error.code}`);
  return read.value.transitions;
};

/** The fold's completion for the phase — the truth every branch must mirror. */
const foldCompleted = (harness: CommitHarness, phaseId = PHASE): string | null =>
  foldPhaseState(COMMIT_REF, transitionsOf(harness)).phases[phaseId]?.completed ?? null;

/** The document's completion for the phase, read through the delivered parser. */
const documentCompleted = (harness: CommitHarness, phaseId = PHASE): string | null => {
  const parsed = parsePmNotesText(harness.targetText(), NOTES);
  if (!parsed.ok) throw new Error("the written document is not parseable");
  return documentCompletedOf(parsed.value, phaseId);
};

/**
 * The written document's `branch` declaration, re-read after the write
 * (TC-MRG-009, DM-1): the key is lint-opaque and must survive every
 * document-writing branch value-faithfully.
 */
const documentBranch = (harness: CommitHarness): string | undefined => {
  const parsed = parsePmNotesText(harness.targetText(), NOTES);
  if (!parsed.ok) throw new Error("the written document is not parseable");
  const value = parsed.value as Record<string, unknown>;
  return typeof value.branch === "string" ? value.branch : undefined;
};

/** The `phase list` payload (the derived projection) for the fixture change. */
const runList = async (harness: CommitHarness): Promise<Record<string, unknown>> => {
  const run = await harness.runPhase(["list", COMMIT_REF]);
  expect(run.exitCode).toBe(0);
  return dataOf(run);
};

const listCompleted = async (harness: CommitHarness, phaseId = PHASE): Promise<string | null> => {
  const phases = (await runList(harness)).phases as
    | Record<string, { readonly completed?: unknown }>
    | undefined;
  const completed = phases?.[phaseId]?.completed;
  return typeof completed === "string" ? completed : null;
};

/** The `evidence.completedAt` a no-op envelope reports. */
const noOpEvidenceCompletedAt = (run: Parameters<typeof dataOf>[0]): unknown => {
  const evidence = dataOf(run).evidence;
  return typeof evidence === "object" && evidence !== null
    ? (evidence as { readonly completedAt?: unknown }).completedAt
    : undefined;
};

describe("TC-F5-003 the F4 regression: complete → reopen → re-complete", () => {
  test("the second completion reaches the fold, phase list and the document", async () => {
    await withCommitHarness(
      async (harness) => {
        // 1. complete(T1) lands a commit and the mirror.
        dirty(harness, "2");
        harness.coreTransport.push({
          kind: "success",
          message: validMessage(undefined, "Complete the fixture delivery phase."),
        });
        const first = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(first.exitCode).toBe(0);
        expect(dataOf(first).outcome).toBe("landed");
        const firstCompletion = foldCompleted(harness);
        expect(firstCompletion).not.toBeNull();
        expect(documentCompleted(harness)).toBe(firstCompletion);
        expect(await listCompleted(harness)).toBe(firstCompletion);

        // 2. reopen clears the completion in the fold and writes null.
        const reopened = await harness.runPhase(["reopen", COMMIT_REF, PHASE, "scope reopened"]);
        expect(reopened.exitCode).toBe(0);
        expect(foldCompleted(harness)).toBeNull();
        expect(documentCompleted(harness)).toBeNull();

        // 3. re-complete lands a second completion, distinct from the first.
        dirty(harness, "3");
        harness.coreTransport.push({
          kind: "success",
          message: validMessage(undefined, "Complete the fixture delivery phase again."),
        });
        const second = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(second.exitCode).toBe(0);
        const secondCompletion = foldCompleted(harness);
        expect(secondCompletion).not.toBeNull();
        expect(secondCompletion).not.toBe(firstCompletion);
        expect(documentCompleted(harness)).toBe(secondCompletion);

        // The discriminating fact: the retired derivation yields the FIRST
        // completion, so the inequality is asserted before the equalities (M99).
        const history = transitionsOf(harness);
        const retired = preFixCompletionLookup(history, PHASE);
        expect(retired).toBe(firstCompletion);
        expect(retired).not.toBe(secondCompletion);

        // 4. A mirror carrying the pre-reopen value converges on a no-op.
        harness.repo.write(
          NOTES,
          phaseNotesText({ [PHASE]: { started: null, completed: firstCompletion } }),
        );
        const beforeCommits = commitCount(harness);
        const recordsBefore = transitionPayloads(harness).length;
        const rerun = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(rerun.exitCode).toBe(0);
        const rerunData = dataOf(rerun);
        expect(rerunData.outcome).toBe("no-op");
        expect(rerunData.commitSkipped).toBe("no-op");
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(transitionPayloads(harness)).toHaveLength(recordsBefore);
        // API-6: the no-op evidence reports the fold's value, never the retired
        // derivation's.
        expect(noOpEvidenceCompletedAt(rerun)).toBe(secondCompletion);

        // All three surfaces carry the second completion, and the pre-reopen
        // completion appears in neither surface.
        expect(foldCompleted(harness)).toBe(secondCompletion);
        expect(documentCompleted(harness)).toBe(secondCompletion);
        expect(await listCompleted(harness)).toBe(secondCompletion);
        expect(harness.targetText()).not.toContain(firstCompletion);
        const listPayload = JSON.stringify(await runList(harness));
        expect(listPayload).not.toContain(`"completed":"${firstCompletion}"`);
        expect(listPayload).toContain(`"completed":"${secondCompletion}"`);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-F5-001 every document-writing branch writes the fold's completion", () => {
  test("both (already landed): the mirror converges on the fold's latest completion", async () => {
    await withCommitHarness(
      async (harness) => {
        dirty(harness, "2");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const landed = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(landed.exitCode).toBe(0);
        const completion = foldCompleted(harness);
        expect(completion).not.toBeNull();

        // A second writer leaves a different completion in the mirror.
        harness.repo.write(NOTES, phaseNotesText({ [PHASE]: { started: null, completed: T1 } }));
        const converged = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(converged.exitCode).toBe(0);
        expect(dataOf(converged).outcome).toBe("no-op");
        expect(foldCompleted(harness)).toBe(completion);
        expect(documentCompleted(harness)).toBe(completion);
        expect(documentCompleted(harness)).not.toBe(T1);
        // The branch declaration survives the already-landed write.
        expect(documentBranch(harness)).toBe(phaseNotesBranch);
      },
      { seedFiles: SEED },
    );
  });

  test("commit-without-record: the appended record's completion is the mirror's", async () => {
    await withCommitHarness(
      async (harness) => {
        dirty(harness, "2");
        harness.repo.run(["add", "-A", "--", "src"]);
        harness.repo.run([
          "commit",
          "--no-verify",
          "--no-gpg-sign",
          "-m",
          `feat(${COMMIT_REF}): pre-landed`,
        ]);
        appendTelemetryRecord(harness, { commitSha: harness.repo.head() });
        harness.repo.write(NOTES, phaseNotesText({ [PHASE]: { started: null, completed: T1 } }));
        const beforeCommits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).outcome).toBe("landed");
        expect(commitCount(harness)).toBe(beforeCommits);
        const completion = foldCompleted(harness);
        expect(completion).not.toBeNull();
        expect(completion).not.toBe(T1);
        expect(documentCompleted(harness)).toBe(completion);
        // The branch declaration survives the commit-without-record write.
        expect(documentBranch(harness)).toBe(phaseNotesBranch);
        expect(transitionPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });

  test("record-atomic-without-commit: the record authors the convergence document", async () => {
    await withCommitHarness(
      async (harness) => {
        appendCompletionRecord(harness, { intent: "atomic", timestamp: T2 });
        harness.repo.write(NOTES, phaseNotesText({ [PHASE]: { started: null, completed: T1 } }));
        dirty(harness, "2");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(run.exitCode).toBe(0);
        const completion = foldCompleted(harness);
        expect(completion).toBe(T2);
        expect(documentCompleted(harness)).toBe(completion);
        // The branch writes the fold's value, never its own clock value.
        expect(documentCompleted(harness)).not.toBe(dataOf(run).timestamp as string);
        // The branch declaration survives the atomic-record write.
        expect(documentBranch(harness)).toBe(phaseNotesBranch);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(await listCompleted(harness)).toBe(completion);
      },
      { seedFiles: SEED },
    );
  });

  test("record-record-only: the no-op reports the fold and repairs nothing", async () => {
    await withCommitHarness(
      async (harness) => {
        const first = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(first.exitCode).toBe(0);
        expect(dataOf(first).outcome).toBe("landed");
        const completion = foldCompleted(harness);
        expect(completion).not.toBeNull();
        expect(documentCompleted(harness)).toBe(completion);

        const rerun = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(rerun.exitCode).toBe(0);
        const rerunData = dataOf(rerun);
        expect(rerunData.outcome).toBe("no-op");
        expect(rerunData.commitSkipped).toBe("config-disabled");
        expect(noOpEvidenceCompletedAt(rerun)).toBe(completion);
        expect(documentCompleted(harness)).toBe(completion);
        // The branch declaration survives the no-op write path too: every
        // document-writing branch preserves it value-faithfully.
        expect(documentBranch(harness)).toBe(phaseNotesBranch);
      },
      { seedFiles: SEED, phaseCommit: false },
    );
  });
});

describe("TC-F5-002 started is never rewritten and a reopen writes null", () => {
  test("a re-completion keeps started and a reopen clears completed", async () => {
    const STARTED = "2026-11-05T00:30:00Z";
    await withCommitHarness(
      async (harness) => {
        harness.repo.write(
          NOTES,
          phaseNotesText({ [PHASE]: { started: STARTED, completed: null } }),
        );
        dirty(harness, "2");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const first = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(first.exitCode).toBe(0);
        const parsedFirst = parsePmNotesText(harness.targetText(), NOTES);
        if (!parsedFirst.ok) throw new Error("the written document is not parseable");
        expect(documentStartedOf(parsedFirst.value, PHASE)).toBe(STARTED);
        const firstCompletion = foldCompleted(harness);
        expect(documentCompleted(harness)).toBe(firstCompletion);

        const reopened = await harness.runPhase(["reopen", COMMIT_REF, PHASE, "scope reopened"]);
        expect(reopened.exitCode).toBe(0);
        const parsedReopened = parsePmNotesText(harness.targetText(), NOTES);
        if (!parsedReopened.ok) throw new Error("the written document is not parseable");
        expect(documentStartedOf(parsedReopened.value, PHASE)).toBe(STARTED);
        expect(documentCompleted(harness)).toBeNull();
        expect(foldCompleted(harness)).toBeNull();

        dirty(harness, "3");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const second = await harness.runPhase(["complete", COMMIT_REF, PHASE]);
        expect(second.exitCode).toBe(0);
        const parsedSecond = parsePmNotesText(harness.targetText(), NOTES);
        if (!parsedSecond.ok) throw new Error("the written document is not parseable");
        expect(documentStartedOf(parsedSecond.value, PHASE)).toBe(STARTED);
        const secondCompletion = foldCompleted(harness);
        expect(secondCompletion).not.toBeNull();
        expect(secondCompletion).not.toBe(firstCompletion);
        expect(documentCompleted(harness)).toBe(secondCompletion);

        // The control: the retired derivation on the same history is the FIRST
        // completion, so the equality above discriminates.
        const retired = preFixCompletionLookup(transitionsOf(harness), PHASE);
        expect(retired).toBe(firstCompletion);
        expect(retired).not.toBe(documentCompleted(harness));
      },
      { seedFiles: SEED },
    );
  });
});
