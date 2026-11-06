/**
 * TC-RETRO-038 — deterministic replays with zero ambient reads and zero model
 * calls in the report render path.
 */
import { describe, expect, test } from "bun:test";
import { collectRetro, reportRetro } from "../../packages/core/src/domain/retro";
import {
  auditOutcome,
  auditRecord,
  collectDeps,
  makeRetroDir,
  reportDeps,
  transitionRecord,
} from "../fixtures/retro/harness";

describe("TC-RETRO-038 report determinism", () => {
  test("three replays are byte-identical under throwing ambient stubs", () => {
    const fixture = makeRetroDir("report-determinism");
    fixture.scriptDeliveryChanges([
      {
        changeRef: "GH-232",
        completedAt: "2026-11-06T12:00:00Z",
        transitions: [transitionRecord({ changeRef: "GH-232", timestamp: "2026-11-06T12:00:00Z" })],
      },
    ]);
    fixture.scriptAudit(
      auditOutcome({
        records: [auditRecord()],
        orphans: [{ auditSeq: 2, runId: "orphan", position: 2 }],
      }),
    );
    fixture.scriptStateFamilies("GH-232", {
      transitions: [transitionRecord({ changeRef: "GH-232" })],
      closeouts: [{ outcome: "complete" }],
      telemetry: [],
    });
    fixture.scriptNotes("GH-232", { retroNotes: ["deterministic note"] });
    expect(collectRetro(collectDeps(fixture)).ok).toBe(true);

    const originalNow = Date.now;
    const originalRandom = Math.random;
    const originalFetch = globalThis.fetch;
    Date.now = () => {
      throw new Error("ambient clock read");
    };
    Math.random = () => {
      throw new Error("ambient randomness read");
    };
    globalThis.fetch = (() => {
      throw new Error("network read");
    }) as typeof fetch;
    try {
      const first = reportRetro(reportDeps(fixture));
      const second = reportRetro(reportDeps(fixture));
      const third = reportRetro(reportDeps(fixture));
      expect(first.ok).toBe(true);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(JSON.stringify(second)).toBe(JSON.stringify(third));
    } finally {
      Date.now = originalNow;
      Math.random = originalRandom;
      globalThis.fetch = originalFetch;
    }
  });
});
