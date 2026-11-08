/**
 * TC-DISP-007 (phase 4) — text mode emits exactly the four bash-continuity keys
 * in bash order, with no fifth key and no `closeout_unverified=`. Byte equality
 * with the committed goldens.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";
import { artifacts, ledger, prNone, readOk } from "../fixtures/dispatch/truth";

const GOAL = join(process.cwd(), "tests/fixtures/dispatch/golden/text");

const KEY_LINE = /^([a-z_]+)=/;

const keyOf = (line: string): string | undefined => KEY_LINE.exec(line)?.[1];

const assertFourKeys = (stdout: string) => {
  const lines = stdout.split("\n").filter((line) => line.length > 0);
  expect(lines.map(keyOf)).toEqual(["result", "pr_url", "exit_code", "last_message"]);
  expect(stdout.includes("closeout_unverified=")).toBe(false);
  for (const line of lines) {
    const key = keyOf(line);
    if (key !== undefined && !["result", "pr_url", "exit_code", "last_message"].includes(key)) {
      throw new Error(`unexpected key ${key}`);
    }
  }
};

describe("TC-DISP-007 exactly four ordered keys", () => {
  test("pr-open is byte-identical to its golden", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301"]);
      expect(run.exit).toBe(0);
      assertFourKeys(run.stdout);
      expect(run.stdout).toBe(readFileSync(join(GOAL, "pr-open.txt"), "utf8"));
    } finally {
      scenario.dispose();
    }
  });

  test("failed is byte-identical to its golden", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 0, pr: prNone })),
        ledger: readOk(ledger({ progressed: false })),
      }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301"]);
      expect(run.exit).toBe(1);
      assertFourKeys(run.stdout);
      expect(run.stdout).toBe(readFileSync(join(GOAL, "failed.txt"), "utf8"));
    } finally {
      scenario.dispose();
    }
  });

  test("pr-open-unverified emits an empty pr_url and no extra key", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      reads: readsFrom({
        artifacts: readOk(artifacts({ branchCommits: 2, pr: { state: "open", url: null, mergeReady: true } })),
      }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301"]);
      expect(run.exit).toBe(0);
      assertFourKeys(run.stdout);
      expect(run.stdout).toBe(readFileSync(join(GOAL, "pr-open-unverified.txt"), "utf8"));
      expect(run.stdout).toContain("pr_url=\n");
    } finally {
      scenario.dispose();
    }
  });
});
