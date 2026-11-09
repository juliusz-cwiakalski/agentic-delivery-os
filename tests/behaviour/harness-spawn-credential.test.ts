/**
 * TC-HARN-013 — use-time credential resolution and fail-closed declarations
 * (builder level; the session-port observation completes in Phase 3).
 */
import { describe, expect, test } from "bun:test";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/harness-spawn-env";
import { canonicalHarnessJson } from "../../packages/core/src/domain/index";
import {
  CANARY_CREDENTIAL_SOURCE,
  CANARY_DECOY_CREDENTIAL,
  CREDENTIAL_REFERENCE,
  createFakeCredentialPort,
  DECLARED_CREDENTIAL_SOURCE_KEY,
  DECLARED_CREDENTIAL_VARIABLE,
  DECLARED_MODEL_VARIABLE,
  PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
} from "../fixtures/harness/spawn-env";

const codes = new Set(ERROR_TABLE.map((entry) => entry.code));

describe("TC-HARN-013 credential resolution", () => {
  test("the resolved material is the use-time value, never a construction-time capture", () => {
    const credentials = createFakeCredentialPort("synthetic-credential-material-1");
    const first = buildHarnessSpawnEnvironment({
      descriptor: SPAWN_ENV_DESCRIPTOR,
      parentEnvironment: PARENT_ENVIRONMENT,
      credentials: credentials.port,
    });
    credentials.setMaterial("synthetic-credential-material-2");
    const second = buildHarnessSpawnEnvironment({
      descriptor: SPAWN_ENV_DESCRIPTOR,
      parentEnvironment: PARENT_ENVIRONMENT,
      credentials: credentials.port,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value[DECLARED_CREDENTIAL_VARIABLE]).toBe("synthetic-credential-material-1");
    expect(second.value[DECLARED_CREDENTIAL_VARIABLE]).toBe("synthetic-credential-material-2");
    expect(credentials.calls).toEqual([
      { referenceName: CREDENTIAL_REFERENCE.referenceName },
      { referenceName: CREDENTIAL_REFERENCE.referenceName },
    ]);
  });

  test("the credential source key is absent and the value appears only under the declared name", () => {
    const built = buildHarnessSpawnEnvironment({
      descriptor: SPAWN_ENV_DESCRIPTOR,
      parentEnvironment: PARENT_ENVIRONMENT,
      credentials: createFakeCredentialPort().port,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.hasOwn(built.value, DECLARED_CREDENTIAL_SOURCE_KEY)).toBe(false);
    expect(built.value[DECLARED_CREDENTIAL_VARIABLE]).toBe("synthetic-credential-material-1");
    expect(built.value[DECLARED_CREDENTIAL_VARIABLE]).not.toBe(CANARY_CREDENTIAL_SOURCE);
    expect(built.value[DECLARED_CREDENTIAL_VARIABLE]).not.toBe(CANARY_DECOY_CREDENTIAL);
  });

  test("an unresolvable reference fails closed and names the reference", () => {
    const credentials = createFakeCredentialPort();
    credentials.setFailure();
    const built = buildHarnessSpawnEnvironment({
      descriptor: SPAWN_ENV_DESCRIPTOR,
      parentEnvironment: PARENT_ENVIRONMENT,
      credentials: credentials.port,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error.code).toBe("config.credential.missing");
    expect(built.error.reference).toBe(CREDENTIAL_REFERENCE.referenceName);
    expect(built.error.summary ?? "").toContain(CREDENTIAL_REFERENCE.referenceName);
    expect(codes.has(built.error.code)).toBe(true);
    expect(canonicalHarnessJson(built.error)).not.toContain(CANARY_CREDENTIAL_SOURCE);
    expect(canonicalHarnessJson(built.error)).not.toContain("synthetic-credential-material");
  });

  test("a missing declared non-credential variable fails closed and names it", () => {
    const parent: Record<string, string> = { ...PARENT_ENVIRONMENT };
    delete parent[DECLARED_MODEL_VARIABLE];
    const built = buildHarnessSpawnEnvironment({
      descriptor: SPAWN_ENV_DESCRIPTOR,
      parentEnvironment: parent,
      credentials: createFakeCredentialPort().port,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error.code).toBe("harness.spawn.variable-missing");
    expect(built.error.field).toBe(DECLARED_MODEL_VARIABLE);
    expect(built.error.summary ?? "").toContain(DECLARED_MODEL_VARIABLE);
    expect(codes.has(built.error.code)).toBe(true);
  });
});

describe("TC-HARN-013 session-port observation (Phase 3 completing half)", () => {
  test("credentials resolve at spawn time through the port and enter only the spawn env", async () => {
    const { createOpencodeSession } = await import("../../packages/adapters/src/harness/index");
    const {
      createRecordingRunner,
      runnerResult,
      SPAWN_ARGS,
      HARNESS_COMMAND,
      streamStarterFromRunner,
      TIMEOUT_MS,
    } = await import("../fixtures/harness/harness-io");
    const credentials = createFakeCredentialPort("synthetic-credential-material-1");
    credentials.setMaterial("synthetic-credential-material-2");
    const recording = createRecordingRunner(() =>
      runnerResult(
        JSON.stringify({ session: { id: "ses_cred_1" }, result: { completion: "complete" } }),
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
      prompt: "prompt",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(spawned.ok).toBe(true);
    expect(credentials.calls).toEqual([{ referenceName: CREDENTIAL_REFERENCE.referenceName }]);
    const observed = recording.invocations[0]?.options.env ?? {};
    expect(observed[DECLARED_CREDENTIAL_VARIABLE]).toBe("synthetic-credential-material-2");
    expect(Object.hasOwn(observed, DECLARED_CREDENTIAL_SOURCE_KEY)).toBe(false);
  });

  test("an unresolvable reference refuses the spawn with zero runner invocations", async () => {
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
    credentials.setFailure();
    const recording = createRecordingRunner(() => runnerResult(""));
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
      classify: () => ({ outcome: "failed", token: "failed", derivationClass: "verify" }),
      assembleLiveness: () => ({ readings: [] }),
      now: () => "2026-11-06T00:00:00Z",
      timeoutMs: TIMEOUT_MS,
      spawnArgs: SPAWN_ARGS,
    });
    const spawned = await port.spawn({
      workItemRef: "GH-233",
      prompt: "prompt",
      descriptor: SPAWN_ENV_DESCRIPTOR,
    });
    expect(spawned.ok).toBe(false);
    if (spawned.ok) return;
    expect(spawned.error.code).toBe("config.credential.missing");
    expect(spawned.error.reference).toBe(CREDENTIAL_REFERENCE.referenceName);
    expect(recording.invocations).toHaveLength(0);
  });
});
