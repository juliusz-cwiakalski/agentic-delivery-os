/**
 * TC-ERR-004 (phase 4) — every dispatch failure envelope carries the six stable
 * error fields and stays within the bounded exits; byte equality with the
 * committed goldens.
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
import { createCommandScenario, readsFrom } from "../fixtures/dispatch/golden/harness";
import {
  COMPLETED_EVIDENCE,
  createDispatchState,
  createScriptedHarness,
} from "../fixtures/dispatch/harness";
import { readFail } from "../fixtures/dispatch/truth";

const GOLDEN = join(process.cwd(), "tests/fixtures/dispatch/golden/errors");

const BRAND = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

type ErrorFieldCarrier = {
  readonly category?: string;
  readonly consequence?: string;
  readonly code?: string;
  readonly remediationHint?: string;
  readonly retryable?: boolean;
  readonly summary?: string;
};

const assertErrorFields = (
  envelope:
    | {
        readonly exitCode: number;
        readonly data?: { readonly error?: ErrorFieldCarrier };
        readonly error?: ErrorFieldCarrier;
      }
    | undefined,
) => {
  const error = envelope.data?.error ?? envelope.error;
  expect(error).toBeDefined();
  for (const field of [
    "code",
    "category",
    "retryable",
    "consequence",
    "remediationHint",
  ] as const) {
    expect(error?.[field], field).toBeDefined();
  }
  expect(error?.summary === undefined || typeof error.summary === "string").toBe(true);
  expect([0, 1, 2]).toContain(envelope.exitCode);
};

describe("TC-ERR-004 error envelopes carry stable identity and bounded exit", () => {
  test("spawn failure is byte-identical to its golden", async () => {
    const scenario = createCommandScenario({ spawnFails: true });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(1);
      assertErrorFields(run.envelope);
      expect(run.stdout.trim()).toBe(
        readFileSync(join(GOLDEN, "spawn-failed.json"), "utf8").trim(),
      );
    } finally {
      scenario.dispose();
    }
  });

  test("state-unverified is byte-identical to its golden", async () => {
    const scenario = createCommandScenario({
      evidence: COMPLETED_EVIDENCE,
      // GH-347 AC-F4-3: undecidable truth needs both reads to fail.
      reads: readsFrom({
        tracker: readFail("tracker", "tracker.read-unreadable"),
        artifacts: readFail("artifact", "artifact.read-unreadable"),
      }),
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-301", "--json"]);
      expect(run.exit).toBe(2);
      assertErrorFields(run.envelope);
      expect(run.stdout.trim()).toBe(
        readFileSync(join(GOLDEN, "state-unverified.json"), "utf8").trim(),
      );
    } finally {
      scenario.dispose();
    }
  });
});

/* ------------------------------------------------------------------------- */
/* GH-386 (TC-FAIL-002 golden half) — the typed push failure is the delivered  */
/* data-bearing shape: no top-level error, the PR URL retained, the additive   */
/* push block present. Pinned once; updated only by explicit regeneration.     */
/* ------------------------------------------------------------------------- */

const pushFailureRuntime = (): DispatchCommandRuntime => {
  const state = createDispatchState("push-error-golden");
  const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
  return createDispatchCommandRuntime({
    store: state.store,
    stateRoot: state.root,
    fenceToken: state.fenceToken,
    nowIso: () => "2026-11-08T10:00:00.000Z",
    newAttemptId: () => "attempt-push-error",
    newDivergenceId: () => "DIV-push-error",
    harnesses: { opencode: scripted.port },
    defaultHarness: "opencode",
    descriptor: { kind: "host", workDirectory: state.root, environment: [] },
    prompt: (ref) => `deliver ${ref}`,
    repository: () => "github.com/owner/repo",
    readTruth: async () => readsFrom(),
    claimLease: () => ({ ok: true, leaseId: "lease-1" }),
    releaseLease: () => true,
    phaseLedger: () => ({ completed: 3, total: 9, variant: "full" }),
    pushParity: async () => ({
      ok: true,
      facts: {
        localHead: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
        remoteHead: "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1",
        verdict: "failed",
        parity: false,
      },
    }),
  });
};

describe("GH-386 the typed push failure golden", () => {
  test("the data-bearing failure envelope is byte-identical to its golden", async () => {
    const out: string[] = [];
    const exit = await runCli(
      ["dispatch", "GH-301", "--json"],
      {
        stdout: { write: (chunk: string) => out.push(chunk) },
        stderr: { write: () => undefined },
      },
      {
        brand: BRAND,
        clock: { now: () => Date.parse("2026-11-08T10:00:00.000Z") },
        newRunId: () => "run-push-error",
        secrets: [],
        program: { commands: { dispatch: createDispatchCommandDefinition(pushFailureRuntime()) } },
      },
    );
    const stdout = out.join("");
    expect(exit).toBe(1);
    const envelope = JSON.parse(stdout) as {
      data?: { error?: unknown };
    };
    // No top-level error identity: the delivered data-bearing shape.
    expect(envelope.data?.error).toBeUndefined();
    expect(stdout.trim()).toBe(readFileSync(join(GOLDEN, "push-parity-unmet.json"), "utf8").trim());
  });
});
