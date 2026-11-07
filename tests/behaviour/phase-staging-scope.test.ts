/**
 * TC-STAGE-001..004, TC-STAGE-008 — a lifecycle completion stages the mapped
 * plan-phase scope union the change folder, keeps unrelated strays out, and
 * preserves the forbidden/oversized disclosures.
 */
import { describe, expect, test } from "bun:test";
import { COMMIT_CHANGE_DIRECTORY, withCommitHarness } from "../fixtures/commit/harness";
import { COMMIT_REF, commitCount, dataOf, excludedOf, transitionPayloads } from "./commit-support";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;
const NOTES = `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-pm-notes.yaml`;
const SPEC = `${COMMIT_CHANGE_DIRECTORY}/chg-${COMMIT_REF}-spec.md`;

const MULTI_KIND_PLAN = `schemaVersion: delivery.plan.v1
workItemRef: GH-310
tier:
  name: full
  phases: [1, 2, 3]
phases:
  - id: 1
    title: "Delivery one"
    kind: delivery
    scope:
      files:
        - src/one.ts
    summary: "deliver one"
  - id: 2
    title: "Delivery two"
    kind: delivery
    scope:
      files:
        - src/two.ts
    summary: "deliver two"
  - id: 3
    title: "Planning three"
    kind: planning
    scope:
      files:
        - src/planning.ts
    summary: "plan three"
`;

describe("TC-STAGE-001 plan scope union the change folder", () => {
  test("the staged set is the plan files plus the change-folder artifacts", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("src/new-file.ts", "export const n = 1;\n");
        harness.repo.write(SPEC, "# spec\n");
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run)).toMatchObject({ outcome: "landed", atomic: true });
        expect(dataOf(run).stagedFiles).toEqual([
          NOTES,
          SPEC,
          "src/existing.ts",
          "src/new-file.ts",
        ]);
        const tree = harness.repo.run(["show", "--name-only", "HEAD"]).stdout;
        for (const path of [SPEC, NOTES, "src/existing.ts", "src/new-file.ts"]) {
          expect(tree).toContain(path);
        }
        expect(transitionPayloads(harness)).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-STAGE-002 unrelated strays stay unstaged and are disclosed", () => {
  test("root and tools strays remain untracked and named in the disclosure", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("stray.txt", "stray\n");
        harness.repo.write("tools/untracked.sh", "echo stray\n");
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(excludedOf(run).untrackedNotStaged).toEqual(["stray.txt", "tools/untracked.sh"]);
        const tree = harness.repo.run(["show", "--name-only", "HEAD"]).stdout;
        expect(tree).not.toContain("stray.txt");
        expect(tree).not.toContain("tools/untracked.sh");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-STAGE-003 a plan-absent planning phase stages the change folder", () => {
  test("a newly created spec artifact commits with the transition", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write(SPEC, "# spec\n");
        const run = await harness.runPhase(["complete", COMMIT_REF, "specification"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).stagedFiles).toEqual([NOTES, SPEC]);
        const tree = harness.repo.run(["show", "--name-only", "HEAD"]).stdout;
        expect(tree).toContain(SPEC);
        expect(tree).toContain(NOTES);
      },
      { seedFiles: SEED, omitPlan: true },
    );
  });
});

describe("TC-STAGE-004 a delivery phase maps to every delivery-kind plan phase", () => {
  test("both delivery files and the change folder stage; planning-only work does not", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/one.ts", "export const one = 1;\n");
        harness.repo.write("src/two.ts", "export const two = 2;\n");
        harness.repo.write("src/planning.ts", "export const plan = 3;\n");
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        expect(dataOf(run).stagedFiles).toEqual([NOTES, "src/one.ts", "src/two.ts"]);
        expect(excludedOf(run).untrackedNotStaged).toEqual(["src/planning.ts"]);
      },
      { seedFiles: SEED, planYaml: MULTI_KIND_PLAN },
    );
  });
});

describe("TC-STAGE-008 forbidden and oversized exclusions still apply", () => {
  test("a forbidden path and an oversized binary are excluded and scope drift is disclosed", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write(`${COMMIT_CHANGE_DIRECTORY}/.env`, "TOKEN=canary\n");
        harness.repo.write(`${COMMIT_CHANGE_DIRECTORY}/blob.bin`, "\0".repeat(1_100_000));
        harness.repo.write("README.md", "# changed\n");
        const run = await harness.runPhase(["complete", COMMIT_REF, "delivery"]);
        expect(run.exitCode).toBe(0);
        const excluded = excludedOf(run);
        expect(excluded.forbiddenPaths).toEqual([`${COMMIT_CHANGE_DIRECTORY}/.env`]);
        expect(excluded.oversizedBinaries).toEqual([`${COMMIT_CHANGE_DIRECTORY}/blob.bin`]);
        expect(excluded.scopeDrift).toEqual(["README.md"]);
        const tree = harness.repo.run(["show", "--name-only", "HEAD"]).stdout;
        expect(tree).not.toContain(".env");
        expect(tree).not.toContain("blob.bin");
      },
      { seedFiles: SEED },
    );
  });
});
