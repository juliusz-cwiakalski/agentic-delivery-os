/**
 * TC-ECON-040 — attach-and-continue resumes without re-paying prefill. The
 * declared capability persists the session identity and tree root, consumes no
 * ordinal, and invokes no execution; the control without the capability takes
 * the re-entry path instead.
 */
import { afterEach, describe, expect, test } from "bun:test";
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

const input = (sessionId = "ses_fixture_1") => ({
  workItemRef: "GH-235",
  runId: "run-attach",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence({ sessionId, treeRoot: `${sessionId}-root` }),
});

describe("TC-ECON-040 attach-and-continue resumes without re-paying prefill", () => {
  test("the declared capability persists identity, consumes no ordinal, and records no re-pay", () => {
    const created = createEconomicsRuntime({
      bound: 3,
      label: "attach",
      capability: { modes: ["attach-continue"] },
    });
    runtimes.push(created);
    seedRestarts(created.store, 1);
    const before = created.view("GH-235");
    const decision = created.supervised.attempt(input());
    expect(decision.outcome).toBe("attach-continue");
    if (decision.outcome !== "attach-continue") return;
    expect(decision.sessionId).toBe("ses_fixture_1");
    expect(decision.treeRoot).toBe("ses_fixture_1-root");
    expect(decision.ordinalConsumed).toBe(false);
    expect(decision.evidence).toContain("attach-and-continue");
    expect(decision.evidence).toContain("prefill not re-paid");
    const after = created.view("GH-235");
    expect(after.restarts).toBe(before.restarts);
    expect(after.restartHistory.map((entry, index) => entry.ordinal)).toEqual(
      before.restartHistory.map((entry) => entry.ordinal),
    );
    expect(created.execution.counters.spawns).toBe(0);
    expect(created.execution.counters.restarts).toBe(0);
  });

  test("no restart event is appended for an attach-continue resume", () => {
    const created = createEconomicsRuntime({
      bound: 3,
      label: "attach-noevent",
      capability: { modes: ["attach-continue"] },
    });
    runtimes.push(created);
    const before = created.store.readRecords();
    created.supervised.attempt(input());
    const after = created.store.readRecords();
    expect(before.ok && after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(after.value.records.length).toBe(before.value.records.length);
    expect(created.read("GH-235").ok).toBe(true);
  });

  test("the control without the capability takes the re-entry path", () => {
    const created = createEconomicsRuntime({
      bound: 3,
      label: "attach-control",
      capability: { modes: ["prompt-reentry"] },
    });
    runtimes.push(created);
    const decision = created.supervised.attempt(
      input("ses_fixture_2"),
    );
    expect(decision.outcome).not.toBe("attach-continue");
    expect(decision.outcome).toBe("admit-restart");
    if (decision.outcome !== "admit-restart") return;
    expect(decision.record.ordinal).toBe(1);
  });
});
