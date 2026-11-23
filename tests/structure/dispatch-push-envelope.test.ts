/**
 * GH-386 — the additive optional machine-envelope `push` block (TC-PUSH-015's
 * presence matrix and TC-PUSH-016's bounds, at the structure layer).
 *
 * Presence is evaluated through the real command path: the two evaluating
 * outcomes (the `pr-open` success and the typed push failure) run over a
 * composed runtime with the injected ensure-push capability; every
 * non-evaluating outcome family runs over the delivered command harness with
 * no capability, where the block must be absent.
 */
import { describe, expect, test } from "bun:test";
import { createDispatchCommandDefinition } from "../../packages/cli/src/commands/dispatch";
import {
  createDispatchCommandRuntime,
  type DispatchCommandRuntime,
} from "../../packages/cli/src/edge";
import { type CliStreams, runCli } from "../../packages/cli/src/index";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import type { DispatchPushParityReading } from "../../packages/core/src/contracts/index";
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import {
  type COMPLETED_EVIDENCE,
  createDispatchState,
  createScriptedHarness,
} from "../fixtures/dispatch/harness";
import { artifacts, prNone, prOpen, readFail, readOk, tracker } from "../fixtures/dispatch/truth";

const BRAND = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

const FULL_HEX = /^[0-9a-f]{40}$/u;

/** A composed runtime with (or without) the injected ensure-push capability. */
const composedRuntime = (input: {
  readonly label: string;
  readonly reads?: ReturnType<typeof readsFrom>;
  readonly pushParity?: DispatchPushParityReading;
  readonly evidence?: typeof COMPLETED_EVIDENCE;
}): DispatchCommandRuntime => {
  const state = createDispatchState(input.label);
  const scripted = createScriptedHarness(
    input.evidence === undefined ? {} : { evidence: input.evidence },
  );
  return createDispatchCommandRuntime({
    store: state.store,
    stateRoot: state.root,
    fenceToken: state.fenceToken,
    nowIso: () => "2026-11-08T10:00:00.000Z",
    newAttemptId: () => `attempt-${input.label}`,
    newDivergenceId: () => `DIV-${input.label}`,
    harnesses: { opencode: scripted.port },
    defaultHarness: "opencode",
    descriptor: { kind: "host", workDirectory: state.root, environment: [] },
    prompt: (ref) => `deliver ${ref}`,
    repository: () => "github.com/owner/repo",
    readTruth: async () => input.reads ?? readsFrom(),
    claimLease: () => ({ ok: true, leaseId: "lease-1" }),
    releaseLease: () => true,
    phaseLedger: () => ({ completed: 3, total: 9, variant: "full" }),
    ...(input.pushParity === undefined ? {} : { pushParity: async () => input.pushParity }),
  });
};

const invoke = async (
  runtime: DispatchCommandRuntime,
  argv: readonly string[],
): Promise<{
  readonly exit: number;
  readonly stdout: string;
  readonly data?: Record<string, unknown>;
}> => {
  const out: string[] = [];
  const err: string[] = [];
  const streams: CliStreams = {
    stdout: { write: (chunk: string) => out.push(chunk) },
    stderr: { write: (chunk: string) => err.push(chunk) },
  };
  const exit = await runCli(argv, streams, {
    brand: BRAND,
    clock: { now: () => Date.parse("2026-11-08T10:00:00.000Z") },
    newRunId: () => "run-push-structure",
    secrets: [],
    program: { commands: { dispatch: createDispatchCommandDefinition(runtime) } },
  });
  const stdout = out.join("");
  const data = stdout.trim().startsWith("{")
    ? ((JSON.parse(stdout) as { data?: Record<string, unknown> }).data ?? undefined)
    : undefined;
  return { exit, stdout, data };
};

const cleanParity: DispatchPushParityReading = {
  ok: true,
  facts: {
    localHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    remoteHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    verdict: "clean",
    parity: true,
  },
};
const pushedParity: DispatchPushParityReading = {
  ok: true,
  facts: {
    localHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    remoteHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    verdict: "pushed",
    parity: true,
  },
};
const failedParity: DispatchPushParityReading = {
  ok: true,
  facts: {
    localHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
    remoteHead: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
    verdict: "failed",
    parity: false,
  },
};

describe("TC-PUSH-015 the push block is present exactly when the precondition evaluated", () => {
  test("pr-open over clean and pushed facts carries a complete parity-true block", async () => {
    for (const [label, parity] of [
      ["clean", cleanParity],
      ["pushed", pushedParity],
    ] as const) {
      const { exit, data } = await invoke(
        composedRuntime({ label: `push-015-${label}`, pushParity: parity }),
        ["dispatch", "GH-301", "--json"],
      );
      expect(exit, label).toBe(0);
      const keys = Object.keys(data ?? {});
      expect(keys[keys.length - 1], label).toBe("push");
      expect(data?.push, label).toEqual({
        verdict: label,
        localHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        remoteHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        parity: true,
      });
    }
  });

  test("the typed push failure carries a complete parity-false block", async () => {
    const { exit, data } = await invoke(
      composedRuntime({ label: "push-015-failure", pushParity: failedParity }),
      ["dispatch", "GH-301", "--json"],
    );
    expect(exit).toBe(1);
    const keys = Object.keys(data ?? {});
    expect(keys[keys.length - 1]).toBe("push");
    expect(data?.result).toBe("failed");
    expect(data?.push).toEqual({
      verdict: "failed",
      localHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
      remoteHead: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
      parity: false,
    });
    expect(data?.error).toBeUndefined();
  });

  test("every non-evaluating outcome family carries no block and no partial shape", async () => {
    const families: readonly {
      readonly name: string;
      readonly reads: ReturnType<typeof readsFrom>;
      readonly expectedToken: string;
      readonly expectedExit: number;
    }[] = [
      {
        name: "merged",
        reads: readsFrom({ tracker: readOk(tracker({ state: "done" })) }),
        expectedToken: "merged",
        expectedExit: 0,
      },
      {
        name: "blocked",
        reads: readsFrom({
          tracker: readOk(tracker({ state: "delivery-blocked", blocking: true })),
        }),
        expectedToken: "blocked",
        expectedExit: 0,
      },
      {
        name: "pr-open-unverified",
        reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pr: prOpen(null) })) }),
        expectedToken: "pr-open-unverified",
        expectedExit: 0,
      },
      {
        name: "finished",
        reads: readsFrom({ artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone })) }),
        expectedToken: "finished",
        expectedExit: 0,
      },
      {
        name: "partial",
        reads: readsFrom({
          artifacts: readOk(artifacts({ branchCommits: 2, pr: prNone, pmNotes: "incomplete" })),
        }),
        expectedToken: "partial",
        expectedExit: 1,
      },
      {
        name: "state-unverified",
        reads: readsFrom({
          tracker: readFail("tracker", "tracker.read-unreadable"),
          artifacts: readFail("artifact", "artifact.read-unreadable"),
        }),
        expectedToken: "state-unverified",
        expectedExit: 2,
      },
    ];
    for (const family of families) {
      const scenario = createCommandScenario({ reads: family.reads });
      try {
        const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
        expect(run.exit, family.name).toBe(family.expectedExit);
        const data = run.envelope?.data as Record<string, unknown> | undefined;
        expect(data?.result, family.name).toBe(family.expectedToken);
        expect(data?.push, family.name).toBeUndefined();
      } finally {
        scenario.dispose();
      }
    }
  });
});

describe("TC-PUSH-016 the push block is bounded, closed, and secret-free", () => {
  test("members are closed, heads are full-hex, and the whole block fits the bound", async () => {
    const cells: readonly DispatchPushParityReading[] = [cleanParity, pushedParity, failedParity];
    for (const [index, parity] of cells.entries()) {
      const { data } = await invoke(
        composedRuntime({ label: `push-016-${index}`, pushParity: parity }),
        ["dispatch", "GH-301", "--json"],
      );
      const block = data?.push as Record<string, unknown> | undefined;
      expect(block).toBeDefined();
      const members = Object.keys(block ?? {}).sort();
      expect(members).toEqual(["localHead", "parity", "remoteHead", "verdict"]);
      expect(FULL_HEX.test(String(block?.localHead))).toBe(true);
      expect(FULL_HEX.test(String(block?.remoteHead))).toBe(true);
      expect(["clean", "pushed", "failed"]).toContain(block?.verdict);
      expect(typeof block?.parity).toBe("boolean");
      const serialized = JSON.stringify(block) ?? "";
      expect(serialized.length).toBeLessThanOrEqual(256);
      expect(serialized).not.toContain("\n");
      for (const forbidden of ["credential", "diff", "prompt", "transcript", "payload"]) {
        expect(serialized.toLowerCase()).not.toContain(forbidden);
      }
    }
  });
});
