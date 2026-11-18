/** TC-CAP-024 — attributed hits across the four marker kinds. */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { evaluateDiffSweep } from "../../packages/core/src/domain/closeout-diff-sweep";
import {
  CAPSULE_DIFF_ACTIONS,
  CAPSULE_DIFF_MARKER_KINDS,
  CLOSEOUT_DIFF_MARKERS,
} from "../../packages/core/src/contracts/index";
import { attributedLines, makeDiff } from "../fixtures/closeout/diff";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

describe("TC-CAP-024 attributed merged-diff hits", () => {
  test("each attributed kind resolves with its declared action", () => {
    const result = evaluateDiffSweep({ diff: makeDiff(attributedLines), workItemRef: "GH-183" });
    expect(result.status).toBe("scanned");
    expect(result.hits.length).toBe(4);
    expect(result.hits.every((hit) => hit.resolved)).toBe(true);
    expect(result.hits.map((hit) => hit.kind).sort()).toEqual(
      [...CAPSULE_DIFF_MARKER_KINDS].sort(),
    );
    expect(result.hits.every((hit) => CAPSULE_DIFF_ACTIONS.includes(hit.action as never))).toBe(
      true,
    );
  });

  test("the marker vocabulary is declared data with the fixed mapping", () => {
    expect(CLOSEOUT_DIFF_MARKERS.length).toBe(4);
    for (const marker of CLOSEOUT_DIFF_MARKERS) {
      expect(CAPSULE_DIFF_MARKER_KINDS).toContain(marker.kind);
      expect(CAPSULE_DIFF_ACTIONS).toContain(marker.action);
    }
  });

  test("apply appends idempotent owed-flip evidence and re-emits nothing", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const capsule = makeCapsuleRuntime(tree.changes);
      const diff = makeDiff(attributedLines);
      const first = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
        diffRead: diff,
      });
      expect(first.exitCode).toBe(0);
      const events = capsule.read(WORK_ITEM_REF);
      expect(events.ok).toBe(true);
      if (!events.ok) return;
      const owed = events.events.filter((event) => event.kind === "closeout.step");
      expect(owed.length).toBe(4);
      expect(owed[0]?.payload.lineHash).toBe(
        createHash("sha256")
          .update(
            (owed[0]?.payload.lineHash as string) === "" ? "" : (attributedLines[0] as string),
          )
          .digest("hex"),
      );
      const data = closeoutData(first.envelope);
      const step = data.steps.find((entry) => entry.stepId === "merged-diff-sweep");
      expect(step?.outcome).toBe("applied");
      const before = events.events.length;
      const second = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
        diffRead: diff,
      });
      expect(second.exitCode).toBe(0);
      const after = capsule.read(WORK_ITEM_REF);
      expect(after.ok && after.events.length).toBe(before);
    } finally {
      tree.cleanup();
    }
  });
});
