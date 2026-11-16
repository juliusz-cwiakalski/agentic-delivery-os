/**
 * TC-ACTION-028 — bounded output: the list `data` stays within 65,536 UTF-8
 * bytes with marked truncation and counted omissions, free text is bounded with
 * a refusal naming the bound, and in-bounds text is stored unnormalized (NFR-2).
 */
import { describe, expect, test } from "bun:test";
import {
  ACTION_FREE_TEXT_BOUNDS,
  ACTION_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { closeAction, fileAction, listActions } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const bytesOf = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

describe("TC-ACTION-028 bounds are measured, never assumed", () => {
  test("the small control's measured byte length is positive and untruncated", () => {
    const fixture = makeActionStore("bounds-control");
    try {
      expect(fileAction(fixture.store, conformingDraft(), { filedAt: FILING_MS }).ok).toBe(true);
      const listed = listActions(fixture.store, FILING_MS);
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      expect(bytesOf(listed.data)).toBeGreaterThan(0);
      expect((listed.data as { truncated: boolean }).truncated).toBe(false);
      expect((listed.data as { omitted: number }).omitted).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });

  test("a large list stays within the byte cap and counts every dropped row", () => {
    const fixture = makeActionStore("bounds-large");
    try {
      for (let index = 0; index < 60; index += 1) {
        expect(
          fileAction(
            fixture.store,
            conformingDraft({
              window: `window-${String(index % 20)}`,
              measurableOutcome: `${"x".repeat(300)}-${String(index)}`,
              rollbackCondition: `${"y".repeat(300)}-${String(index)}`,
            }),
            { actionId: `action-${String(index).padStart(3, "0")}`, filedAt: FILING_MS },
          ).ok,
        ).toBe(true);
      }
      const listed = listActions(fixture.store, FILING_MS);
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      const data = listed.data as {
        readonly actions: readonly unknown[];
        readonly truncated: boolean;
        readonly omitted: number;
      };
      expect(bytesOf(data)).toBeLessThanOrEqual(ACTION_MAX_MACHINE_BYTES);
      expect(data.actions.length + data.omitted).toBe(60);
      expect(data.truncated).toBe(data.omitted > 0);
    } finally {
      fixture.cleanup();
    }
  });

  test("over-long free text is refused naming the bound, never silently clipped", () => {
    const fixture = makeActionStore("bounds-text");
    try {
      const overLong = "z".repeat(ACTION_FREE_TEXT_BOUNDS.measurableOutcome + 1);
      const filing = fileAction(fixture.store, conformingDraft({ measurableOutcome: overLong }));
      expect(filing.ok).toBe(false);
      if (!filing.ok) {
        expect(filing.error.code).toBe("retro.action-incomplete");
        expect(filing.error.location?.field).toBe("measurableOutcome");
        expect(filing.error.summary).toContain(String(ACTION_FREE_TEXT_BOUNDS.measurableOutcome));
      }
      expect(fileAction(fixture.store, conformingDraft(), { actionId: "action-close" }).ok).toBe(
        true,
      );
      const reason = "r".repeat(ACTION_FREE_TEXT_BOUNDS.closureReason + 1);
      const closing = closeAction(
        fixture.store,
        { actionId: "action-close", route: "deprioritized", decision: "d", reason },
        { nowMs: FILING_MS },
      );
      expect(closing.ok).toBe(false);
      if (!closing.ok) {
        expect(closing.error.code).toBe("retro.closure-incomplete");
        expect(closing.error.location?.field).toBe("reason");
      }
    } finally {
      fixture.cleanup();
    }
  });

  test("in-bounds free text is stored byte-identically (no normalization)", () => {
    const fixture = makeActionStore("bounds-unmodified");
    try {
      const outcome = "  Keep    spacing and Case  ";
      expect(fileAction(fixture.store, conformingDraft({ measurableOutcome: outcome })).ok).toBe(
        true,
      );
      const listed = listActions(fixture.store, FILING_MS);
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      const rows = (listed.data as { actions: readonly { measurableOutcome: string }[] }).actions;
      expect(rows[0]?.measurableOutcome).toBe(outcome);
    } finally {
      fixture.cleanup();
    }
  });
});
