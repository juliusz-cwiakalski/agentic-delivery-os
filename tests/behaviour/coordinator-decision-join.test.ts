/**
 * TC-COORD-020 — a live session records `join-live` and consumes no ordinal.
 */
import { describe, expect, test } from "bun:test";
import { decideLifecycle, lifecycleEffect } from "../../packages/core/src/domain/index";
import { createCoordinatorHarness } from "../fixtures/coordinator/harness";
import { CONTEXT_LIMIT, LIFECYCLE_CASES } from "../fixtures/coordinator/lifecycle";
import { createRecordingProcessPort } from "../fixtures/coordinator/process-port";

describe("TC-COORD-020 a live session joins and consumes no ordinal", () => {
  const liveCase = LIFECYCLE_CASES.find((entry) => entry.id === "live-session-joins");
  if (liveCase === undefined) throw new Error("missing live fixture");

  test("the decision is join-live with no ordinal and an attach effect", () => {
    const decision = decideLifecycle(liveCase.facts);
    expect(decision.kind).toBe("join-live");
    expect(decision.consumesOrdinal).toBe(0);
    expect(lifecycleEffect(decision)).toBe("attach");
    expect(liveCase.facts.contextLimit).toBe(CONTEXT_LIMIT);
  });

  test("an integrated tick records join-live, consumes no ordinal, and attaches nothing", async () => {
    const harness = createCoordinatorHarness({
      label: "decision-join-integrated",
      session: { liveness: "alive", sessionId: "session-live" },
      alive: { 4242: true },
    });
    const result = await harness.run(["coordinator", "tick", "--json"]);
    expect(result.code).toBe(0);
    const read = harness.records();
    if (!read.ok) throw new Error("read failed");
    expect(read.iterations).toHaveLength(1);
    expect(read.iterations[0]?.decision).toBe("join-live");
    expect(read.iterations[0]?.reason).toBe("live-session");
    expect(read.restarts).toHaveLength(0);
    expect(harness.counters.spawns).toBe(0);
    expect(harness.counters.resumes).toBe(0);
    expect(harness.counters.joins).toBe(0);
    expect(harness.process.signals).toHaveLength(0);
    // The recording process port stays untouched by the pure decision.
    const recorder = createRecordingProcessPort();
    expect(recorder.calls.spawn).toBe(0);
    expect(recorder.calls.signal).toBe(0);
  });
});
