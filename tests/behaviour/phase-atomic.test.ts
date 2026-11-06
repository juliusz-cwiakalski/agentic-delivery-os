/**
 * TC-ATOMIC-001..012 — SC-M1-12 inherited verbatim, the four completion modes,
 * the clean-abort contract, and the one-record-per-landing invariant.
 */
import { describe, expect, test } from "bun:test";
import { COMMIT_MULTI_PHASE_PLAN_YAML, withCommitHarness } from "../fixtures/commit/harness";
import {
  appendCompletionRecord,
  COMMIT_REF,
  commitCount,
  dataOf,
  errorCodeOf,
  excludedOf,
  head,
  status,
  telemetryPayloads,
  transitionPayloads,
  validMessage,
} from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

/** A production-shaped plan whose only phase is planning-kind. */
const PLANNING_PLAN_YAML = `schemaVersion: delivery.plan.v1
workItemRef: GH-310
tier:
  name: full
  phases: [4]
phases:
  - id: 4
    title: "Planning"
    kind: planning
    scope:
      files:
        - src/planning-note.ts
    summary: "plan the fixture change"
`;

const pending = (harness: import("../fixtures/commit/harness").CommitHarness): void => {
  harness.repo.write("src/existing.ts", "export const v = 2;\n");
  harness.repo.write("src/new-file.ts", "export const n = 1;\n");
};

describe("TC-ATOMIC-001 SC-M1-12 atomic default lands record and commit", () => {
  test("both sides land, the stray stays untracked, and telemetry exists", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        harness.repo.write("stray.txt", "stray\n");
        const beforeCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        const data = dataOf(run);
        expect(data).toMatchObject({
          phase: "delivery",
          outcome: "landed",
          atomic: true,
        });
        expect(data.commitSha).toBe(head(harness));
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        expect(status(harness)).toContain("?? stray.txt");
        const records = transitionPayloads(harness);
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
          phaseId: "delivery",
          operation: "complete",
          commitIntent: "atomic",
        });
        expect(records[0]?.commitIntentBasis).toBeUndefined();
        expect(telemetryPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-ATOMIC-002 SC-M1-12 --no-commit records the transition alone", () => {
  test("durable record-only intent and a later intentional no-op", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        const beforeHead = head(harness);
        const beforeCommits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery", "--no-commit"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).commitSkipped).toBe("opt-out-flag");
        expect(head(harness)).toBe(beforeHead);
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(telemetryPayloads(harness)).toEqual([]);
        const records = transitionPayloads(harness);
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
          commitIntent: "record-only",
          commitIntentBasis: "opt-out-flag",
        });

        harness.repo.write("src/new-file.ts", "export const n = 2;\n");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const reRun = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(reRun.exitCode).toBe(0);
        expect(dataOf(reRun).commitSkipped).toBe("opt-out-flag");
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(harness.coreTransport.calls).toHaveLength(0);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-ATOMIC-003 no stageable work lands the transition alone", () => {
  test("durable skipped-no-pending-work basis and a stable no-op re-run", async () => {
    await withCommitHarness(
      async (harness) => {
        const beforeHead = head(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).commitSkipped).toBe("skipped-no-pending-work");
        expect(head(harness)).toBe(beforeHead);
        expect(telemetryPayloads(harness)).toEqual([]);
        const records = transitionPayloads(harness);
        expect(records).toHaveLength(1);
        expect(records[0]).toMatchObject({
          commitIntent: "record-only",
          commitIntentBasis: "skipped-no-pending-work",
        });
        const reRun = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(reRun.exitCode).toBe(0);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(harness.coreTransport.calls).toHaveLength(0);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-ATOMIC-004 configuration disable", () => {
  test("config-disabled basis is durable and the controls prove the flag semantics", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).commitSkipped).toBe("config-disabled");
        expect(transitionPayloads(harness)[0]).toMatchObject({
          commitIntent: "record-only",
          commitIntentBasis: "config-disabled",
        });
        expect(telemetryPayloads(harness)).toEqual([]);
      },
      { seedFiles: SEED, phaseCommit: false },
    );

    await withCommitHarness(
      async (harness) => {
        pending(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).atomic).toBe(true);
        expect(transitionPayloads(harness)[0]).toMatchObject({ commitIntent: "atomic" });
      },
      { seedFiles: SEED, phaseCommit: true },
    );
  });
});

describe("TC-ATOMIC-005 clean abort restores neither side", () => {
  test("a commit-object fault exits 2 and lands no record or commit", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        const beforeHead = head(harness);
        harness.faults.commitObject = true;
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(2);
        expect(errorCodeOf(run)).toBe("commit.atomic-abort");
        expect(head(harness)).toBe(beforeHead);
        expect(transitionPayloads(harness)).toEqual([]);
        expect(telemetryPayloads(harness)).toEqual([]);
        harness.faults.commitObject = false;
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const reRun = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(reRun.exitCode).toBe(0);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(telemetryPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });

  test("a ledger-append fault removes the primitive's own commit and lands no record", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        const beforeHead = head(harness);
        harness.faults.ledgerAppend = true;
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(2);
        expect(errorCodeOf(run)).toBe("commit.atomic-abort");
        expect(head(harness)).toBe(beforeHead);
        expect(transitionPayloads(harness)).toEqual([]);
        expect(status(harness)).not.toBe("");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-ATOMIC-006/007/008/009 matrix rows and reopen", () => {
  test("row 1 lands one record and one commit; row 2 is a no-op even with dirty work", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        const beforeCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const first = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(first.exitCode).toBe(0);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        harness.repo.write("src/new-file.ts", "export const n = 5;\n");
        const second = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(second.exitCode).toBe(0);
        expect(dataOf(second).outcome).toBe("no-op");
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        expect(telemetryPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });

  test("row 3 reopened re-completion lands a new record and commit", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        const reopened = await harness.runPhase(["reopen", COMMIT_REF, "delivery", "rework"]);
        expect(reopened.exitCode).toBe(0);
        harness.repo.write("src/new-file.ts", "export const n = 7;\n");
        const beforeCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const reCompleted = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(reCompleted.exitCode).toBe(0);
        expect(transitionPayloads(harness)).toHaveLength(3);
        expect(commitCount(harness)).toBe(beforeCommits + 1);
      },
      { seedFiles: SEED },
    );
  });

  test("the reopen path creates no commit object", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        const beforeHead = head(harness);
        const beforeCommits = commitCount(harness);
        const beforeTelemetry = telemetryPayloads(harness).length;
        harness.repo.write("src/new-file.ts", "export const n = 9;\n");
        const reopened = await harness.runPhase(["reopen", COMMIT_REF, "delivery", "late fix"]);
        expect(reopened.exitCode).toBe(0);
        expect(head(harness)).toBe(beforeHead);
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(telemetryPayloads(harness)).toHaveLength(beforeTelemetry);
        expect(transitionPayloads(harness).at(-1)).toMatchObject({
          operation: "reopen",
          reason: "late fix",
        });
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-ATOMIC-010/012 exactly one record with the durable intent", () => {
  test("atomic arrival appends one record and the projection equals the fold", async () => {
    await withCommitHarness(
      async (harness) => {
        pending(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(transitionPayloads(harness)[0]).toMatchObject({ commitIntent: "atomic" });
        const projection = harness.projectionContent() as {
          phases: { delivery: { completed: string } };
        };
        expect(projection.phases.delivery.completed).toBe(dataOf(run).timestamp);
        const second = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(dataOf(second).outcome).toBe("no-op");
        expect(transitionPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });

  test("all four modes append exactly one line and the envelope basis matches the record", async () => {
    const cases: Array<{
      readonly label: string;
      readonly phaseCommit: boolean;
      readonly noCommit: boolean;
      readonly dirty: boolean;
      readonly basis?: string;
    }> = [
      { label: "atomic", phaseCommit: true, noCommit: false, dirty: true },
      { label: "opt-out", phaseCommit: true, noCommit: true, dirty: true, basis: "opt-out-flag" },
      {
        label: "config",
        phaseCommit: false,
        noCommit: false,
        dirty: true,
        basis: "config-disabled",
      },
      {
        label: "no-pending",
        phaseCommit: true,
        noCommit: false,
        dirty: false,
        basis: "skipped-no-pending-work",
      },
    ];
    for (const entry of cases) {
      await withCommitHarness(
        async (harness) => {
          if (entry.dirty) pending(harness);
          harness.coreTransport.push({ kind: "success", message: validMessage() });
          const args = entry.noCommit
            ? ["complete", COMMIT_REF, "delivery", "--no-commit"]
            : ["complete", COMMIT_REF, "delivery"];
          const run = await harness.runPhase(args);
          expect(run.exitCode, entry.label).toBe(0);
          const records = transitionPayloads(harness);
          expect(records, entry.label).toHaveLength(1);
          if (entry.basis === undefined) {
            expect(records[0]?.commitIntent, entry.label).toBe("atomic");
            expect(records[0]?.commitIntentBasis, entry.label).toBeUndefined();
          } else {
            expect(records[0]?.commitIntentBasis, entry.label).toBe(entry.basis);
            expect(dataOf(run).commitSkipped, entry.label).toBe(entry.basis);
          }
        },
        { seedFiles: SEED, phaseCommit: entry.phaseCommit },
      );
    }
  });
});

describe("TC-ATOMIC-013 lifecycle phase ids map to declared plan-phase scopes", () => {
  test("a non-first-phase declared untracked file is stageable in phase-centric mode", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/two.ts", "export const two = 2;\n");
        const dry = await harness.runCommit(["--dry-run", COMMIT_REF, "--phase", "delivery"]);
        expect(dry.exitCode).toBe(0);
        expect(dataOf(dry).stagedFiles).toEqual(["src/two.ts"]);
        expect(excludedOf(dry).untrackedNotStaged).toEqual([]);

        const beforeCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run)).toMatchObject({ outcome: "landed", atomic: true });
        expect(dataOf(run).commitSkipped).toBeUndefined();
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        expect(transitionPayloads(harness)[0]).toMatchObject({
          phaseId: "delivery",
          commitIntent: "atomic",
        });
      },
      { seedFiles: SEED, planYaml: COMMIT_MULTI_PHASE_PLAN_YAML },
    );
  });

  test("a phase-mode dry run previews no-pending-work as success, not a staging refusal", async () => {
    await withCommitHarness(
      async (harness) => {
        const beforeHead = head(harness);
        const beforeCommits = commitCount(harness);
        const run = await harness.runCommit(["--dry-run", COMMIT_REF, "--phase", "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run)).toMatchObject({
          stagedFiles: [],
          dryRun: true,
          commitSkipped: "skipped-no-pending-work",
        });
        expect(head(harness)).toBe(beforeHead);
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(telemetryPayloads(harness)).toEqual([]);
        expect(transitionPayloads(harness)).toEqual([]);
      },
      { seedFiles: SEED, planYaml: COMMIT_MULTI_PHASE_PLAN_YAML },
    );
  });

  test("a lifecycle phase without a plan-phase correspondence degrades instead of impersonating phase 1", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/two.ts", "export const two = 2;\n");
        const beforeCommits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "review_fix"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run)).toMatchObject({
          outcome: "landed",
          atomic: false,
          commitSkipped: "skipped-no-pending-work",
        });
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(telemetryPayloads(harness)).toEqual([]);
        expect(status(harness)).toContain("?? src/two.ts");
      },
      { seedFiles: SEED, planYaml: COMMIT_MULTI_PHASE_PLAN_YAML },
    );
  });
});

describe("TC-ATOMIC-014 interrupted atomic re-run with no pending work", () => {
  test("discloses the envelope-only basis and lands nothing", async () => {
    await withCommitHarness(
      async (harness) => {
        appendCompletionRecord(harness, { intent: "atomic" });
        const beforeHead = head(harness);
        const beforeCommits = commitCount(harness);
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run)).toMatchObject({
          outcome: "no-op",
          atomic: false,
          commitSkipped: "interrupted-atomic-no-pending-work",
        });
        expect(commitCount(harness)).toBe(beforeCommits);
        expect(head(harness)).toBe(beforeHead);
        expect(transitionPayloads(harness)).toHaveLength(1);
        expect(telemetryPayloads(harness)).toEqual([]);
        expect(harness.coreTransport.calls).toHaveLength(0);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-ATOMIC-015 delivery_planning maps to planning-kind plan scope", () => {
  test("a declared untracked planning file stages in phase-centric mode", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/planning-note.ts", "export const plan = 1;\n");
        const beforeCommits = commitCount(harness);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery_planning"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run)).toMatchObject({ outcome: "landed", atomic: true });
        expect(dataOf(run).stagedFiles).toEqual(["src/planning-note.ts"]);
        expect(commitCount(harness)).toBe(beforeCommits + 1);
        expect(transitionPayloads(harness)[0]).toMatchObject({
          phaseId: "delivery_planning",
          commitIntent: "atomic",
          commitSha: head(harness),
        });
      },
      { seedFiles: SEED, planYaml: PLANNING_PLAN_YAML },
    );
  });
});

describe("TC-ATOMIC-016 plan-present degraded scope on the commit surface", () => {
  test("an unmapped lifecycle phase with a plan present discloses plan-absent", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([
          "--dry-run",
          COMMIT_REF,
          "--phase",
          "system_spec_update",
        ]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).degradedScope).toBe("plan-absent");
        expect(dataOf(run).stagedFiles).toEqual(["src/existing.ts"]);
      },
      { seedFiles: SEED, planYaml: COMMIT_MULTI_PHASE_PLAN_YAML },
    );
  });
});
