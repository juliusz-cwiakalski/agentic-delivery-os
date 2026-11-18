/** TC-CAP-052 residue golden — deterministic ordering across mixed kinds. */
import { describe, expect, test } from "bun:test";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { makeFacts, WORK_ITEM_REF } from "../fixtures/closeout/harness";

describe("closeout residue golden", () => {
  test("two runs over identical facts render identical residue", async () => {
    const runOnce = async () => {
      const change = makeChangeTree({
        ref: WORK_ITEM_REF,
        month: "2026-11",
        name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      });
      try {
        const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
          capsule: makeCapsuleRuntime(change.changes),
          facts: makeFacts({
            threadAuthorFacts: [
              { threadId: "PRRT_2", authorPrincipal: "@reviewer-bob", authorKind: "human" },
            ],
          }),
        });
        return JSON.stringify(closeoutData(run.envelope).residue);
      } finally {
        change.cleanup();
      }
    };
    expect(await runOnce()).toBe(await runOnce());
  });
});
