/**
 * TC-DAEMON-001 (phase 9) — the production planner returns the lifecycle prompt
 * and only the declared environment variable names (no secret value), and the
 * lane executor reports available with the selected session port and descriptor.
 */
import { describe, expect, test } from "bun:test";
import {
  createLaneLaunchPlanner,
  planLaneLaunch,
} from "../../packages/core/src/domain/lane-launch-plan";
import { createLaneExecutor } from "../../packages/adapters/src/daemon/lane-executor";
import { createScriptedHarness } from "../fixtures/dispatch/harness";

const request = { ref: "GH-239", repository: "github.com/owner/repo", weightClass: "standard" };
const declaredEnvironment = ["HOME", "PATH", "OPENCODE_MODEL"] as const;

describe("TC-DAEMON-001 planner produces prompt and declared environment", () => {
  test("the plan carries the lifecycle prompt and only declared variable names", () => {
    const plan = planLaneLaunch(request, {
      declaredEnvironment,
      lifecyclePrompt: (lane) => `deliver ${lane.ref} at ${lane.weightClass}`,
    });
    expect(plan.prompt).toBe("deliver GH-239 at standard");
    expect(Object.keys(plan.environment).sort()).toEqual([...declaredEnvironment].sort());
    for (const value of Object.values(plan.environment)) expect(value).toBe("");
    expect(JSON.stringify(plan)).not.toContain("BEGIN PRIVATE KEY");
  });

  test("the planner returns no secret value and no undeclared variable", () => {
    const planner = createLaneLaunchPlanner({
      declaredEnvironment,
      lifecyclePrompt: (lane) => `deliver ${lane.ref}`,
    });
    const plan = planner.plan(request);
    expect(plan).toBeDefined();
    expect(Object.keys(plan?.environment ?? {})).toEqual([...declaredEnvironment]);
    expect(JSON.stringify(plan)).not.toContain("ghp_");
  });

  test("createLaneExecutor reports available with the session port and descriptor", () => {
    const scripted = createScriptedHarness();
    const executor = createLaneExecutor({
      session: scripted.port,
      planner: createLaneLaunchPlanner({
        declaredEnvironment,
        lifecyclePrompt: (lane) => `deliver ${lane.ref}`,
      }),
      descriptor: { kind: "host", workDirectory: "/tmp", environment: [] },
    });
    expect(executor.availability()).toEqual({ available: true });
  });

  test("an unavailable planner keeps the executor in honest supervise-only mode", () => {
    const scripted = createScriptedHarness();
    const executor = createLaneExecutor({ session: scripted.port });
    expect(executor.availability()).toEqual({
      available: false,
      reason: "lane-executor-unavailable",
    });
  });
});
