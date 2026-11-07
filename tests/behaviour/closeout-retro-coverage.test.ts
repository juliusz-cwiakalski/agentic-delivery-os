/** TC-CAP-040/041 — read-only retro coverage and the unreadable-registry gap. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF, makeFacts } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import { parseCapsuleEvents } from "../../packages/core/src/domain/capsule";

const tree = () =>
  makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
  });

describe("TC-CAP-040/041 retro coverage", () => {
  test("collected and pending are recorded as one idempotent capsule event", async () => {
    for (const collected of [true, false]) {
      const change = tree();
      try {
        const capsule = makeCapsuleRuntime(change.changes);
        const facts = makeFacts({ retro: { available: true, collected, runId: "run-7" } });
        const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
          capsule,
          facts,
        });
        expect(run.exitCode).toBe(0);
        const report = parseCapsuleEvents(readFileSync(`${change.folder}/events.jsonl`, "utf8"));
        expect(report.ok).toBe(true);
        if (!report.ok) return;
        const events = report.events.filter((event) => event.kind === "capsule.retro-coverage");
        expect(events.length).toBe(1);
        expect(events[0]?.payload).toMatchObject({
          level: "change",
          state: collected ? "collected" : "pending",
        });
        const before = readFileSync(`${change.folder}/events.jsonl`, "utf8");
        const again = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
          capsule,
          facts,
        });
        expect(again.exitCode).toBe(0);
        expect(readFileSync(`${change.folder}/events.jsonl`, "utf8")).toBe(before);
      } finally {
        change.cleanup();
      }
    }
  });

  test("an unavailable registry is a gap plus residue and the rest proceeds", async () => {
    const change = tree();
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: makeFacts({ retro: { available: false, collected: false } }),
      });
      expect(run.exitCode).toBe(1);
      const data = closeoutData(run.envelope);
      const step = data.steps.find((entry) => entry.stepId === "retro-coverage-move");
      expect(step?.outcome).toBe("skipped-gap");
      expect(
        data.residue?.filter((item) => item.kind === "retro-coverage-unavailable").length,
      ).toBe(1);
      expect(data.capsule?.closed).toBe(true);
    } finally {
      change.cleanup();
    }
  });
});
