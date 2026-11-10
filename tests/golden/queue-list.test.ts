/**
 * TC-SCHED-009 / TC-COMPAT-001 (GH-237) — committed queue list goldens are
 * structurally compared through the real edge path.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/golden");

describe("queue list golden", () => {
  test("the machine payload is structurally identical to the committed golden", async () => {
    const harness = createQueueEdgeHarness("golden-list");
    await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    const run = await harness.run(["queue", "list", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual(
      JSON.parse(readFileSync(join(GOLDEN, "queue-list.json"), "utf8")),
    );
  });

  test("the list golden renders the normalized key only", () => {
    const text = readFileSync(join(GOLDEN, "queue-list.json"), "utf8");
    expect(text).toContain("github.com/owner/repo-alpha");
    expect(text).not.toContain("repositoryRoot");
    expect(text).not.toMatch(/\/work\/|\/home\//);
  });

  test("the held list matches the new held golden and keeps the full blocking list", async () => {
    const hold = {
      active: true as const,
      source: "marker" as const,
      reason: "peak-hour cost pause",
    };
    const harness = createQueueEdgeHarness("golden-list-held", {
      overrides: { readOwnerHold: () => hold },
    });
    await harness.run(["queue", "add", "GH-320", "--priority", "5", "--json"]);
    const run = await harness.run(["queue", "list", "--json"]);
    expect(run.exitCode).toBe(0);
    const payload = JSON.parse(run.stdout);
    expect(payload).toEqual(JSON.parse(readFileSync(join(GOLDEN, "queue-list-held.json"), "utf8")));
    expect(payload.data.ownerHold).toEqual({ source: "marker", reason: "peak-hour cost pause" });
    expect(payload.data.entries[0].blocking[0].reason).toBe("owner-hold");
  });
});
