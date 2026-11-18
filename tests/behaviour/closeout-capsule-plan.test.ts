/**
 * TC-CAP-014 — plan-mode capsule rendering and zero writes.
 *
 * Plan mode performs the read-only pre-flight, renders the capsule step, omits
 * the applied capsule object, and writes nothing.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { eventsText, makeChangeTree, makeEvent, payloadFor } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

const tree = () =>
  makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    files: {
      "events.jsonl": eventsText([
        makeEvent(1, "capsule.opened", "closeout", payloadFor("capsule.opened")),
        makeEvent(2, "commit.landed", "commit", payloadFor("commit.landed")),
      ]),
    },
  });

describe("TC-CAP-014 plan-mode capsule", () => {
  test("a valid capsule renders would-apply with bounded detail and writes nothing", async () => {
    const change = tree();
    try {
      const file = join(change.folder, "events.jsonl");
      const before = readFileSync(file, "utf8");
      const runtime = makeCapsuleRuntime(change.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], {
        capsule: runtime,
      });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      const step = data.steps.find((entry) => entry.stepId === "capsule");
      expect(step?.outcome).toBe("would-apply");
      expect(step?.detail).toEqual({ present: true, events: 2, candidates: 0 });
      expect(data.capsule).toBeUndefined();
      expect(readFileSync(file, "utf8")).toBe(before);
      expect(existsSync(join(change.folder, "candidates"))).toBe(false);
      expect(readdirSync(change.folder).sort()).toEqual(["events.jsonl"]);
    } finally {
      change.cleanup();
    }
  });

  test("the capsule step is last in the plan order", async () => {
    const change = tree();
    try {
      const runtime = makeCapsuleRuntime(change.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], {
        capsule: runtime,
      });
      const data = closeoutData(run.envelope);
      expect(data.steps[data.steps.length - 1]?.stepId).toBe("capsule");
      expect(data.steps.length).toBe(12);
    } finally {
      change.cleanup();
    }
  });
});
