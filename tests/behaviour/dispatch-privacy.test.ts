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
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createOperatorHarness, OPERATOR_REF } from "../fixtures/dispatch/operator/harness";
import { createGuardedRunner } from "../fixtures/dispatch/parity/process-runner";
import { createTranscriptDouble } from "../fixtures/dispatch/operator/transcript";

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
          "sessionIds",
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

/* ------------------------------------------------------------------------- */
/* GH-354 TC-NFR-004 — the operator surface's privacy boundary (NFR-11, §21). */
/* ------------------------------------------------------------------------- */

const ARTIFACT_CANARY = "STDOUT-ARTIFACT-CANARY-gh354";
const OPERATOR_CREDENTIAL_CANARY = `ghp_${"z".repeat(36)}`;
const PROMPT_ONLY_CANARY = "PROMPT-ONLY-CANARY-gh354";

describe("TC-NFR-004 the operator payload boundary", () => {
  test("the artifact holds only harness stdout, and no record carries it", async () => {
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-privacy-004-family");
    rmSync(familyRoot, { recursive: true, force: true });
    const output = [
      '{"sessionID":"ses-priv"}',
      ARTIFACT_CANARY,
      OPERATOR_CREDENTIAL_CANARY,
      '{"type":"step_finish","part":{"reason":"stop"}}',
    ].join("\n");
    const guarded = createGuardedRunner({
      session: () => ({ sessionId: "ses-priv", stdout: output, status: 0, timedOut: false }),
    });
    const h = createOperatorHarness({
      label: "privacy-004",
      guarded,
      artifactRoot: familyRoot,
      secrets: [OPERATOR_CREDENTIAL_CANARY],
      transcriptRead: createTranscriptDouble({
        messages: { "ses-priv": `the final message with ${OPERATOR_CREDENTIAL_CANARY}` },
      }).read,
    });
    try {
      const run = await h.run(["dispatch", OPERATOR_REF, "--json"]);
      expect(run.envelope?.error).toBeUndefined();
      const directory = join(familyRoot, OPERATOR_REF);
      const names = readdirSync(directory);
      expect(names.length).toBeGreaterThan(0);
      const artifact = names.map((name) => readFileSync(join(directory, name), "utf8")).join("");
      // The artifact holds the harness stdout verbatim (unscrubbed by design).
      expect(artifact).toContain(ARTIFACT_CANARY);
      expect(artifact).toContain(OPERATOR_CREDENTIAL_CANARY);
      // The declared transformation exactly: the engine adds nothing, so no
      // prompt, diff, tool argument, or provider payload can be in the file.
      expect(artifact).toBe(`${output}\n`);
      expect(artifact).not.toContain(PROMPT_ONLY_CANARY);
      // No record, evidence ref, or envelope carries the artifact canary.
      for (const record of h.records()) {
        expect(JSON.stringify(record)).not.toContain(ARTIFACT_CANARY);
      }
      expect(run.stdout).not.toContain(ARTIFACT_CANARY);

      // The message answer replaces the registered credential value.
      h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-priv" });
      const message = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      const answer = (message.data as { readonly message?: string }).message ?? "";
      expect(answer).toContain("[redacted]");
      expect(answer).not.toContain(OPERATOR_CREDENTIAL_CANARY);
      expect(answer.length).toBeLessThanOrEqual(512);
      expect(answer).not.toContain("\n");
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });
});
