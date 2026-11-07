/**
 * TC-SCHED-008 / TC-RANK-001 / TC-COMPAT-001 (GH-237) — committed queue plan
 * goldens are structurally compared through the real edge path.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/golden");

describe("queue plan golden", () => {
  test("the machine payload is structurally identical to the committed golden", async () => {
    const harness = createQueueEdgeHarness("golden-plan");
    await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    const run = await harness.run(["queue", "plan", "--next", "2", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual(
      JSON.parse(readFileSync(join(GOLDEN, "queue-plan.json"), "utf8")),
    );
  });

  test("the plan golden carries no absolute path or recorded root", () => {
    const text = readFileSync(join(GOLDEN, "queue-plan.json"), "utf8");
    expect(text).not.toContain("repositoryRoot");
    expect(text).not.toMatch(/\/work\/|\/home\//);
  });
});
