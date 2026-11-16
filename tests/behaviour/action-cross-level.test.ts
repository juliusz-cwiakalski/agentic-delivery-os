/**
 * TC-ACTION-024 — one registry serves every retro level: the same record kind,
 * prefix, contract, aging, closure discipline, and refusal identities with no
 * per-level fork; R6 stays declared-but-unscheduled (AC-F7-2).
 */
import { describe, expect, test } from "bun:test";
import {
  RETRO_ACTION_RECORD_KIND,
  RETRO_LEVEL_NAMES,
  RETRO_LEVELS,
} from "../../packages/core/src/contracts/index";
import { evaluateActionAging } from "../../packages/core/src/domain/action-aging";
import { conformingDraft } from "../fixtures/action/builders";
import { clockAtDaysOpen, FILING_MS } from "../fixtures/action/clock";
import { actionSnapshot, closeAction, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const SERVED_LEVELS = ["change", "session", "incident", "window", "project"] as const;

describe("TC-ACTION-024 every level shares one registry and one discipline", () => {
  test("one conforming action per level lands under the same kind and prefix", () => {
    const fixture = makeActionStore("cross-level");
    try {
      for (const level of SERVED_LEVELS) {
        expect(
          fileAction(fixture.store, conformingDraft({ level, window: `window-${level}` }), {
            actionId: `action-${level}`,
            filedAt: FILING_MS,
          }).ok,
          level,
        ).toBe(true);
      }
      const records = fixture.store.readRecords();
      expect(records.ok).toBe(true);
      if (!records.ok) return;
      const actionRecords = records.value.records.filter(
        (record) => record.kind === RETRO_ACTION_RECORD_KIND,
      );
      expect(actionRecords).toHaveLength(SERVED_LEVELS.length);
      for (const record of actionRecords) {
        expect(record.key.startsWith("retro.actions:")).toBe(true);
      }
      expect(actionSnapshot(fixture.store).actions.map((action) => action.level)).toEqual([
        ...SERVED_LEVELS,
      ]);
    } finally {
      fixture.cleanup();
    }
  });

  test("aging and closure semantics are identical for every level", () => {
    const fixture = makeActionStore("cross-level-semantics");
    try {
      for (const level of SERVED_LEVELS) {
        expect(
          fileAction(fixture.store, conformingDraft({ level, window: `window-${level}` }), {
            actionId: `action-${level}`,
            filedAt: FILING_MS,
          }).ok,
        ).toBe(true);
        const close = closeAction(
          fixture.store,
          {
            actionId: `action-${level}`,
            route: "deprioritized",
            decision: `decision-${level}`,
            reason: "not pursued",
          },
          { nowMs: clockAtDaysOpen(14) },
        );
        expect(close.ok, level).toBe(true);
        if (close.ok && "outcomeClosure" in close.data) {
          expect(close.data.outcomeClosure).toBe("closed");
        }
      }
      const snapshot = actionSnapshot(fixture.store);
      for (const action of snapshot.actions) {
        expect(evaluateActionAging(action, clockAtDaysOpen(14)).state).toBe("nudged");
        expect(
          snapshot.closures.find((closure) => closure.actionId === action.actionId)?.route,
        ).toBe("deprioritized");
      }
    } finally {
      fixture.cleanup();
    }
  });

  test("the same refusal identity applies regardless of level", () => {
    for (const level of SERVED_LEVELS) {
      const fixture = makeActionStore(`cross-level-refusal-${level}`);
      try {
        const outcome = fileAction(
          fixture.store,
          conformingDraft({ level, measurableOutcome: undefined }),
        );
        expect(outcome.ok, level).toBe(false);
        if (!outcome.ok) expect(outcome.error.code).toBe("retro.action-incomplete");
        expect(actionSnapshot(fixture.store).actions).toHaveLength(0);
      } finally {
        fixture.cleanup();
      }
    }
  });

  test("the level vocabulary has one home and R6 stays declared-but-unscheduled", () => {
    expect([...RETRO_LEVEL_NAMES]).toEqual([
      "change",
      "session",
      "incident",
      "window",
      "project",
      "fleet",
    ]);
    const fleet = RETRO_LEVELS.find((level) => level.name === "fleet");
    expect(fleet?.status).toBe("declared");
    expect(fleet?.id).toBe("R6");
  });
});
