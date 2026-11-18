/**
 * TC-HARNESS-018 — attach resolves from a bounded listing, spawns nothing, and
 * keeps the delivered unknown-session semantics (M-08, AC-F4-1).
 */
import { describe, expect, test } from "bun:test";
import { createOpencodeSession } from "../../packages/adapters/src/harness/index";
import {
  HARNESS_MAX_SESSIONS,
  type HarnessSessionHandle,
} from "../../packages/core/src/contracts/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import {
  HARNESS_COMMAND,
  PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createFakeStreamStarter,
  createRecordingRunner,
  runnerResult,
  streamStarterFromRunner,
} from "../fixtures/harness/harness-io";
import { createPropagationHarness } from "../fixtures/harness/propagation-harness";
import { PRODUCTION_OPENCODE_ARGS } from "../../packages/cli/src/production";

const listing = (ids: readonly string[]): string =>
  JSON.stringify(ids.map((id) => ({ id, title: `session ${id}` })));

const handleFor = (sessionId: string): HarnessSessionHandle => ({
  harnessKind: "opencode",
  sessionId,
  treeRoot: sessionId,
  workItemRef: "GH-335",
});

describe("TC-HARNESS-018 attach from the bounded listing", () => {
  test("the listing is read once with the declared cap and spawns nothing", async () => {
    const harness = createPropagationHarness({
      versionVerdict: "inside",
      listingOutput: listing(["ses-a", "ses-b"]),
    });
    const listed = await harness.port.listSessions({
      workItemRef: "GH-335",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.handles.map((handle) => handle.sessionId)).toEqual(["ses-a", "ses-b"]);
    expect(harness.invocations).toHaveLength(1);
    // The only invocation was the listing: no session was spawned.
    expect(harness.invocations[0]?.args).toEqual([...PRODUCTION_OPENCODE_ARGS.list]);
  });

  test("an over-cap listing carries the explicit truncation mark and still resolves", async () => {
    const ids = Array.from({ length: HARNESS_MAX_SESSIONS + 2 }, (_value, index) => `ses-${index}`);
    const harness = createPropagationHarness({
      versionVerdict: "inside",
      listingOutput: listing(ids),
    });
    const listed = await harness.port.listSessions({
      workItemRef: "GH-335",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.handles).toHaveLength(HARNESS_MAX_SESSIONS);
    expect(listed.value.truncation).toEqual({
      truncated: true,
      omitted: 2,
      cap: HARNESS_MAX_SESSIONS,
    });
    expect(listed.value.handles.some((handle) => handle.sessionId === "ses-0")).toBe(true);
  });

  test("an absent or different identity keeps harness.session.unknown with one idempotent kill", async () => {
    const credentials = createFakeCredentialPort();
    const fake = createFakeStreamStarter({
      lines: [JSON.stringify({ sessionID: "ses-known", type: "step_start" })],
      autoEnd: true,
    });
    const recording = createRecordingRunner(() => runnerResult(""));
    const port = createOpencodeSession({
      command: HARNESS_COMMAND,
      runner: recording.runner,
      starter: fake.starter,
      buildEnvironment: (descriptor) =>
        buildHarnessSpawnEnvironment({
          descriptor,
          parentEnvironment: PARENT_ENVIRONMENT,
          credentials: credentials.port,
        }),
      classify: classifier,
      assembleLiveness,
      now: () => "2026-11-18T00:00:00.000Z",
      spawnArgs: PRODUCTION_OPENCODE_ARGS.spawn,
      resumeArgs: PRODUCTION_OPENCODE_ARGS.resume,
      listArgs: PRODUCTION_OPENCODE_ARGS.list,
      versionVerdict: "inside",
    });
    const resumed = await port.resume({
      handle: handleFor("ses-other"),
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.error.code).toBe("harness.session.unknown");
    expect(fake.kills).toBe(1);
    expect(fake.liveStreams).toBe(0);
    expect(recording.invocations).toHaveLength(0);
    expect(fake.invocations).toHaveLength(1);
  });
});
