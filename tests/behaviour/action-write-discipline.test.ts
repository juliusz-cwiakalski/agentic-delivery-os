/**
 * TC-ACTION-029 — fenced-write discipline: exactly one append per explicit
 * invocation, zero appends on list/board/report, no update-in-place or delete,
 * and a torn append classifies leaving the store consistent (NFR-5, §21).
 */
import { describe, expect, test } from "bun:test";
import type { StateStorePort } from "../../packages/core/src/contracts/index";
import { conformingDraft } from "../fixtures/action/builders";
import { FILING_MS } from "../fixtures/action/clock";
import { runActionCli } from "../fixtures/action/run";
import { closeAction, fileAction } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

type Counter = { appends: number; reads: number; fences: number };

const counted = (store: StateStorePort): { store: StateStorePort; counts: Counter } => {
  const counts: Counter = { appends: 0, reads: 0, fences: 0 };
  const wrapped = {
    ...store,
    readRecords: () => {
      counts.reads += 1;
      return store.readRecords();
    },
    acquireFence: (token: string) => {
      counts.fences += 1;
      return store.acquireFence(token);
    },
    append: (
      handle: Parameters<StateStorePort["append"]>[0],
      request: Parameters<StateStorePort["append"]>[1],
    ) => {
      counts.appends += 1;
      return store.append(handle, request);
    },
  } as StateStorePort;
  return { store: wrapped, counts };
};

describe("TC-ACTION-029 writes are explicit and fenced", () => {
  test("file and close each append exactly once; list appends nothing", async () => {
    const fixture = makeActionStore("write-discipline");
    try {
      const filing = counted(fixture.store);
      expect(
        fileAction(filing.store, conformingDraft(), {
          actionId: "action-write",
          filedAt: FILING_MS,
        }).ok,
      ).toBe(true);
      expect(filing.counts.appends).toBe(1);
      expect(filing.counts.fences).toBe(1);

      const closing = counted(fixture.store);
      expect(
        closeAction(
          closing.store,
          { actionId: "action-write", route: "done", decision: "d", artifact: "artifact:x" },
          { nowMs: FILING_MS },
        ).ok,
      ).toBe(true);
      expect(closing.counts.appends).toBe(1);

      const reading = counted(fixture.store);
      const listed = await runActionCli(["retro", "action", "list", "--json"], reading.store);
      expect(listed.exitCode).toBe(0);
      expect(reading.counts.appends).toBe(0);
      const reported = await runActionCli(["retro", "report", "--json"], reading.store);
      expect(reported.exitCode).toBe(0);
      expect(reading.counts.appends).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });

  test("the store exposes no update-in-place or delete path", () => {
    const fixture = makeActionStore("write-no-delete");
    try {
      const methods = Object.keys(fixture.store);
      expect(methods).not.toContain("update");
      expect(methods).not.toContain("delete");
      expect(methods).not.toContain("removeRecord");
    } finally {
      fixture.cleanup();
    }
  });

  test("a torn append classifies and leaves the store consistent", () => {
    const fixture = makeActionStore("write-torn");
    try {
      expect(fileAction(fixture.store, conformingDraft(), { filedAt: FILING_MS }).ok).toBe(true);
      fixture.edge.arm(["append-before-flush"]);
      const torn = fileAction(fixture.store, conformingDraft(), { actionId: "action-torn" });
      fixture.edge.disarm();
      expect(torn.ok).toBe(false);
      if (!torn.ok) expect(torn.error.code.startsWith("state.")).toBe(true);
      const read = fixture.store.readRecords();
      expect(read.ok).toBe(true);
      if (read.ok) {
        // No partial record: the torn append lands nothing, and the earlier
        // record is intact and readable.
        expect(
          read.value.records.filter((record) => record.key === "retro.actions:action-torn"),
        ).toHaveLength(0);
        expect(read.value.records.filter((record) => record.kind === "retro.action")).toHaveLength(
          1,
        );
      }
    } finally {
      fixture.cleanup();
    }
  });
});
