/**
 * TC-HARNESS-012 — a declared record value beats a conflicting ambient parent
 * value, and the paired control keeps the declared parent value (AC-F3-2).
 *
 * Exercised on the surface that consumes variables: the deny-by-default
 * environment builder. The opencode adapter's binding is an argument, not a
 * variable, so this is the variable-consuming double's contract.
 */
import { describe, expect, test } from "bun:test";
import type {
  CredentialPort,
  HarnessExecutionEnvironmentDescriptor,
} from "../../packages/core/src/contracts/index";
import { buildHarnessSpawnEnvironment } from "../../packages/core/src/domain/index";
import { AMBIENT_CANARIES, DECLARED_SEAT_VARIABLE } from "../fixtures/harness/profile";

const credentials: CredentialPort = {
  resolve: () => {
    throw new Error("no credential is declared in this fixture");
  },
};

const descriptor = (): HarnessExecutionEnvironmentDescriptor => ({
  kind: "host",
  workDirectory: "/synthetic/work",
  environment: [{ kind: "variable", name: DECLARED_SEAT_VARIABLE }],
});

const RESOLVED_MODEL = "synthetic/model-resolved";

describe("TC-HARNESS-012 record precedence", () => {
  test("the resolved record value wins over a conflicting ambient parent value", () => {
    const built = buildHarnessSpawnEnvironment({
      descriptor: descriptor(),
      parentEnvironment: { [DECLARED_SEAT_VARIABLE]: AMBIENT_CANARIES.conflictingModel },
      credentials,
      record: {
        [DECLARED_SEAT_VARIABLE]: RESOLVED_MODEL,
        [AMBIENT_CANARIES.undeclaredRecordName]: AMBIENT_CANARIES.undeclaredModel,
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value[DECLARED_SEAT_VARIABLE]).toBe(RESOLVED_MODEL);
    // The ambient conflicting value appears nowhere in the built environment.
    expect(JSON.stringify(built.value)).not.toContain(AMBIENT_CANARIES.conflictingModel);
    // The undeclared record name added nothing.
    expect(Object.keys(built.value)).toEqual([DECLARED_SEAT_VARIABLE]);
    expect(JSON.stringify(built.value)).not.toContain(AMBIENT_CANARIES.undeclaredModel);
  });

  test("the paired control uses the declared parent value when the record omits the name", () => {
    const built = buildHarnessSpawnEnvironment({
      descriptor: descriptor(),
      parentEnvironment: { [DECLARED_SEAT_VARIABLE]: AMBIENT_CANARIES.conflictingModel },
      credentials,
      record: { [AMBIENT_CANARIES.undeclaredRecordName]: AMBIENT_CANARIES.undeclaredModel },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value[DECLARED_SEAT_VARIABLE]).toBe(AMBIENT_CANARIES.conflictingModel);
    expect(Object.keys(built.value)).toEqual([DECLARED_SEAT_VARIABLE]);
  });
});
