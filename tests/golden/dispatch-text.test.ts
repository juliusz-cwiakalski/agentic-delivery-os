/**
 * TC-DISP-007 (phase 4) — text mode emits exactly the four bash-continuity keys
 * in bash order, with no fifth key and no `closeout_unverified=`. Byte equality
 * with the committed goldens.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createDispatchCommandDefinition } from "../../packages/cli/src/commands/dispatch";
import {
  createDispatchCommandRuntime,
  type DispatchCommandRuntime,
} from "../../packages/cli/src/edge";
import { runCli } from "../../packages/cli/src/index";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { createCommandScenario, FIXED_CLOCK, readsFrom } from "../fixtures/dispatch/golden/harness";
import {
  COMPLETED_EVIDENCE,
  createDispatchState,
  createScriptedHarness,
} from "../fixtures/dispatch/harness";
import { artifacts, ledger, prNone, readOk } from "../fixtures/dispatch/truth";

const GOAL = join(process.cwd(), "tests/fixtures/dispatch/golden/text");

const BRAND = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

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
    // GH-347 §8.5: the exit-0-no-artifact `failed` arm is subsumed; `failed`
    // is reachable from a reported failure (Appendix F(C)(9)).
    const scenario = createCommandScenario({
      evidence: {
        completionMarker: true,
        exitStatus: 1,
        timedOut: false,
        spawnRefused: false,
        failureReported: true,
        toolFailure: false,
      },
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
        artifacts: readOk(
          artifacts({ branchCommits: 2, pr: { state: "open", url: null, mergeReady: true } }),
        ),
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

/* ------------------------------------------------------------------------- */
/* GH-386 (TC-PUSH-017) — text mode is byte-identical over the parity cells:  */
/* the ensure-push act never changes a byte of the four-key contract.         */
/* ------------------------------------------------------------------------- */

const pushParityFacts = (verdict: "clean" | "pushed") =>
  ({
    ok: true,
    facts: {
      localHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      remoteHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      verdict,
      parity: true,
    },
  }) as const;

describe("GH-386 the parity cells stay byte-identical in text mode", () => {
  const runtime = (
    label: string,
    parity: ReturnType<typeof pushParityFacts>,
  ): DispatchCommandRuntime => {
    const state = createDispatchState(label);
    const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
    return createDispatchCommandRuntime({
      store: state.store,
      stateRoot: state.root,
      fenceToken: state.fenceToken,
      nowIso: () => "2026-11-08T10:00:00.000Z",
      newAttemptId: () => `attempt-${label}`,
      newDivergenceId: () => `DIV-${label}`,
      harnesses: { opencode: scripted.port },
      defaultHarness: "opencode",
      descriptor: { kind: "host", workDirectory: state.root, environment: [] },
      prompt: (ref) => `deliver ${ref}`,
      repository: () => "github.com/owner/repo",
      readTruth: async () => readsFrom(),
      claimLease: () => ({ ok: true, leaseId: "lease-1" }),
      releaseLease: () => true,
      phaseLedger: () => ({ completed: 3, total: 9, variant: "full" }),
      pushParity: async () => parity,
    });
  };

  for (const verdict of ["clean", "pushed"] as const) {
    test(`the ${verdict} parity cell is byte-identical to the pr-open golden`, async () => {
      const out: string[] = [];
      const exit = await runCli(
        ["dispatch", "GH-301"],
        {
          stdout: { write: (chunk: string) => out.push(chunk) },
          stderr: { write: () => undefined },
        },
        {
          brand: BRAND,
          clock: FIXED_CLOCK,
          newRunId: () => "run-push-text",
          secrets: [],
          program: {
            commands: {
              dispatch: createDispatchCommandDefinition(
                runtime(`push-text-${verdict}`, pushParityFacts(verdict)),
              ),
            },
          },
        },
      );
      const stdout = out.join("");
      expect(exit).toBe(0);
      assertFourKeys(stdout);
      // Byte-identity with the committed golden: the parity facts do not enter
      // text mode, and the arm's delivered four-key cell is unchanged.
      expect(stdout).toBe(readFileSync(join(GOAL, "pr-open.txt"), "utf8"));
      expect(stdout).not.toContain("a1b2c3d4");
      expect(stdout).not.toContain("push");
    });
  }
});
