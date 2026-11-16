/**
 * TC-ACTION-014..016 — the improvement WIP limit: a fourth filing into a full
 * window is refused naming window, count, and limit; counts are derived from
 * the records; and the count/limit disclosure is in-band (AC-F5-1, DM-5, DEC-6).
 */
import { describe, expect, test } from "bun:test";
import { ACTION_WIP_LIMIT } from "../../packages/core/src/contracts/index";
import { actionWindowEntries } from "../../packages/core/src/domain/action-filing";
import { windowDisclosure, windowDisclosures } from "../../packages/core/src/domain/action-window";
import { conformingDraft } from "../fixtures/action/builders";
import { actionSnapshot, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const seedFullWindow = (store: ReturnType<typeof makeActionStore>["store"]) => {
  for (let index = 0; index < ACTION_WIP_LIMIT; index += 1) {
    const outcome = fileAction(store, conformingDraft({ window: "window-full" }), {
      actionId: `action-full-${String(index)}`,
    });
    expect(outcome.ok).toBe(true);
  }
};

describe("TC-ACTION-014 the limit is a refusal", () => {
  test("a fourth filing into a full window is refused naming window, count, and limit", () => {
    const fixture = makeActionStore("wip-refusal");
    try {
      seedFullWindow(fixture.store);
      const before = actionSnapshot(fixture.store);
      expect(before.actions).toHaveLength(ACTION_WIP_LIMIT);

      const outcome = fileAction(fixture.store, conformingDraft({ window: "window-full" }), {
        actionId: "action-excess",
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error.code).toBe("retro.wip-limit-exceeded");
        expect(outcome.error.location?.window).toBe("window-full");
        expect(outcome.error.location?.openCount).toBe(ACTION_WIP_LIMIT);
        expect(outcome.error.location?.limit).toBe(ACTION_WIP_LIMIT);
        expect(outcome.error.summary).toContain("window-full");
        expect(outcome.error.summary).toContain(String(ACTION_WIP_LIMIT));
      }
      const after = actionSnapshot(fixture.store);
      expect(after.actions).toHaveLength(ACTION_WIP_LIMIT);
      expect(after.actions.map((entry) => entry.actionId)).not.toContain("action-excess");
    } finally {
      fixture.cleanup();
    }
  });

  test("a window with two open actions accepts its third (paired control)", () => {
    const fixture = makeActionStore("wip-control");
    try {
      expect(fileAction(fixture.store, conformingDraft({ window: "window-control" })).ok).toBe(
        true,
      );
      expect(fileAction(fixture.store, conformingDraft({ window: "window-control" })).ok).toBe(
        true,
      );
      const third = fileAction(fixture.store, conformingDraft({ window: "window-control" }));
      expect(third.ok).toBe(true);
      expect(actionSnapshot(fixture.store).actions).toHaveLength(3);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-015 counts derive from the records", () => {
  test("the open count is derived from the recorded actions, not a stored counter", () => {
    const fixture = makeActionStore("wip-derived");
    try {
      seedFullWindow(fixture.store);
      expect(fileAction(fixture.store, conformingDraft({ window: "window-other" })).ok).toBe(true);
      const snapshot = actionSnapshot(fixture.store);
      const entries = actionWindowEntries(snapshot);
      expect(entries.filter((entry) => entry.window === "window-full").length).toBe(
        ACTION_WIP_LIMIT,
      );
      const disclosures = windowDisclosures(entries);
      expect(disclosures).toEqual([
        {
          window: "window-full",
          openCount: ACTION_WIP_LIMIT,
          limit: ACTION_WIP_LIMIT,
        },
        { window: "window-other", openCount: 1, limit: ACTION_WIP_LIMIT },
      ]);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-016 the disclosure is in-band wherever a window is reported", () => {
  test("a full window and a one-action window both disclose count and limit", () => {
    const fixture = makeActionStore("wip-disclosure");
    try {
      seedFullWindow(fixture.store);
      expect(fileAction(fixture.store, conformingDraft({ window: "window-single" })).ok).toBe(true);
      const entries = actionWindowEntries(actionSnapshot(fixture.store));
      for (const window of ["window-full", "window-single"]) {
        const disclosure = windowDisclosure(entries, window);
        expect(disclosure.limit).toBe(ACTION_WIP_LIMIT);
        expect(disclosure.openCount).toBe(window === "window-full" ? 3 : 1);
      }
    } finally {
      fixture.cleanup();
    }
  });

  test("a window with zero open actions still discloses count 0 and the limit", () => {
    const fixture = makeActionStore("wip-zero");
    try {
      const entries = actionWindowEntries(actionSnapshot(fixture.store));
      expect(windowDisclosure(entries, "window-empty")).toEqual({
        window: "window-empty",
        openCount: 0,
        limit: ACTION_WIP_LIMIT,
      });
    } finally {
      fixture.cleanup();
    }
  });
});
