/** TC-CAP-025 — ambiguous hits are residue, never resolved. */
import { describe, expect, test } from "bun:test";
import { evaluateDiffSweep } from "../../packages/core/src/domain/closeout-diff-sweep";
import { makeDiff } from "../fixtures/closeout/diff";

const sweep = (lines: readonly string[]) =>
  evaluateDiffSweep({ diff: makeDiff(lines), workItemRef: "GH-183" });

describe("TC-CAP-025 ambiguous merged-diff hits", () => {
  test("unattributed, other-ref, kind-mismatch, and owner-less class hits are ambiguous", () => {
    const result = sweep([
      "// TODO close-todo (no ref)",
      "// TODO close-todo GH-999",
      "// feature_flag remove-guard GH-183",
      "// class_string rename-class",
      "// TODO @action:do-something GH-183",
      "// TODO @action:foo GH-183",
      "// feature_flag @action:remove-guard GH-183",
    ]);
    expect(result.hits.length).toBe(7);
    expect(result.hits.every((hit) => !hit.resolved)).toBe(true);
    expect(result.hits.every((hit) => hit.reason !== undefined)).toBe(true);
    expect(
      result.hits.some(
        (hit) => hit.reason === "out-of-vocabulary-action" && hit.action === "do-something",
      ),
    ).toBe(true);
    expect(
      result.hits.some((hit) => hit.reason === "out-of-vocabulary-action" && hit.action === "foo"),
    ).toBe(true);
    expect(
      result.hits.some((hit) => hit.reason === "kind-mismatch" && hit.action === "remove-guard"),
    ).toBe(true);
  });

  test("ordinary hyphenated prose does not suppress resolution", () => {
    const result = sweep([
      "// TODO GH-183: fix the retry-policy bug",
      "// when GH-183 merges, remove the read-only guard",
      "// TODO @action:close-todo GH-183",
    ]);
    expect(result.hits.length).toBe(3);
    expect(result.hits.every((hit) => hit.resolved)).toBe(true);
    expect(result.hits.map((hit) => hit.action).sort()).toEqual([
      "close-todo",
      "close-todo",
      "remove-guard",
    ]);
  });

  test("a mix keeps only the attributed match resolved", () => {
    const result = sweep(["// TODO close-todo GH-183", "// TODO close-todo GH-999"]);
    expect(result.hits.filter((hit) => hit.resolved).length).toBe(1);
    expect(result.hits.filter((hit) => !hit.resolved).length).toBe(1);
  });
});

describe("TC-CAP-025 plan-mode ambiguous residue", () => {
  test("plan and apply render the same ambiguous-flip-hit locations", async () => {
    const { makeChangeTree } = await import("../fixtures/capsule/harness");
    const { makeCapsuleRuntime } = await import("../fixtures/capsule/producer");
    const { runCloseoutCli, closeoutData } = await import("../fixtures/closeout/cli");
    const { makeFacts, WORK_ITEM_REF } = await import("../fixtures/closeout/harness");
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const diff = makeDiff(["// TODO close-todo (no ref)"]);
      const capsule = makeCapsuleRuntime(tree.changes);
      const facts = makeFacts({
        diff: {
          available: true,
          hits: 1,
          ambiguous: 1,
          ambiguousHits: [{ kind: "todo-marker", location: "src/file.ts:1" }],
        },
      });
      const plan = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], {
        capsule,
        facts,
        diffRead: diff,
      });
      expect(plan.exitCode).toBe(0);
      const planAmbiguous = (closeoutData(plan.envelope).residue ?? []).filter(
        (item) => item.kind === "ambiguous-flip-hit",
      );
      expect(planAmbiguous).toEqual([
        {
          item: "ambiguous todo-marker hit",
          kind: "ambiguous-flip-hit",
          location: "src/file.ts:1",
        },
      ]);
      const applied = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule,
        facts,
        diffRead: diff,
      });
      expect(applied.exitCode).toBe(1);
      const appliedAmbiguous = (closeoutData(applied.envelope).residue ?? []).filter(
        (item) => item.kind === "ambiguous-flip-hit",
      );
      expect(appliedAmbiguous).toEqual(planAmbiguous);
    } finally {
      tree.cleanup();
    }
  });
});
