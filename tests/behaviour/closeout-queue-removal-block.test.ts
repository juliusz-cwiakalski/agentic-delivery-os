/**
 * TC-QLC-025 (GH-292, DM-6) — the `queueRemoval` block is one additive
 * non-step data block: the step inventory is identical, the block sits beside
 * the delivered data blocks, and its vocabularies are the closed sets.
 */
import { describe, expect, test } from "bun:test";
import { CLOSEOUT_QUEUE_REMOVAL_OUTCOMES } from "../../packages/core/src/contracts/index";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { CLOSEOUT_WORK_ITEM_REF } from "../fixtures/closeout/queue-removal";

const WORK_ITEM_REF = CLOSEOUT_WORK_ITEM_REF;

describe("TC-QLC-025 the additive queueRemoval data block", () => {
  test("the delivered closeout data carries no queueRemoval block", async () => {
    const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {});
    expect(run.exitCode).toBe(0);
    const data = closeoutData(run.envelope as Record<string, unknown>);
    expect(Object.hasOwn(data, "queueRemoval")).toBe(false);
    expect(data.steps).toHaveLength(12);
  });

  test("the closed outcome vocabulary is exactly the declared four values", () => {
    expect([...CLOSEOUT_QUEUE_REMOVAL_OUTCOMES]).toEqual([
      "removed",
      "would-remove",
      "satisfied",
      "skipped",
    ]);
  });
});
