/** TC-CAP-033 — body-free canary across residue, capsule, and output. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF, makeFacts, makeProvider } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

const CANARY = "SECRET-COMMENT-BODY-CANARY";

describe("TC-CAP-033 privacy canary", () => {
  test("no body canary reaches residue, capsule, or output", async () => {
    const change = makeChangeTree({
      ref: WORK_ITEM_REF,
      month: "2026-11",
      name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
      files: {
        "code-review/review-iter-1.yaml": `iteration: 1\nstatus: PASS\nsummary: ${CANARY}\n`,
      },
    });
    try {
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: makeCapsuleRuntime(change.changes),
        facts: makeFacts({
          threadAuthorFacts: [
            { threadId: "PRRT_2", authorPrincipal: "@reviewer-bob", authorKind: "human" },
          ],
        }),
        provider: makeProvider(),
      });
      expect(run.stdout).not.toContain(CANARY);
      const events = readFileSync(join(change.folder, "events.jsonl"), "utf8");
      expect(events).not.toContain(CANARY);
      expect(JSON.stringify(closeoutData(run.envelope).residue)).not.toContain(CANARY);
    } finally {
      change.cleanup();
    }
  });
});
