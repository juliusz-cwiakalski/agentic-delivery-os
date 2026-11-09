/**
 * GH-275 bounds, kill hygiene, hermeticity and fixture non-vacuity.
 *
 * TC-OCS-023, 050, 051, 053, 071, 072. No product code lives here: a red
 * assertion reopens P2/P3 instead of being edited away.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createOpencodeSession } from "../../packages/adapters/src/harness/index";
import type { HarnessSessionPort } from "../../packages/core/src/contracts/index";
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import {
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createFakeStreamStarter,
  createRecordingRunner,
  createVirtualClock,
  declaredBuildEnvironment,
  type FakeStreamStarter,
  FIXED_NOW,
  HARNESS_COMMAND,
  LIST_ARGS,
  RESUME_ARGS,
  runnerResult,
  SPAWN_ARGS,
  SPAWN_ENV_DESCRIPTOR,
  type StreamScript,
  TIMEOUT_MS,
} from "../fixtures/harness/harness-io";
import { HAPPY_PATH_LINES, HAPPY_PATH_SESSION_ID } from "../fixtures/harness/scenarios/stream";

const ROOT = process.cwd();
const WORK_ITEM_REF = "GH-275";
const ROOT_SESSION = "ses_root_1";
const PROMPT = "Deliver change GH-275.";

const spawnInput = () => ({
  workItemRef: WORK_ITEM_REF,
  prompt: PROMPT,
  descriptor: SPAWN_ENV_DESCRIPTOR,
});
const resumeInput = (sessionId = ROOT_SESSION) => ({
  handle: {
    harnessKind: "opencode" as const,
    sessionId,
    treeRoot: sessionId,
    workItemRef: WORK_ITEM_REF,
  },
  prompt: "steer",
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
    timeoutMs: TIMEOUT_MS,
    ...overrides,
  });

const stepStart = (sessionID: string): string =>
  JSON.stringify({ type: "step_start", timestamp: 1, sessionID, part: { type: "step-start" } });
const stepFinish = (sessionID: string): string =>
  JSON.stringify({
    type: "step_finish",
    timestamp: 3,
    sessionID,
    part: { type: "step-finish", reason: "stop" },
  });

const fakeFor = (script: StreamScript | readonly StreamScript[]) => createFakeStreamStarter(script);

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

describe("TC-OCS-023 no default whole-session bound", () => {
  test("11 h of virtual time never kills a session with no session bound", async () => {
    const clock = createVirtualClock();
    const fake = createFakeStreamStarter({ lines: [stepStart(ROOT_SESSION)] }, clock);
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    for (const step of [300_000, 600_000, 39_600_000 - 900_000]) {
      clock.advance(step);
      expect(fake.kills).toBe(0);
      expect(fake.completionSettled).toBe(false);
    }
    const recorded = fake.options;
    expect(recorded?.sessionTimeoutMs ?? 0).toBe(0);
    fake.finish({ status: 0 });
    const collected = await port.collect({ handle: spawned.value });
    expect(collected.ok).toBe(true);
    if (collected.ok) expect(collected.value.exitStatus).toBe(0);
  });

  test("an injected session bound is passed through verbatim and enforced by the host", async () => {
    const clock = createVirtualClock();
    const fake = createFakeStreamStarter({ lines: [stepStart(ROOT_SESSION)] }, clock);
    const port = makePort(fake, { sessionTimeoutMs: 1 });
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    expect(fake.options?.sessionTimeoutMs).toBe(1);
    clock.advance(1);
    expect(fake.kills).toBe(1);
    expect(fake.completionSettled).toBe(true);
  });
});

describe("TC-OCS-050 handle-bound expiry kills the child and refuses pre-session", () => {
  test("spawn refuses with the observed status and no session record", async () => {
    const fake = fakeFor({ lines: [] });
    const port = makePort(fake);
    const spawnedPromise = port.spawn(spawnInput());
    fake.expireHandleBound();
    const spawned = await spawnedPromise;
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("harness.spawn.refused");
    expect(spawned.error.summary ?? "").toContain("acquisition timeout");
    expect(fake.kills).toBe(1);
    expect(fake.acquiredCalls).toBe(0);
    const later = await port.collect({
      handle: {
        harnessKind: "opencode",
        sessionId: "ses_absent",
        treeRoot: "ses_absent",
        workItemRef: WORK_ITEM_REF,
      },
    });
    expect(later.ok).toBe(false);
  });

  test("resume refuses with session.unknown and one kill", async () => {
    const fake = fakeFor({ lines: [] });
    const port = makePort(fake);
    const resumedPromise = port.resume(resumeInput());
    fake.expireHandleBound();
    const resumed = await resumedPromise;
    expect(resumed.ok).toBe(false);
    if (!resumed.ok) expect(resumed.error.code).toBe("harness.session.unknown");
    expect(fake.kills).toBe(1);
  });
});

describe("TC-OCS-051 kill on every failure and abandonment path", () => {
  test("no-identifier spawn paths kill exactly once", async () => {
    for (const status of [0, 7]) {
      const fake = fakeFor({
        lines: [JSON.stringify({ type: "text", timestamp: 1 })],
        autoEnd: true,
        result: { status },
      });
      const port = makePort(fake);
      const spawned = await port.spawn(spawnInput());
      expect(spawned.ok).toBe(false);
      expect(fake.kills).toBe(1);
      expect(fake.liveStreams).toBe(0);
    }
  });

  test("resume no-identifier and mismatch paths kill", async () => {
    const noId = fakeFor({ lines: [], autoEnd: true, result: { status: 4 } });
    const noIdPort = makePort(noId);
    const refused = await noIdPort.resume(resumeInput());
    expect(refused.ok).toBe(false);
    expect(noId.kills).toBe(1);

    const mismatch = fakeFor([
      { lines: [stepStart("ses_lane_a")] },
      { lines: [stepStart("ses_lane_b")] },
    ]);
    const mismatchPort = makePort(mismatch);
    const spawned = await mismatchPort.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    const mismatchResume = await mismatchPort.resume(resumeInput("ses_lane_a"));
    expect(mismatchResume.ok).toBe(false);
    expect(mismatch.kills).toBe(1);
  });

  test("a successful acquisition is not killed and kill is idempotent", async () => {
    const fake = fakeFor({ lines: [stepStart(ROOT_SESSION)] });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    expect(fake.kills).toBe(0);
    fake.streams[0]?.kill();
    fake.streams[0]?.kill();
    expect(fake.kills).toBe(1);
    expect(fake.completionSettled).toBe(true);
    expect(fake.liveStreams).toBe(0);
  });
});

describe("TC-OCS-053 bounds wiring", () => {
  test("the default handle bound is 60 s and no session bound is passed", async () => {
    const fake = fakeFor({ lines: [stepStart(ROOT_SESSION)] });
    await makePort(fake).spawn(spawnInput());
    expect(fake.options?.handleTimeoutMs).toBe(60_000);
    expect(fake.options?.sessionTimeoutMs).toBeUndefined();
    expect(fake.options !== undefined && "timeout" in fake.options).toBe(false);
    expect(fake.options !== undefined && "timeoutMs" in fake.options).toBe(false);
  });

  test("explicit bounds are passed through verbatim and listing keeps its own timeout", async () => {
    const fake = fakeFor({ lines: [stepStart(ROOT_SESSION)] });
    const runner = createRecordingRunner(() => runnerResult("[]"));
    const port = makePort(fake, {
      runner: runner.runner,
      handleTimeoutMs: 1_234,
      sessionTimeoutMs: 5_678,
    });
    await port.spawn(spawnInput());
    expect(fake.options?.handleTimeoutMs).toBe(1_234);
    expect(fake.options?.sessionTimeoutMs).toBe(5_678);
    const listed = await port.listSessions({
      workItemRef: WORK_ITEM_REF,
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(listed.ok).toBe(true);
    expect(runner.invocations).toHaveLength(1);
    expect(runner.invocations[0]?.options.timeout).toBe(TIMEOUT_MS);
    expect(fake.invocations).toHaveLength(1);
  });
});

describe("TC-OCS-071 hermeticity and determinism meta-check", () => {
  const adapterSuites = [
    "tests/behaviour/harness-opencode-stream.test.ts",
    "tests/behaviour/harness-opencode-resume-stream.test.ts",
  ];

  test("no real harness command or process API in the adapter suites", () => {
    for (const file of adapterSuites) {
      const text = read(file);
      for (const banned of ["node:child_process", "Bun.spawn", "Bun.$", "execFile"]) {
        expect(text, `${file}: ${banned}`).not.toContain(banned);
      }
      expect(text, file).not.toContain('command: "opencode"');
      expect(text, file).not.toContain('command: "claude"');
      expect(text, file).toContain("command: HARNESS_COMMAND");
    }
  });

  test("process.execPath appears only in the host suite", () => {
    expect(read("tests/behaviour/harness-host-stream.test.ts")).toContain("process.execPath");
    for (const file of adapterSuites) expect(read(file)).not.toContain("process.execPath");
  });

  test("the stream fixture has no timer, wall clock, or process access", () => {
    const fixture = read("tests/fixtures/harness/stream.ts");
    for (const banned of [
      "setTimeout",
      "setInterval",
      "Date.now",
      "performance.now",
      "node:child_process",
      "Bun.spawn",
      "fetch(",
    ]) {
      expect(fixture, banned).not.toContain(banned);
    }
    expect(fixture).toContain("createVirtualClock");
  });

  test("replaying the same script yields byte-identical evidence", async () => {
    const run = async () => {
      const fake = fakeFor({ lines: HAPPY_PATH_LINES, autoEnd: true });
      const port = makePort(fake);
      const spawned = await port.spawn(spawnInput());
      if (!spawned.ok) throw new Error("spawn failed");
      const collected = await port.collect({ handle: spawned.value });
      if (!collected.ok) throw new Error("collect failed");
      return { evidence: collected.value, classified: port.classify(collected.value) };
    };
    const first = await run();
    const second = await run();
    expect(canonicalHarnessJson(first.evidence)).toBe(canonicalHarnessJson(second.evidence));
    expect(first.classified).toEqual(second.classified);
  });

  test("the stream is fully drained after acquisition", async () => {
    const fake = fakeFor({ lines: HAPPY_PATH_LINES });
    const port = makePort(fake);
    const spawned = await port.spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    fake.push(stepFinish(String(HAPPY_PATH_SESSION_ID)));
    fake.endLines();
    fake.finish({ status: 0 });
    if (spawned.ok) await port.collect({ handle: spawned.value });
    expect(fake.delivered).toBe(HAPPY_PATH_LINES.length + 1);
  });
});

describe("TC-OCS-072 fixture non-vacuity", () => {
  test("the happy path produces a handle and the fixture is load-bearing", async () => {
    const happy = fakeFor({ lines: HAPPY_PATH_LINES, autoEnd: true });
    const happySpawn = await makePort(happy).spawn(spawnInput());
    expect(happySpawn.ok).toBe(true);
    expect(happy.delivered).toBe(HAPPY_PATH_LINES.length);

    const renamed = fakeFor({
      lines: HAPPY_PATH_LINES.map((line) => line.replaceAll('"sessionID"', '"session_id"')),
      autoEnd: true,
      result: { status: 0 },
    });
    const renamedSpawn = await makePort(renamed).spawn(spawnInput());
    expect(renamedSpawn.ok).toBe(false);
    if (!renamedSpawn.ok) expect(renamedSpawn.error.code).toBe("harness.spawn.invalid-output");

    const secondLine = fakeFor({ lines: HAPPY_PATH_LINES.slice(1), autoEnd: true });
    const secondSpawn = await makePort(secondLine).spawn(spawnInput());
    expect(secondSpawn.ok).toBe(true);
    if (secondSpawn.ok) expect(secondSpawn.value.sessionId).toBe(HAPPY_PATH_SESSION_ID as string);

    const empty = fakeFor({ lines: ["", "", ""], autoEnd: true, result: { status: 0 } });
    const emptySpawn = await makePort(empty).spawn(spawnInput());
    expect(emptySpawn.ok).toBe(false);
  });

  test("the handle id never echoes a work item or command constant", async () => {
    const fake = fakeFor({ lines: HAPPY_PATH_LINES, autoEnd: true });
    const spawned = await makePort(fake).spawn(spawnInput());
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(spawned.value.sessionId).not.toBe(WORK_ITEM_REF);
    expect(spawned.value.sessionId).not.toBe(HARNESS_COMMAND);
    expect(spawned.value.sessionId).not.toBe(ROOT_SESSION);
  });
});
