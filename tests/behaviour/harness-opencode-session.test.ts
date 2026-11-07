/**
 * TC-HARN-008, TC-HARN-009, TC-HARN-010, TC-HARN-033 — the opencode adapter.
 *
 * Hermetic: every invocation goes through the recording runner; the spawn
 * environment is built from the injected parent record; liveness facts and
 * listing output are injected. No bash script is executed (GAP-T2).
 */
import { describe, expect, test } from "bun:test";
import {
  createOpencodeSession,
  OPENCODE_CAPABILITIES,
} from "../../packages/adapters/src/harness/index";
import {
  HARNESS_MAX_SESSIONS,
  type HarnessSessionPort,
} from "../../packages/core/src/contracts/index";
import {
  assembleLiveness,
  CLAUDE_COMMAND,
  CLAUDE_HEADLESS_ARGS,
  classifier,
  createFakeCredentialPort,
  createRecordingRunner,
  declaredBuildEnvironment,
  FIXED_NOW,
  HARNESS_COMMAND,
  LIST_ARGS,
  LIVENESS_FACTS,
  output,
  PARENT_ENVIRONMENT,
  RESUME_ARGS,
  runnerResult,
  SPAWN_ARGS,
  SPAWN_ENV_DESCRIPTOR,
  TIMEOUT_MS,
} from "../fixtures/harness/harness-io";
import { DECLARED_VARIABLES } from "../fixtures/harness/spawn-env";

const WORK_ITEM_REF = "GH-233";
const ROOT_SESSION = "ses_root_1";
const PREMATURE_SESSION = "ses_premature_1";
const DEFAULT_PROMPT = "Implement the harness adapter seam.\nSecond line: data, not flags.";

const makeSession = (
  handler: Parameters<typeof createRecordingRunner>[0],
  overrides: Partial<Parameters<typeof createOpencodeSession>[0]> = {},
): {
  readonly port: HarnessSessionPort;
  readonly invocations: ReturnType<typeof createRecordingRunner>["invocations"];
  readonly credentials: ReturnType<typeof createFakeCredentialPort>;
} => {
  const recording = createRecordingRunner(handler);
  const credentials = createFakeCredentialPort();
  const port = createOpencodeSession({
    command: HARNESS_COMMAND,
    runner: recording.runner,
    buildEnvironment: declaredBuildEnvironment(credentials),
    classify: classifier,
    assembleLiveness,
    now: () => FIXED_NOW,
    timeoutMs: TIMEOUT_MS,
    spawnArgs: SPAWN_ARGS,
    resumeArgs: RESUME_ARGS,
    listArgs: LIST_ARGS,
    livenessFacts: LIVENESS_FACTS,
    ...overrides,
  });
  return { port, invocations: recording.invocations, credentials };
};

const spawnInput = (prompt = DEFAULT_PROMPT) => ({
  workItemRef: WORK_ITEM_REF,
  prompt,
  descriptor: SPAWN_ENV_DESCRIPTOR,
});

const spawnRoot = async (port: HarnessSessionPort) =>
  port.spawn({
    workItemRef: WORK_ITEM_REF,
    prompt: DEFAULT_PROMPT,
    descriptor: SPAWN_ENV_DESCRIPTOR,
  });

describe("TC-HARN-008 opencode spawn", () => {
  test("spawn invokes once with the configured command, args, work dir, env, and prompt", async () => {
    const { port, invocations } = makeSession(() => runnerResult(output(ROOT_SESSION, "complete")));
    const spawned = await spawnRoot(port);
    expect(spawned.ok).toBe(true);
    expect(invocations).toHaveLength(1);
    const invocation = invocations[0];
    if (invocation === undefined) return;
    expect(invocation.file).toBe(HARNESS_COMMAND);
    expect(invocation.args).toEqual([...SPAWN_ARGS]);
    expect(invocation.options.cwd).toBe(SPAWN_ENV_DESCRIPTOR.workDirectory);
    expect(invocation.options.timeout).toBe(TIMEOUT_MS);
    expect(invocation.options.stdin).toBe(DEFAULT_PROMPT);
    expect(Object.keys(invocation.options.env).sort()).toEqual([...DECLARED_VARIABLES].sort());
    expect(invocation.options.env.HARNESS_MODEL).toBe(PARENT_ENVIRONMENT.HARNESS_MODEL as string);
  });

  test("the handle carries identity and attribution only", async () => {
    const { port } = makeSession(() => runnerResult(output(ROOT_SESSION, "complete")));
    const spawned = await spawnRoot(port);
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(Object.keys(spawned.value).sort()).toEqual([
      "harnessKind",
      "sessionId",
      "treeRoot",
      "workItemRef",
    ]);
    expect(spawned.value.sessionId).toBe(ROOT_SESSION);
    expect(spawned.value.treeRoot).toBe(ROOT_SESSION);
    expect(spawned.value.workItemRef).toBe(WORK_ITEM_REF);
    expect(JSON.stringify(spawned.value)).not.toContain("finished");
  });

  test("malformed output is a classified failure with no fabricated id", async () => {
    const { port, invocations } = makeSession(() => runnerResult("{not-json"));
    const spawned = await spawnRoot(port);
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("harness.spawn.invalid-output");
    expect(JSON.stringify(spawned.error)).not.toContain("ses_");
    expect(invocations).toHaveLength(1);
  });

  test("a non-zero exit is classified data carrying the observed status", async () => {
    const { port, invocations } = makeSession(() => runnerResult("", 7));
    const spawned = await spawnRoot(port);
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("harness.spawn.refused");
    expect(spawned.error.status).toBe(7);
    expect(invocations).toHaveLength(1);
  });

  test("no second spawn is attempted", async () => {
    const { port, invocations } = makeSession(() => runnerResult(output(ROOT_SESSION, "complete")));
    await spawnRoot(port);
    await spawnRoot(port);
    expect(invocations).toHaveLength(2);
    expect(invocations.every((invocation) => invocation.file === HARNESS_COMMAND)).toBe(true);
  });
});

describe("TC-HARN-009 opencode resume/steer", () => {
  test("resume keeps the root and delivers the steering payload verbatim as data", async () => {
    const { port, invocations } = makeSession((invocation) =>
      invocation.args.includes("--resume")
        ? runnerResult(output(ROOT_SESSION, "complete"))
        : runnerResult(output(ROOT_SESSION, "complete")),
    );
    const spawned = await spawnRoot(port);
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const steering = "--dangerously-skip-permissions; $(touch synthetic-marker)";
    const resumed = await port.resume({ handle: spawned.value, prompt: steering });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.treeRoot).toBe(ROOT_SESSION);
    expect(resumed.value.sessionId).toBe(ROOT_SESSION);
    expect(invocations).toHaveLength(2);
    const invocation = invocations[1];
    if (invocation === undefined) return;
    expect(invocation.args).toEqual([...RESUME_ARGS, ROOT_SESSION]);
    expect(invocation.args).not.toContain(steering);
    expect(invocation.options.stdin).toBe(steering);
  });

  test("an unknown session fails classified with no new session id", async () => {
    const { port, invocations } = makeSession(() => runnerResult("", 1));
    const resumed = await port.resume({
      handle: {
        harnessKind: "opencode",
        sessionId: "ses_missing",
        treeRoot: "ses_missing",
        workItemRef: WORK_ITEM_REF,
      },
      prompt: "steer",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.error.code).toBe("harness.session.unknown");
    expect(invocations).toHaveLength(1);
    expect(JSON.stringify(resumed.error)).not.toContain("ses_new");
  });

  test("a declared resume gap returns before any invocation", async () => {
    const capabilities = {
      ...OPENCODE_CAPABILITIES,
      supportedOperations: OPENCODE_CAPABILITIES.supportedOperations.filter(
        (operation) => operation !== "resume",
      ),
      declaredGaps: [
        ...OPENCODE_CAPABILITIES.declaredGaps,
        { capability: "resume" as const, reason: "adapter-not-implemented" as const },
      ],
    };
    const { port, invocations } = makeSession(() => runnerResult(""), { capabilities });
    const resumed = await port.resume({
      handle: {
        harnessKind: "opencode",
        sessionId: ROOT_SESSION,
        treeRoot: ROOT_SESSION,
        workItemRef: WORK_ITEM_REF,
      },
      prompt: "steer",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.error.code).toBe("harness.capability.gap");
    expect(invocations).toHaveLength(0);
  });
});

describe("TC-HARN-010 opencode premature end and liveness", () => {
  test("completed, premature end, and failure stay three distinct outcomes", async () => {
    const completed = makeSession(() => runnerResult(output(ROOT_SESSION, "complete")));
    const premature = makeSession(() => runnerResult(output(PREMATURE_SESSION, "incomplete")));
    const failed = makeSession(() => runnerResult(output("ses_failed", "failed")));

    const completedSpawn = await spawnRoot(completed.port);
    const prematureSpawn = await spawnRoot(premature.port);
    const failedSpawn = await spawnRoot(failed.port);
    expect(completedSpawn.ok && prematureSpawn.ok && failedSpawn.ok).toBe(true);
    if (!completedSpawn.ok || !prematureSpawn.ok || !failedSpawn.ok) return;

    const completedFacts = await completed.port.collect({ handle: completedSpawn.value });
    const prematureFacts = await premature.port.collect({ handle: prematureSpawn.value });
    const failedFacts = await failed.port.collect({ handle: failedSpawn.value });
    expect(completedFacts.ok && prematureFacts.ok && failedFacts.ok).toBe(true);
    if (!completedFacts.ok || !prematureFacts.ok || !failedFacts.ok) return;

    const completedClass = completed.port.classify(completedFacts.value);
    const prematureClass = premature.port.classify(prematureFacts.value);
    const failedClass = failed.port.classify(failedFacts.value);
    expect(completedClass.outcome).toBe("completed");
    expect(prematureClass.outcome).toBe("premature-end");
    expect(failedClass.outcome).toBe("failed");
    expect(new Set([completedClass.token, prematureClass.token, failedClass.token]).size).toBe(3);
  });

  test("liveness maps sourced facts and declares the undeclared worktree kind absent", async () => {
    const { port, invocations } = makeSession(() => runnerResult(output(ROOT_SESSION, "complete")));
    const spawned = await spawnRoot(port);
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const report = await port.liveness({ handle: spawned.value });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    const traffic = report.value.readings.find((reading) => reading.kind === "session-traffic");
    const worktree = report.value.readings.find((reading) => reading.kind === "worktree-activity");
    const process = report.value.readings.find((reading) => reading.kind === "process");
    expect(traffic).toMatchObject({ status: "sourced", value: 7 });
    expect(process).toMatchObject({ status: "sourced", value: 1 });
    expect(worktree).toMatchObject({ status: "absent", reason: "harness-unsupported" });
    expect(invocations).toHaveLength(1);
  });
});

describe("TC-HARN-033 opencode session listing", () => {
  test("session listing is a declared capability and runs once over the injected seam", async () => {
    expect(OPENCODE_CAPABILITIES.supportedOperations).toContain("session-list");
    const listing = JSON.stringify([
      { id: ROOT_SESSION, treeRoot: ROOT_SESSION },
      { id: "ses_child_1", treeRoot: ROOT_SESSION },
    ]);
    const { port, invocations } = makeSession((invocation) =>
      invocation.args.includes("list")
        ? runnerResult(listing)
        : runnerResult(output(ROOT_SESSION, "complete")),
    );
    const spawned = await spawnRoot(port);
    expect(spawned.ok).toBe(true);
    const listed = await port.listSessions({
      workItemRef: WORK_ITEM_REF,
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.handles.map((handle) => handle.sessionId).sort()).toEqual([
      "ses_child_1",
      ROOT_SESSION,
    ]);
    expect(listed.value.handles.every((handle) => handle.workItemRef === WORK_ITEM_REF)).toBe(true);
    expect(invocations).toHaveLength(2);
    const invocation = invocations[1];
    if (invocation === undefined) return;
    expect(invocation.file).toBe(HARNESS_COMMAND);
    expect(invocation.args).toEqual([...LIST_ARGS]);
    expect(invocation.options.cwd).toBe(SPAWN_ENV_DESCRIPTOR.workDirectory);
    expect(invocation.options.timeout).toBe(TIMEOUT_MS);
    expect(Object.keys(invocation.options.env).sort()).toEqual([...DECLARED_VARIABLES].sort());
  });

  test("an empty listing is an empty list with no fabricated session", async () => {
    const { port } = makeSession(() => runnerResult("[]"));
    const listed = await port.listSessions({
      workItemRef: WORK_ITEM_REF,
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.handles).toEqual([]);
  });

  test("malformed and non-zero listings are classified data", async () => {
    const malformed = makeSession(() => runnerResult("{not-json"));
    const bad = await malformed.port.listSessions({
      workItemRef: WORK_ITEM_REF,
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("harness.listing.invalid-output");
    expect(malformed.invocations).toHaveLength(1);

    const nonZero = makeSession(() => runnerResult("", 4));
    const refused = await nonZero.port.listSessions({
      workItemRef: WORK_ITEM_REF,
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.status).toBe(4);
  });

  test("a declared listing gap returns before any invocation", async () => {
    const capabilities = {
      ...OPENCODE_CAPABILITIES,
      supportedOperations: OPENCODE_CAPABILITIES.supportedOperations.filter(
        (operation) => operation !== "session-list",
      ),
      declaredGaps: [
        ...OPENCODE_CAPABILITIES.declaredGaps,
        { capability: "session-list" as const, reason: "adapter-not-implemented" as const },
      ],
    };
    const { port, invocations } = makeSession(() => runnerResult("[]"), { capabilities });
    const listed = await port.listSessions({
      workItemRef: WORK_ITEM_REF,
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(listed.ok).toBe(false);
    if (!listed.ok) expect(listed.error.code).toBe("harness.capability.gap");
    expect(invocations).toHaveLength(0);
  });

  test("the listing is capped with an explicit truncation mark", async () => {
    const entries = Array.from({ length: HARNESS_MAX_SESSIONS + 3 }, (_, index) => ({
      id: `ses_${index}`,
      treeRoot: `ses_${index}`,
    }));
    const { port } = makeSession(() => runnerResult(JSON.stringify(entries)));
    const listed = await port.listSessions({
      workItemRef: WORK_ITEM_REF,
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.handles).toHaveLength(HARNESS_MAX_SESSIONS);
    expect(listed.value.truncation).toEqual({
      truncated: true,
      omitted: 3,
      cap: HARNESS_MAX_SESSIONS,
    });
  });
});

// The Claude adapter is built with the same fixture seams in Phase 4; keeping
// these constants referenced documents the cross-adapter intent.
void CLAUDE_COMMAND;
void CLAUDE_HEADLESS_ARGS;
