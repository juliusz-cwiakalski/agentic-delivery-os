/**
 * TC-HARN-012 — deny-by-default spawn-environment construction (builder level).
 *
 * The oracle asserts set equality, absence of every undeclared parent key, the
 * canary's absence from the environment and its serialization, declared values,
 * and determinism. Construction is a pure function of injected data.
 */
import { describe, expect, test } from "bun:test";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import {
  CANARY_CREDENTIAL_SOURCE,
  CANARY_DECOY_CREDENTIAL,
  CANARY_HOME,
  CANARY_PATH_ALT,
  CANARY_UNDECLARED_TOKEN,
  createFakeCredentialPort,
  DECLARED_CREDENTIAL_VARIABLE,
  DECLARED_MODEL_VARIABLE,
  DECLARED_PATH_VARIABLE,
  DECLARED_SMALL_MODEL_VARIABLE,
  DECLARED_VARIABLES,
  DECLARED_WORK_PATH_VARIABLE,
  PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
  UNDECLARED_VARIABLES,
} from "../fixtures/harness/spawn-env";

const CANARIES = [
  CANARY_UNDECLARED_TOKEN,
  CANARY_HOME,
  CANARY_PATH_ALT,
  CANARY_CREDENTIAL_SOURCE,
  CANARY_DECOY_CREDENTIAL,
];

const build = () =>
  buildHarnessSpawnEnvironment({
    descriptor: SPAWN_ENV_DESCRIPTOR,
    parentEnvironment: PARENT_ENVIRONMENT,
    credentials: createFakeCredentialPort().port,
  });

describe("TC-HARN-012 deny-by-default spawn environment", () => {
  test("the observed key set equals the declared set exactly", () => {
    const built = build();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.value).sort()).toEqual([...DECLARED_VARIABLES].sort());
  });

  test("every undeclared parent variable is absent and its canary never leaks", () => {
    const built = build();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    for (const key of UNDECLARED_VARIABLES) {
      expect(Object.hasOwn(built.value, key)).toBe(false);
    }
    const serialized = `${canonicalHarnessJson(built.value)} ${JSON.stringify(built.value)}`;
    for (const canary of CANARIES) {
      expect(serialized).not.toContain(canary);
    }
  });

  test("no undeclared key masquerades as empty, undefined, or null", () => {
    const built = build();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    for (const key of UNDECLARED_VARIABLES) {
      expect(Object.hasOwn(built.value, key)).toBe(false);
      expect(built.value[key]).toBeUndefined();
    }
    for (const value of Object.values(built.value)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe("undefined");
      expect(value).not.toBe("null");
    }
  });

  test("declared values come from the injected parent environment", () => {
    const built = build();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value[DECLARED_MODEL_VARIABLE]).toBe("synthetic/model-large");
    expect(built.value[DECLARED_SMALL_MODEL_VARIABLE]).toBe("synthetic/model-small");
    expect(built.value[DECLARED_WORK_PATH_VARIABLE]).toBe(SPAWN_ENV_DESCRIPTOR.workDirectory);
    expect(built.value[DECLARED_PATH_VARIABLE]).toBe(PARENT_ENVIRONMENT[DECLARED_PATH_VARIABLE]);
    expect(built.value[DECLARED_CREDENTIAL_VARIABLE]).toBe("synthetic-credential-material-1");
  });

  test("construction is deterministic and byte-stable", () => {
    const first = build();
    const second = build();
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value).toEqual(second.value);
    expect(canonicalHarnessJson(first.value)).toBe(canonicalHarnessJson(second.value));
  });
});

describe("TC-HARN-012 session-port observation (Phase 3 completing half)", () => {
  test("the observed runner environment is exactly the declared set end-to-end", async () => {
    const { createOpencodeSession } = await import("../../packages/adapters/src/harness/index");
    const {
      createRecordingRunner,
      runnerResult,
      SPAWN_ARGS,
      HARNESS_COMMAND,
      streamStarterFromRunner,
      TIMEOUT_MS,
    } = await import("../fixtures/harness/harness-io");
    const credentials = createFakeCredentialPort();
    const recording = createRecordingRunner(() =>
      runnerResult(
        JSON.stringify({ session: { id: "ses_env_1" }, result: { completion: "complete" } }),
      ),
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
      classify: (evidence) => {
        const completionToken = evidence.completionMarker ? "finished" : "partial";
        return {
          outcome: evidence.completionMarker ? "completed" : "premature-end",
          token: completionToken,
          derivationClass: "verify",
        };
      },
      assembleLiveness: () => ({ readings: [] }),
      now: () => "2026-11-06T00:00:00Z",
      timeoutMs: TIMEOUT_MS,
      spawnArgs: SPAWN_ARGS,
    });
    const spawned = await port.spawn({
      workItemRef: "GH-233",
      prompt: "prompt as data",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(spawned.ok).toBe(true);
    expect(recording.invocations).toHaveLength(1);
    const observed = recording.invocations[0]?.options.env ?? {};
    expect(Object.keys(observed).sort()).toEqual([...DECLARED_VARIABLES].sort());
    for (const key of UNDECLARED_VARIABLES) expect(Object.hasOwn(observed, key)).toBe(false);
    expect(JSON.stringify(observed)).not.toContain(CANARY_UNDECLARED_TOKEN);
    expect(JSON.stringify(observed)).not.toContain(CANARY_HOME);
    expect(JSON.stringify(observed)).not.toContain(CANARY_PATH_ALT);
  });
});
