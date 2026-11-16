/**
 * TC-CEREMONY-026 (one missed window replayed exactly once), TC-CEREMONY-027
 * (nothing missed appends zero), TC-CEREMONY-028 (`mode: none` declared gap),
 * TC-CEREMONY-029 (the catch-up matrix), and TC-CEREMONY-065 (an explicitly-run
 * window is satisfied and never consumes the single replay slot).
 */
import { describe, expect, test } from "bun:test";
import type { CeremonyDeclaration } from "../../packages/core/src/contracts/index";
import { catchUpCeremonies, runCeremony } from "../../packages/core/src/domain/index";
import { readCeremonyRuns } from "../../packages/core/src/state/index";
import { makeEngineHarness } from "../fixtures/ceremony/engine";
import { readFixture, withPath } from "../fixtures/ceremony/declarations";
import { NOW_MS } from "../fixtures/ceremony/state";

const daily = (): CeremonyDeclaration =>
  readFixture("valid-note-less-scheduled.json") as unknown as CeremonyDeclaration;

const dailyWindow = (day: number) => ({
  start: new Date(Date.UTC(2026, 10, day, 0, 0, 0, 0)).toISOString(),
  end: new Date(Date.UTC(2026, 10, day, 23, 59, 59, 999)).toISOString(),
});

const recordCount = (harness: ReturnType<typeof makeEngineHarness>): number => {
  const read = harness.store.readRecords();
  return read.ok ? read.value.records.length : -1;
};

describe("TC-CEREMONY-026 a missed window is replayed exactly once", () => {
  test("one catch-up labels the run catch-up with the missed bounds, then appends nothing", () => {
    const harness = makeEngineHarness();
    try {
      const target = { declaration: daily(), scopeKey: harness.env.repositoryId };
      const first = catchUpCeremonies({
        targets: [target],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
        lookbackWindows: 1,
      });
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.data.outcome).toBe("caught-up");
      expect(first.data.appendedRuns).toBe(1);
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (!runs.ok) return;
      expect(runs.value.records).toHaveLength(1);
      expect(runs.value.records[0]?.trigger).toMatchObject({
        kind: "catch-up",
        resolution: "declaration",
        declaredWindow: dailyWindow(15),
        actualWindow: dailyWindow(15),
        catchUp: true,
      });
      const before = recordCount(harness);
      const second = catchUpCeremonies({
        targets: [target],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
        lookbackWindows: 1,
      });
      expect(second.ok).toBe(true);
      if (second.ok) {
        expect(second.data.outcome).toBe("nothing-missed");
        expect(second.data.appendedRuns).toBe(0);
      }
      expect(recordCount(harness)).toBe(before);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-027 nothing missed appends zero and exits clean", () => {
  test("a recorded due window makes the next catch-up a no-miss", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = daily();
      const run = runCeremony({
        declaration,
        env: harness.env,
        noteSupplied: false,
        window: dailyWindow(15),
        apply: false,
      });
      expect(run.ok).toBe(true);
      const before = recordCount(harness);
      const report = catchUpCeremonies({
        targets: [{ declaration, scopeKey: harness.env.repositoryId }],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
        lookbackWindows: 1,
      });
      expect(report.ok).toBe(true);
      if (report.ok) {
        expect(report.data.outcome).toBe("nothing-missed");
        expect(report.data.appendedRuns).toBe(0);
        expect(report.data.ceremonies[0]?.satisfiedWindows).toEqual([dailyWindow(15)]);
      }
      expect(recordCount(harness)).toBe(before);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-028 catchUp.mode none reports a declared gap with no run", () => {
  test("the missed window is a gap with its bounds and nothing executes", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = withPath(readFixture("valid-note-less-scheduled.json"), "catchUp", {
        mode: "none",
        maxMissedWindows: 1,
      }) as unknown as CeremonyDeclaration;
      const before = recordCount(harness);
      const report = catchUpCeremonies({
        targets: [{ declaration, scopeKey: harness.env.repositoryId }],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
        lookbackWindows: 1,
      });
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      expect(report.data.outcome).toBe("declared-gap");
      expect(report.data.appendedRuns).toBe(0);
      expect(report.data.ceremonies[0]).toMatchObject({
        disposition: "declared-gap",
        window: dailyWindow(15),
      });
      expect(recordCount(harness)).toBe(before);
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-029 the catch-up matrix", () => {
  test("several missed windows replay the oldest once and report the remainder", () => {
    const harness = makeEngineHarness();
    try {
      const report = catchUpCeremonies({
        targets: [{ declaration: daily(), scopeKey: harness.env.repositoryId }],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
        lookbackWindows: 3,
      });
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      expect(report.data.appendedRuns).toBe(1);
      expect(report.data.ceremonies[0]?.disposition).toBe("still-missed");
      expect(report.data.ceremonies[0]?.window).toEqual(dailyWindow(13));
      expect(report.data.ceremonies[0]?.missedWindows).toEqual([dailyWindow(14), dailyWindow(15)]);
    } finally {
      harness.dispose();
    }
  });

  test("an event-triggered ceremony records a declared gap, not an invented window", () => {
    const harness = makeEngineHarness();
    try {
      const report = catchUpCeremonies({
        targets: [
          {
            declaration: readFixture(
              "valid-note-less-event.json",
            ) as unknown as CeremonyDeclaration,
            scopeKey: harness.env.repositoryId,
          },
        ],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
      });
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      expect(report.data.outcome).toBe("declared-gap");
      expect(report.data.ceremonies[0]?.reason).toContain("event-triggered");
      expect(report.data.appendedRuns).toBe(0);
    } finally {
      harness.dispose();
    }
  });

  test("a removed declaration keeps its history readable and reports a declared gap", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = daily();
      const run = runCeremony({
        declaration,
        env: harness.env,
        noteSupplied: false,
        window: dailyWindow(15),
        apply: false,
      });
      expect(run.ok).toBe(true);
      const report = catchUpCeremonies({
        targets: [],
        removed: [{ ceremonyId: declaration.id, recordedRuns: 1 }],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
      });
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      expect(report.data.ceremonies[0]?.disposition).toBe("declared-gap");
      expect(report.data.ceremonies[0]?.reason).toContain("removed");
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (runs.ok) expect(runs.value.records).toHaveLength(1);
    } finally {
      harness.dispose();
    }
  });

  test("a zero look-back is the current/no-miss control", () => {
    const harness = makeEngineHarness();
    try {
      const report = catchUpCeremonies({
        targets: [{ declaration: daily(), scopeKey: harness.env.repositoryId }],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
        lookbackWindows: 0,
      });
      expect(report.ok).toBe(true);
      if (report.ok) {
        expect(report.data.outcome).toBe("nothing-missed");
        expect(report.data.appendedRuns).toBe(0);
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-065 an occupied identity is satisfied and frees the replay slot", () => {
  test("an explicitly-run window is not replayed and the different missed window is caught up", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = daily();
      const explicit = runCeremony({
        declaration,
        env: harness.env,
        noteSupplied: false,
        window: dailyWindow(15),
        apply: false,
      });
      expect(explicit.ok).toBe(true);
      const report = catchUpCeremonies({
        targets: [{ declaration, scopeKey: harness.env.repositoryId }],
        env: harness.env,
        nowMs: NOW_MS,
        apply: false,
        lookbackWindows: 2,
      });
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      expect(report.data.appendedRuns).toBe(1);
      const entry = report.data.ceremonies[0];
      expect(entry?.satisfiedWindows).toEqual([dailyWindow(15)]);
      expect(entry?.window).toEqual(dailyWindow(14));
      expect(entry?.missedWindows).toEqual([]);
      expect(entry?.disposition).toBe("caught-up");
      const runs = readCeremonyRuns(harness.store);
      expect(runs.ok).toBe(true);
      if (!runs.ok) return;
      expect(runs.value.records).toHaveLength(2);
      const occupied = runs.value.records.find(
        (run) => run.trigger.actualWindow.start === dailyWindow(15).start,
      );
      expect(occupied?.trigger.kind).toBe("explicit");
      expect(occupied?.trigger.resolution).toBe("declaration");
      const replayed = runs.value.records.find(
        (run) => run.trigger.actualWindow.start === dailyWindow(14).start,
      );
      expect(replayed?.trigger.kind).toBe("catch-up");
    } finally {
      harness.dispose();
    }
  });
});
