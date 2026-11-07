/**
 * TC-LEASE-005 (GH-237) — the lease-conflict refusal golden and its evidence.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";

const ROOT = process.cwd();
const GOLDEN = join(ROOT, "tests/fixtures/queue/golden");

describe("queue lease-conflict golden", () => {
  test("the refusal envelope is byte-identical to the committed golden", async () => {
    const harness = createQueueEdgeHarness("golden-conflict");
    await harness.run(["queue", "add", "GH-320", "--json"]);
    await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"]);
    const run = await harness.run(["queue", "claim", "GH-320", "--holder", "holder-b", "--json"]);
    expect(run.exitCode).toBe(1);
    expect(run.stdout).toBe(readFileSync(join(GOLDEN, "queue-lease-conflict.json"), "utf8"));
  });

  test("the refusal names the holder and carries no data sibling", () => {
    const envelope = JSON.parse(
      readFileSync(join(GOLDEN, "queue-lease-conflict.json"), "utf8"),
    ) as { error?: { code?: string; summary?: string }; data?: unknown };
    expect(envelope.error?.code).toBe("queue.lease-conflict");
    expect(envelope.error?.summary).toContain("holder-a");
    expect(envelope.data).toBeUndefined();
  });
});
