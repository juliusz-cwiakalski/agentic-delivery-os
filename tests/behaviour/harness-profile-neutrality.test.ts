/**
 * TC-HARNESS-013 — undeclared record names change nothing, no ambient value is
 * forwarded, and the allowlist is never widened (AC-F3-3, NG-10, RSK-6).
 *
 * The variable-consuming surface is asserted here; the opencode invocation's
 * environment half is completed in the propagation suite (TC-HARNESS-011), where
 * the binding reaches argv and adds no environment key at all.
 */
import { describe, expect, test } from "bun:test";
import type {
  CredentialPort,
  HarnessExecutionEnvironmentDescriptor,
} from "../../packages/core/src/contracts/index";
import {
  bindingEnvironmentRecords,
  bindingInvocationArgs,
  buildHarnessSpawnEnvironment,
} from "../../packages/core/src/domain/index";
import {
  AMBIENT_CANARIES,
  DECLARED_SEAT_VARIABLE,
  THREE_SEAT_PROFILE,
  THREE_SEAT_SELECTION,
} from "../fixtures/harness/profile";

const credentials: CredentialPort = {
  resolve: () => {
    throw new Error("fixture declares no credential entry");
  },
};

const descriptor = (): HarnessExecutionEnvironmentDescriptor => ({
  kind: "host",
  workDirectory: "/synthetic/work",
  environment: [{ kind: "variable", name: DECLARED_SEAT_VARIABLE }],
});

describe("TC-HARNESS-013 undeclared names and ambient forwarding", () => {
  test("the built environment is exactly the declared allowlist set", () => {
    const parent = {
      [DECLARED_SEAT_VARIABLE]: "parent-value",
      [AMBIENT_CANARIES.undeclaredRecordName]: AMBIENT_CANARIES.undeclaredModel,
      UNRELATED_AMBIENT_CANARY: AMBIENT_CANARIES.conflictingModel,
    };
    const declared = descriptor().environment.map((entry) => entry.name);
    const built = buildHarnessSpawnEnvironment({
      descriptor: descriptor(),
      parentEnvironment: parent,
      credentials,
      record: {
        [DECLARED_SEAT_VARIABLE]: "synthetic/model-resolved",
        [AMBIENT_CANARIES.undeclaredRecordName]: AMBIENT_CANARIES.undeclaredModel,
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(Object.keys(built.value).sort()).toEqual([...declared].sort());
    for (const canary of [AMBIENT_CANARIES.undeclaredModel, AMBIENT_CANARIES.conflictingModel]) {
      expect(JSON.stringify(built.value)).not.toContain(canary);
    }
    // The allowlist itself is unchanged.
    expect(descriptor().environment).toHaveLength(declared.length);
  });

  test("the binding's environment records name only a declared envName, if any", () => {
    // The three-seat profile declares one explicit envName.
    expect(
      bindingEnvironmentRecords({
        agent: "coder",
        seat: "seat-judgment",
        resolvedModel: "zai/glm-5#judgment",
      }),
    ).toEqual({});
    expect(
      bindingEnvironmentRecords({
        agent: "coder",
        seat: "seat-judgment",
        resolvedModel: "zai/glm-5#judgment",
        envName: DECLARED_SEAT_VARIABLE,
      }),
    ).toEqual({ [DECLARED_SEAT_VARIABLE]: "zai/glm-5#judgment" });
    // The variable-consuming extension carries no invented OC_* family.
    const records = bindingEnvironmentRecords({
      agent: "writer",
      seat: "seat-execution",
      resolvedModel: "deepseek/deepseek-flash",
    });
    expect(Object.keys(records)).toEqual([]);
    expect(JSON.stringify(records)).not.toContain("OC_");
  });

  test("the honoured surface carries the binding as argv and adds no environment entry", () => {
    expect(THREE_SEAT_PROFILE.seats["seat-judgment"]).toBeDefined();
    expect(THREE_SEAT_SELECTION.seatModels["seat-judgment"]).toBe("zai/glm-5#judgment");
    const args = bindingInvocationArgs({
      agent: "coder",
      seat: "seat-judgment",
      resolvedModel: "zai/glm-5#judgment",
    });
    expect(args).toEqual(["--agent", "coder", "--model", "zai/glm-5#judgment"]);
    expect(args.filter((value) => value === "--agent")).toHaveLength(1);
    expect(args.filter((value) => value === "--model")).toHaveLength(1);
  });
});

const UNRELATED_AMBIENT_CANARY = "UNRELATED_AMBIENT_CANARY";
