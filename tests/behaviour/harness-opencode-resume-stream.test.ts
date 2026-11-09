/**
 * GH-275 resume/deliver on the streaming seam: identity-preserving, non-blocking
 * acquisition; no-identifier and mismatch refusals; post-handle exit evidence.
 *
 * TC-OCS-030..034. Hermetic: every stream fact is injected.
 */
import { describe, expect, test } from "bun:test";
import { createOpencodeSession } from "../../packages/adapters/src/harness/index";
import type { HarnessSessionPort } from "../../packages/core/src/contracts/index";
import {
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createFakeStreamStarter,
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

const WORK_ITEM_REF = "GH-275";
const ROOT_SESSION = "ses_root_1";
const PROMPT = "steer the resumed lane";

const HANDLE = {
  harnessKind: "opencode" as const,
  sessionId: ROOT_SESSION,
  treeRoot: ROOT_SESSION,
  workItemRef: WORK_ITEM_REF,
};

const stepStart = (sessionID: string): string =>
  JSON.stringify({ type: "step_start", timestamp: 1, sessionID, part: { type: "step-start" } });
const stepFinish = (sessionID: string, reason: string): string =>
  JSON.stringify({
    type: "step_finish",
    timestamp: 3,
    sessionID,
    part: { type: "step-finish", reason },
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

const spawnInput = () => ({
  workItemRef: WORK_ITEM_REF,
  prompt: "initial prompt",
  descriptor: SPAWN_ENV_DESCRIPTOR,
});

const resumeInput = (handle = HANDLE, prompt = PROMPT) => ({
  handle,
  prompt,
  descriptor: SPAWN_ENV_DESCRIPTOR,
});

const fakeFor = (script: StreamScript | readonly StreamScript[]): FakeStreamStarter =>
  createFakeStreamStarter(script);

describe("TC-OCS-030 resume with a matching identifier returns the existing identity before completion", () => {
  test("resume acquires non-blockingly, records the args, and keeps the caller's identity", async () => {
    const fake = fakeFor({ lines: [stepStart(ROOT_SESSION)] });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;

    let resumeSettled = false;
    const resumePromise = port.resume(resumeInput()).then((result) => {
      resumeSettled = true;
      return result;
    });
    await flushUntil(() => resumeSettled || fake.acquiredCalls > 1, 64);
    await flushUntil(() => resumeSettled, 64);
    expect(resumeSettled).toBe(true);
    expect(fake.acquiredCalls).toBe(2);
    expect(fake.completionSettled).toBe(false);

    const resumed = await resumePromise;
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.sessionId).toBe(spawned.value.sessionId);
    expect(resumed.value.treeRoot).toBe(spawned.value.treeRoot);
    expect(fake.invocations).toHaveLength(2);
    const invocation = fake.invocations[1];
    expect(invocation?.args).toEqual([...RESUME_ARGS, ROOT_SESSION]);
    expect(invocation?.options.stdin).toBe(PROMPT);
    expect(invocation?.args).not.toContain(PROMPT);

    fake.finish({ status: 0 });
    const collected = await port.collect({ handle: resumed.value });
    expect(collected.ok).toBe(true);
  });

  test("deliver uses the same acquisition and never spawns a fresh session", async () => {
    const fake = fakeFor({ lines: [stepStart(ROOT_SESSION), stepFinish(ROOT_SESSION, "stop")] });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const delivered = await port.deliver(resumeInput(spawned.value));
    expect(delivered.ok).toBe(true);
    if (!delivered.ok) return;
    expect(delivered.value.sessionId).toBe(ROOT_SESSION);
    expect(fake.invocations).toHaveLength(2);
    expect(fake.invocations[1]?.args).toEqual([...RESUME_ARGS, ROOT_SESSION]);
    expect(fake.invocations[1]?.options.stdin).toBe(PROMPT);
  });
});

describe("TC-OCS-031 resume with no identifier is session.unknown", () => {
  test("the observed status is carried and no session is recorded", async () => {
    const fake = fakeFor({
      lines: [JSON.stringify({ type: "text", timestamp: 1, part: { type: "text", text: "ok" } })],
      autoEnd: true,
      result: { status: 4 },
    });
    const port = makePort(fake);
    const resumed = await port.resume(resumeInput());
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.error.code).toBe("harness.session.unknown");
    expect(resumed.error.status).toBe(4);
    expect(JSON.stringify(resumed.error)).not.toContain("ses_");
    expect(fake.acquiredCalls).toBe(0);
    expect(fake.invocations).toHaveLength(1);
    const later = await port.collect({ handle: HANDLE });
    expect(later.ok).toBe(false);
  });

  test("bound expiry carries the acquisition-timeout summary", async () => {
    const fake = fakeFor({ lines: [] });
    const port = makePort(fake);
    const resumedPromise = port.resume(resumeInput());
    fake.expireHandleBound();
    const resumed = await resumedPromise;
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.error.code).toBe("harness.session.unknown");
    expect(resumed.error.summary ?? "").toContain("acquisition timeout");
    expect(fake.acquiredCalls).toBe(0);
    expect(fake.kills).toBe(1);
  });
});

describe("TC-OCS-032 a resumed stream can never switch lanes", () => {
  test("a mismatching identifier is refused and the original session is untouched", async () => {
    const fake = fakeFor([
      { lines: [stepStart("ses_lane_a")] },
      { lines: [stepStart("ses_lane_b")] },
    ]);
    const port = makePort(fake);
    const laneA = {
      harnessKind: "opencode" as const,
      sessionId: "ses_lane_a",
      treeRoot: "ses_lane_a",
      workItemRef: WORK_ITEM_REF,
    };
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(spawned.value.sessionId).toBe("ses_lane_a");

    const resumed = await port.resume(resumeInput(laneA));
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.error.code).toBe("harness.session.unknown");
    expect(JSON.stringify(resumed.error)).not.toContain("ses_lane_b");
    expect(fake.kills).toBe(1);

    // The lane-A record still resolves its own evidence.
    fake.streams[0]?.finish({ status: 0 });
    const collected = await port.collect({ handle: laneA });
    expect(collected.ok).toBe(true);
  });
});

describe("TC-OCS-033 a post-handle resume exit is evidence, not an acquisition refusal", () => {
  test("collect carries the exit and the classifier fails", async () => {
    const fake = fakeFor({
      lines: [stepStart(ROOT_SESSION)],
    });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const resumed = await port.resume(resumeInput(spawned.value));
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(fake.completionSettled).toBe(false);

    fake.finish({ status: 5 });
    const collected = await port.collect({ handle: resumed.value });
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    expect(collected.value.exitStatus).toBe(5);
    expect(collected.value.completionMarker).toBe(false);
    expect(collected.value.failureReported).toBe(false);
    expect(classifier(collected.value).outcome).toBe("failed");
    expect(resumed.value.sessionId).toBe(spawned.value.sessionId);
  });
});

describe("TC-OCS-034 deliver shares the resume identity rules", () => {
  test("deliver refuses a no-identifier stream with session.unknown", async () => {
    const fake = fakeFor({ lines: [], autoEnd: true, result: { status: 0 } });
    const port = makePort(fake);
    const delivered = await port.deliver(resumeInput());
    expect(delivered.ok).toBe(false);
    if (!delivered.ok) expect(delivered.error.code).toBe("harness.session.unknown");
    expect(fake.acquiredCalls).toBe(0);
  });

  test("deliver refuses a mismatch with session.unknown", async () => {
    const fake = fakeFor([
      { lines: [stepStart("ses_lane_a")] },
      { lines: [stepStart("ses_lane_b")] },
    ]);
    const port = makePort(fake);
    const laneA = {
      harnessKind: "opencode" as const,
      sessionId: "ses_lane_a",
      treeRoot: "ses_lane_a",
      workItemRef: WORK_ITEM_REF,
    };
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    const delivered = await port.deliver(resumeInput(laneA));
    expect(delivered.ok).toBe(false);
    if (!delivered.ok) expect(delivered.error.code).toBe("harness.session.unknown");
    expect(fake.invocations).toHaveLength(2);
  });
});
