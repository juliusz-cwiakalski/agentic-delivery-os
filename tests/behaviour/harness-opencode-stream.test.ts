/**
 * GH-275 opencode spawn over the streaming seam: JSONL decoding, top-level
 * `sessionID` acquisition, non-blocking handle, completion-scoped evidence,
 * legacy-envelope precedence, and the pinned failure encodings.
 *
 * TC-OCS-010..017, 020..022, 040..048. Hermetic: every stream fact is injected
 * through the fake starter; no harness CLI is invoked.
 */
import { describe, expect, test } from "bun:test";
import { createOpencodeSession } from "../../packages/adapters/src/harness/index";
import type { HarnessEvidence, HarnessSessionPort } from "../../packages/core/src/contracts/index";
import {
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createFakeStreamStarter,
  createVirtualClock,
  declaredBuildEnvironment,
  type FakeStreamStarter,
  FIXED_NOW,
  flushUntil,
  HARNESS_COMMAND,
  LIST_ARGS,
  RESUME_ARGS,
  SPAWN_ARGS,
  SPAWN_ENV_DESCRIPTOR,
  type StreamScript,
} from "../fixtures/harness/harness-io";
import { CLASSIFICATION_SCENARIOS } from "../fixtures/harness/scenarios/classification";
import {
  HAPPY_PATH_LINES,
  HAPPY_PATH_SESSION_ID,
  STREAM_CASES,
  STREAM_ERROR_LINES,
  type StreamCase,
  type StreamCaseId,
  streamCase,
  TOOL_ERROR_LINES,
  TOOL_ERROR_SESSION_ID,
} from "../fixtures/harness/scenarios/stream";

const WORK_ITEM_REF = "GH-275";
const PROMPT = "Deliver change GH-275.\nSecond line: data, not flags.";
const HANDLE_SESSION = "ses_handle_stream_1";

const spawnInput = () => ({
  workItemRef: WORK_ITEM_REF,
  prompt: PROMPT,
  descriptor: SPAWN_ENV_DESCRIPTOR,
});

const makePort = (
  fake: FakeStreamStarter,
  overrides: Partial<Parameters<typeof createOpencodeSession>[0]> = {},
): HarnessSessionPort =>
  createOpencodeSession({
    command: HARNESS_COMMAND,
    runner: async () => ({ stdout: "", stderr: "", status: 0, timedOut: false }),
    starter: fake.starter,
    buildEnvironment: declaredBuildEnvironment(createFakeCredentialPort()),
    classify: classifier,
    assembleLiveness,
    now: () => FIXED_NOW,
    spawnArgs: SPAWN_ARGS,
    resumeArgs: RESUME_ARGS,
    listArgs: LIST_ARGS,
    ...overrides,
  });

const fakeFor = (
  script: StreamScript,
  clock?: ReturnType<typeof createVirtualClock>,
): FakeStreamStarter => createFakeStreamStarter(script, clock);

const spawnFromCase = async (
  testCase: StreamCase,
): Promise<{
  readonly fake: FakeStreamStarter;
  readonly port: HarnessSessionPort;
  readonly spawned: Awaited<ReturnType<HarnessSessionPort["spawn"]>>;
}> => {
  const fake = fakeFor({
    lines: testCase.lines,
    autoEnd: true,
    result: testCase.completion,
  });
  const port = makePort(fake);
  return { fake, port, spawned: await port.spawn(spawnInput()) };
};

const evidenceOf = async (
  port: HarnessSessionPort,
  handle: Parameters<HarnessSessionPort["collect"]>[0]["handle"],
): Promise<HarnessEvidence> => {
  const collected = await port.collect({ handle });
  expect(collected.ok).toBe(true);
  if (!collected.ok) throw new Error("collect failed");
  return collected.value;
};

const expectEvidence = (evidence: HarnessEvidence, expected: Partial<HarnessEvidence>): void => {
  for (const [key, value] of Object.entries(expected)) {
    expect(evidence[key as keyof HarnessEvidence]).toEqual(value);
  }
};

const stepStart = (sessionID: string): string =>
  JSON.stringify({ type: "step_start", timestamp: 1, sessionID, part: { type: "step-start" } });
const textLine = (sessionID: string): string =>
  JSON.stringify({ type: "text", timestamp: 2, sessionID, part: { type: "text", text: "ok" } });
const stepFinish = (sessionID: string, reason: string): string =>
  JSON.stringify({
    type: "step_finish",
    timestamp: 3,
    sessionID,
    part: { type: "step-finish", reason },
  });

describe("TC-OCS-010 the real three-line JSONL stream acquires from top-level sessionID", () => {
  test("spawn returns a handle carrying the captured sessionID", async () => {
    const fake = fakeFor({ lines: HAPPY_PATH_LINES });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(spawned.value.sessionId).toBe(HAPPY_PATH_SESSION_ID as string);
    expect(spawned.value.treeRoot).toBe(HAPPY_PATH_SESSION_ID as string);
    expect(spawned.value.workItemRef).toBe(WORK_ITEM_REF);
    expect(fake.invocations).toHaveLength(1);
    const invocation = fake.invocations[0];
    expect(invocation?.file).toBe(HARNESS_COMMAND);
    expect(invocation?.args).toEqual([...SPAWN_ARGS]);
    expect(invocation?.options.cwd).toBe(SPAWN_ENV_DESCRIPTOR.workDirectory);
    expect(invocation?.options.stdin).toBe(PROMPT);
    expect(fake.acquiredCalls).toBe(1);
    expect(JSON.stringify(spawned.value)).not.toContain("step_start");
    expect(JSON.stringify(spawned.value)).not.toContain("finished");
  });
});

describe("TC-OCS-011 leading blank and malformed lines are scanned past", () => {
  test("the first identified line wins after noise", async () => {
    const fake = fakeFor({ lines: streamCase("leading-noise").lines });
    const spawned = await makePort(fake).spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(spawned.value.sessionId).toBe("ses_noise");
    expect(fake.acquiredCalls).toBe(1);
  });

  test("a malformed line after a valid one never overrides the first identifier", async () => {
    const fake = fakeFor({
      lines: [stepStart("ses_first"), "not-json", stepStart("ses_second")],
    });
    const spawned = await makePort(fake).spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(spawned.value.sessionId).toBe("ses_first");
  });
});

describe("TC-OCS-012 no identifier at exit 0 is invalid-output with no fabricated handle", () => {
  test("the refusal carries no session id and records no session", async () => {
    const testCase = streamCase("no-id-exit-0");
    const { spawned, port, fake } = await spawnFromCase(testCase);
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("harness.spawn.invalid-output");
    expect(JSON.stringify(spawned.error)).not.toContain("ses_");
    const later = await port.collect({
      handle: {
        harnessKind: "opencode",
        sessionId: "ses_missing",
        treeRoot: "ses_missing",
        workItemRef: WORK_ITEM_REF,
      },
    });
    expect(later.ok).toBe(false);
    if (!later.ok) expect(later.error.code).toBe("harness.session.unknown");
    expect(fake.invocations).toHaveLength(1);
  });
});

describe("TC-OCS-013 no identifier with a non-zero exit is spawn.refused", () => {
  test("the observed status is carried", async () => {
    const { spawned } = await spawnFromCase(streamCase("no-id-non-zero"));
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("harness.spawn.refused");
    expect(spawned.error.status).toBe(7);
    expect("timedOut" in spawned.error).toBe(false);
  });
});

describe("TC-OCS-014 acquisition-bound expiry refuses with the starter timeout fact", () => {
  test("the child is killed and the summary names the acquisition timeout", async () => {
    const fake = fakeFor({ lines: [] });
    const port = makePort(fake);
    const spawnedPromise = port.spawn(spawnInput());
    fake.expireHandleBound();
    const spawned = await spawnedPromise;
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("harness.spawn.refused");
    expect(spawned.error.status).toBe(1);
    expect(spawned.error.summary ?? "").toContain("acquisition timeout");
    expect(fake.kills).toBe(1);
    expect(fake.acquiredCalls).toBe(0);
  });
});

describe("TC-OCS-015 an early identifier with a later non-zero exit is post-handle evidence", () => {
  test("the handle is returned first and collect carries the exit", async () => {
    const fake = fakeFor({ lines: [stepStart("ses_late")] });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(fake.completionSettled).toBe(false);
    fake.finish({ status: 3 });
    const evidence = await evidenceOf(port, spawned.value);
    expectEvidence(evidence, {
      exitStatus: 3,
      completionMarker: false,
      spawnRefused: false,
      failureReported: false,
    });
    expect(classifier(evidence).outcome).toBe("failed");
    expect(classifier(evidence).token).toBe("failed");
  });

  test("exit 0 with a missing terminal event is premature end", async () => {
    const fake = fakeFor({ lines: [stepStart("ses_early")] });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    fake.finish({ status: 0 });
    const evidence = await evidenceOf(port, spawned.value);
    expect(evidence.completionMarker).toBe(false);
    expect(classifier(evidence).outcome).toBe("premature-end");
  });
});

describe("TC-OCS-016 truncation after acquisition is premature end with the handle intact", () => {
  test("the handle survives and completion is not fabricated", async () => {
    const { spawned, port } = await spawnFromCase(streamCase("truncated"));
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const evidence = await evidenceOf(port, spawned.value);
    expectEvidence(evidence, { completionMarker: false, exitStatus: 0, timedOut: false });
    expect(classifier(evidence).outcome).toBe("premature-end");
    expect(classifier(evidence).token).toBe("partial");
  });
});

describe("TC-OCS-017 single-document fallback shapes and identifier precedence", () => {
  test("every retained fallback shape is accepted", async () => {
    for (const id of ["single-session-id", "single-sessionId", "single-id"] as const) {
      const testCase = streamCase(id);
      const { spawned } = await spawnFromCase(testCase);
      expect(spawned.ok, id).toBe(true);
      if (spawned.ok) expect(spawned.value.sessionId, id).toBe(testCase.expectedSessionId);
    }
  });

  test("sessionID wins over session.id, and an empty-string id is not an identifier", async () => {
    const precedence = await spawnFromCase(streamCase("precedence"));
    expect(precedence.spawned.ok).toBe(true);
    if (precedence.spawned.ok) expect(precedence.spawned.value.sessionId).toBe("ses_top");

    const fake = fakeFor({ lines: [JSON.stringify({ sessionID: "", session: { id: "ses_b" } })] });
    const spawned = await makePort(fake).spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (spawned.ok) expect(spawned.value.sessionId).toBe("ses_b");
  });
});

describe("TC-OCS-020 a handle is returned before a 300 s-plus completion", () => {
  test("virtual time advances 11 h without a kill while the session is open", async () => {
    const clock = createVirtualClock();
    const fake = fakeFor({ lines: HAPPY_PATH_LINES }, clock);
    const port = makePort(fake);
    let spawnSettled = false;
    const spawnedPromise = port.spawn(spawnInput()).then((result) => {
      spawnSettled = true;
      return result;
    });
    await flushUntil(() => spawnSettled || fake.acquiredCalls > 0, 64);
    await flushUntil(() => spawnSettled, 64);
    expect(spawnSettled).toBe(true);
    expect(fake.acquiredCalls).toBe(1);
    expect(fake.completionSettled).toBe(false);
    const spawned = await spawnedPromise;
    expect(spawned.ok).toBe(true);
    clock.advance(300_000);
    clock.advance(600_000);
    clock.advance(39_600_000 - 900_000);
    expect(fake.kills).toBe(0);
    fake.finish({ status: 0 });
    if (spawned.ok) {
      const evidence = await evidenceOf(port, spawned.value);
      expect(evidence.completionMarker).toBe(true);
    }
  });
});

describe("TC-OCS-021 collect is completion-scoped", () => {
  test("collect stays pending before close and resolves after", async () => {
    const fake = fakeFor({ lines: HAPPY_PATH_LINES });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    let collectSettled = false;
    const collectPromise = port.collect({ handle: spawned.value }).then((result) => {
      collectSettled = true;
      return result;
    });
    await flushUntil(() => collectSettled, 64);
    expect(collectSettled).toBe(false);
    expect(fake.completionSettled).toBe(false);
    fake.finish({ status: 0 });
    await flushUntil(() => collectSettled, 64);
    expect(collectSettled).toBe(true);
    const collected = await collectPromise;
    expect(collected.ok).toBe(true);
    const second = await port.collect({ handle: spawned.value });
    expect(second.ok && collected.ok && JSON.stringify(second.value)).toBe(
      JSON.stringify(collected.ok ? collected.value : {}),
    );
  });

  test("an abnormal completion is reported only after close", async () => {
    const fake = fakeFor({ lines: HAPPY_PATH_LINES });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    fake.finish({ status: 1 });
    const evidence = await evidenceOf(port, spawned.value);
    expect(evidence.exitStatus).toBe(1);
    expect(evidence.completionMarker).toBe(false);
  });
});

describe("TC-OCS-022 the handle carries identity and attribution only", () => {
  test("no token or payload leaks into the handle", async () => {
    const fake = fakeFor({ lines: HAPPY_PATH_LINES });
    const spawned = await makePort(fake).spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(Object.keys(spawned.value).sort()).toEqual([
      "harnessKind",
      "sessionId",
      "treeRoot",
      "workItemRef",
    ]);
    expect(spawned.value.harnessKind).toBe("opencode");
    expect(spawned.value.treeRoot).toBe(spawned.value.sessionId);
    const serialized = JSON.stringify(spawned.value);
    for (const token of ["finished", "partial", "max-restarts", "FAILED"]) {
      expect(serialized).not.toContain(token);
    }
  });
});

describe("TC-OCS-040 completion requires exit 0 plus a terminal stop event", () => {
  test("the pinned happy path classifies completed/finished", async () => {
    const { spawned, port } = await spawnFromCase(streamCase("real-three-line"));
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const evidence = await evidenceOf(port, spawned.value);
    expectEvidence(evidence, {
      completionMarker: true,
      exitStatus: 0,
      timedOut: false,
      spawnRefused: false,
      failureReported: false,
      toolFailure: false,
    });
    expect(Object.keys(evidence)).not.toContain("token");
    expect(classifier(evidence).outcome).toBe("completed");
    expect(classifier(evidence).token).toBe("finished");
  });
});

describe("TC-OCS-041 a clean exit alone never fabricates completion", () => {
  test("no terminal event is premature end", async () => {
    const { spawned, port } = await spawnFromCase(streamCase("no-terminal-event"));
    if (!spawned.ok) throw new Error("spawn failed");
    const evidence = await evidenceOf(port, spawned.value);
    expect(evidence.completionMarker).toBe(false);
    expect(evidence.exitStatus).toBe(0);
    expect(classifier(evidence).outcome).toBe("premature-end");
    expect(classifier(evidence).token).toBe("partial");
  });

  test("a terminal event whose reason is not stop is premature end", async () => {
    const fake = fakeFor({
      lines: [stepStart(HANDLE_SESSION), stepFinish(HANDLE_SESSION, "tool-calls")],
    });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    if (!spawned.ok) throw new Error("spawn failed");
    fake.finish({ status: 0 });
    const evidence = await evidenceOf(port, spawned.value);
    expect(evidence.completionMarker).toBe(false);
    expect(classifier(evidence).outcome).toBe("premature-end");
  });
});

describe("TC-OCS-042 the pinned tool_use error part is completed with token partial", () => {
  test("toolFailure is read from part.state.status === error", async () => {
    const { spawned, port } = await spawnFromCase(streamCase("tool-error"));
    if (!spawned.ok) throw new Error("spawn failed");
    expect(spawned.value.sessionId).toBe(TOOL_ERROR_SESSION_ID as string);
    const evidence = await evidenceOf(port, spawned.value);
    expectEvidence(evidence, {
      completionMarker: true,
      toolFailure: true,
      failureReported: false,
      exitStatus: 0,
    });
    expect(classifier(evidence).outcome).toBe("completed");
    expect(classifier(evidence).token).toBe("partial");
  });

  test("removing the tool line or flipping its status flips the result", async () => {
    const withoutTool = TOOL_ERROR_LINES.filter(
      (line) => !((JSON.parse(line) as { readonly type?: string }).type === "tool_use"),
    );
    const removed = fakeFor({ lines: withoutTool, autoEnd: true });
    const removedPort = makePort(removed);
    const removedSpawn = await removedPort.spawn(spawnInput());
    if (!removedSpawn.ok) throw new Error("spawn failed");
    const removedEvidence = await evidenceOf(removedPort, removedSpawn.value);
    expect(removedEvidence.toolFailure).toBe(false);
    expect(classifier(removedEvidence).token).toBe("finished");

    const flipped = TOOL_ERROR_LINES.map((line) =>
      line.replace('"status":"error"', '"status":"completed"'),
    );
    const flippedFake = fakeFor({ lines: flipped, autoEnd: true });
    const flippedPort = makePort(flippedFake);
    const flippedSpawn = await flippedPort.spawn(spawnInput());
    if (!flippedSpawn.ok) throw new Error("spawn failed");
    const flippedEvidence = await evidenceOf(flippedPort, flippedSpawn.value);
    expect(flippedEvidence.toolFailure).toBe(false);
  });
});

describe("TC-OCS-043 an abnormal end reports the observed facts", () => {
  test("a host timeout is timed-out; a non-zero exit is failed", async () => {
    const timeoutCase = await spawnFromCase(streamCase("abnormal-timeout"));
    if (!timeoutCase.spawned.ok) throw new Error("spawn failed");
    const timeoutEvidence = await evidenceOf(timeoutCase.port, timeoutCase.spawned.value);
    expectEvidence(timeoutEvidence, { completionMarker: false, timedOut: true });
    expect(classifier(timeoutEvidence).outcome).toBe("timed-out");
    expect(classifier(timeoutEvidence).token).toBe("max-restarts");

    const failedCase = await spawnFromCase(streamCase("id-then-non-zero"));
    if (!failedCase.spawned.ok) throw new Error("spawn failed");
    const failedEvidence = await evidenceOf(failedCase.port, failedCase.spawned.value);
    expectEvidence(failedEvidence, { completionMarker: false, exitStatus: 3 });
    expect(classifier(failedEvidence).outcome).toBe("failed");
    expect(classifier(failedEvidence).token).toBe("failed");
  });
});

describe("TC-OCS-044 collect for an unknown handle never fabricates evidence", () => {
  test("unknown and post-failure handles are both session.unknown", async () => {
    const fake = fakeFor({ lines: [], autoEnd: true, result: { status: 0 } });
    const port = makePort(fake);
    const missing = await port.collect({
      handle: {
        harnessKind: "opencode",
        sessionId: "ses_missing",
        treeRoot: "ses_missing",
        workItemRef: WORK_ITEM_REF,
      },
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("harness.session.unknown");
      expect(JSON.stringify(missing.error)).not.toContain("completionMarker");
    }
    const failed = await port.spawn({
      workItemRef: WORK_ITEM_REF,
      prompt: PROMPT,
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(failed.ok).toBe(false);
    const afterFailure = await port.collect({
      handle: {
        harnessKind: "opencode",
        sessionId: "ses_after_failure",
        treeRoot: "ses_after_failure",
        workItemRef: WORK_ITEM_REF,
      },
    });
    expect(afterFailure.ok).toBe(false);
  });
});

describe("TC-OCS-045 the anti-fabrication evidence table", () => {
  test("every declared case produces exactly the declared evidence and token", async () => {
    const tokens = new Set<string>();
    for (const testCase of STREAM_CASES) {
      const { spawned, port } = await spawnFromCase(testCase);
      if (testCase.expectedFailure !== undefined) {
        expect(spawned.ok, testCase.id).toBe(false);
        if (!spawned.ok) expect(spawned.error.code, testCase.id).toBe(testCase.expectedFailure);
        continue;
      }
      expect(spawned.ok, testCase.id).toBe(true);
      if (!spawned.ok) continue;
      const evidence = await evidenceOf(port, spawned.value);
      expectEvidence(evidence, { spawnRefused: false, ...(testCase.expectedEvidence ?? {}) });
      const classification = classifier(evidence);
      if (testCase.expectedOutcome !== undefined) {
        expect(classification.outcome, testCase.id).toBe(testCase.expectedOutcome);
      }
      if (testCase.expectedToken !== undefined) {
        expect(classification.token, testCase.id).toBe(testCase.expectedToken);
        tokens.add(classification.token);
      }
    }
    expect([...tokens].sort()).toEqual(["failed", "finished", "max-restarts", "partial"]);
  });
});

describe("TC-OCS-046 the legacy single-document envelope is the authoritative evidence source", () => {
  const behaviour = (
    scenario: (typeof CLASSIFICATION_SCENARIOS)[number],
  ): { lines: readonly string[]; result: { status: number; timedOut: boolean } } => ({
    lines: [scenario.opencode.spawnStdout],
    result: { status: scenario.opencode.spawnStatus, timedOut: scenario.opencode.spawnTimedOut },
  });

  test("all six delivered envelopes keep their delivered evidence and token", async () => {
    for (const scenario of CLASSIFICATION_SCENARIOS) {
      const fake = fakeFor({ ...behaviour(scenario), autoEnd: true });
      const port = makePort(fake);
      const spawned = await port.spawn(spawnInput());
      expect(spawned.ok, scenario.id).toBe(true);
      if (!spawned.ok) continue;
      const evidence = await evidenceOf(port, spawned.value);
      expectEvidence(evidence, {
        ...scenario.expectedEvidence,
        exitStatus: scenario.opencode.spawnStatus,
        timedOut: scenario.opencode.spawnTimedOut,
      });
      expect(classifier(evidence).outcome, scenario.id).toBe(
        scenario.id === "timeout"
          ? "timed-out"
          : scenario.id === "spawn-refusal"
            ? "refused"
            : scenario.id === "harness-failure"
              ? "failed"
              : scenario.id === "premature-end"
                ? "premature-end"
                : "completed",
      );
      expect(classifier(evidence).token, scenario.id).toBe(scenario.expectedToken);
    }
  });

  test("the envelope wins over a JSONL terminal stop, and vice versa", async () => {
    const envelopeWins = fakeFor({
      lines: [
        JSON.stringify({
          session: { id: "ses_precedence" },
          result: { completion: "incomplete" },
        }),
        stepFinish("ses_precedence", "stop"),
      ],
      autoEnd: true,
    });
    const envelopePort = makePort(envelopeWins);
    const envelopeSpawn = await envelopePort.spawn(spawnInput());
    if (!envelopeSpawn.ok) throw new Error("spawn failed");
    expect((await evidenceOf(envelopePort, envelopeSpawn.value)).completionMarker).toBe(false);

    const jsonlOnly = fakeFor({
      lines: [stepStart("ses_jsonl"), stepFinish("ses_jsonl", "stop")],
      autoEnd: true,
    });
    const jsonlPort = makePort(jsonlOnly);
    const jsonlSpawn = await jsonlPort.spawn(spawnInput());
    if (!jsonlSpawn.ok) throw new Error("spawn failed");
    expect((await evidenceOf(jsonlPort, jsonlSpawn.value)).completionMarker).toBe(true);
  });
});

describe("TC-OCS-047 the pinned tool_use error part makes toolFailure falsifiable", () => {
  test("the capture carries the real encoding", () => {
    const tool = TOOL_ERROR_LINES.map(
      (line) =>
        JSON.parse(line) as {
          readonly type?: string;
          readonly part?: { readonly type?: string; readonly state?: { readonly status?: string } };
        },
    ).find((line) => line.type === "tool_use");
    expect(tool?.part?.type).toBe("tool");
    expect(tool?.part?.state?.status).toBe("error");
  });

  test("the adapter reads state.status only", async () => {
    const { spawned, port } = await spawnFromCase(streamCase("tool-error"));
    if (!spawned.ok) throw new Error("spawn failed");
    expect((await evidenceOf(port, spawned.value)).toolFailure).toBe(true);
  });
});

describe("TC-OCS-048 the pinned error event makes failureReported falsifiable", () => {
  test("the capture carries a real error event", () => {
    const error = STREAM_ERROR_LINES.map(
      (line) => JSON.parse(line) as { readonly type?: string; readonly error?: unknown },
    ).find((line) => line.type === "error");
    expect(error).toBeDefined();
  });

  test("an exit-0 error event is failed, and removing it restores premature end", async () => {
    const { spawned, port } = await spawnFromCase(streamCase("stream-error"));
    if (!spawned.ok) throw new Error("spawn failed");
    const evidence = await evidenceOf(port, spawned.value);
    expectEvidence(evidence, { failureReported: true, completionMarker: false, exitStatus: 0 });
    expect(classifier(evidence).outcome).toBe("failed");
    expect(classifier(evidence).token).toBe("failed");
    expect(JSON.stringify(evidence)).not.toContain("synthetic stream failure");

    const withoutError = STREAM_ERROR_LINES.filter(
      (line) => (JSON.parse(line) as { readonly type?: string }).type !== "error",
    );
    const removedFake = fakeFor({ lines: withoutError, autoEnd: true });
    const removedPort = makePort(removedFake);
    const removedSpawn = await removedPort.spawn(spawnInput());
    if (!removedSpawn.ok) throw new Error("spawn failed");
    const removedEvidence = await evidenceOf(removedPort, removedSpawn.value);
    expect(removedEvidence.failureReported).toBe(false);
    expect(classifier(removedEvidence).outcome).toBe("premature-end");
    expect(classifier(removedEvidence).token).toBe("partial");
  });

  test("a non-zero exit with no error event is carried by exitStatus only", async () => {
    const fake = fakeFor({
      lines: [stepStart("ses_nonzero"), textLine("ses_nonzero")],
      autoEnd: true,
      result: { status: 4, timedOut: false },
    });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    if (!spawned.ok) throw new Error("spawn failed");
    const evidence = await evidenceOf(port, spawned.value);
    expectEvidence(evidence, {
      failureReported: false,
      completionMarker: false,
      exitStatus: 4,
    });
    expect(classifier(evidence).outcome).toBe("failed");
    expect(classifier(evidence).token).toBe("failed");
  });
});

// Keep the case-id union referenced so a case rename is a compile error.
const CASE_IDS: readonly StreamCaseId[] = STREAM_CASES.map((testCase) => testCase.id);
void CASE_IDS;
