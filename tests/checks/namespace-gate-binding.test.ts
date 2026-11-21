/**
 * GH-365 P4 TC-SCAN-006 — both namespace arms are CI-bound, non-advisory, in the
 * aggregate, deterministic, and read-only.
 *
 * The topology and bindingness validators are the delivered invariants; the
 * mutants below feed a mutated workflow object and require each rejected shape to
 * fail by name.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { validate as validateBindingness } from "../../scripts/checks/ci-bindingness";
import {
  BASH_JOBS,
  TREE_COMMAND,
  TREE_JOB_ID,
  TS_JOBS,
  treeJobFailures,
  validate as validateTopology,
} from "../../scripts/checks/ci-topology";
import { ROOT } from "./fixture-repo";

type WorkflowStep = {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
};
type WorkflowJob = {
  permissions?: { contents?: string };
  steps?: WorkflowStep[];
  "continue-on-error"?: unknown;
};
type Workflow = { jobs?: Record<string, WorkflowJob> };

const liveWorkflow = (): Workflow =>
  parse(readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8")) as Workflow;

const runArm = (script: string) =>
  spawnSync("bun", ["run", script], { cwd: ROOT, encoding: "utf8" });

const gitStatus = (): string =>
  (
    spawnSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).stdout ?? ""
  ).trim();

describe("TC-SCAN-006 gate binding", () => {
  test("the live topology declares both arms as non-advisory jobs", () => {
    expect(validateTopology(ROOT)).toEqual([]);
    expect(validateBindingness(ROOT)).toEqual([]);
    expect(TS_JOBS).toContain("ts-forbidden-literals");
    expect(TS_JOBS).toContain(TREE_JOB_ID);
    const workflow = liveWorkflow();
    expect(Object.keys(workflow.jobs ?? {}).sort()).toEqual([...TS_JOBS, ...BASH_JOBS].sort());
    const job = workflow.jobs?.[TREE_JOB_ID];
    expect(job).toBeDefined();
    expect(job?.["continue-on-error"]).toBeUndefined();
    expect(job?.permissions?.contents).toBe("read");
  });

  test("the tree job must fetch the recorded baseline", () => {
    const workflow = liveWorkflow();
    const job = workflow.jobs?.[TREE_JOB_ID];
    if (job === undefined) throw new Error("the tree job is missing");
    job.steps = (job.steps ?? []).filter((step) => !(step.run ?? "").includes("git fetch"));
    expect(treeJobFailures(ROOT, workflow).join("\n")).toContain("missing baseline fetch");
  });

  test("an advisory or bypassed tree job fails by name", () => {
    const advisory = liveWorkflow();
    const advisoryJob = advisory.jobs?.[TREE_JOB_ID];
    if (advisoryJob === undefined) throw new Error("the tree job is missing");
    advisoryJob["continue-on-error"] = true;
    expect(treeJobFailures(ROOT, advisory).join("\n")).toContain("advisory");

    const writable = liveWorkflow();
    const writableJob = writable.jobs?.[TREE_JOB_ID];
    if (writableJob === undefined) throw new Error("the tree job is missing");
    writableJob.permissions = { contents: "write" };
    expect(treeJobFailures(ROOT, writable).join("\n")).toContain("permissions.contents: read");

    const noRun = liveWorkflow();
    const noRunJob = noRun.jobs?.[TREE_JOB_ID];
    if (noRunJob === undefined) throw new Error("the tree job is missing");
    noRunJob.steps = (noRunJob.steps ?? []).filter(
      (step) => !(step.run ?? "").includes(TREE_COMMAND),
    );
    expect(treeJobFailures(ROOT, noRun).join("\n")).toContain(`must run ${TREE_COMMAND}`);
  });

  test("both arms are reached from the aggregate check", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts.check).toContain("pnpm check:forbidden-literals");
    expect(manifest.scripts.check).toContain("pnpm check:namespace-tree");
    expect(manifest.scripts["check:forbidden-literals"]).toBe(
      "bun run scripts/checks/forbidden-literals.ts",
    );
    expect(manifest.scripts["check:namespace-tree"]).toBe(
      "bun run scripts/checks/namespace-tree.ts",
    );
    expect(manifest.scripts.check).not.toContain("|| true");
    expect(manifest.scripts.check).not.toContain("continue-on-error");
  });

  test("both arms exit green, deterministically, and write nothing", () => {
    const before = gitStatus();
    for (const script of [
      "scripts/checks/forbidden-literals.ts",
      "scripts/checks/namespace-tree.ts",
    ]) {
      const first = runArm(script);
      expect(first.status, `${script}: ${first.stderr}`).toBe(0);
      const second = runArm(script);
      expect(second.status, `${script}: ${second.stderr}`).toBe(0);
      expect(second.stdout).toBe(first.stdout);
    }
    expect(gitStatus()).toBe(before);
  });
});
