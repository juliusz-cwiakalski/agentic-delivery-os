/**
 * TC-BLK-040 — error surface and exit projection: the four blockers user errors
 * exit 1, malformed answers reuse `input.value.rejected`, delivered state faults
 * keep their exits (torn/lock 2, permission 1), and valid runs exit 0.
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { createBlockersCommandDefinition } from "../../packages/cli/src/commands/blockers";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import type { StateResult } from "../../packages/core/src/contracts/index";
import { BLOCKERS_ERROR_CODES } from "../../packages/core/src/contracts/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { REGISTERED_SECRET, secrets } from "../fixtures/blockers/credentials";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { shippedPolicy } from "../fixtures/blockers/policy";
import { makeQuestion } from "../fixtures/blockers/records";
import { ledgerPath } from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const failure = (code: string) => ({
  ok: false as const,
  error: {
    kind: "state",
    code,
    consequence: "not_landed" as const,
    location: { path: "planted-state-path" },
  },
});

const runWithFailingRead = async (code: string) => {
  const definition = createBlockersCommandDefinition({
    brand: SYNTHETIC_BRAND,
    clock: { nowMs: () => 0, nowIso: () => "2026-11-06T12:00:00Z" },
    newQuestionSuffix: () => "x",
    newFenceToken: () => "f",
    readBlockers: (): StateResult<never> => failure(code),
    appendQuestion: () => failure(code),
    appendAnswer: () => failure(code),
    callerAudienceFact: undefined,
    capability: undefined,
    delegationPolicy: shippedPolicy(),
    secrets: [],
  });
  const stdout = bufferSink();
  const stderr = bufferSink();
  let tick = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => (tick++ === 0 ? 100 : 110) },
    newRunId: () => "run-errors-fixture",
    secrets: [],
    program: { commands: { blockers: definition } },
  };
  const exitCode = await runCli(["--json", "blockers", "list"], { stdout, stderr }, deps);
  const envelope = JSON.parse(stdout.value) as Record<string, unknown>;
  return { exitCode, envelope, stdout: stdout.value, stderr: stderr.value };
};

describe("TC-BLK-040 error surface and exit projection", () => {
  test("an unknown question id is blockers.unknown-id at exit 1", async () => {
    const harness = createBlockersHarness();
    try {
      const run = await harness.run(["answer", "q-does-not-exist", "--text", "x"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({
        code: "blockers.unknown-id",
        category: "user",
        retryable: false,
        consequence: "not_landed",
      });
      expect(run.data).toBeUndefined();
      expect(harness.read().verifiedEmpty).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("the four blockers user errors all exit 1 with the exact identities", async () => {
    const harness = createBlockersHarness({
      secrets: secrets(),
      callerAudienceFact: "coordinator",
      seedQuestions: [
        makeQuestion({ id: "q-owner", type: "decision-needed", audience: "owner", options: ["a"] }),
      ],
    });
    try {
      const cases: readonly [readonly string[], string][] = [
        [["publish", "nope", "--lane", "L2", "q"], "blockers.invalid-type"],
        [
          ["publish", "spec-ambiguity", "--lane", "L2", `x ${REGISTERED_SECRET}`],
          "blockers.credential-value-rejected",
        ],
        [["answer", "q-owner", "--choice", "1"], "blockers.audience-mismatch"],
        [["answer", "q-missing", "--text", "x"], "blockers.unknown-id"],
      ];
      for (const [argv, code] of cases) {
        const run = await harness.run(argv);
        expect(run.exitCode, code).toBe(1);
        expect(run.envelope?.error, code).toMatchObject({
          code,
          category: "user",
          retryable: false,
          consequence: "not_landed",
        });
        expect(run.data, code).toBeUndefined();
        expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      }
      expect(BLOCKERS_ERROR_CODES).toHaveLength(4);
      for (const code of BLOCKERS_ERROR_CODES) expect(code.startsWith("blockers.")).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  test("an already-answered question reuses input.value.rejected", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      expect((await harness.run(["answer", "q-1", "--choice", "1"])).exitCode).toBe(0);
      const run = await harness.run(["answer", "q-1", "--choice", "1"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "input.value.rejected" });
    } finally {
      harness.cleanup();
    }
  });

  test("valid list and answer exit 0 with one success envelope and no error", async () => {
    const harness = createBlockersHarness({
      seedQuestions: [makeQuestion({ id: "q-1", options: ["a"] })],
    });
    try {
      const list = await harness.run(["list"]);
      expect(list.exitCode).toBe(0);
      expect(list.envelope).not.toHaveProperty("error");
      expect(assertEnvelopeContract(list.envelope)).toEqual([]);
      const answer = await harness.run(["answer", "q-1", "--choice", "1"]);
      expect(answer.exitCode).toBe(0);
      expect(answer.envelope).not.toHaveProperty("error");
    } finally {
      harness.cleanup();
    }
  });

  test("torn and fence-busy stores exit 2; permission denied keeps exit 1", async () => {
    const torn = createBlockersHarness();
    try {
      await torn.run(["publish", "spec-ambiguity", "--lane", "L2", "q"]);
      const bytes = torn.ledgerBytes();
      writeFileSync(ledgerPath(torn.state.identity), bytes.subarray(0, bytes.length - 3));
      const run = await torn.run(["list"]);
      expect(run.exitCode).toBe(2);
      expect(run.envelope?.error).toMatchObject({ code: "state.store.torn" });
    } finally {
      torn.cleanup();
    }

    const busy = createBlockersHarness();
    try {
      const held = busy.state.store.acquireFence("holder");
      const run = await busy.run(["publish", "spec-ambiguity", "--lane", "L2", "q"]);
      expect(run.exitCode).toBe(2);
      expect(run.envelope?.error).toMatchObject({ code: "state.lock.busy" });
      if (held.ok) busy.state.store.releaseFence(held.value.handle);
    } finally {
      busy.cleanup();
    }

    const denied = await runWithFailingRead("state.permission.denied");
    expect(denied.exitCode).toBe(1);
    expect(denied.envelope.error).toMatchObject({ code: "state.permission.denied" });
  });

  test("malformed invocations are fallback.invocation before any read", async () => {
    const harness = createBlockersHarness();
    try {
      const run = await harness.run(["publish", "decision-needed", "no lane"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "fallback.invocation" });
      expect(harness.recorder.calls.filter((call) => call === "readRecords")).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });
});
