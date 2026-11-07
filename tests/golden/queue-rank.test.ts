/**
 * TC-RANK-001 / TC-SCHED-006 (GH-237) — the close-first rank golden.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/golden");

describe("queue rank golden", () => {
  test("the close-first action order is byte-identical to the committed golden", async () => {
    const harness = createQueueEdgeHarness("golden-rank");
    await harness.run(["queue", "add", "GH-310", "--json"]);
    await harness.run(["queue", "add", "GH-320", "--json"]);
    const run = await harness.run(["queue", "plan", "--next", "2", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual(
      JSON.parse(readFileSync(join(GOLDEN, "queue-rank.json"), "utf8")),
    );
  });

  test("the merge-ready entry ranks first", () => {
    const envelope = JSON.parse(readFileSync(join(GOLDEN, "queue-rank.json"), "utf8")) as {
      data: { nextActions: Array<{ ref: string; rankClass: string }> };
    };
    expect(envelope.data.nextActions[0]?.rankClass).toBe("merge-ready");
    expect(envelope.data.nextActions[0]?.ref).toBe("GH-310");
  });
});
