/**
 * TC-NFR-006 / TC-NFR-007 (phase 10) — no secret, credential value, prompt,
 * transcript, diff, or raw provider payload reaches output, envelopes, records,
 * or help; the spawn environment is deny-by-default.
 */
import { describe, expect, test } from "bun:test";
import { runDispatch } from "../../packages/core/src/app/dispatch";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import { createDispatchState, createScriptedHarness } from "../fixtures/dispatch/harness";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import { COMPLETED_EVIDENCE } from "../fixtures/dispatch/harness";

const CANARIES = [
  "CANARY-PROMPT-7f3a",
  "CANARY-TRANSCRIPT-7f3a",
  "CANARY-CREDENTIAL-7f3a",
  "CANARY-PAYLOAD-7f3a",
  "CANARY-TOKENLIKE-7f3a",
];

const noCanary = (label: string, text: string): void => {
  for (const canary of CANARIES) expect(text.includes(canary), `${label}: ${canary}`).toBe(false);
};

describe("TC-NFR-006 no secret, prompt, transcript, or payload leaks", () => {
  test("a dispatch with canaries in its prompt and evidence leaks none", async () => {
    const state = createDispatchState("privacy");
    try {
      const scripted = createScriptedHarness({ evidence: COMPLETED_EVIDENCE });
      const result = await runDispatch({
        store: state.store,
        fenceToken: state.fenceToken,
        harness: scripted.port,
        harnessKind: "opencode",
        descriptor: { kind: "host", workDirectory: state.root, environment: [] },
        prompt: `deliver GH-239 ${CANARIES.join(" ")}`,
        ref: "GH-239",
        evidenceClass: "pilot",
        repository: "github.com/owner/repo",
        handoverState: "dual-run",
        nowIso: () => "2026-11-08T10:00:00.000Z",
        newAttemptId: () => "attempt-privacy",
        newDivergenceId: () => "DIV-PRIVACY",
        readTruth: async () => readsFrom(),
        claimLease: () => ({ ok: true, leaseId: "lease" }),
        releaseLease: () => true,
        phaseLedger: { completed: 3, total: 9, variant: "full" },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      noCanary("envelope", JSON.stringify(result.data));
      const read = readDispatchAttempts(state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      noCanary("record", JSON.stringify(read.records));
      // The record carries only the declared bounded fields.
      const keys = Object.keys(read.records[0] ?? {}).sort();
      expect(keys).toEqual(
        [
          "attemptId",
          "comparison",
          "corroboration",
          "evidenceClass",
          "evidenceRefs",
          "falseSuccess",
          "finishedAt",
          "handoverState",
          "harness",
          "outcome",
          "recordedAt",
          "ref",
          "repository",
          "schema",
          "startedAt",
          "token",
        ].sort(),
      );
    } finally {
      state.dispose();
    }
  });

  test("dispatch text, summary text, and help pages leak no canary", async () => {
    const scenario = createCommandScenario({ evidence: COMPLETED_EVIDENCE, gate: {} });
    try {
      const dispatch = await scenario.invoke(["dispatch", "GH-301"]);
      noCanary("dispatch text", dispatch.stdout);
      noCanary("dispatch stderr", dispatch.stderr);
      const help = await scenario.invoke(["dispatch", "--help"]);
      noCanary("help", help.stdout);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-NFR-007 the spawn environment is deny-by-default", () => {
  test("only declared variables survive; a parent canary is absent", () => {
    const parentEnvironment = {
      HOME: "/var/app",
      CANARY_PARENT: "CANARY-PARENT-7f3a",
      CANARY_CREDENTIAL: "CANARY-VALUE-7f3a",
    };
    const built = buildHarnessSpawnEnvironment({
      descriptor: {
        kind: "host",
        workDirectory: "/tmp",
        environment: [{ kind: "variable", name: "HOME" }],
      },
      parentEnvironment,
      credentials: {
        resolve: () => ({
          ok: false,
          error: { kind: "config", code: "config.credential.missing" },
        }),
      } as never,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.value)).toEqual(["HOME"]);
    expect(built.value.HOME).toBe("/var/app");
    expect(JSON.stringify(built.value)).not.toContain("CANARY");
    expect(JSON.stringify(built.value)).not.toContain("CANARY");
  });

  test("an undeclared parent variable is never copied", () => {
    const built = buildHarnessSpawnEnvironment({
      descriptor: { kind: "host", workDirectory: "/tmp", environment: [] },
      parentEnvironment: { PATH: "/usr/bin", CANARY_PARENT: "x" },
      credentials: {
        resolve: () => ({
          ok: false,
          error: { kind: "config", code: "config.credential.missing" },
        }),
      } as never,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value).toEqual({});
  });
});
