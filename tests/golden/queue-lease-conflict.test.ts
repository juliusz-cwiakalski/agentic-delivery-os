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
  test("the refusal envelope is structurally identical to the committed golden", async () => {
    const harness = createQueueEdgeHarness("golden-conflict");
    await harness.run(["queue", "add", "GH-320", "--json"]);
    await harness.run(["queue", "add", "GH-321", "--json"]);
    await harness.run(["queue", "claim", "GH-320", "--holder", "holder-a", "--json"]);
    // GH-292 F-4: the same-ref claim by another holder is the single-flight
    // refusal; the golden pins the delivered other-ref lease conflict.
    const sameRef = await harness.run([
      "queue",
      "claim",
      "GH-320",
      "--holder",
      "holder-b",
      "--json",
    ]);
    expect(sameRef.exitCode).toBe(1);
    const sameRefEnvelope = JSON.parse(sameRef.stdout) as {
      error?: { code?: string };
      detail?: { holder?: string };
    };
    expect(sameRefEnvelope.error?.code).toBe("queue.single-flight");
    expect(sameRefEnvelope.detail?.holder).toBe("holder-a");
    const run = await harness.run(["queue", "claim", "GH-321", "--holder", "holder-b", "--json"]);
    expect(run.exitCode).toBe(1);
    expect(JSON.parse(run.stdout)).toEqual(
      JSON.parse(readFileSync(join(GOLDEN, "queue-lease-conflict.json"), "utf8")),
    );
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
