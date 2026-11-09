/**
 * TC-COORD-012 / TC-COORD-013 (golden half) — the tick and status `data` and
 * human text are deterministic for identical injected facts.
 *
 * The expected payloads are inline snapshots so this suite needs no golden
 * directory; phase 8 adds the committed fixture set.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness, dataOf } from "../fixtures/coordinator/harness";

const normalize = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe("TC-COORD-012/013 coordinator goldens are deterministic", () => {
  test("a fresh status renders the declared shape byte-identically twice", async () => {
    const harness = createCoordinatorHarness({ label: "golden-status" });
    const first = await harness.run(["coordinator", "status", "--json"]);
    const second = await harness.run(["coordinator", "status", "--json"]);
    expect(normalize(dataOf(first))).toEqual(normalize(dataOf(second)));
    expect(normalize(dataOf(first))).toEqual({
      schemaVersion: "delivery.coordinator.v1",
      coordinatorId: "coordinator-main",
      instance: null,
      regime: {
        scope: "state-dir",
        stateDirectory: harness.root,
        unitIdentity: `coordinator@${harness.root}#coordinator-main`,
        processKind: "coordinator",
        budgetStore: "coordinator-restart",
        supervisorMode: "foreground",
        externalUnit: "absent",
        daemonInstallSeam: "M1-S18",
      },
      session: {
        sessionId: "session-1",
        liveness: "absent",
        contextTokens: 10_000,
        harnessKind: "opencode",
      },
      decision: null,
      restarts: {
        count: 0,
        bound: 10,
        budgetEpochId: "epoch-1",
        historyRef: "coordinator/coordinator-main",
        terminal: false,
      },
      stuck: null,
      tickVerdict: null,
      wake: null,
      escalation: { state: "not-exhausted", questionId: null },
      fence: null,
      live: null,
      degradation: [],
    });
  });

  test("a quiet tick golden carries the lease pair and a progressing verdict", async () => {
    const harness = createCoordinatorHarness({
      label: "golden-tick",
      session: { liveness: "alive" },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    const data = dataOf(result);
    expect(data.tickVerdict).toEqual({
      verdict: "progressing",
      phase: null,
      reason: null,
      evidence: null,
    });
    expect(data.fence?.action).toBe("released");
    expect(data.instance).toBeNull();
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.fences).toHaveLength(2);
  });

  test("the human text is byte-identical across two identical runs", async () => {
    const harness = createCoordinatorHarness({ label: "golden-text" });
    const first = await harness.run(["coordinator", "status"]);
    const second = await harness.run(["coordinator", "status"]);
    expect(first.stdout).toBe(second.stdout);
    expect(first.stdout).not.toContain("\u001b[");
  });
});
