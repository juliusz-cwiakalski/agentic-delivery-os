/**
 * TC-SLA-004, TC-SLA-005, and the TC-SLA-024 behaviour half — escalation
 * boundary precision from contract data, stickiness until resolve, visibility
 * only, and identical evaluation for both audiences.
 */
import { describe, expect, test } from "bun:test";
import {
  OWNER_GATE_SLA_AUDIENCES,
  type OwnerGateFact,
  type OwnerGateSlaInput,
} from "../../packages/core/src/contracts/index";
import { evaluateOwnerGateSla } from "../../packages/core/src/domain/owner-gate-sla";
import {
  asPolicy,
  BOARD_NOW_ISO,
  BOARD_NOW_MS,
  clonePolicy,
  gateFact,
  HOUR_MS,
  ownerReviewGate,
  shippedPolicy,
  waiverGate,
} from "../fixtures/board/matrix";

const evaluate = (
  gates: readonly OwnerGateFact[],
  overrides: Partial<OwnerGateSlaInput> = {},
): ReturnType<typeof evaluateOwnerGateSla> =>
  evaluateOwnerGateSla({
    audience: "owner",
    nowMs: BOARD_NOW_MS,
    nowIso: BOARD_NOW_ISO,
    policy: shippedPolicy(),
    gates,
    decisions: [],
    ...overrides,
  });

describe("TC-SLA-004 24 h escalation boundary and stickiness", () => {
  test("T-1 ms is fresh, exactly T is escalated under >=, and T+1 ms is escalated", () => {
    const justBefore = evaluate([ownerReviewGate("GH-201", 24 * HOUR_MS - 1)]).gates[0];
    const at = evaluate([ownerReviewGate("GH-202", 24 * HOUR_MS)]).gates[0];
    const after = evaluate([ownerReviewGate("GH-203", 24 * HOUR_MS + 1)]).gates[0];
    expect(justBefore?.slaState).toBe("fresh");
    expect(at?.slaState).toBe("escalated");
    expect(after?.slaState).toBe("escalated");
  });

  test("a 25 h gate stays escalated on every later evaluation", () => {
    const gate = ownerReviewGate("GH-204", 25 * HOUR_MS);
    for (const nowMs of [
      BOARD_NOW_MS,
      BOARD_NOW_MS + HOUR_MS,
      BOARD_NOW_MS + 23 * HOUR_MS,
      BOARD_NOW_MS + 10 * 24 * HOUR_MS,
    ]) {
      expect(evaluate([gate], { nowMs }).gates[0]?.slaState).toBe("escalated");
    }
  });

  test("escalation is visibility only: zero decisions and no state mutation surface", () => {
    const result = evaluate([ownerReviewGate("GH-205", 48 * HOUR_MS)]);
    expect(result.decisionsToApply).toEqual([]);
    expect(result.gates[0]?.default).toBeNull();
  });

  test("resolving the gate (label removed or item closed) removes it from the population", () => {
    expect(evaluate([]).gates).toEqual([]);
    expect(evaluate([], { gates: [] }).gates).toEqual([]);
  });

  test("escalation is derived, not a persisted flag: a new gate id at 1 h starts fresh", () => {
    expect(evaluate([ownerReviewGate("GH-206", HOUR_MS)]).gates[0]?.slaState).toBe("fresh");
  });

  test("re-adding the original old activity returns the gate to escalated", () => {
    const old = ownerReviewGate("GH-207", 30 * HOUR_MS);
    expect(evaluate([old]).gates[0]?.slaState).toBe("escalated");
    expect(evaluate([old]).gates[0]?.slaState).toBe("escalated");
  });

  test("the boundary reads contract data: a 25 h threshold makes 24 h fresh", () => {
    const policy = clonePolicy();
    policy.escalationThresholdMs = 25 * HOUR_MS;
    expect(
      evaluate([ownerReviewGate("GH-208", 24 * HOUR_MS)], { policy: asPolicy(policy) }).gates[0]
        ?.slaState,
    ).toBe("fresh");
  });
});

describe("TC-SLA-005 exact 24 h and 72 h boundary precision", () => {
  test("the comparator reads contract data and exactly-T follows >=", () => {
    expect(evaluate([ownerReviewGate("GH-209", 24 * HOUR_MS - 1)]).gates[0]?.slaState).toBe(
      "fresh",
    );
    expect(evaluate([ownerReviewGate("GH-210", 24 * HOUR_MS)]).gates[0]?.slaState).toBe(
      "escalated",
    );
  });

  test("a defaultable waiver gate applies at exactly 72 h and one record is proposed", () => {
    const before = evaluate([waiverGate("GH-211", 72 * HOUR_MS - 1)]).gates[0];
    const at = evaluate([waiverGate("GH-212", 72 * HOUR_MS)]);
    const after = evaluate([waiverGate("GH-213", 72 * HOUR_MS + 1)]);
    expect(before?.slaState).toBe("escalated");
    expect(before?.default).toBeNull();
    expect(at.gates[0]?.slaState).toBe("default-applied");
    expect(at.gates[0]?.default).toBe("owner-review-first");
    expect(at.decisionsToApply).toHaveLength(1);
    expect(after.gates[0]?.slaState).toBe("default-applied");
    expect(after.decisionsToApply).toHaveLength(1);
  });

  test("an owner-review gate at exactly 72 h and beyond stays escalated with no record", () => {
    for (const age of [72 * HOUR_MS, 72 * HOUR_MS + 1, 7 * 24 * HOUR_MS]) {
      const result = evaluate([ownerReviewGate("GH-214", age)]);
      expect(result.gates[0]?.slaState).toBe("escalated");
      expect(result.gates[0]?.default).toBeNull();
      expect(result.decisionsToApply).toEqual([]);
    }
  });

  test("a > comparator in a temp copy inverts the exactly-T expectations", () => {
    const strict = clonePolicy();
    strict.comparator = ">";
    const at24 = evaluate([ownerReviewGate("GH-215", 24 * HOUR_MS)], {
      policy: asPolicy(strict),
    });
    const after24 = evaluate([ownerReviewGate("GH-216", 24 * HOUR_MS + 1)], {
      policy: asPolicy(strict),
    });
    expect(at24.gates[0]?.slaState).toBe("fresh");
    expect(after24.gates[0]?.slaState).toBe("escalated");

    const at72 = evaluate([waiverGate("GH-217", 72 * HOUR_MS)], {
      policy: asPolicy(strict),
    });
    const after72 = evaluate([waiverGate("GH-218", 72 * HOUR_MS + 1)], {
      policy: asPolicy(strict),
    });
    expect(at72.gates[0]?.slaState).toBe("escalated");
    expect(at72.decisionsToApply).toEqual([]);
    expect(after72.gates[0]?.slaState).toBe("default-applied");
  });

  test("changing thresholds in a temp copy moves the boundary", () => {
    const shifted = clonePolicy();
    shifted.escalationThresholdMs = 25 * HOUR_MS;
    shifted.expiryThresholdMs = 73 * HOUR_MS;
    expect(
      evaluate([ownerReviewGate("GH-219", 24 * HOUR_MS)], { policy: asPolicy(shifted) }).gates[0]
        ?.slaState,
    ).toBe("fresh");
    expect(
      evaluate([waiverGate("GH-220", 72 * HOUR_MS)], { policy: asPolicy(shifted) })
        .decisionsToApply,
    ).toEqual([]);
    expect(
      evaluate([waiverGate("GH-221", 73 * HOUR_MS)], { policy: asPolicy(shifted) }).gates[0]
        ?.slaState,
    ).toBe("default-applied");
  });

  test("a single invocation after a large clock jump produces the terminal state", () => {
    const gate = waiverGate("GH-222", 0);
    const result = evaluate([gate], { nowMs: BOARD_NOW_MS + 73 * HOUR_MS });
    expect(result.gates[0]?.slaState).toBe("default-applied");
  });
});

describe("TC-SLA-024 audience seam behaviour parity", () => {
  test("the declared audience vocabulary is exactly owner and coordinator", () => {
    expect([...OWNER_GATE_SLA_AUDIENCES]).toEqual(["owner", "coordinator"]);
  });

  test("identical facts evaluate identically under both audiences and echo the audience", () => {
    const gates = [
      ownerReviewGate("GH-230", 26 * HOUR_MS),
      waiverGate("GH-231", 73 * HOUR_MS),
      gateFact({ id: "GH-232", absent: "missing" }),
    ];
    const owner = evaluate(gates, { audience: "owner" });
    const coordinator = evaluate(gates, { audience: "coordinator" });
    expect(coordinator.audience).toBe("coordinator");
    expect(owner.audience).toBe("owner");
    const withoutAudience = (result: typeof owner) => ({ ...result, audience: "same" });
    expect(withoutAudience(coordinator)).toEqual(withoutAudience(owner));
  });
});
