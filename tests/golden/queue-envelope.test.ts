/**
 * TC-SCHED-016 (GH-237) — the empty queue envelope and the success/refusal
 * shapes are byte-compared and carry the truthful degradation marker.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/golden");

describe("queue envelope golden", () => {
  test("the observed-empty envelope is byte-identical to the committed golden", async () => {
    const harness = createQueueEdgeHarness("golden-envelope");
    const run = await harness.run(["queue", "list", "--json"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "queue-envelope.json"), "utf8"));
  });

  test("the empty envelope names the degradation and explicit counts", () => {
    const envelope = JSON.parse(
      readFileSync(join(GOLDEN, "queue-envelope.json"), "utf8"),
    ) as { data: { degraded: string[]; counts: { entries: number } } };
    expect(envelope.data.degraded).toEqual(["daemon-unreachable"]);
    expect(envelope.data.counts.entries).toBe(0);
  });
});
