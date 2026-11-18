/**
 * TC-HARNESS-043 — the union attribution across every recorded dispatch attempt
 * (DM-8, AC-F5-5).
 *
 * Attempt A holds S1 and its child with its own binding, attempt B holds S2 with
 * its own binding, and a third attempt holds no identity. Capture projects the
 * union once, each row set cites its own attempt's binding, and the identity-less
 * attempt is counted rather than inferred.
 */
import { describe, expect, test } from "bun:test";
import { appendDispatchAttempt } from "../../packages/core/src/app/dispatch-ledger";
import { resolveSessionAttribution } from "../../packages/cli/src/edge";
import { createDispatchState } from "../fixtures/dispatch/harness";
import { buildAttempts, eligibleSpecs } from "../fixtures/dispatch/evidence-windows";
import { ROOT_BINDING, TWO_ATTEMPT, extractOpencode } from "../fixtures/harness/telemetry-attempts";
import { buildTwoAttemptStore } from "../fixtures/harness/telemetry-attempts";
import {
  CHILD_SESSION,
  OTHER_SESSION,
  ROOT_SESSION,
} from "../fixtures/harness/opencode-store/build";

const seededAttempts = (workItemRef: string) => {
  const state = createDispatchState("gh335-attribution");
  const base = buildAttempts(eligibleSpecs()).slice(0, 3);
  const records = base.map((attempt, index) => ({
    ...attempt,
    ref: workItemRef,
    ...(index === 0
      ? { sessionIds: [ROOT_SESSION, CHILD_SESSION], binding: ROOT_BINDING }
      : index === 1
        ? {
            sessionIds: [OTHER_SESSION],
            binding: TWO_ATTEMPT.bindings[OTHER_SESSION],
          }
        : {}),
  }));
  for (const record of records) {
    expect(appendDispatchAttempt(state.store, state.fenceToken, record).ok).toBe(true);
  }
  return state;
};

describe("TC-HARNESS-043 the union across recorded attempts", () => {
  test("the union is every attempt's held identities, sorted, once each", () => {
    const state = seededAttempts("GH-335");
    const attribution = resolveSessionAttribution(state.store, "GH-335");
    expect([...attribution.heldSessionIds]).toEqual(
      [ROOT_SESSION, CHILD_SESSION, OTHER_SESSION].sort(),
    );
    expect(attribution.unattributedAttempts).toBe(1);
    // A binding attaches to every identity of the attempt that recorded it, and
    // to no other attempt's identities.
    expect(Object.keys(attribution.bindings).sort()).toEqual(
      [ROOT_SESSION, CHILD_SESSION, OTHER_SESSION].sort(),
    );
    expect(attribution.bindings[CHILD_SESSION]).toEqual(ROOT_BINDING);
  });

  test("each row set cites its own attempt's binding and no binding crosses", () => {
    const store = buildTwoAttemptStore();
    const captured = extractOpencode({
      store,
      heldSessionIds: TWO_ATTEMPT.heldSessionIds,
      bindings: TWO_ATTEMPT.bindings,
      unattributedAttempts: TWO_ATTEMPT.unattributedAttempts,
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok) return;
    const root = captured.value.records.find((row) => row.sessionId === ROOT_SESSION);
    expect(root?.seat).toBe(ROOT_BINDING.seat);
    expect(root?.resolvedModel).toBe(ROOT_BINDING.resolvedModel);
    const other = captured.value.records.find((row) => row.sessionId === OTHER_SESSION);
    expect(other?.seat).toBe("seat-review");
    expect(other?.resolvedModel).toBe("synthetic/other-model");
    // A's binding never attaches to B's identities.
    expect(other?.seat).not.toBe(ROOT_BINDING.seat);
    expect(captured.value.unattributedAttempts).toBe(1);
  });

  test("a work item whose attempts hold nothing has an empty union", () => {
    const state = createDispatchState("gh335-empty-union");
    const attribution = resolveSessionAttribution(state.store, "GH-335");
    expect(attribution.heldSessionIds).toEqual([]);
    expect(attribution.unattributedAttempts).toBe(0);
  });

  test("another work item's attempts contribute nothing", () => {
    const state = seededAttempts("GH-999");
    const attribution = resolveSessionAttribution(state.store, "GH-335");
    expect(attribution.heldSessionIds).toEqual([]);
  });
});
