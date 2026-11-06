/**
 * TC-SLA-002 and TC-SLA-003 — aging derives only from the injected activity
 * timestamp, and unknown age is declared distinctly, never fresh or defaulted.
 */
import { describe, expect, test } from "bun:test";
import type { OwnerGateFact, OwnerGateSlaInput } from "../../packages/core/src/contracts/index";
import { evaluateOwnerGateSla } from "../../packages/core/src/domain/owner-gate-sla";
import {
  BOARD_NOW_ISO,
  BOARD_NOW_MS,
  DAY_MS,
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

describe("TC-SLA-002 aging from the provider-native activity timestamp", () => {
  test("a 10 h owner-review gate is fresh with truthful arithmetic and no default", () => {
    const gate = ownerReviewGate("GH-101", 10 * HOUR_MS);
    const result = evaluate([gate]);
    expect(result.gates).toHaveLength(1);
    const record = result.gates[0];
    expect(record?.age).toBe(10 * HOUR_MS);
    expect(record?.slaState).toBe("fresh");
    expect(record?.default).toBeNull();
    expect(record?.waivedBy).toBeNull();
    expect(record?.ageUnknownReason).toBeUndefined();
    expect(result.decisionsToApply).toEqual([]);
  });

  test("a real zero age is distinguished from unknown age", () => {
    const record = evaluate([ownerReviewGate("GH-102", 0)]).gates[0];
    expect(record?.age).toBe(0);
    expect(record?.age).not.toBeNull();
    expect(record?.slaState).toBe("fresh");
  });

  test("a future timestamp is arithmetic, fresh, and never defaulted", () => {
    const record = evaluate([waiverGate("GH-103", -2 * HOUR_MS)]).gates[0];
    expect(record?.age).toBe(-2 * HOUR_MS);
    expect(record?.slaState).toBe("fresh");
    expect(record?.ageUnknownReason).toBeUndefined();
    expect(record?.default).toBeNull();
  });

  test("unrelated fact fields and order cannot change the age", () => {
    const first = gateFact({
      id: "GH-104:owner-review",
      ref: "GH-104",
      ageMs: 10 * HOUR_MS,
    });
    const second = gateFact({
      id: "GH-104:owner-review",
      ref: "GH-104",
      ageMs: 10 * HOUR_MS,
      waivedBy: "owner",
    });
    expect(evaluate([first]).gates[0]?.age).toBe(10 * HOUR_MS);
    expect(evaluate([second]).gates[0]?.age).toBe(10 * HOUR_MS);
    expect(evaluate([second, first]).gates.map((gate) => gate.age)).toEqual([
      10 * HOUR_MS,
      10 * HOUR_MS,
    ]);
  });

  test("advancing the injected clock increases the age and keeps a 10 h gate fresh", () => {
    const gate = ownerReviewGate("GH-105", 10 * HOUR_MS);
    const later = evaluate([gate], { nowMs: BOARD_NOW_MS + HOUR_MS });
    expect(later.gates[0]?.age).toBe(11 * HOUR_MS);
    expect(later.gates[0]?.slaState).toBe("fresh");
  });

  test("control: fresh requires observed evidence", () => {
    const record = evaluate([gateFact({ id: "GH-106", absent: "missing" })]).gates[0];
    expect(record?.age).toBeNull();
    expect(record?.slaState).toBe("escalated");
    expect(record?.ageUnknownReason).toBe("activity-timestamp-absent");
  });
});

describe("TC-SLA-003 unknown age is declared, never fresh, zero, or defaulted", () => {
  const absentForms = ["missing", "undefined", "null", "empty", "whitespace"] as const;

  test("every absent form is age null with the absent marker and escalated", () => {
    for (const absent of absentForms) {
      const record = evaluate([gateFact({ id: `GH-${absent}`, kind: "waiver", absent })]).gates[0];
      expect(record?.age, absent).toBeNull();
      expect(record?.ageUnknownReason, absent).toBe("activity-timestamp-absent");
      expect(record?.slaState, absent).toBe("escalated");
      expect(record?.default, absent).toBeNull();
    }
  });

  test("every unparseable form is age null with the unparseable marker and escalated", () => {
    for (const value of ["not-a-date", "2026-13-45T99:99:99Z", "yesterday"]) {
      const record = evaluate([gateFact({ id: `GH-${value}`, kind: "waiver", activityAt: value })])
        .gates[0];
      expect(record?.age, value).toBeNull();
      expect(record?.ageUnknownReason, value).toBe("activity-timestamp-unparseable");
      expect(record?.slaState, value).toBe("escalated");
    }
  });

  test("the two markers stay distinct side by side", () => {
    const result = evaluate([
      gateFact({ id: "GH-absent", absent: "missing" }),
      gateFact({ id: "GH-unparseable", activityAt: "not-a-date" }),
    ]);
    const markers = result.gates.map((gate) => gate.ageUnknownReason).sort();
    expect(markers).toEqual(["activity-timestamp-absent", "activity-timestamp-unparseable"]);
  });

  test("unknown age is never fresh, zero, or silently dropped", () => {
    const result = evaluate([
      gateFact({ id: "GH-unknown", absent: "missing" }),
      ownerReviewGate("GH-fresh", HOUR_MS),
    ]);
    const unknown = result.gates.find((gate) => gate.id === "GH-unknown");
    expect(unknown?.slaState).toBe("escalated");
    expect(unknown?.age).toBeNull();
    expect(result.gates.map((gate) => gate.id)).toContain("GH-unknown");
  });

  test("unknown-age waiver gates are never default-applied even after months", () => {
    for (const advance of [DAY_MS, 30 * DAY_MS, 365 * DAY_MS]) {
      const result = evaluate(
        [gateFact({ id: "GH-unknown-waiver", kind: "waiver", absent: "missing" })],
        { nowMs: BOARD_NOW_MS + advance },
      );
      expect(result.gates[0]?.slaState).toBe("escalated");
      expect(result.gates[0]?.default).toBeNull();
      expect(result.decisionsToApply).toEqual([]);
    }
  });

  test("unknown age is ranked with the escalated class ahead of a fresh gate", () => {
    const result = evaluate([
      ownerReviewGate("GH-fresh", HOUR_MS),
      gateFact({ id: "GH-unknown", absent: "missing" }),
    ]);
    expect(result.gates[0]?.id).toBe("GH-unknown");
    expect(result.gates[0]?.slaState).toBe("escalated");
  });

  test("a valid-timestamp twin is fresh and a valid old waiver twin is default-applied", () => {
    expect(evaluate([waiverGate("GH-valid-fresh", 10 * HOUR_MS)]).gates[0]?.slaState).toBe("fresh");
    expect(evaluate([waiverGate("GH-valid-old", 73 * HOUR_MS)]).gates[0]?.slaState).toBe(
      "default-applied",
    );
  });
});
