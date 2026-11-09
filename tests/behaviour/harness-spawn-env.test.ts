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
  CANARY_AMBIENT_MODEL,
  CANARY_AMBIENT_SMALL_MODEL,
  CANARY_CREDENTIAL_SOURCE,
  CANARY_DECOY_CREDENTIAL,
  CANARY_DECOY_MODEL,
  CANARY_HOME,
  CANARY_PATH_ALT,
  CANARY_UNDECLARED_TOKEN,
  createFakeCredentialPort,
  DECLARED_CREDENTIAL_VARIABLE,
  DECLARED_HOME_VARIABLE,
  DECLARED_MODEL_VARIABLE,
  DECLARED_PATH_VARIABLE,
  DECLARED_SMALL_MODEL_VARIABLE,
  DECLARED_TMPDIR_VARIABLE,
  DECLARED_VARIABLES,
  DECLARED_WORK_PATH_VARIABLE,
  PARENT_ENVIRONMENT,
  REPAIRED_DEFAULT_DESCRIPTOR,
  REPAIRED_DEFAULT_PARENT_ENVIRONMENT,
  SPAWN_ENV_DESCRIPTOR,
  UNDECLARED_VARIABLES,
  WORK_DIRECTORY,
} from "../fixtures/harness/spawn-env";

const CANARIES = [
  CANARY_UNDECLARED_TOKEN,
  CANARY_HOME,
  CANARY_PATH_ALT,
  CANARY_AMBIENT_MODEL,
  CANARY_AMBIENT_SMALL_MODEL,
  CANARY_DECOY_MODEL,
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

const buildRepaired = (
  parent: Readonly<Record<string, string | undefined>> = REPAIRED_DEFAULT_PARENT_ENVIRONMENT,
) =>
  buildHarnessSpawnEnvironment({
    descriptor: REPAIRED_DEFAULT_DESCRIPTOR,
    parentEnvironment: parent,
    credentials: createFakeCredentialPort().port,
    record: { [DECLARED_WORK_PATH_VARIABLE]: WORK_DIRECTORY },
  });

describe("TC-HDA-012 deny-by-default over the repaired default (builder half)", () => {
  test("the child set is the declared and present set; ambient and OC_ADOS_* stay absent", () => {
    const built = buildRepaired();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.value).sort()).toEqual(
      [DECLARED_PATH_VARIABLE, DECLARED_HOME_VARIABLE, DECLARED_WORK_PATH_VARIABLE].sort(),
    );
    expect(Object.hasOwn(built.value, DECLARED_TMPDIR_VARIABLE)).toBe(false);
    for (const key of UNDECLARED_VARIABLES) expect(Object.hasOwn(built.value, key)).toBe(false);
    const serialized = `${canonicalHarnessJson(built.value)} ${JSON.stringify(built.value)}`;
    for (const canary of CANARIES) expect(serialized).not.toContain(canary);
  });

  test("construction is deterministic across two builds", () => {
    const first = buildRepaired();
    const second = buildRepaired();
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(canonicalHarnessJson(first.value)).toBe(canonicalHarnessJson(second.value));
  });
});

describe("TC-HDA-013 zero-configuration parent without model variables", () => {
  test("the repaired default builds with both model variables unset", () => {
    const built = buildRepaired();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value[DECLARED_PATH_VARIABLE]).toBe(
      REPAIRED_DEFAULT_PARENT_ENVIRONMENT[DECLARED_PATH_VARIABLE],
    );
    expect(built.value[DECLARED_HOME_VARIABLE]).toBe(
      REPAIRED_DEFAULT_PARENT_ENVIRONMENT[DECLARED_HOME_VARIABLE],
    );
    expect(Object.hasOwn(built.value, DECLARED_MODEL_VARIABLE)).toBe(false);
    expect(Object.hasOwn(built.value, DECLARED_SMALL_MODEL_VARIABLE)).toBe(false);
  });

  test("the pre-change descriptor still fails on HARNESS_MODEL, proving the repair", () => {
    const legacy = buildHarnessSpawnEnvironment({
      descriptor: {
        kind: "host",
        workDirectory: WORK_DIRECTORY,
        environment: [
          { kind: "variable", name: DECLARED_MODEL_VARIABLE },
          { kind: "variable", name: DECLARED_SMALL_MODEL_VARIABLE },
          { kind: "variable", name: DECLARED_WORK_PATH_VARIABLE },
        ],
      },
      parentEnvironment: REPAIRED_DEFAULT_PARENT_ENVIRONMENT,
      credentials: createFakeCredentialPort().port,
      record: { [DECLARED_WORK_PATH_VARIABLE]: WORK_DIRECTORY },
    });
    expect(legacy.ok).toBe(false);
    if (!legacy.ok) {
      expect(legacy.error.code).toBe("harness.spawn.variable-missing");
      expect(legacy.error.field).toBe(DECLARED_MODEL_VARIABLE);
    }
  });
});

describe("TC-HDA-014 absent required entries fail closed and spawn no child", () => {
  for (const missing of [
    DECLARED_HOME_VARIABLE,
    DECLARED_PATH_VARIABLE,
    DECLARED_WORK_PATH_VARIABLE,
  ]) {
    test(`a missing ${missing} names the field with no partial environment`, () => {
      const parent: Record<string, string> = { ...REPAIRED_DEFAULT_PARENT_ENVIRONMENT };
      delete parent[missing];
      const record =
        missing === DECLARED_WORK_PATH_VARIABLE
          ? {}
          : { [DECLARED_WORK_PATH_VARIABLE]: WORK_DIRECTORY };
      const built = buildHarnessSpawnEnvironment({
        descriptor: REPAIRED_DEFAULT_DESCRIPTOR,
        parentEnvironment: parent,
        credentials: createFakeCredentialPort().port,
        record,
      });
      expect(built.ok).toBe(false);
      if (built.ok) return;
      expect(built.error.code).toBe("harness.spawn.variable-missing");
      expect(built.error.field).toBe(missing);
      expect(built.error.summary ?? "").toContain(missing);
      expect(canonicalHarnessJson(built.error)).not.toContain("synthetic/home");
      const codes = [
        "harness.spawn.variable-missing",
        "harness.spawn.refused",
        "harness.spawn.invalid-output",
      ];
      expect(codes).toContain(built.error.code);
    });
  }

  test("the session port starts zero child processes when a required entry is absent", async () => {
    const { createOpencodeSession } = await import("../../packages/adapters/src/harness/index");
    const {
      createRecordingRunner,
      runnerResult,
      SPAWN_ARGS,
      HARNESS_COMMAND,
      streamStarterFromRunner,
      TIMEOUT_MS,
    } = await import("../fixtures/harness/harness-io");
    const parent: Record<string, string> = { ...REPAIRED_DEFAULT_PARENT_ENVIRONMENT };
    delete parent[DECLARED_HOME_VARIABLE];
    const recording = createRecordingRunner(() => runnerResult(""));
    const port = createOpencodeSession({
      command: HARNESS_COMMAND,
      runner: recording.runner,
      starter: streamStarterFromRunner(recording.runner),
      buildEnvironment: (descriptor) =>
        buildHarnessSpawnEnvironment({
          descriptor,
          parentEnvironment: parent,
          credentials: createFakeCredentialPort().port,
          record: { [DECLARED_WORK_PATH_VARIABLE]: WORK_DIRECTORY },
        }),
      classify: () => ({ outcome: "failed", token: "failed", derivationClass: "verify" }),
      assembleLiveness: () => ({ readings: [] }),
      now: () => "2026-11-09T00:00:00Z",
      timeoutMs: TIMEOUT_MS,
      spawnArgs: SPAWN_ARGS,
    });
    const spawned = await port.spawn({
      workItemRef: "GH-277",
      prompt: "synthetic prompt",
      descriptor: REPAIRED_DEFAULT_DESCRIPTOR,
    });
    expect(spawned.ok).toBe(false);
    if (!spawned.ok) {
      expect(spawned.error.code).toBe("harness.spawn.variable-missing");
      expect(spawned.error.field).toBe(DECLARED_HOME_VARIABLE);
    }
    expect(recording.invocations).toHaveLength(0);
  });
});

describe("TC-HDA-015 absent optional entry is omitted", () => {
  test("an absent TMPDIR builds successfully and is not substituted", () => {
    const built = buildRepaired();
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.hasOwn(built.value, DECLARED_TMPDIR_VARIABLE)).toBe(false);
    expect(built.value[DECLARED_TMPDIR_VARIABLE]).toBeUndefined();
    for (const required of [
      DECLARED_PATH_VARIABLE,
      DECLARED_HOME_VARIABLE,
      DECLARED_WORK_PATH_VARIABLE,
    ]) {
      expect(Object.hasOwn(built.value, required)).toBe(true);
    }
  });

  test("removing the marker makes the same absence fail closed", () => {
    const built = buildHarnessSpawnEnvironment({
      descriptor: {
        ...REPAIRED_DEFAULT_DESCRIPTOR,
        environment: REPAIRED_DEFAULT_DESCRIPTOR.environment.map((entry) =>
          entry.kind === "variable" && entry.name === DECLARED_TMPDIR_VARIABLE
            ? { kind: "variable" as const, name: entry.name }
            : entry,
        ),
      },
      parentEnvironment: REPAIRED_DEFAULT_PARENT_ENVIRONMENT,
      credentials: createFakeCredentialPort().port,
      record: { [DECLARED_WORK_PATH_VARIABLE]: WORK_DIRECTORY },
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe("harness.spawn.variable-missing");
      expect(built.error.field).toBe(DECLARED_TMPDIR_VARIABLE);
    }
  });
});

describe("TC-HDA-016 present optional entry is forwarded", () => {
  test("a present TMPDIR is forwarded with its value and the record still wins", () => {
    const present = buildRepaired({
      ...REPAIRED_DEFAULT_PARENT_ENVIRONMENT,
      [DECLARED_TMPDIR_VARIABLE]: "/synthetic/tmp",
    });
    expect(present.ok).toBe(true);
    if (present.ok) expect(present.value[DECLARED_TMPDIR_VARIABLE]).toBe("/synthetic/tmp");

    const recordWins = buildHarnessSpawnEnvironment({
      descriptor: REPAIRED_DEFAULT_DESCRIPTOR,
      parentEnvironment: {
        ...REPAIRED_DEFAULT_PARENT_ENVIRONMENT,
        [DECLARED_TMPDIR_VARIABLE]: "/synthetic/tmp",
      },
      credentials: createFakeCredentialPort().port,
      record: {
        [DECLARED_WORK_PATH_VARIABLE]: WORK_DIRECTORY,
        [DECLARED_TMPDIR_VARIABLE]: "/synthetic/record-tmp",
      },
    });
    expect(recordWins.ok).toBe(true);
    if (recordWins.ok) {
      expect(recordWins.value[DECLARED_TMPDIR_VARIABLE]).toBe("/synthetic/record-tmp");
    }
  });
});

describe("TC-HDA-017 record value precedence", () => {
  test("record values win and an undeclared record name is inert", () => {
    const built = buildHarnessSpawnEnvironment({
      descriptor: REPAIRED_DEFAULT_DESCRIPTOR,
      parentEnvironment: REPAIRED_DEFAULT_PARENT_ENVIRONMENT,
      credentials: createFakeCredentialPort().port,
      record: {
        [DECLARED_PATH_VARIABLE]: "/record/bin",
        [DECLARED_WORK_PATH_VARIABLE]: "/record/work",
        SYNTHETIC_RECORD_EXTRA: "record-extra",
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value[DECLARED_PATH_VARIABLE]).toBe("/record/bin");
    expect(built.value[DECLARED_WORK_PATH_VARIABLE]).toBe("/record/work");
    expect(Object.hasOwn(built.value, "SYNTHETIC_RECORD_EXTRA")).toBe(false);

    const again = buildHarnessSpawnEnvironment({
      descriptor: REPAIRED_DEFAULT_DESCRIPTOR,
      parentEnvironment: REPAIRED_DEFAULT_PARENT_ENVIRONMENT,
      credentials: createFakeCredentialPort().port,
      record: {
        [DECLARED_PATH_VARIABLE]: "/record/bin",
        [DECLARED_WORK_PATH_VARIABLE]: "/record/work",
        SYNTHETIC_RECORD_EXTRA: "record-extra",
      },
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(canonicalHarnessJson(again.value)).toBe(canonicalHarnessJson(built.value));
  });
});
