/** TC-CAP-032 — residue kinds, deterministic order, and the 50-item cap. */
import { describe, expect, test } from "bun:test";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF, makeFacts, makeMergedRequest } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import {
  CAPSULE_MAX_RESIDUE_ITEMS,
  CAPSULE_RESIDUE_KINDS,
} from "../../packages/core/src/contracts/index";

describe("TC-CAP-032 residue contract", () => {
  test("residue is ordered by kind then location and capped with an omitted mark", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const threads = Array.from({ length: CAPSULE_MAX_RESIDUE_ITEMS + 10 }, (_, index) => ({
        threadId: `t-${String(index).padStart(3, "0")}`,
        authorPrincipal: `@human-${index}`,
        authorKind: "human" as const,
      }));
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(tree.changes),
        facts: makeFacts({
          threadAuthorFacts: threads,
          mergedRequest: {
            observation: "observed",
            value: {
              ...makeMergedRequest(),
              threads: threads.map((thread) => ({
                threadId: thread.threadId,
                resolved: false,
                commentCount: 1,
                authorLogin: thread.authorPrincipal,
                authorKind: "human" as const,
              })),
            },
          },
        }),
      });
      expect(run.exitCode).toBe(1);
      const data = closeoutData(run.envelope);
      expect(data.residue?.length).toBe(CAPSULE_MAX_RESIDUE_ITEMS + 1);
      const last = data.residue?.[data.residue.length - 1];
      expect(last?.kind).toBe("capsule-cap-reached");
      expect(last?.item).toBe("+10 more items");
      const ordered = data.residue?.slice(0, -1) ?? [];
      const ranks = ordered.map((item) =>
        (CAPSULE_RESIDUE_KINDS as readonly string[]).indexOf(item.kind),
      );
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
      for (const item of ordered) {
        expect(Object.keys(item).sort()).toEqual(["item", "kind", "location"]);
      }
    } finally {
      tree.cleanup();
    }
  });
});

describe("TC-CAP-032 residue producer cap", () => {
  test("sixty ambiguous diff hits are capped to the declared bound with +N", async () => {
    const tree = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
    });
    try {
      const lines = Array.from(
        { length: 60 },
        (_, index) => `// TODO close-todo (no ref ${index})`,
      );
      const diff = {
        text: `+++ b/src/file.ts\n${lines.map((line) => `+${line}`).join("\n")}\n`,
        files: 1,
        squashSha: "a".repeat(40),
        parentSha: "b".repeat(40),
      };
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(tree.changes),
        diffRead: diff,
      });
      expect(run.exitCode).toBe(1);
      const data = closeoutData(run.envelope);
      expect(data.residue?.length).toBe(CAPSULE_MAX_RESIDUE_ITEMS + 1);
      const last = data.residue?.[data.residue.length - 1];
      expect(last?.kind).toBe("capsule-cap-reached");
      expect(last?.item).toBe("+10 more items");
    } finally {
      tree.cleanup();
    }
  });
});
