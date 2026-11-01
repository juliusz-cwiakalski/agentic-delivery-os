/** TC-CLOSE-062 — the closeout battery is offline and leak-bounded. */
import { describe, expect, test } from "bun:test";
import { assertCanaryPresent, CANARY_TEXT } from "../fixtures/closeout/canary";
import { runCloseoutCli } from "../fixtures/closeout/cli";
import { makeFacts, makeWorkItem, observed, WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { installThrowingFetchGuard } from "./providers/support";

describe("TC-CLOSE-062 offline and no-leak proof", () => {
  test("the throwing-fetch guard sees zero calls during apply", async () => {
    const guard = installThrowingFetchGuard();
    try {
      const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--apply", "--json"]);
      expect(run.exitCode).toBe(0);
      expect(guard.calls).toHaveLength(0);
    } finally {
      guard.restore();
    }
  });

  test("the canary is present in the fixture before it is absent from output", async () => {
    const fact = makeWorkItem({ title: `Title ${CANARY_TEXT}` });
    expect(assertCanaryPresent(JSON.stringify(fact))).toBe(true);
    const run = await runCloseoutCli(["closeout", WORK_ITEM_REF, "--json"], {
      facts: makeFacts({ observedWorkItem: observed(fact) }),
    });
    expect(run.stdout.includes(CANARY_TEXT)).toBe(false);
    expect(run.stderr.includes(CANARY_TEXT)).toBe(false);
    expect(run.state.records.some((record) => JSON.stringify(record).includes(CANARY_TEXT))).toBe(
      false,
    );
  });
});
