/**
 * TC-HARNESS-007 — the delivered default mode on its observed surface, with no
 * runtime fallback (DEC-2, NG-2, AC-F2-1).
 */
import { describe, expect, test } from "bun:test";
import { createOpencodeSession } from "../../packages/adapters/src/harness/index";
import { PRODUCTION_OPENCODE_ARGS } from "../../packages/cli/src/production";
import {
  DEFAULT_HARNESS_MODE,
  HARNESS_MODE_SURFACES,
  HARNESS_MODES,
} from "../../packages/core/src/contracts/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import {
  HARNESS_COMMAND,
  PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
  assembleLiveness,
  classifier,
  createFakeCredentialPort,
  createRecordingRunner,
  runnerResult,
  streamStarterFromRunner,
} from "../fixtures/harness/harness-io";
import {
  PROPAGATION_BINDING_SEAMS,
  createPropagationHarness,
} from "../fixtures/harness/propagation-harness";

const spawnOnce = (port: ReturnType<typeof createPropagationHarness>["port"]) =>
  port.spawn({
    workItemRef: "GH-335",
    prompt: "synthetic",
    descriptor: { kind: "host", workDirectory: "/synthetic", environment: [] },
  });

describe("TC-HARNESS-007 the default mode", () => {
  test("the resolved mode is the declared default and maps to --standalone", () => {
    expect(DEFAULT_HARNESS_MODE).toBe("per-invocation-private-server");
    expect(HARNESS_MODE_SURFACES[DEFAULT_HARNESS_MODE]).toBe("--standalone");
    expect(HARNESS_MODES).toHaveLength(3);
  });

  test("the production surface table carries --standalone once per invocation family", () => {
    for (const args of Object.values(PRODUCTION_OPENCODE_ARGS)) {
      expect(args.filter((value) => value === "--standalone")).toHaveLength(1);
      for (const other of ["service", "api", "serve", "--server"]) {
        expect(args, other).not.toContain(other);
      }
    }
  });

  test("a spawn sends --standalone exactly once and touches no other transport", async () => {
    const harness = createPropagationHarness({ versionVerdict: "inside" });
    const result = await spawnOnce(harness.port);
    expect(result.ok).toBe(true);
    expect(harness.invocations).toHaveLength(1);
    const args = harness.invocations[0]?.args ?? [];
    expect(args.filter((value) => value === "--standalone")).toHaveLength(1);
    for (const other of ["service", "api", "serve", "--server"]) {
      expect(args, other).not.toContain(other);
    }
  });

  test("a transport failure is the default mode's classified outcome with no second attempt", async () => {
    const credentials = createFakeCredentialPort();
    const recording = createRecordingRunner(() =>
      runnerResult("", 1, { stderr: "synthetic transport failure" }),
    );
    const port = createOpencodeSession({
      command: HARNESS_COMMAND,
      runner: recording.runner,
      starter: streamStarterFromRunner(recording.runner),
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
      bindingSeams: PROPAGATION_BINDING_SEAMS,
      versionVerdict: "inside",
    });
    const result = await port.spawn({
      workItemRef: "GH-335",
      prompt: "synthetic",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(result.ok).toBe(false);
    // One invocation on the default surface; no alternate transport was tried.
    expect(recording.invocations).toHaveLength(1);
    const args = recording.invocations[0]?.args ?? [];
    expect(args.filter((value) => value === "--standalone")).toHaveLength(1);
    for (const other of ["service", "api", "serve", "--server"]) {
      expect(args, other).not.toContain(other);
    }
  });
});
