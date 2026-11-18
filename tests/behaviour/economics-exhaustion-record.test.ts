/**
 * TC-ECON-054 — the terminal state is escalation-ready data, not silence. The
 * record carries the declared consumer-field contract, resolves to the same
 * full history reference as the refusal corpus, contains no content canaries,
 * and nothing in the change requeues or re-enters automatically.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
  ECONOMICS_EXHAUSTION_OPTIONS,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
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

const input = () => ({
  workItemRef: "GH-235",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence(),
});

const exhausted = (): EconomicsRuntime => {
  const created = createEconomicsRuntime({ bound: 3, label: "terminal" });
  runtimes.push(created);
  seedRestarts(created.store, 3);
  created.supervised.attempt(input());
  return created;
};

describe("TC-ECON-054 the terminal state is escalation-ready data", () => {
  test("the terminal record carries the declared consumer-field contract", () => {
    const created = exhausted();
    const read = created.read("GH-235");
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const terminal = read.terminal;
    expect(terminal).toBeDefined();
    if (terminal === undefined) return;
    expect(terminal.terminal).toBe(true);
    expect(terminal.workItemRef).toBe("GH-235");
    expect(terminal.runId.length).toBeGreaterThan(0);
    expect(terminal.reason).toBe("dispatch.restart-budget-exceeded");
    expect(terminal.restarts).toBe(3);
    expect(terminal.historyRef).toBe("economics/GH-235");
    expect(terminal.options).toEqual([...ECONOMICS_EXHAUSTION_OPTIONS]);
    expect(terminal.recordedAt.length).toBeGreaterThan(0);
    expect(Object.keys(terminal).sort()).toEqual(
      [
        "historyRef",
        "options",
        "reason",
        "recordedAt",
        "restarts",
        "runId",
        "schemaId",
        "terminal",
        "workItemRef",
      ].sort(),
    );
  });

  test("the record reference is the same resolvable reference the refusal corpus carries", () => {
    const created = exhausted();
    const decision = created.supervised.attempt(input());
    if (decision.outcome !== "refuse") throw new Error("expected refusal");
    const corpus = parseRefusalCorpus(decision.corpus);
    const read = created.read("GH-235");
    if (!read.ok) throw new Error("expected read");
    expect(corpus.historyRef).toBe(read.terminal?.historyRef);
    expect(read.restarts.map((record) => record.ordinal)).toEqual([1, 2, 3]);
  });

  test("no prompt text, transcript, or credential material is present", () => {
    const created = createEconomicsRuntime({ bound: 3, label: "terminal-canary" });
    runtimes.push(created);
    seedRestarts(created.store, 3, { sessionId: "ses_fixture_PROMPT_CANARY" });
    created.supervised.attempt(input());
    const read = created.read("GH-235");
    if (!read.ok) throw new Error("expected read");
    const serialized = JSON.stringify(read.terminal);
    expect(serialized).not.toContain("PROMPT");
    expect(serialized).not.toContain("transcript");
    expect(serialized).not.toContain("credential");
    expect(serialized).not.toContain("token=");
  });

  test("a post-exhaustion replay re-reads state with zero spawns and no queue mutation", () => {
    const created = exhausted();
    const before = created.read("GH-235");
    created.supervised.attempt(input());
    created.oneShot.attempt(input());
    created.read("GH-235");
    const after = created.read("GH-235");
    expect(after.ok && before.ok).toBe(true);
    if (!after.ok || !before.ok) return;
    expect(after.restarts).toHaveLength(3);
    expect(after.terminal?.restarts).toBe(before.terminal?.restarts);
    expect(created.execution.counters.spawns).toBe(0);
    expect(created.execution.counters.queueMutations).toBe(0);
    expect(created.execution.counters.supervisions).toBe(0);
  });

  test("no requeue or retry instruction is written for the exhausted delivery", () => {
    const created = exhausted();
    const read = created.read("GH-235");
    if (!read.ok) throw new Error("expected read");
    expect(read.terminal?.options).toEqual(["requeue-fresh-budget", "park-owner-review"]);
    for (const [key, value] of Object.entries(read.terminal ?? {})) {
      if (key === "options") continue;
      expect(JSON.stringify(value).toLowerCase()).not.toContain("requeue");
      expect(JSON.stringify(value).toLowerCase()).not.toContain("retry");
    }
  });

  test("the record is additive: no schema bump and existing kinds remain readable", () => {
    const created = exhausted();
    expect(STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    const records = created.store.readRecords();
    expect(records.ok).toBe(true);
    if (!records.ok) return;
    expect(
      records.value.records.every((record) => record.schemaVersion === "delivery.state.v1"),
    ).toBe(true);
    expect(records.value.records.some((record) => record.kind === "economics.restart")).toBe(true);
    expect(
      records.value.records.some((record) => record.kind === "economics.budget-exhaustion"),
    ).toBe(true);
  });
});
