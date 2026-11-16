/**
 * TC-ACTION-006..008 — the derived aging ladder: exact boundaries on the one
 * pinned basis (time open since the recorded filing timestamp), the second-miss
 * rule, and zero ambient clock reads (AC-F3-1, DM-2, NFR-3, DEC-3, DEC-9).
 */
import { describe, expect, test } from "bun:test";
import {
  ACTION_AGING_BASIS,
  ACTION_AGING_DAY_MS,
  ACTION_AGING_ESCALATE_DAYS,
  ACTION_AGING_NUDGE_DAYS,
} from "../../packages/core/src/contracts/index";
import { actionOpenDays, evaluateActionAging } from "../../packages/core/src/domain/action-aging";
import { actionRecord, closureRecord, conformingDraft } from "../fixtures/action/builders";
import {
  AGING_DAY_PLAN,
  clockAtDaysOpen,
  DAY_MS,
  FILING_ISO,
  FILING_MS,
  ONE_LAPSE,
  TWO_LAPSES,
} from "../fixtures/action/clock";
import { actionSnapshot, appendClosure, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const agingDraft = (overrides = {}) => conformingDraft({ dueDateLapses: [], ...overrides });

const openAction = (overrides = {}) =>
  actionRecord(
    { dueDateLapses: [], ...overrides },
    { actionId: "action-aging", filedAt: FILING_MS },
  );

describe("TC-ACTION-006 the boundary ladder is exact", () => {
  const expected: ReadonlyArray<readonly [number, string]> = [
    [0, "current"],
    [13, "current"],
    [14, "nudged"],
    [15, "nudged"],
    [29, "nudged"],
    [30, "escalated"],
    [31, "escalated"],
  ];

  test("each declared day offset renders the declared state", () => {
    const record = openAction();
    for (const [days, state] of expected) {
      const aging = evaluateActionAging(record, clockAtDaysOpen(days));
      expect(aging.state, `day ${String(days)}`).toBe(state);
      expect(aging.basis).toBe(ACTION_AGING_BASIS);
      expect(aging.openDays).toBe(days);
    }
    expect(AGING_DAY_PLAN).toEqual(expected.map(([days]) => days));
  });

  test("threshold-1 and threshold differ at both thresholds", () => {
    const record = openAction();
    expect(evaluateActionAging(record, clockAtDaysOpen(ACTION_AGING_NUDGE_DAYS - 1)).state).toBe(
      "current",
    );
    expect(evaluateActionAging(record, clockAtDaysOpen(ACTION_AGING_NUDGE_DAYS)).state).toBe(
      "nudged",
    );
    expect(evaluateActionAging(record, clockAtDaysOpen(ACTION_AGING_ESCALATE_DAYS - 1)).state).toBe(
      "nudged",
    );
    expect(evaluateActionAging(record, clockAtDaysOpen(ACTION_AGING_ESCALATE_DAYS)).state).toBe(
      "escalated",
    );
  });

  test("moving a due date without adding a lapse event changes no days-based state", () => {
    const late = openAction({ dueDate: "2026-12-31T00:00:00Z" });
    const early = openAction({ dueDate: "2026-10-02T00:00:00Z" });
    for (const days of [0, 13, 14, 29, 30]) {
      expect(evaluateActionAging(late, clockAtDaysOpen(days)).state).toBe(
        evaluateActionAging(early, clockAtDaysOpen(days)).state,
      );
    }
  });

  test("evaluating twice at one instant is identical and performs no write", () => {
    const fixture = makeActionStore("aging-purity");
    try {
      expect(fileAction(fixture.store, agingDraft({ window: "window-a" })).ok).toBe(true);
      const before = actionSnapshot(fixture.store);
      const record = before.actions[0];
      if (record === undefined) throw new Error("expected one recorded action");
      const first = evaluateActionAging(record, clockAtDaysOpen(20));
      const second = evaluateActionAging(record, clockAtDaysOpen(20));
      expect(second).toEqual(first);
      expect(actionSnapshot(fixture.store)).toEqual(before);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-007 the second missed due date escalates", () => {
  test("one lapse follows the days-based state; two lapses escalate at five days open", () => {
    const oneLapse = openAction({ dueDateLapses: ONE_LAPSE });
    const twoLapses = openAction({ dueDateLapses: TWO_LAPSES });
    expect(evaluateActionAging(oneLapse, clockAtDaysOpen(5)).state).toBe("current");
    const escalated = evaluateActionAging(twoLapses, clockAtDaysOpen(5));
    expect(escalated.state).toBe("escalated");
    expect(escalated.escalationReason).toBe("second-miss");
  });

  test("escalation from the second miss holds at every age", () => {
    const twoLapses = openAction({ dueDateLapses: TWO_LAPSES });
    for (const days of [0, 5, 40]) {
      const aging = evaluateActionAging(twoLapses, clockAtDaysOpen(days));
      expect(aging.state, `day ${String(days)}`).toBe("escalated");
      expect(aging.escalationReason).toBe("second-miss");
    }
  });
});

describe("TC-ACTION-008 one aging basis, recorded dates only", () => {
  test("the basis is the recorded filing timestamp and the straddling fixture picks one state", () => {
    const record = actionRecord(
      { dueDate: "2026-10-05T00:00:00Z" },
      { actionId: "action-straddle", filedAt: FILING_MS },
    );
    // The due date is 4 days after filing; at 14 days open a due-date basis
    // would read 10 days past due (current) while the pinned basis reads 14.
    const aging = evaluateActionAging(record, clockAtDaysOpen(14));
    expect(aging.basis).toBe(ACTION_AGING_BASIS);
    expect(aging.openDays).toBe(14);
    expect(aging.state).toBe("nudged");
  });

  test("the basis field is the recorded filing instant and the clock can rewind", () => {
    const record = openAction();
    expect(actionOpenDays(record, FILING_MS)).toBe(0);
    expect(actionOpenDays(record, FILING_MS - DAY_MS)).toBe(0);
    const later = evaluateActionAging(record, clockAtDaysOpen(20));
    const rewound = evaluateActionAging(record, FILING_MS - DAY_MS);
    expect(later.state).toBe("nudged");
    expect(rewound.state).toBe("current");
    expect(rewound.ageMs).toBeLessThan(0);
  });

  test("every action carries both recorded dates (filing instant and due date)", () => {
    const record = openAction();
    expect(record.filedAt).toBe(Date.parse(FILING_ISO));
    expect(record.dueDate).toBe("2026-10-15T00:00:00Z");
    expect(ACTION_AGING_DAY_MS).toBe(DAY_MS);
  });
});

describe("closure records do not move the aging projection", () => {
  test("a closed action keeps the same age and state at one instant", () => {
    const fixture = makeActionStore("aging-after-close");
    try {
      expect(
        fileAction(fixture.store, agingDraft({ window: "window-a" }), { actionId: "action-1" }).ok,
      ).toBe(true);
      expect(
        appendClosure(
          fixture.store,
          closureRecord({ closureId: "closure-1", actionId: "action-1" }),
        ).ok,
      ).toBe(true);
      const record = actionSnapshot(fixture.store).actions[0];
      if (record === undefined) throw new Error("expected one recorded action");
      expect(evaluateActionAging(record, clockAtDaysOpen(20)).state).toBe("nudged");
    } finally {
      fixture.cleanup();
    }
  });
});
