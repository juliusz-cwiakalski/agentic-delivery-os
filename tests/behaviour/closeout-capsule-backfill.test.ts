/**
 * TC-CAP-013 — pre-contract capsule completion.
 *
 * A change folder with no capsule is completed with `capsule.opened` plus one
 * `capsule.backfill-gap` naming the pre-contract state; absence is never an
 * error.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCapsuleEvents } from "../../packages/core/src/domain/capsule";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

describe("TC-CAP-013 pre-contract backfill", () => {
  test("a folder with no capsule is completed with opened and one backfill gap", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      expect(existsSync(join(tree.folder, "events.jsonl"))).toBe(false);
      const runtime = makeCapsuleRuntime(tree.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
      });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      expect(data.capsule?.closed).toBe(true);
      const report = parseCapsuleEvents(readFileSync(join(tree.folder, "events.jsonl"), "utf8"));
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      const opened = report.events.find((event) => event.kind === "capsule.opened");
      expect(opened?.payload.contractVersion).toBe("delivery.capsule.v1");
      const backfills = report.events.filter((event) => event.kind === "capsule.backfill-gap");
      expect(backfills.length).toBe(1);
      expect(backfills[0]?.payload.state).toBe("pre-contract");
      expect(existsSync(join(tree.folder, "candidates"))).toBe(true);
      const capsuleStep = data.steps.find((step) => step.stepId === "capsule");
      expect(capsuleStep?.detail?.preContract).toBe(true);
    } finally {
      tree.cleanup();
    }
  });

  test("a second apply reuses the capsule without a second backfill", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const runtime = makeCapsuleRuntime(tree.changes);
      expect(
        (
          await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
            capsule: runtime,
          })
        ).exitCode,
      ).toBe(0);
      const first = readFileSync(join(tree.folder, "events.jsonl"), "utf8");
      expect(
        (
          await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
            capsule: runtime,
          })
        ).exitCode,
      ).toBe(0);
      expect(readFileSync(join(tree.folder, "events.jsonl"), "utf8")).toBe(first);
    } finally {
      tree.cleanup();
    }
  });
});
