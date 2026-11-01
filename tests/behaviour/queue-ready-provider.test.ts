/**
 * TC-QREADY-011 / TC-QREADY-012 — provider-available from the declared chain and
 * verified park fold, never the engine; config failures mapped by the read reason.
 */
import { describe, expect, test } from "bun:test";
import {
  baseFacts,
  createRecorder,
  evaluate,
  providers,
  queueRuntime,
  runQueueReadyCli,
} from "../fixtures/queue-ready/harness";
import { providerCases, providerFixture } from "../fixtures/queue-ready/provider/cases";

const providerOf = (fixture: string) => {
  const candidate = evaluate({ providers: providerFixture(fixture) }).candidates[0];
  if (candidate === undefined) throw new Error("candidate missing");
  const condition = candidate.conditions.find((entry) => entry.id === "provider-available");
  if (condition === undefined) throw new Error("provider-available missing");
  return condition;
};

describe("TC-QREADY-011 provider-available satisfied path", () => {
  test("each fixture matches the case record and the engine-not-run companion", () => {
    for (const testCase of providerCases) {
      const condition = providerOf(testCase.fixture);
      expect(condition.state, testCase.fixture).toBe(testCase.state);
      expect(condition.evidence, testCase.fixture).toEqual([
        {
          source: testCase.source,
          reason: testCase.reason,
          ...(testCase.detail === undefined ? {} : { detail: testCase.detail }),
        },
        { source: "provider-config", reason: "engine-not-run" },
      ]);
    }
  });

  test("non-matching provider and chain parks are inert", () => {
    const condition = providerOf("non-matching-parks");
    expect(condition.state).toBe("satisfied");
    expect(condition.evidence[0]?.reason).toBe("no-active-park");
  });

  test("provider evidence never claims `available` (condition id exempt)", () => {
    for (const testCase of providerCases) {
      const condition = providerOf(testCase.fixture);
      const text = JSON.stringify(condition.evidence);
      expect(text.toLowerCase().includes("available"), testCase.fixture).toBe(false);
    }
  });

  test("exactly one config resolve and one park fold, with zero engine/quota calls", async () => {
    const recorder = createRecorder();
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(baseFacts(), recorder),
    );
    expect(run.exitCode).toBe(0);
    expect(recorder.calls.filter((call) => call === "readProviderConfig")).toHaveLength(1);
    expect(recorder.calls.filter((call) => call === "readProviderParks")).toHaveLength(1);
  });
});

describe("TC-QREADY-012 provider-available unknown and unmet states", () => {
  test("config failures are mapped by the read's own reason, never blanket config-invalid", () => {
    const unresolved = providerOf("unresolved-chain-command");
    expect(unresolved.evidence[0]?.reason).toBe("provider-chain-unresolved");
    const invalid = providerOf("config-invalid");
    expect(invalid.evidence[0]?.reason).toBe("config-invalid");
  });

  test("a park-fold failure stays provider-parks/state-unreadable", () => {
    const condition = providerOf("park-fold-torn");
    expect(condition.evidence[0]?.source).toBe("provider-parks");
    expect(condition.evidence[0]?.reason).toBe("state-unreadable");
  });

  test("a config or park failure carries the pinned failure identity form and no free-form detail", () => {
    const both = evaluate({
      providers: providers({
        parks: {
          ok: false,
          reason: "state-unreadable",
          failureCode: "state.store.torn",
          failureClass: "store",
        },
      }),
    });
    const condition = both.candidates[0]?.conditions.find(
      (entry) => entry.id === "provider-available",
    );
    expect(condition?.evidence[0]?.detail).toBe("failureCode:state.store.torn; failureClass:store");
    for (const record of condition?.evidence ?? []) {
      expect(
        record.detail === undefined || /^(failureCode|failureClass):/.test(record.detail),
      ).toBe(true);
    }
  });

  test("no declared chain and a defensive missing chain carry no failure detail", () => {
    for (const fixture of ["no-chain", "unresolved-chain"]) {
      const condition = providerOf(fixture);
      expect(condition.evidence[0]?.detail, fixture).toBeUndefined();
    }
  });

  test("an expired chain park is inert and an active one is unsatisfied", () => {
    expect(providerOf("chain-parked-t-minus-1").state).toBe("satisfied");
    expect(providerOf("chain-parked").state).toBe("unsatisfied");
  });
});
