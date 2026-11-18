/**
 * TC-CAP-015 — review-verdict ingestion.
 *
 * Readable `code-review/review-iter-*.yaml` artifacts become review.verdict
 * events; an unreadable artifact is `review-verdict-unreadable` residue, never
 * capsule damage; a missing artifact is not damage.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCapsuleEvents } from "../../packages/core/src/domain/capsule";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

describe("TC-CAP-015 review verdict ingestion", () => {
  test("readable verdicts are events and an unreadable artifact is residue", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "code-review/review-iter-1.yaml": "version: 1\niteration: 1\nstatus: PASS\n",
        "code-review/review-iter-2.yaml": "version: 1\nsummary: no status line\n",
      },
    });
    try {
      const runtime = makeCapsuleRuntime(tree.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
      });
      expect(run.exitCode).toBe(1);
      const data = closeoutData(run.envelope);
      const report = parseCapsuleEvents(readFileSync(join(tree.folder, "events.jsonl"), "utf8"));
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      const verdicts = report.events.filter((event) => event.kind === "review.verdict");
      expect(verdicts.length).toBe(1);
      expect(verdicts[0]?.payload).toEqual({
        iteration: 1,
        verdict: "PASS",
        artifact: "review-iter-1.yaml",
      });
      const unreadable = data.residue?.filter((item) => item.kind === "review-verdict-unreadable");
      expect(unreadable?.length).toBe(1);
      expect(unreadable?.[0]?.location).toBe("review-iter-2.yaml");
    } finally {
      tree.cleanup();
    }
  });

  test("a missing code-review directory is not damage", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const runtime = makeCapsuleRuntime(tree.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
      });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      expect(data.residue ?? []).toEqual([]);
      expect(data.capsule?.closed).toBe(true);
    } finally {
      tree.cleanup();
    }
  });

  test("re-ingesting the same verdicts appends nothing", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: { "code-review/review-iter-1.yaml": "iteration: 1\nstatus: FAIL\n" },
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
      const file = join(tree.folder, "events.jsonl");
      const before = readFileSync(file, "utf8");
      expect(
        (
          await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
            capsule: runtime,
          })
        ).exitCode,
      ).toBe(0);
      expect(readFileSync(file, "utf8")).toBe(before);
    } finally {
      tree.cleanup();
    }
  });
});
