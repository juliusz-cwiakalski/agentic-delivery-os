/**
 * TC-SMAP-006 — every configuration-document state is classified fail-closed at
 * the handler seam, and no state yields an unearned pass.
 *
 * The injected `readSuiteMap` carries each state's classification. A recording
 * runtime proves the refusal precedes every gates source read; the two
 * undeclared states are byte-identical to the no-map path.
 */
import { describe, expect, test } from "bun:test";
import type { VerifyGatesCommandRuntime } from "../../packages/cli/src/commands/verify-gates";
import { resolveVerifySuiteMap } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  clone,
  EXPECTED_JOBS,
  run as pipelineRun,
} from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, gatesRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import {
  countedRead,
  DEFECTS,
  declaredRead,
  invalidRead,
  REFERENCE_JOB,
  REFERENCE_SUITES,
  undeclaredRead,
  validEqualityMap,
} from "../fixtures/verify-gates/suite-map/cases";

const REF = "GH-300";

type Recording = {
  readonly runtime: VerifyGatesCommandRuntime;
  readonly calls: string[];
};

const recordingRuntime = (
  suiteMap: VerifyGatesCommandRuntime["readSuiteMap"],
  facts = greenFacts(),
  recordedMapRead: string[] = [],
): Recording => {
  const calls: string[] = [];
  const base = gatesRuntime({ facts });
  const wrap =
    <Args extends readonly unknown[], Result>(name: string, call: (...args: Args) => Result) =>
    (...args: Args): Result => {
      calls.push(name);
      return call(...args);
    };
  return {
    calls: recordedMapRead,
    runtime: {
      ...base,
      readLifecycle: wrap("readLifecycle", base.readLifecycle),
      readRepository: wrap("readRepository", base.readRepository),
      readWorkflow: wrap("readWorkflow", base.readWorkflow),
      readOpenPullRequests: wrap("readOpenPullRequests", base.readOpenPullRequests),
      readDeliveryRequestDetail: wrap("readDeliveryRequestDetail", base.readDeliveryRequestDetail),
      readCheckRuns: wrap("readCheckRuns", base.readCheckRuns),
      readWorkItem: wrap("readWorkItem", base.readWorkItem),
      ...(suiteMap === undefined
        ? {}
        : {
            readSuiteMap: () => {
              recordedMapRead.push("readSuiteMap");
              return suiteMap();
            },
          }),
    },
  };
};

const greenFacts = () => {
  const facts = clone(baseFacts());
  const names = [...EXPECTED_JOBS, REFERENCE_JOB];
  facts.workflow = { outcome: "read", names };
  facts.checkRuns = {
    ok: true,
    value: {
      items: names.map((name) => pipelineRun(name, "succeeded")),
      pageItemCount: names.length,
    },
  };
  return facts;
};

const runSeam = async (
  read: VerifyGatesCommandRuntime["readSuiteMap"] | undefined,
  facts = greenFacts(),
) => {
  const recording = recordingRuntime(read, facts);
  const result = await runVerify(
    { ...combinedRuntime({ facts }), gates: recording.runtime },
    ["gates", REF],
    {},
  );
  return { result, calls: recording.calls };
};

describe("TC-SMAP-006 the two undeclared states are the parity path", () => {
  test("an absent document yields the delivered path with no breadth fact", async () => {
    const control = await runVerify(combinedRuntime({ facts: greenFacts() }), ["gates", REF], {});
    const absent = await runSeam(undefined);
    expect(absent.result.exitCode).toBe(control.exitCode);
    expect(absent.result.envelope?.error).toBeUndefined();
    expect(JSON.stringify(absent.result.envelope?.data)).toBe(
      JSON.stringify(control.envelope?.data),
    );
  });

  test("a parsed document without the map node is undeclared, not a refusal", async () => {
    const absent = await runSeam(undefined);
    const noNode = await runSeam(undeclaredRead);
    expect(noNode.result.exitCode).toBe(absent.result.exitCode);
    expect(noNode.result.envelope?.error).toBeUndefined();
    expect(noNode.result.envelope?.data).toEqual(absent.result.envelope?.data);
  });
});

describe("TC-SMAP-006 unusable documents and selection failures refuse before any read", () => {
  test("a selection naming a missing or unreadable path is never parity", async () => {
    for (const detail of ["selected-config-missing", "selected-config-unreadable"]) {
      const { result, calls } = await runSeam(() => invalidRead(detail));
      expect(result.exitCode).toBe(1);
      expect(result.envelope?.data).toBeUndefined();
      expect(result.envelope?.error?.code).toBe("config.value.invalid");
      expect(result.envelope?.error?.category).toBe("user");
      expect(result.envelope?.error?.retryable).toBe(false);
      expect(result.envelope?.error?.consequence).toBe("not_landed");
      expect(result.envelope?.detail).toBeUndefined();
      expect(calls).toEqual(["readSuiteMap"]);
    }
  });

  test("an unreadable or unparseable document refuses with the table prose and no cause line", async () => {
    for (const detail of ["unreadable", "unparseable"]) {
      const { result, calls } = await runSeam(() => invalidRead(detail));
      const error = result.envelope?.error;
      expect(error?.summary).toBe("A configuration value is invalid.");
      expect(String(error?.remediationHint).length).toBeGreaterThan(0);
      expect(result.stderr).not.toContain("cause:");
      expect(calls).toEqual(["readSuiteMap"]);
    }
  });

  test("a defective node refuses through the map's own resolver", async () => {
    for (const [name, raw] of Object.entries(DEFECTS)) {
      const read = () => resolveVerifySuiteMap(raw);
      const { result, calls } = await runSeam(read);
      expect(result.exitCode, name).toBe(1);
      expect(result.envelope?.error?.code, name).toBe("config.value.invalid");
      expect(calls, name).toEqual(["readSuiteMap"]);
    }
  });

  test("a schema defect outside the node leaves the declaration honoured", async () => {
    const document = {
      provider: { unknownKey: true },
      merge: "defective",
      verify: { "suite-map": validEqualityMap() },
    };
    const read = () => resolveVerifySuiteMap(document.verify["suite-map"]);
    const { result } = await runSeam(read);
    expect(result.exitCode).toBe(0);
    const data = result.envelope?.data as Record<string, unknown>;
    expect(data.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(data.mirrorsJob).toBe("job-01");
  });
});

describe("TC-SMAP-006 totality, disjointness, and determinism", () => {
  test("no state is both a parity path and a refusal", async () => {
    const parity = await runSeam(undeclaredRead);
    const refusal = await runSeam(() => invalidRead("unreadable"));
    expect(parity.result.envelope?.error).toBeUndefined();
    expect(refusal.result.envelope?.error).toBeDefined();
    expect(parity.result.envelope?.data).toBeDefined();
    expect(refusal.result.envelope?.data).toBeUndefined();
  });

  test("exactly one resolution attempt per invocation in every state", async () => {
    const counted = countedRead(declaredRead(validEqualityMap())());
    const { result } = await runSeam(counted.read);
    expect(result.exitCode).toBe(0);
    expect(counted.calls).toEqual(["readSuiteMap"]);
  });

  test("every state is identical across two runs", async () => {
    for (const read of [undeclaredRead, () => invalidRead("unreadable")]) {
      const first = await runSeam(read);
      const second = await runSeam(read);
      expect(second.result.stdout).toBe(first.result.stdout);
      expect(second.result.stderr).toBe(first.result.stderr);
      expect(second.result.exitCode).toBe(first.result.exitCode);
    }
  });
});
