/**
 * Member-form goldens (GH-310 TC-XPLAN-001, and the gate/closeout/review
 * goldens added by later phases). Payloads are committed under
 * `tests/fixtures/cross-repository/goldens/`; only envelope `runId`/`timing`
 * are ever normalized, and `reviewFlow.runId` is pinned.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { twoMemberPlanYaml } from "../fixtures/cross-repository/plan";
import { type PlanWorld, planRuntime, runPlanCli } from "../fixtures/plan/harness/index";

const GOLDENS = join(import.meta.dir, "..", "fixtures", "cross-repository", "goldens");

export const golden = (name: string): unknown =>
  JSON.parse(readFileSync(join(GOLDENS, name), "utf8")) as unknown;

const worldFromText = (ref: string, text: string): PlanWorld => ({
  artifacts: { [ref]: [{ kind: "yaml", path: `chg-${ref}-plan.yaml`, text }] },
});

describe("TC-XPLAN-001 plan member echo golden", () => {
  test("the plan validate data equals the committed member echo", async () => {
    const run = await runPlanCli(
      ["plan", "validate", "GH-310", "--json"],
      planRuntime(worldFromText("GH-310", twoMemberPlanYaml())),
    );
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as { readonly data: unknown };
    expect(envelope.data).toEqual(golden("plan-members-echo.json"));
  });
});
