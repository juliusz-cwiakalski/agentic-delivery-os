/**
 * TC-PILOT-001 — the pilot fixture seeds real state, git, and files.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readQueueFold } from "../../../packages/core/src/app/queue";
import { readBlockerLedger } from "../../../packages/core/src/state/index";
import {
  createPilot,
  PILOT_QUESTION_ID,
  PILOT_REF,
  type Pilot,
} from "../../fixtures/pilot/harness";
import { PILOT_BASE, PILOT_BRANCH } from "../../fixtures/pilot/repo";

let pilot: Pilot | undefined;

const fixture = (): Pilot => {
  if (pilot === undefined) throw new Error("pilot fixture was not created");
  return pilot;
};

beforeAll(async () => {
  pilot = await createPilot();
});

afterAll(() => {
  pilot?.cleanup();
});

describe("TC-PILOT-001 pilot repository seed", () => {
  test("the real git repository, delivery branch, and bare mirror exist", () => {
    const current = fixture();
    expect(current.repo.exists("README.md")).toBe(true);
    expect(current.repo.currentBranch()).toBe(PILOT_BRANCH);
    expect(current.repo.branchHead(PILOT_BASE)).toBeDefined();
    expect(current.repo.branchHead(PILOT_BRANCH)).toBeDefined();
    expect(current.repo.commitCount()).toBeGreaterThanOrEqual(2);
    expect(existsSync(current.repo.remoteRoot)).toBe(true);
    expect(current.repo.run(["branch", "--list", PILOT_BASE]).stdout).toContain(PILOT_BASE);
  });

  test("the seeded change folder is tracked after the real delivery completion", () => {
    const current = fixture();
    const files = current.repo.changeFolderFiles();
    expect(files).toContain(
      `doc/changes/2026-11/2026-11-07--GH-310--pilot-delivery/chg-${PILOT_REF}-spec.md`,
    );
    expect(files).toContain(
      `doc/changes/2026-11/2026-11-07--GH-310--pilot-delivery/chg-${PILOT_REF}-plan.yaml`,
    );
    expect(files).toContain(
      `doc/changes/2026-11/2026-11-07--GH-310--pilot-delivery/chg-${PILOT_REF}-pm-notes.yaml`,
    );
    expect(current.repo.statusPorcelain()).toBe("");
  });

  test("the state store is real and carries the ready item and typed question", () => {
    const current = fixture();
    const blockers = readBlockerLedger(current.store);
    expect(blockers.ok).toBe(true);
    if (blockers.ok) {
      expect(blockers.value.questions.map((question) => question.id)).toContain(PILOT_QUESTION_ID);
    }
    const fold = readQueueFold(current.store);
    expect(fold.ok).toBe(true);
    if (fold.ok) {
      expect(fold.value.entries.map((entry) => entry.ref)).toEqual(["GH-310", "GH-320", "GH-321"]);
    }
  });

  test("plan validate and pm-notes lint accept the seeded artifacts", async () => {
    const current = fixture();
    const plan = await current.run(["--json", "plan", "validate", PILOT_REF]);
    expect(plan.exitCode).toBe(0);
    const planData = plan.envelope?.data as { verdict?: string } | undefined;
    expect(planData?.verdict).toBe("valid");

    const lint = await current.run(["--json", "lint", PILOT_REF]);
    expect(lint.exitCode).toBe(0);
  });

  test("teardown removes the temp repository and state root", () => {
    const current = fixture();
    const root = current.repo.root;
    const stateRoot = current.stateRoot;
    current.cleanup();
    expect(existsSync(root)).toBe(false);
    expect(existsSync(stateRoot)).toBe(false);
  });
});
