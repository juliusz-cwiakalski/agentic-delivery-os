/**
 * TC-ECON-041 — a within-budget uneconomical re-entry is refused with a reason.
 * The refusal is a recorded decision, not a destructive act: no restart event,
 * no count change, unchanged session identity; the economical control proceeds.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { parseRefusalCorpus } from "../../packages/core/src/domain/index";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  seedRestarts,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";

const runtimes: EconomicsRuntime[] = [];
afterEach(() => {
  for (const created of runtimes.splice(0)) created.close();
});

const input = (repayTokens: number, observed: number, sessionId = "ses_fixture_1") => ({
  workItemRef: "GH-235",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence({
    sessionId,
    treeRoot: `${sessionId}-root`,
    repayTokens: { inputTokens: repayTokens, outputTokens: 0 },
    observedUniqueProgressTokens: observed,
  }),
});

describe("TC-ECON-041 a within-budget uneconomical re-entry is refused with a reason", () => {
  test("the refusal carries the identity, exit 1, and a parsed numeric re-pay corpus", () => {
    const created = createEconomicsRuntime({
      bound: 3,
      label: "uneconomical",
      capability: { modes: ["prompt-reentry"] },
    });
    runtimes.push(created);
    seedRestarts(created.store, 1);
    const decision = created.supervised.attempt(input(900, 100));
    expect(decision.outcome).toBe("refuse");
    if (decision.outcome !== "refuse") return;
    expect(decision.code).toBe("dispatch.resume-uneconomical");
    expect(decision.exitCode).toBe(1);
    const corpus = parseRefusalCorpus(decision.corpus);
    expect(Object.keys(corpus)).toEqual(["reason", "repayTokens", "economicsRef"]);
    expect(corpus.reason).toBe("dispatch.resume-uneconomical");
    expect(Number(corpus.repayTokens)).toBe(900);
    expect(Number.isFinite(Number(corpus.repayTokens))).toBe(true);
    expect(corpus.economicsRef).toBe("economics/GH-235");
  });

  test("zero spawns, zero re-entry invocations, and no restart event appended", () => {
    const created = createEconomicsRuntime({
      bound: 3,
      label: "uneconomical-noevent",
      capability: { modes: ["prompt-reentry"] },
    });
    runtimes.push(created);
    seedRestarts(created.store, 1);
    const before = created.view("GH-235");
    created.supervised.attempt(input(900, 100));
    const after = created.view("GH-235");
    expect(created.execution.counters.spawns).toBe(0);
    expect(created.execution.counters.restarts).toBe(0);
    expect(after.restarts).toBe(before.restarts);
    expect(after.restartHistory.map((entry) => entry.ordinal)).toEqual([1]);
  });

  test("the refusal leaves the session identity and existing records unchanged", () => {
    const created = createEconomicsRuntime({
      bound: 3,
      label: "uneconomical-records",
      capability: { modes: ["prompt-reentry"] },
    });
    runtimes.push(created);
    seedRestarts(created.store, 1);
    const before = created.read("GH-235");
    const decision = created.supervised.attempt(input(900, 100, "ses_fixture_unchanged"));
    expect(decision.outcome).toBe("refuse");
    const after = created.read("GH-235");
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(JSON.stringify(after.restarts)).toBe(JSON.stringify(before.restarts));
    expect(after.terminal).toBeUndefined();
  });

  test("the identical-but-economical control proceeds and records exactly one restart event", () => {
    const created = createEconomicsRuntime({
      bound: 3,
      label: "uneconomical-control",
      capability: { modes: ["prompt-reentry"] },
    });
    runtimes.push(created);
    seedRestarts(created.store, 1);
    const decision = created.supervised.attempt(input(100, 400));
    expect(decision.outcome).toBe("admit-restart");
    if (decision.outcome !== "admit-restart") return;
    expect(decision.record.ordinal).toBe(2);
    const after = created.view("GH-235");
    expect(after.restarts).toBe(2);
  });
});
