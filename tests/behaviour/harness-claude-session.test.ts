/**
 * TC-HARN-011 — Claude Code headless spawn, collect, classify, and
 * resume-as-a-gap.
 */
import { describe, expect, test } from "bun:test";
import {
  createClaudeSession,
  createOpencodeSession,
} from "../../packages/adapters/src/harness/index";
import type { HarnessSessionPort } from "../../packages/core/src/contracts/index";
import {
  assembleLiveness,
  CLAUDE_COMMAND,
  CLAUDE_HEADLESS_ARGS,
  classifier,
  createFakeCredentialPort,
  createRecordingRunner,
  declaredBuildEnvironment,
  HARNESS_COMMAND,
  runnerResult,
  SPAWN_ARGS,
  streamStarterFromRunner,
  TIMEOUT_MS,
} from "../fixtures/harness/harness-io";

const PROMPT = "Headless delivery prompt with --flags and $(metacharacters).";
const DESCRIPTOR = { kind: "host" as const, workDirectory: "/synthetic/work", environment: [] };

const makeClaude = (
  handler: Parameters<typeof createRecordingRunner>[0],
): {
  port: HarnessSessionPort;
  invocations: ReturnType<typeof createRecordingRunner>["invocations"];
} => {
  const recording = createRecordingRunner(handler);
  const port = createClaudeSession({
    command: CLAUDE_COMMAND,
    runner: recording.runner,
    buildEnvironment: declaredBuildEnvironment(createFakeCredentialPort()),
    classify: classifier,
    assembleLiveness,
    now: () => "2026-11-06T00:00:00Z",
    timeoutMs: TIMEOUT_MS,
    headlessArgs: CLAUDE_HEADLESS_ARGS,
  });
  return { port, invocations: recording.invocations };
};

const makeOpencode = (stdout: string): HarnessSessionPort => {
  const recording = createRecordingRunner(() => runnerResult(stdout));
  return createOpencodeSession({
    command: HARNESS_COMMAND,
    runner: recording.runner,
    starter: streamStarterFromRunner(recording.runner),
    buildEnvironment: declaredBuildEnvironment(createFakeCredentialPort()),
    classify: classifier,
    assembleLiveness,
    now: () => "2026-11-06T00:00:00Z",
    timeoutMs: TIMEOUT_MS,
    spawnArgs: SPAWN_ARGS,
  });
};

const completed = JSON.stringify({
  type: "result",
  subtype: "success",
  session_id: "cc_done",
  is_error: false,
  usage: {},
});
const premature = JSON.stringify({ type: "assistant", session_id: "cc_early", usage: {} });
const missingOptional = JSON.stringify({
  type: "result",
  subtype: "success",
  session_id: "cc_drift",
  is_error: false,
});

describe("TC-HARN-011 Claude Code headless session", () => {
  test("spawn is headless, delivers the prompt as data, and applies the descriptor env", async () => {
    const { port, invocations } = makeClaude(() => runnerResult(completed));
    const spawned = await port.spawn({
      workItemRef: "GH-233",
      prompt: PROMPT,
      descriptor: DESCRIPTOR,
    });
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    expect(spawned.value.harnessKind).toBe("claude-code");
    expect(spawned.value.treeRoot).toBe("cc_done");
    expect(invocations).toHaveLength(1);
    const invocation = invocations[0];
    if (invocation === undefined) return;
    expect(invocation.args).toEqual([...CLAUDE_HEADLESS_ARGS]);
    expect(invocation.args).toContain("--print");
    expect(invocation.options.stdin).toBe(PROMPT);
    expect(invocation.args).not.toContain(PROMPT);
    expect(invocation.options.env).toEqual({});
  });

  test("completed and premature end classify through the shared classifier", async () => {
    const done = makeClaude(() => runnerResult(completed));
    const early = makeClaude(() => runnerResult(premature));
    const doneSpawn = await done.port.spawn({
      workItemRef: "GH-233",
      prompt: PROMPT,
      descriptor: DESCRIPTOR,
    });
    const earlySpawn = await early.port.spawn({
      workItemRef: "GH-233",
      prompt: PROMPT,
      descriptor: DESCRIPTOR,
    });
    expect(doneSpawn.ok && earlySpawn.ok).toBe(true);
    if (!doneSpawn.ok || !earlySpawn.ok) return;
    const doneFacts = await done.port.collect({ handle: doneSpawn.value });
    const earlyFacts = await early.port.collect({ handle: earlySpawn.value });
    expect(doneFacts.ok && earlyFacts.ok).toBe(true);
    if (!doneFacts.ok || !earlyFacts.ok) return;
    expect(done.port.classify(doneFacts.value).token).toBe("finished");
    const earlyClass = early.port.classify(earlyFacts.value);
    expect(earlyClass.outcome).toBe("premature-end");

    const opencode = makeOpencode(
      JSON.stringify({ session: { id: "ses_early" }, result: { completion: "incomplete" } }),
    );
    const opencodeSpawn = await opencode.spawn({
      workItemRef: "GH-233",
      prompt: PROMPT,
      descriptor: DESCRIPTOR,
    });
    expect(opencodeSpawn.ok).toBe(true);
    if (!opencodeSpawn.ok) return;
    const opencodeFacts = await opencode.collect({ handle: opencodeSpawn.value });
    expect(opencodeFacts.ok).toBe(true);
    if (!opencodeFacts.ok) return;
    expect(earlyClass.token).toBe(opencode.classify(opencodeFacts.value).token);
  });

  test("resume returns the declared gap before any invocation and runs no fallback", async () => {
    const { port, invocations } = makeClaude(() => runnerResult(completed));
    const resumed = await port.resume({
      handle: {
        harnessKind: "claude-code",
        sessionId: "cc_done",
        treeRoot: "cc_done",
        workItemRef: "GH-233",
      },
      prompt: "resume please",
      descriptor: DESCRIPTOR,
    });
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.error.code).toBe("harness.capability.gap");
    expect(resumed.error.summary ?? "").toContain("claude-code");
    expect(JSON.stringify(resumed.error).toLowerCase()).not.toContain("reentry");
    expect(invocations).toHaveLength(0);
  });

  test("deliver returns the declared gap before any invocation and runs no fallback", async () => {
    const { port, invocations } = makeClaude(() => runnerResult(completed));
    const delivered = await port.deliver({
      handle: {
        harnessKind: "claude-code",
        sessionId: "cc_done",
        treeRoot: "cc_done",
        workItemRef: "GH-233",
      },
      prompt: "deliver please",
      descriptor: DESCRIPTOR,
    });
    expect(delivered.ok).toBe(false);
    if (delivered.ok) return;
    expect(delivered.error.code).toBe("harness.capability.gap");
    expect(delivered.error.summary ?? "").toContain("claude-code");
    expect(delivered.error.summary ?? "").toContain("deliver");
    expect(JSON.stringify(delivered.error).toLowerCase()).not.toContain("reentry");
    expect(invocations).toHaveLength(0);
  });

  test("only declared liveness kinds are sourced and no undeclared shell-out occurs", async () => {
    const { port, invocations } = makeClaude(() => runnerResult(completed));
    const spawned = await port.spawn({
      workItemRef: "GH-233",
      prompt: PROMPT,
      descriptor: DESCRIPTOR,
    });
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const report = await port.liveness({ handle: spawned.value });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.value.readings.map((reading) => reading.status)).toEqual([
      "absent",
      "absent",
      "absent",
    ]);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.file).toBe(CLAUDE_COMMAND);
  });

  test("a missing optional field degrades with a warning and still classifies", async () => {
    const { port } = makeClaude(() => runnerResult(missingOptional));
    const spawned = await port.spawn({
      workItemRef: "GH-233",
      prompt: PROMPT,
      descriptor: DESCRIPTOR,
    });
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const facts = await port.collect({ handle: spawned.value });
    expect(facts.ok).toBe(true);
    if (!facts.ok) return;
    expect(facts.value.warnings).toEqual(["optional-field-absent"]);
    expect(port.classify(facts.value).token).toBe("finished");
  });

  test("a missing completion marker classifies premature end rather than throwing", async () => {
    const { port } = makeClaude(() => runnerResult(JSON.stringify({ session_id: "cc_marker" })));
    const spawned = await port.spawn({
      workItemRef: "GH-233",
      prompt: PROMPT,
      descriptor: DESCRIPTOR,
    });
    expect(spawned.ok).toBe(true);
    if (!spawned.ok) return;
    const facts = await port.collect({ handle: spawned.value });
    expect(facts.ok).toBe(true);
    if (!facts.ok) return;
    expect(port.classify(facts.value).outcome).toBe("premature-end");
  });
});
