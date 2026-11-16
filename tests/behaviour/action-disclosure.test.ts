/**
 * TC-ACTION-035 (disclosure half) — every refusal names the specific member (or
 * the plane and its existing closure), and aging state, window counts, and WIP
 * limits render in-band on every surface (AC-F1-2, AC-F3-1, AC-F4-1, AC-F4-5,
 * AC-F5-1, §10, DEC-8, DEC-11).
 */
import { describe, expect, test } from "bun:test";
import { ACTION_WIP_LIMIT } from "../../packages/core/src/contracts/index";
import { conformingDraft } from "../fixtures/action/builders";
import { clockAtDaysOpen, FILING_MS } from "../fixtures/action/clock";
import { runActionCli } from "../fixtures/action/run";
import { actionSnapshot, closeAction, fileAction, listActions } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const summaryOf = (stdout: string): string => {
  const parsed = JSON.parse(stdout.trim()) as { readonly error?: { readonly summary?: string } };
  return parsed.error?.summary ?? "";
};
const codeOf = (stdout: string): string => {
  const parsed = JSON.parse(stdout.trim()) as { readonly error?: { readonly code?: string } };
  return parsed.error?.code ?? "";
};

describe("TC-ACTION-035 refusals name the specific member", () => {
  test("filing, closure, WIP, and state-conflict refusals each disclose their detail", async () => {
    const fixture = makeActionStore("disclosure");
    try {
      const filing = await runActionCli(
        ["retro", "action", "file", "--owner-kind", "agent-role", "--json"],
        fixture.store,
      );
      expect(codeOf(filing.stdout)).toBe("retro.action-incomplete");
      expect(summaryOf(filing.stdout)).toContain("owner");

      expect(
        fileAction(fixture.store, conformingDraft({ window: "window-close" }), {
          actionId: "action-fixed",
          filedAt: FILING_MS,
        }).ok,
      ).toBe(true);
      const closure = await runActionCli(
        ["retro", "action", "close", "--action", "action-fixed", "--json"],
        fixture.store,
      );
      expect(codeOf(closure.stdout)).toBe("retro.closure-incomplete");
      expect(summaryOf(closure.stdout)).toContain("decision");

      for (let index = 0; index < ACTION_WIP_LIMIT; index += 1) {
        expect(
          fileAction(fixture.store, conformingDraft({ window: "window-full" }), {
            actionId: `action-${String(index)}`,
            filedAt: FILING_MS,
          }).ok,
        ).toBe(true);
      }
      const wip = await runActionCli(
        [
          "retro",
          "action",
          "file",
          "--owner-kind",
          "agent-role",
          "--owner",
          "agent-role:reviewer",
          "--verb",
          "add",
          "--outcome",
          "an outcome",
          "--tracker",
          "GH-287",
          "--due",
          "2026-11-30T00:00:00Z",
          "--artifact",
          "artifact:x",
          "--outcome-evidence",
          "metric:x",
          "--outcome-window",
          "2026-12-01T00:00:00Z..2026-12-15T00:00:00Z",
          "--rollback",
          "revert",
          "--window",
          "window-full",
          "--json",
        ],
        fixture.store,
      );
      expect(codeOf(wip.stdout)).toBe("retro.wip-limit-exceeded");
      expect(summaryOf(wip.stdout)).toContain("window-full");
      expect(summaryOf(wip.stdout)).toContain(String(ACTION_WIP_LIMIT));

      expect(
        closeAction(
          fixture.store,
          { actionId: "action-0", route: "done", decision: "d1", artifact: "artifact:x" },
          { nowMs: FILING_MS, closureId: "closure-first" },
        ).ok,
      ).toBe(true);
      const conflict = await runActionCli(
        [
          "retro",
          "action",
          "close",
          "--action",
          "action-0",
          "--route",
          "done",
          "--decision",
          "d2",
          "--artifact",
          "artifact:y",
          "--json",
        ],
        fixture.store,
      );
      expect(codeOf(conflict.stdout)).toBe("retro.closure-incomplete");
      expect(summaryOf(conflict.stdout)).toContain("artifact plane");
      expect(summaryOf(conflict.stdout)).toContain("closure-first");
    } finally {
      fixture.cleanup();
    }
  });

  test("aging state and window count/limit render in-band on the list surface", () => {
    const fixture = makeActionStore("disclosure-inband");
    try {
      expect(
        fileAction(fixture.store, conformingDraft({ window: "window-a" }), {
          actionId: "action-nudge",
          filedAt: FILING_MS,
        }).ok,
      ).toBe(true);
      const listed = listAt(fixture.store, clockAtDaysOpen(14));
      const data = listed.data as {
        readonly actions: readonly { readonly agingState: string }[];
        readonly windows: readonly {
          readonly window: string;
          readonly openCount: number;
          readonly limit: number;
        }[];
      };
      expect(data.actions[0]?.agingState).toBe("nudged");
      expect(data.windows).toEqual([{ window: "window-a", openCount: 1, limit: ACTION_WIP_LIMIT }]);
      expect(actionSnapshot(fixture.store).actions).toHaveLength(1);
    } finally {
      fixture.cleanup();
    }
  });
});

const listAt = (
  store: ReturnType<typeof makeActionStore>["store"],
  nowMs: number,
): { readonly ok: boolean; readonly data: unknown } => {
  const outcome = listActions(store, nowMs);
  return outcome.ok ? { ok: true, data: outcome.data } : { ok: false, data: undefined };
};
