/**
 * TC-OCS-082 — the dispatch engine over the real opencode adapter and the
 * streaming seam: a healthy acquisition is watched and classified before
 * `collect` resolves, while the pre-session failure identity is preserved.
 */
import { describe, expect, test } from "bun:test";
import { createOpencodeSession } from "../../packages/adapters/src/harness/index";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import type { HarnessSessionPort } from "../../packages/core/src/contracts/index";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import {
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createFakeStreamStarter,
  declaredBuildEnvironment,
  type FakeStreamStarter,
  HARNESS_COMMAND,
  LIST_ARGS,
  RESUME_ARGS,
  SPAWN_ARGS,
  SPAWN_ENV_DESCRIPTOR,
} from "../fixtures/harness/harness-io";

const WORK_ITEM_REF = "GH-275";
const ROOT_SESSION = "ses_dispatch_stream";

const stepStart = (sessionID: string): string =>
  JSON.stringify({ type: "step_start", timestamp: 1, sessionID, part: { type: "step-start" } });
const stepFinish = (sessionID: string): string =>
  JSON.stringify({
    type: "step_finish",
    timestamp: 3,
    sessionID,
    part: { type: "step-finish", reason: "stop" },
  });

const opencodePort = (fake: FakeStreamStarter): HarnessSessionPort =>
  createOpencodeSession({
    command: HARNESS_COMMAND,
    runner: async () => ({ stdout: "", stderr: "", status: 0, timedOut: false }),
    starter: fake.starter,
    buildEnvironment: declaredBuildEnvironment(createFakeCredentialPort()),
    classify: classifier,
    assembleLiveness,
    now: () => "2026-11-08T10:00:00.000Z",
    spawnArgs: SPAWN_ARGS,
    resumeArgs: RESUME_ARGS,
    listArgs: LIST_ARGS,
  });

type Instrumented = {
  readonly port: HarnessSessionPort;
  readonly order: string[];
  readonly polls: number;
  readonly pollsWhilePending: number;
};

const instrument = (fake: FakeStreamStarter, finishAfterPolls: number): Instrumented => {
  const inner = opencodePort(fake);
  const order: string[] = [];
  let polls = 0;
  let pollsWhilePending = 0;
  let collectSettled = false;
  const port: HarnessSessionPort = {
    spawn: async (input) => {
      order.push("spawn");
      return inner.spawn(input);
    },
    collect: async (input) => {
      order.push("collect-pending");
      const collected = await inner.collect(input);
      collectSettled = true;
      return collected;
    },
    liveness: async (input) => {
      order.push("liveness");
      polls += 1;
      if (!collectSettled) pollsWhilePending += 1;
      if (polls === finishAfterPolls) fake.finish({ status: 0 });
      return inner.liveness(input);
    },
    classify: (evidence) => {
      order.push("classify");
      return inner.classify(evidence);
    },
    listSessions: inner.listSessions,
    resume: inner.resume,
    deliver: inner.deliver,
  };
  return {
    port,
    order,
    get polls() {
      return polls;
    },
    get pollsWhilePending() {
      return pollsWhilePending;
    },
  };
};

describe("TC-OCS-082 dispatch over a healthy streaming acquisition", () => {
  test("collect stays pending across liveness polls, then classification records one attempt", async () => {
    const fake = createFakeStreamStarter({
      lines: [stepStart(ROOT_SESSION), stepFinish(ROOT_SESSION)],
    });
    const instrumented = instrument(fake, 3);
    const scenario = createCommandScenario({
      harnessPort: instrumented.port,
      livenessIntervalMs: 3_000,
    });
    try {
      const run = await scenario.invoke(["dispatch", WORK_ITEM_REF, "--json"]);
      expect(run.exit).toBe(0);
      expect(run.envelope?.data).toBeDefined();
      const data = run.envelope?.data;
      expect(typeof data?.result).toBe("string");
      expect(data?.lastMessage).not.toBe("spawn failed before a session existed");
      expect(data?.error).toBeUndefined();

      expect(instrumented.pollsWhilePending).toBeGreaterThanOrEqual(2);
      expect(fake.invocations).toHaveLength(1);
      expect(fake.invocations[0]?.args).toEqual([...SPAWN_ARGS]);
      expect(scenario.calls.claims).toHaveLength(1);
      expect(scenario.calls.releases).toHaveLength(1);

      const spawnIndex = instrumented.order.indexOf("spawn");
      const livenessIndex = instrumented.order.indexOf("liveness");
      const classifyIndex = instrumented.order.indexOf("classify");
      expect(spawnIndex).toBeGreaterThanOrEqual(0);
      expect(livenessIndex).toBeGreaterThan(spawnIndex);
      expect(classifyIndex).toBeGreaterThan(livenessIndex);

      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok).toBe(true);
      if (!attempts.ok) return;
      expect(attempts.records).toHaveLength(1);
      const attempt = attempts.records[0];
      expect(attempt?.attemptId.length).toBeGreaterThan(0);
      expect(attempt?.token).toBe(data?.result);
      expect(attempt?.evidenceRefs).toContain(`attempt:${attempt?.attemptId}`);
      expect(attempt?.evidenceRefs.some((ref) => ref.startsWith("liveness:"))).toBe(true);
      expect(scenario.calls.merge).toBe(0);
    } finally {
      scenario.dispose();
    }
  });

  test("the preserved pre-session failure identity still collapses the same way", async () => {
    const fake = createFakeStreamStarter({
      lines: [JSON.stringify({ type: "text", timestamp: 1 })],
      autoEnd: true,
      result: { status: 7 },
    });
    const scenario = createCommandScenario({
      harnessPort: opencodePort(fake),
      livenessIntervalMs: 3_000,
    });
    try {
      const run = await scenario.invoke(["dispatch", WORK_ITEM_REF, "--json"]);
      expect(run.envelope?.data?.error?.code).toBe("dispatch.session.spawn-failed");
      expect(run.envelope?.data?.lastMessage).toBe("spawn failed before a session existed");
      expect(run.envelope?.data?.result).toBe("failed");
      expect(fake.invocations).toHaveLength(1);
      expect(scenario.calls.claims).toHaveLength(1);
      expect(scenario.calls.releases).toHaveLength(1);
      const attempts = readDispatchAttempts(scenario.state.store);
      expect(attempts.ok).toBe(true);
      if (attempts.ok) expect(attempts.records).toHaveLength(1);
      expect(scenario.calls.merge).toBe(0);
    } finally {
      scenario.dispose();
    }
  });
});
