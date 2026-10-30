/**
 * GH-172 CI parity — the ts-boundaries job must cruise the same resolution
 * world the boundary rules were written for. Package-name specifiers resolve
 * through each manifest's `exports` to the built `dist` target, so the job has
 * to build before cruising; cruising a pre-build tree leaves declared subpaths
 * unresolved and fails `workspace-import-must-resolve` on artifacts the rules
 * were never scoped to catch.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

export const JOB_ID = "ts-boundaries";
export const BUILD_COMMAND = "pnpm build";
export const BOUNDARY_COMMAND = "pnpm check:boundaries";

type WorkflowStep = { name?: string; run?: string };
type WorkflowJob = { steps?: WorkflowStep[] };
type Workflow = { jobs?: Record<string, WorkflowJob> };

export const validate = (root: string): string[] => {
  const failures: string[] = [];
  const workflow = parse(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8")) as Workflow;
  const steps = workflow.jobs?.[JOB_ID]?.steps ?? [];
  const buildIndex = steps.findIndex((step) => (step.run ?? "").trim() === BUILD_COMMAND);
  const boundaryIndex = steps.findIndex((step) => (step.run ?? "").includes(BOUNDARY_COMMAND));
  if (boundaryIndex < 0) {
    failures.push(`ci.yml: ${JOB_ID} must run ${BOUNDARY_COMMAND}`);
    return failures;
  }
  if (buildIndex < 0) {
    failures.push(
      `ci.yml: ${JOB_ID} must run ${BUILD_COMMAND} before ${BOUNDARY_COMMAND} (no build step; cruising an unbuilt tree fails declared subpath resolution)`,
    );
    return failures;
  }
  if (buildIndex > boundaryIndex) {
    failures.push(
      `ci.yml: ${JOB_ID} must run ${BUILD_COMMAND} before ${BOUNDARY_COMMAND} (build step found after the cruise step)`,
    );
  }
  return failures;
};

if (import.meta.main) {
  const failures = validate(process.cwd());
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL boundary-ci-parity: ${message}`);
    process.exit(1);
  }
  console.log(`OK boundary-ci-parity: ${JOB_ID} builds before cruising`);
}
